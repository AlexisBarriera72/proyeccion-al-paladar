// The mutation ledger: deduplication and auditing inside one transaction.
//
// Every write carries a mutation ID bound to (action, target_type, target_id, actor,
// expected_version, payload_hash). One D1 batch — a transaction — runs:
//   1. claim:   INSERT the ledger row as 'claimed' (ON CONFLICT DO NOTHING leaves any
//               existing row, settled or not, untouched);
//   2. writes:  the action's conditional statements, each requiring the claimed row with the
//               complete binding;
//   3. settle applied:  only a row still 'claimed', with the complete binding, whose target
//               now carries this mutation;
//   4. settle rejected: only a row still 'claimed', with the complete binding;
//   5. audit:   one row per applied mutation (unique mutation_id).
// A settled row is never updated again: steps 3 and 4 require state = 'claimed', and the
// migration's triggers abort any update of a settled row or of a binding column. A 'claimed'
// row never outlives its batch, because a failed batch keeps nothing. After commit the
// Worker only reads the row to answer; no correctness depends on that read.
import {raw, sql, type Sql} from './sql.ts';
import {first, statement, type Db} from './db.ts';

export type TargetType =
  'session' | 'booking' | 'request' | 'experience' | 'venue' | 'policy' | 'setting' | 'staff' | 'database';

export interface Binding {
  mutationId: string;
  action: string;
  targetType: TargetType;
  targetId: string;
  actor: string;
  expectedVersion: number | null;
  payloadHash: string;
}

/** What an action contributes to the batch (see worker/rules.ts). */
export interface ActionSpec {
  /** Scalar JSON of the target: "before" at claim time, "after" in the audit row. */
  snapshot: Sql;
  /** The action's statements. Each must include `guard` in its WHERE. */
  writes: (guard: Sql) => Sql[];
  /** True when the target now carries this mutation (the write applied). */
  appliedWhen: Sql;
  /** The code of the first failing check, evaluated when nothing applied. */
  rejectReason: Sql;
  /** Scalar JSON returned to the caller when applied. */
  outcome: Sql;
}

export interface LedgerRow {
  mutation_id: string;
  action: string;
  target_type: string;
  target_id: string;
  actor: string;
  expected_version: number | null;
  payload_hash: string;
  state: 'claimed' | 'applied' | 'rejected';
  reason: string | null;
  before_json: string | null;
  outcome_json: string | null;
  created_at: number;
}

export type MutationResult =
  | {kind: 'applied'; outcome: Record<string, unknown> | null; replayed: boolean}
  | {kind: 'rejected'; reason: string; replayed: boolean}
  | {kind: 'conflict'} // the ID was used with a different binding; nothing was written
  | {kind: 'error'; error: string}; // the batch failed and was rolled back

/** The complete binding, for a ledger row under `alias`. */
export function bindingMatches(alias: string, binding: Binding): Sql {
  const a = raw(alias);
  return sql`${a}.action = ${binding.action} AND ${a}.target_type = ${binding.targetType}
    AND ${a}.target_id = ${binding.targetId} AND ${a}.actor = ${binding.actor}
    AND ${a}.expected_version IS ${binding.expectedVersion} AND ${a}.payload_hash = ${binding.payloadHash}`;
}

/** Every write in the batch requires this: the ledger row claimed by this batch, fully bound. */
export function claimGuard(binding: Binding): Sql {
  return sql`EXISTS (SELECT 1 FROM mutations mg WHERE mg.mutation_id = ${binding.mutationId}
    AND mg.state = 'claimed' AND ${bindingMatches('mg', binding)})`;
}

/** The batch for one mutation, in order. Exported for tests. */
export function mutationStatements(binding: Binding, spec: ActionSpec, now: number): Sql[] {
  const guard = claimGuard(binding);
  return [
    sql`INSERT INTO mutations (mutation_id, action, target_type, target_id, actor, expected_version, payload_hash,
        state, before_json, created_at)
      VALUES (${binding.mutationId}, ${binding.action}, ${binding.targetType}, ${binding.targetId}, ${binding.actor},
        ${binding.expectedVersion}, ${binding.payloadHash}, 'claimed', ${spec.snapshot}, ${now})
      ON CONFLICT (mutation_id) DO NOTHING`,
    ...spec.writes(guard),
    sql`UPDATE mutations SET state = 'applied', outcome_json = ${spec.outcome}
      WHERE mutation_id = ${binding.mutationId} AND state = 'claimed' AND ${bindingMatches('mutations', binding)}
        AND ${spec.appliedWhen}`,
    sql`UPDATE mutations SET state = 'rejected', reason = ${spec.rejectReason},
        outcome_json = json_object('reason', ${spec.rejectReason})
      WHERE mutation_id = ${binding.mutationId} AND state = 'claimed' AND ${bindingMatches('mutations', binding)}`,
    sql`INSERT INTO audit_events (mutation_id, actor, action, target_type, target_id, before_json, after_json, at)
      SELECT m.mutation_id, m.actor, m.action, m.target_type, m.target_id, m.before_json, ${spec.snapshot}, ${now}
      FROM mutations AS m
      WHERE m.mutation_id = ${binding.mutationId} AND m.state = 'applied' AND ${bindingMatches('m', binding)}
      ON CONFLICT (mutation_id) DO NOTHING`,
  ];
}

const sameBinding = (row: LedgerRow, binding: Binding) =>
  row.action === binding.action &&
  row.target_type === binding.targetType &&
  row.target_id === binding.targetId &&
  row.actor === binding.actor &&
  (row.expected_version ?? null) === binding.expectedVersion &&
  row.payload_hash === binding.payloadHash;

/**
 * Runs one mutation. The spec is built from the binding's own mutation ID, so the claim, the
 * writes' `last_mutation_id` and the settle checks can never disagree about it.
 */
export async function runMutation(
  db: Db,
  binding: Binding,
  makeSpec: (mutationId: string) => ActionSpec,
  now: number,
): Promise<MutationResult> {
  const spec = makeSpec(binding.mutationId);
  // Informational only (the `replayed` flag); no decision depends on this read.
  const existing = await readLedger(db, binding.mutationId);
  try {
    await db.batch(mutationStatements(binding, spec, now).map(query => statement(db, query)));
  } catch (error) {
    return {kind: 'error', error: error instanceof Error ? error.message : String(error)};
  }
  const row = await readLedger(db, binding.mutationId);
  if (!row || !sameBinding(row, binding)) return {kind: 'conflict'};
  // Replayed: the row was already settled before this request (nothing was written now).
  const replayed = existing?.state === row.state && existing.state !== 'claimed';
  if (row.state === 'applied') return {kind: 'applied', outcome: parse(row.outcome_json), replayed};
  return {kind: 'rejected', reason: row.reason ?? 'rejected', replayed};
}

export const readLedger = (db: Db, mutationId: string) =>
  first<LedgerRow>(db, sql`SELECT * FROM mutations WHERE mutation_id = ${mutationId}`);

function parse(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** SHA-256 of a canonical JSON payload (sorted keys), as hex. */
export async function payloadHash(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
