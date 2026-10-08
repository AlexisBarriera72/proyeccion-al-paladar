// The staff API (/api/equipo/*). Every handler runs after the Access token was verified and
// the email was found in staff_members; roles are enforced here, on the server.
import {and, raw, sql, type Sql} from './sql.ts';
import {all, first, type Db} from './db.ts';
import {error, json, mutationIdOf, newReference, readJson, sha256Hex} from './http.ts';
import {answer, write} from './mutate.ts';
import {
  cancel,
  checkIn,
  confirm,
  confirmable,
  confirmedSeats,
  createInquiry,
  editRequest,
  markOutcome,
  moveConfirmed,
  moveRequest,
  net,
  proposeTerms,
  recordPayment,
  reissueLink,
  resize,
  resolveOther,
  resolveRequest,
  resolveSame,
} from './rules.ts';
import {
  createSession,
  demoReset,
  publishChecks,
  saveExperience,
  savePolicyDraft,
  saveStaffMember,
  saveVenue,
  setPolicyState,
  setSessionState,
  setSetting,
  updateSession,
  type SessionFields,
} from './admin-rules.ts';
import {demoSeed} from './seed.ts';
import {sessionSelect, toPublicPolicy} from './views.ts';
import {prDayBounds} from '../shared/time.ts';
import {
  bookingActionSchema,
  experienceSchema,
  manualBookingSchema,
  paymentSchema,
  policySchema,
  policyStateSchema,
  sessionCreateSchema,
  sessionStateSchema,
  sessionUpdateSchema,
  settingSchema,
  staffMemberSchema,
  venueSchema,
} from '../shared/schemas.ts';
import type {Env} from './env.ts';
import type {StaffIdentity} from './access.ts';

interface Context {
  env: Env;
  db: Db;
  now: number;
  staff: StaffIdentity;
}

const ownerOnly = () => error('owner_only', 403);

function invalid(issues: {message: string; path: PropertyKey[]}[]) {
  const issue = issues[0];
  return error(issue?.message && /^[a-z_]+$/.test(issue.message) ? issue.message : 'invalid', 400, {
    field: issue?.path?.join('.') || null,
  });
}

const BOOKING_COLUMNS =
  raw(`b.id, b.reference, b.session_id, b.party_size, b.lead_name, b.contact_kind, b.contact_value,
  b.note, b.status, b.exception_reason, b.source, b.checked_in_at, b.version, b.synthetic, b.created_at, b.updated_at,
  b.accepted_policy_version_id, b.accepted_at, b.terms_price_status, b.unit_price_cents, b.currency,
  (b.token_digest IS NOT NULL) AS has_link`);

/** Each publishing check and each confirmable part for one session: {code, ok}. */
async function checklist(db: Db, now: number, sessionId: string) {
  const evaluate = async (checks: {code: string; when: Sql}[]) => {
    const columns = checks.reduce<Sql>(
      (acc, check, index) =>
        index
          ? sql`${acc}, COALESCE(${check.when}, 0) AS c${raw(String(index))}`
          : sql`COALESCE(${check.when}, 0) AS c0`,
      raw(''),
    );
    const row = await first<Record<string, number>>(
      db,
      sql`SELECT ${columns} FROM sessions AS s WHERE s.id = ${sessionId}`,
    );
    return checks.map((check, index) => ({code: check.code, ok: Boolean(row?.[`c${index}`])}));
  };
  return {publish: await evaluate(publishChecks(now)), confirmable: await evaluate(confirmable(now, 's'))};
}

async function sessionsForStaff(db: Db, now: number, from: number | null, to: number | null) {
  const range =
    from !== null && to !== null
      ? sql`WHERE (s.starts_at >= ${from} AND s.starts_at < ${to}) OR s.starts_at IS NULL`
      : sql`WHERE s.state IN ('draft', 'published') OR s.starts_at >= ${now - 7 * 24 * 60 * 60 * 1000} OR s.starts_at IS NULL`;
  return all<Record<string, unknown>>(
    db,
    sql`SELECT x.*,
        (SELECT COUNT(*) FROM bookings ib WHERE ib.session_id = x.id AND ib.status = 'inquiry') AS inquiries,
        (SELECT COUNT(*) FROM bookings pb WHERE pb.session_id = x.id AND pb.status = 'pending_payment') AS pending,
        (SELECT COUNT(*) FROM bookings eb WHERE eb.session_id = x.id AND eb.status = 'exception') AS exceptions
      FROM (${sessionSelect(now)} ${range}) AS x ORDER BY x.starts_at IS NULL, x.starts_at LIMIT 500`,
  );
}

const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; // no formulas in spreadsheets
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export async function handleStaff(request: Request, url: URL, ctx: Context): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;
  const {db, now, staff} = ctx;
  const actor = `staff:${staff.email}`;
  const isOwner = staff.role === 'owner';

  // ------------------------------------------------------------------ reads
  if (method === 'GET') {
    if (path === '/api/equipo/me') {
      return json({
        email: staff.email,
        role: staff.role,
        demo: ctx.env.DEMO_MODE === '1',
        environment: ctx.env.APP_ENV,
        now,
      });
    }

    if (path === '/api/equipo/sessions') {
      const from = url.searchParams.has('from') ? Number(url.searchParams.get('from')) : null;
      const to = url.searchParams.has('to') ? Number(url.searchParams.get('to')) : null;
      return json({sessions: await sessionsForStaff(db, now, from, to)});
    }

    const session = /^\/api\/equipo\/sessions\/([A-Za-z0-9_:-]{1,80})$/.exec(path);
    if (session) {
      const row = await first<Record<string, unknown>>(
        db,
        sql`SELECT s.*, ${confirmedSeats('s')} AS seats_taken FROM sessions AS s WHERE s.id = ${session[1]}`,
      );
      if (!row) return error('not_found', 404);
      const bookings = await all(
        db,
        sql`SELECT ${BOOKING_COLUMNS}, ${net('b')} AS net FROM bookings AS b WHERE b.session_id = ${session[1]}
          ORDER BY CASE b.status WHEN 'exception' THEN 0 WHEN 'pending_payment' THEN 1 WHEN 'inquiry' THEN 2
            WHEN 'confirmed' THEN 3 ELSE 4 END, b.created_at`,
      );
      return json({session: row, bookings, checklist: await checklist(db, now, session[1])});
    }

    if (path === '/api/equipo/catalog') {
      const [experiences, venues, policies, settings, members] = await Promise.all([
        all(db, sql`SELECT * FROM experiences ORDER BY status, title_es`),
        all(db, sql`SELECT * FROM venues ORDER BY name`),
        all(db, sql`SELECT * FROM policy_versions ORDER BY state, COALESCE(effective_from, created_at) DESC`),
        all(db, sql`SELECT key, value, updated_at, updated_by FROM settings ORDER BY key`),
        all(db, sql`SELECT email, role, active, version FROM staff_members ORDER BY role, email`),
      ]);
      return json({experiences, venues, policies, settings, staff: isOwner ? members : []});
    }

    if (path === '/api/equipo/bookings') {
      const sessionId = url.searchParams.get('session');
      const status = url.searchParams.get('status');
      const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 80);
      const filters: Sql[] = [];
      if (sessionId) filters.push(sql`b.session_id = ${sessionId}`);
      if (status) filters.push(sql`b.status = ${status}`);
      if (q) {
        const like = `%${q.replace(/[%_]/g, '')}%`;
        filters.push(
          sql`(lower(b.lead_name) LIKE ${like} OR lower(b.contact_value) LIKE ${like} OR lower(b.reference) LIKE ${like})`,
        );
      }
      const where = filters.length ? sql`WHERE ${and(filters)}` : raw('');
      return json({
        bookings: await all(
          db,
          sql`SELECT ${BOOKING_COLUMNS}, ${net('b')} AS net, s.starts_at, e.title_es
            FROM bookings AS b JOIN sessions AS s ON s.id = b.session_id JOIN experiences AS e ON e.id = s.experience_id
            ${where} ORDER BY s.starts_at IS NULL, s.starts_at, b.created_at LIMIT 500`,
        ),
      });
    }

    if (path === '/api/equipo/bookings/duplicates') {
      const sessionId = url.searchParams.get('session') || '';
      const contact = (url.searchParams.get('contact') || '').trim().toLowerCase();
      const name = (url.searchParams.get('name') || '').trim().toLowerCase();
      return json({
        duplicates: await all(
          db,
          sql`SELECT ${BOOKING_COLUMNS} FROM bookings AS b WHERE b.session_id = ${sessionId}
            AND b.status IN ('inquiry', 'pending_payment', 'confirmed', 'exception')
            AND ((${contact} <> '' AND lower(b.contact_value) = ${contact}) OR (${name} <> '' AND lower(b.lead_name) = ${name}))`,
        ),
      });
    }

    const booking = /^\/api\/equipo\/bookings\/([A-Za-z0-9_:-]{1,80})$/.exec(path);
    if (booking) {
      const id = booking[1];
      const row = await first<Record<string, unknown>>(
        db,
        sql`SELECT ${BOOKING_COLUMNS}, ${net('b')} AS net FROM bookings AS b WHERE b.id = ${id}`,
      );
      if (!row) return error('not_found', 404);
      const [sessionRow, payments, acceptances, proposals, requests, audit] = await Promise.all([
        first(db, sql`${sessionSelect(now)} WHERE s.id = ${row.session_id as string}`),
        all(db, sql`SELECT * FROM payments WHERE booking_id = ${id} ORDER BY recorded_at, rowid`),
        all(db, sql`SELECT * FROM term_acceptances WHERE booking_id = ${id} ORDER BY accepted_at, rowid`),
        all(db, sql`SELECT * FROM term_proposals WHERE booking_id = ${id} ORDER BY created_at DESC`),
        all(db, sql`SELECT * FROM booking_requests WHERE booking_id = ${id} ORDER BY created_at DESC`),
        all(
          db,
          sql`SELECT * FROM audit_events WHERE (target_type = 'booking' AND target_id = ${id})
            OR json_extract(after_json, '$.id') = ${id} ORDER BY at, rowid`,
        ),
      ]);
      const locked = row.accepted_policy_version_id
        ? toPublicPolicy(
            await first(db, sql`SELECT * FROM policy_versions WHERE id = ${row.accepted_policy_version_id as string}`),
          )
        : null;
      return json({
        booking: row,
        session: sessionRow,
        payments,
        acceptances,
        proposals,
        requests,
        audit,
        lockedPolicy: locked,
      });
    }

    if (path === '/api/equipo/exceptions') {
      return json({
        exceptions: await all(
          db,
          sql`SELECT ${BOOKING_COLUMNS}, ${net('b')} AS net, s.starts_at, e.title_es FROM bookings AS b
            JOIN sessions AS s ON s.id = b.session_id JOIN experiences AS e ON e.id = s.experience_id
            WHERE b.status = 'exception' ORDER BY b.updated_at`,
        ),
      });
    }

    if (path === '/api/equipo/requests') {
      return json({
        requests: await all(
          db,
          sql`SELECT r.*, b.reference, b.lead_name, b.status AS booking_status FROM booking_requests AS r
            JOIN bookings AS b ON b.id = r.booking_id WHERE r.status = 'open' ORDER BY r.created_at`,
        ),
      });
    }

    if (path === '/api/equipo/tonight') {
      const [start, end] = prDayBounds(now);
      return json({
        bookings: await all(
          db,
          sql`SELECT ${BOOKING_COLUMNS}, s.starts_at, e.title_es FROM bookings AS b
            JOIN sessions AS s ON s.id = b.session_id JOIN experiences AS e ON e.id = s.experience_id
            WHERE b.status IN ('confirmed', 'fulfilled', 'no_show') AND s.starts_at >= ${start} AND s.starts_at < ${end}
            ORDER BY s.starts_at, b.lead_name`,
        ),
        dayStart: start,
      });
    }

    if (path === '/api/equipo/audit') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);
      return json({events: await all(db, sql`SELECT * FROM audit_events ORDER BY at DESC, rowid DESC LIMIT ${limit}`)});
    }

    if (path === '/api/equipo/export.csv') {
      const sessionId = url.searchParams.get('session') || '';
      const rows = await all<Record<string, unknown>>(
        db,
        sql`SELECT b.reference, b.lead_name, b.party_size, b.status, b.checked_in_at, b.contact_kind, b.contact_value,
            b.source, ${net('b')} AS net_cents
          FROM bookings AS b WHERE b.session_id = ${sessionId}
            AND b.status IN ('confirmed', 'pending_payment', 'inquiry', 'exception', 'fulfilled', 'no_show')
          ORDER BY b.lead_name`,
      );
      const header = [
        'reference',
        'lead_name',
        'party_size',
        'status',
        'checked_in_at',
        'contact_kind',
        'contact',
        'source',
        'net_cents',
      ];
      const body = rows.map(row =>
        [
          row.reference,
          row.lead_name,
          row.party_size,
          row.status,
          row.checked_in_at ? new Date(row.checked_in_at as number).toISOString() : '',
          row.contact_kind,
          row.contact_value,
          row.source,
          row.net_cents,
        ]
          .map(csvCell)
          .join(','),
      );
      return new Response([header.join(','), ...body].join('\r\n') + '\r\n', {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="reservaciones-${sessionId.replace(/[^A-Za-z0-9_-]/g, '')}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return error('not_found', 404);
  }

  // ------------------------------------------------------------------ writes
  if (method !== 'POST') return error('not_found', 404);
  const mutationId = mutationIdOf(request);
  if (!mutationId) return error('idempotency_key_required', 400);
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const base = {db, mutationId, actor, now};

  if (path === '/api/equipo/sessions') {
    const parsed = sessionCreateSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const id = `ses-${crypto.randomUUID().slice(0, 8)}`;
    const fields = parsed.data.fields as SessionFields;
    if (!isOwner && fields.capacity !== null) return ownerOnly(); // capacity is the owner's decision
    return answer(
      await write({
        ...base,
        action: 'session_create',
        targetType: 'session',
        targetId: id,
        expectedVersion: null,
        payload: fields,
        makeSpec: mid => createSession({id, fields, actor, mutationId: mid, now}),
      }),
    );
  }

  const sessionWrite = /^\/api\/equipo\/sessions\/([A-Za-z0-9_:-]{1,80})(\/state)?$/.exec(path);
  if (sessionWrite) {
    const id = sessionWrite[1];
    if (sessionWrite[2]) {
      const parsed = sessionStateSchema.safeParse(body.value);
      if (!parsed.success) return invalid(parsed.error.issues);
      const {expectedVersion, transition} = parsed.data;
      return answer(
        await write({
          ...base,
          action: `session_${transition}`,
          targetType: 'session',
          targetId: id,
          expectedVersion,
          payload: {transition},
          makeSpec: mid => setSessionState({id, transition, expectedVersion, actor, mutationId: mid, now}),
        }),
      );
    }
    const parsed = sessionUpdateSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const fields = parsed.data.fields as SessionFields;
    const current = await first<{capacity: number | null; blocked_seats: number; version: number}>(
      db,
      sql`SELECT capacity, blocked_seats, version FROM sessions WHERE id = ${id}`,
    );
    if (!current) return error('not_found', 404);
    // Capacity is the owner's decision. The version check keeps this comparison current.
    if (!isOwner && (current.capacity !== fields.capacity || current.blocked_seats !== fields.blockedSeats)) {
      return ownerOnly();
    }
    return answer(
      await write({
        ...base,
        action: 'session_update',
        targetType: 'session',
        targetId: id,
        expectedVersion: parsed.data.expectedVersion,
        payload: fields,
        // The version the capacity comparison above was made against.
        makeSpec: mid =>
          updateSession({id, fields, expectedVersion: parsed.data.expectedVersion, actor, mutationId: mid, now}),
      }),
    );
  }

  if (path === '/api/equipo/bookings') {
    const parsed = manualBookingSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const b = parsed.data;
    const input = {
      bookingId: crypto.randomUUID(),
      reference: newReference(),
      sessionId: b.sessionId,
      partySize: b.partySize,
      leadName: b.leadName,
      contactKind: b.contactKind,
      contactValue: b.contactValue,
      note: b.note,
      source: b.source,
      tokenDigest: null,
      mutationId,
      now,
    };
    return answer(
      await write({
        ...base,
        action: 'create_inquiry',
        targetType: 'session',
        targetId: b.sessionId,
        expectedVersion: null,
        payload: b,
        makeSpec: mid => createInquiry({...input, mutationId: mid}, true),
      }),
    );
  }

  const bookingAction = /^\/api\/equipo\/bookings\/([A-Za-z0-9_:-]{1,80})\/(actions|payments)$/.exec(path);
  if (bookingAction) {
    const id = bookingAction[1];
    if (bookingAction[2] === 'payments') {
      const parsed = paymentSchema.safeParse(body.value);
      if (!parsed.success) return invalid(parsed.error.issues);
      const p = parsed.data;
      if (p.method === 'prueba' && ctx.env.APP_ENV === 'production') return error('method_not_allowed', 400);
      return answer(
        await write({
          ...base,
          action: 'record_payment',
          targetType: 'booking',
          targetId: id,
          expectedVersion: null,
          payload: p,
          makeSpec: mid =>
            recordPayment({
              paymentId: crypto.randomUUID(),
              bookingId: id,
              kind: p.kind,
              method: p.method,
              amountCents: p.amountCents,
              currency: p.currency,
              externalReference: p.externalReference,
              reversesPaymentId: p.reversesPaymentId,
              note: p.note,
              recordedBy: staff.email,
              mutationId: mid,
              now,
            }),
        }),
      );
    }
    const parsed = bookingActionSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const a = parsed.data;
    const current = await first<{status: string; party_size: number}>(
      db,
      sql`SELECT status, party_size FROM bookings WHERE id = ${id}`,
    );
    if (!current) return error('not_found', 404);
    const common = {id, expectedVersion: a.expectedVersion, now};
    let makeSpec;
    switch (a.action) {
      case 'confirm':
        makeSpec = (mid: string) => confirm({...common, mutationId: mid});
        break;
      case 'cancel':
        makeSpec = (mid: string) => cancel({...common, mutationId: mid});
        break;
      case 'resize':
        makeSpec = (mid: string) => resize({...common, mutationId: mid, partySize: a.partySize});
        break;
      case 'move':
        makeSpec =
          current.status === 'confirmed'
            ? (mid: string) => moveConfirmed({...common, mutationId: mid, destination: a.destination})
            : (mid: string) =>
                moveRequest({
                  ...common,
                  mutationId: mid,
                  destination: a.destination,
                  status: current.status === 'pending_payment' ? 'pending_payment' : 'inquiry',
                });
        break;
      case 'resolve_same':
        makeSpec = (mid: string) => resolveSame({...common, mutationId: mid});
        break;
      case 'resolve_other':
        makeSpec = (mid: string) => resolveOther({...common, mutationId: mid, destination: a.destination});
        break;
      case 'check_in':
      case 'undo_check_in': {
        const [dayStart, dayEnd] = prDayBounds(now);
        const undo = a.action === 'undo_check_in';
        makeSpec = (mid: string) => checkIn({...common, mutationId: mid, undo, dayStart, dayEnd});
        break;
      }
      case 'fulfilled':
      case 'no_show': {
        const outcome = a.action;
        makeSpec = (mid: string) => markOutcome({...common, mutationId: mid, outcome});
        break;
      }
      case 'propose_terms':
        makeSpec = (mid: string) =>
          proposeTerms({...common, mutationId: mid, proposalId: crypto.randomUUID(), sessionId: a.sessionId, actor});
        break;
      case 'reissue_link': {
        // Staff created the token in the browser; only its digest is stored.
        const digest = await sha256Hex(a.token);
        makeSpec = (mid: string) => reissueLink({...common, mutationId: mid, tokenDigest: digest});
        break;
      }
      case 'edit': {
        const status = current.status === 'pending_payment' ? 'pending_payment' : 'inquiry';
        makeSpec = (mid: string) =>
          editRequest({
            ...common,
            mutationId: mid,
            status,
            partySize: a.partySize,
            sizeChanged: a.partySize !== current.party_size,
            leadName: a.leadName,
            contactKind: a.contactKind,
            contactValue: a.contactValue,
            note: a.note,
          });
        break;
      }
    }
    const {expectedVersion, action, ...rest} = a;
    // The token itself never enters the ledger; its digest does (through the payload hash).
    const payload = action === 'reissue_link' ? {digest: await sha256Hex((rest as {token: string}).token)} : rest;
    return answer(
      await write({...base, action, targetType: 'booking', targetId: id, expectedVersion, payload, makeSpec}),
    );
  }

  const requestResolve = /^\/api\/equipo\/requests\/([A-Za-z0-9_:-]{1,80})\/resolve$/.exec(path);
  if (requestResolve) {
    const id = requestResolve[1];
    return answer(
      await write({
        ...base,
        action: 'resolve_request',
        targetType: 'request',
        targetId: id,
        expectedVersion: null,
        payload: {},
        makeSpec: mid => resolveRequest({requestId: id, actor, mutationId: mid, now}),
      }),
    );
  }

  // Catalog, settings, staff and the demo reset.
  const catalog = /^\/api\/equipo\/(experiences|venues|policies)(?:\/([A-Za-z0-9_:-]{1,80}))?(\/state)?$/.exec(path);
  if (catalog) {
    const [, kind, existingId, stateSuffix] = catalog;
    if (kind === 'experiences') {
      const parsed = experienceSchema.safeParse(body.value);
      if (!parsed.success) return invalid(parsed.error.issues);
      if (!isOwner && parsed.data.fields.status === 'approved') return ownerOnly();
      const id = existingId ?? `exp-${crypto.randomUUID().slice(0, 8)}`;
      const {expectedVersion, fields} = parsed.data;
      if (existingId && expectedVersion === null) return error('expected_version_required', 400);
      return answer(
        await write({
          ...base,
          action: 'experience_save',
          targetType: 'experience',
          targetId: id,
          expectedVersion,
          payload: fields,
          makeSpec: mid => saveExperience({id, fields, expectedVersion, actor, mutationId: mid, now}),
        }),
      );
    }
    if (!isOwner) return ownerOnly();
    if (kind === 'venues') {
      const parsed = venueSchema.safeParse(body.value);
      if (!parsed.success) return invalid(parsed.error.issues);
      const id = existingId ?? `venue-${crypto.randomUUID().slice(0, 8)}`;
      const {expectedVersion, fields} = parsed.data;
      if (existingId && expectedVersion === null) return error('expected_version_required', 400);
      return answer(
        await write({
          ...base,
          action: 'venue_save',
          targetType: 'venue',
          targetId: id,
          expectedVersion,
          payload: fields,
          makeSpec: mid => saveVenue({id, fields, expectedVersion, actor, mutationId: mid, now}),
        }),
      );
    }
    if (stateSuffix && existingId) {
      const parsed = policyStateSchema.safeParse(body.value);
      if (!parsed.success) return invalid(parsed.error.issues);
      const {expectedVersion, to} = parsed.data;
      return answer(
        await write({
          ...base,
          action: `policy_${to}`,
          targetType: 'policy',
          targetId: existingId,
          expectedVersion,
          payload: {to},
          makeSpec: mid => setPolicyState({id: existingId, to, expectedVersion, actor, mutationId: mid, now}),
        }),
      );
    }
    const parsed = policySchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const id = existingId ?? `pol-${crypto.randomUUID().slice(0, 8)}`;
    const {expectedVersion, fields} = parsed.data;
    if (existingId && expectedVersion === null) return error('expected_version_required', 400);
    return answer(
      await write({
        ...base,
        action: 'policy_save',
        targetType: 'policy',
        targetId: id,
        expectedVersion,
        payload: fields,
        makeSpec: mid => savePolicyDraft({id, fields, expectedVersion, actor, mutationId: mid, now}),
      }),
    );
  }

  if (path === '/api/equipo/settings') {
    if (!isOwner) return ownerOnly();
    const parsed = settingSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const {key, value} = parsed.data;
    return answer(
      await write({
        ...base,
        action: 'setting_set',
        targetType: 'setting',
        targetId: key,
        expectedVersion: null,
        payload: {value},
        makeSpec: mid => setSetting({key, value, actor, mutationId: mid, now}),
      }),
    );
  }

  if (path === '/api/equipo/staff') {
    if (!isOwner) return ownerOnly();
    const parsed = staffMemberSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error.issues);
    const member = parsed.data;
    return answer(
      await write({
        ...base,
        action: 'staff_save',
        targetType: 'staff',
        targetId: member.email,
        expectedVersion: null,
        payload: member,
        makeSpec: mid => saveStaffMember({...member, actor, mutationId: mid, now}),
      }),
    );
  }

  if (path === '/api/equipo/demo/reset') {
    if (!isOwner) return ownerOnly();
    if (ctx.env.DEMO_MODE !== '1' || !['demo', 'local'].includes(ctx.env.APP_ENV ?? '')) {
      return error('reset_not_allowed', 403);
    }
    return answer(
      await write({
        ...base,
        action: 'demo_reset',
        targetType: 'database',
        targetId: 'demo',
        expectedVersion: null,
        payload: {},
        makeSpec: mid => demoReset({seed: demoSeed(now), mutationId: mid, now, actor}),
      }),
    );
  }

  return error('not_found', 404);
}
