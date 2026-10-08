// Shared write path for the HTTP handlers: binding, ledger, and the HTTP answer.
import {payloadHash, runMutation, type ActionSpec, type Binding, type MutationResult} from './ledger.ts';
import {error, json} from './http.ts';
import type {Db} from './db.ts';

export interface WriteRequest {
  db: Db;
  mutationId: string;
  action: string;
  targetType: Binding['targetType'];
  targetId: string;
  actor: string;
  expectedVersion: number | null;
  payload: unknown;
  now: number;
  makeSpec: (mutationId: string) => ActionSpec;
}

export async function write(request: WriteRequest): Promise<MutationResult> {
  const binding: Binding = {
    mutationId: request.mutationId,
    action: request.action,
    targetType: request.targetType,
    targetId: request.targetId,
    actor: request.actor,
    expectedVersion: request.expectedVersion,
    payloadHash: await payloadHash({action: request.action, payload: request.payload}),
  };
  return runMutation(request.db, binding, request.makeSpec, request.now);
}

/** HTTP for a ledger result: 200 applied, 409 rejected or conflicting reuse, 500 failed batch. */
export function answer(result: MutationResult, extra: Record<string, unknown> = {}): Response {
  switch (result.kind) {
    case 'applied':
      return json({ok: true, replayed: result.replayed, outcome: result.outcome, ...extra});
    case 'rejected':
      return error(result.reason, 409, {replayed: result.replayed});
    case 'conflict':
      return error('idempotency_conflict', 409);
    case 'error':
      if (/payments_method_reference|payments\.method/.test(result.error)) return error('duplicate_reference', 409);
      if (/bookings\.reference/.test(result.error)) return error('retry', 503);
      if (/reset is only possible/.test(result.error)) return error('reset_not_allowed', 403);
      console.error('write failed', result.error);
      return error('write_failed', 500);
  }
}
