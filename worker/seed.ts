// Modo demostración data. Used by `npm run cf -- demo seed` (written to a SQL file) and by the
// owner's "Restablecer demostración" (inside one ledger batch). Dates are relative to `now`, so
// the demo always shows upcoming dates. Every row is marked synthetic; titles say DEMO.
//
// Set A is modeled on their advertised programming: inquiry only, no venue, no price, and the
// announced policy shown as announced. Set B is synthetic with complete terms, so the unchanged
// production rules can be seen confirming a reservation.
import {raw, sql, type Sql, type SqlValue} from './sql.ts';
import {prDateParts, prLocalToUtc} from '../shared/time.ts';

export interface SeedRow {
  table: string;
  values: Record<string, SqlValue>;
}

/** The announced policy, quoted exactly as the visible text of their post (A02). */
export const ANNOUNCED_POLICY_TEXT =
  'A partir del 15 de noviembre , para garantizar una mejor organización y evitar inconvenientes, nuestra política de ' +
  'reservaciones ha sido actualizada. TODAS las experiencias deberán ser pagadas en su totalidad al momento de reservar. ' +
  'En caso de cancelación con 3 días de anticipación, se reembolsará el 60% del pago total. Este ajuste se realiza ' +
  'porque, en múltiples ocasiones, no se ha respetado la política anterior y esto afecta la planificación de nuestras ' +
  'experiencias.';
export const ANNOUNCED_POLICY_SOURCE = 'https://www.instagram.com/proyeccionalpaladarpr/p/DdIb7sxoOoR/';

/** The Shrek offer's inclusions, quoted exactly from their September 22, 2026 carousel (A28). */
const SHREK_INCLUSIONS = [
  '8 platos inspirados en la película',
  '3 bebidas tematícas',
  'Ambientación tematíca',
  'Proyección de la película',
  'Popcorn',
  'Agua',
].join('\n');

const SYSTEM = 'seed';

export function demoSeed(now: number): SeedRow[] {
  const {year, month, day} = prDateParts(now);
  const at = (days: number, hour: number, minute: number) => prLocalToUtc(year, month, day + days, hour, minute);
  const rows: SeedRow[] = [];
  const add = (table: string, values: Record<string, SqlValue>) => rows.push({table, values});
  const stamp = {created_at: now, updated_at: now, updated_by: SYSTEM};

  for (const [key, value] of [
    ['confirmed_bookings_enabled', '1'],
    ['required_contact', 'either'],
    ['exception_process_approved', '0'],
  ]) {
    add('settings', {key, value, updated_at: now, updated_by: SYSTEM});
  }

  add('experiences', {
    id: 'demo-shrek',
    title_es: 'DEMO · Cena inspirada en Shrek',
    title_en: 'DEMO · Dinner inspired by Shrek',
    description_es: 'Cena temática inspirada en la película Shrek. Precio, lugar y condiciones por confirmar.',
    description_en: 'A themed dinner inspired by the movie Shrek. Price, place and terms to be confirmed.',
    inclusions_es: SHREK_INCLUSIONS,
    inclusions_en: null,
    photo_slot: 'food',
    status: 'approved',
    synthetic: 1,
    ...stamp,
  });
  add('experiences', {
    id: 'demo-ratatouille',
    title_es: 'DEMO · Cena inspirada en Ratatouille',
    title_en: 'DEMO · Dinner inspired by Ratatouille',
    description_es: 'Cena temática inspirada en la película Ratatouille. Precio, lugar y condiciones por confirmar.',
    description_en: 'A themed dinner inspired by the movie Ratatouille. Price, place and terms to be confirmed.',
    inclusions_es: null,
    inclusions_en: null,
    photo_slot: 'table-food',
    status: 'approved',
    synthetic: 1,
    ...stamp,
  });
  add('experiences', {
    id: 'demo-prueba',
    title_es: 'DEMO · Función de prueba',
    title_en: 'DEMO · Test session',
    description_es: 'Una función inventada para probar cómo se confirma una reservación. No es una experiencia real.',
    description_en: 'A made-up session to try how a reservation is confirmed. It is not a real experience.',
    inclusions_es: null,
    inclusions_en: null,
    photo_slot: null,
    status: 'approved',
    synthetic: 1,
    ...stamp,
  });

  add('venues', {
    id: 'demo-sala',
    name: 'Sala de prueba (DEMO)',
    address: 'Dirección de prueba. No es un lugar real.',
    instructions: null,
    approved: 1,
    allow_overlap: 0,
    synthetic: 1,
    ...stamp,
  });

  add('policy_versions', {
    id: 'demo-anunciada',
    title: 'Política anunciada en Instagram',
    text_es: ANNOUNCED_POLICY_TEXT,
    text_en: null,
    source_url: ANNOUNCED_POLICY_SOURCE,
    source_note:
      'Publicada el 10 de septiembre de 2026. La imagen no dice el año y está cortada arriba y abajo. Aplica solo si los dueños la confirman.',
    state: 'draft',
    public_announcement: 1,
    applies_to: null,
    effective_from: null,
    effective_until: null,
    full_payment: null,
    refund_fraction_bp: null,
    cutoff_rule: null,
    approved_at: null,
    approved_by: null,
    synthetic: 0,
    ...stamp,
  });
  for (const [id, title, text, fullPayment] of [
    [
      'demo-politica-a',
      'Política de prueba (DEMO)',
      'Política de prueba: no requiere pago por adelantado. No aplica a reservaciones reales.',
      0,
    ],
    [
      'demo-politica-b',
      'Política de prueba con pago (DEMO)',
      'Política de prueba: pago completo al reservar, sin reembolso. No aplica a reservaciones reales.',
      1,
    ],
  ] as const) {
    add('policy_versions', {
      id,
      title,
      text_es: text,
      text_en: null,
      source_url: null,
      source_note: null,
      state: 'approved',
      public_announcement: 0,
      applies_to: 'booking_time',
      effective_from: now - 24 * 60 * 60 * 1000,
      effective_until: null,
      full_payment: fullPayment,
      refund_fraction_bp: 0,
      cutoff_rule: 'Prueba: sin reembolso.',
      approved_at: now,
      approved_by: SYSTEM,
      synthetic: 1,
      ...stamp,
    });
  }

  const inquirySession = (id: string, experience: string, startsAt: number | null, state = 'published') =>
    add('sessions', {
      id,
      experience_id: experience,
      venue_id: null,
      starts_at: startsAt,
      ends_at: null,
      tz: 'America/Puerto_Rico',
      capacity: null,
      blocked_seats: 0,
      party_min: null,
      party_max: null,
      booking_mode: 'inquiry',
      price_status: 'unset',
      price_cents: null,
      currency: null,
      policy_version_id: 'demo-anunciada',
      low_seats_threshold: null,
      state,
      synthetic: 1,
      ...stamp,
    });
  inquirySession('demo-shrek-1', 'demo-shrek', at(7, 19, 0));
  inquirySession('demo-ratatouille-1', 'demo-ratatouille', at(10, 19, 0));
  inquirySession('demo-shrek-2', 'demo-shrek', at(14, 19, 0));
  inquirySession('demo-ratatouille-cancelada', 'demo-ratatouille', at(17, 19, 0), 'cancelled');
  inquirySession('demo-ratatouille-2', 'demo-ratatouille', at(21, 19, 0));
  inquirySession('demo-shrek-por-confirmar', 'demo-shrek', null);

  const testSession = (id: string, startsAt: number, priceCents: number | null, policy: string) =>
    add('sessions', {
      id,
      experience_id: 'demo-prueba',
      venue_id: 'demo-sala',
      starts_at: startsAt,
      ends_at: startsAt + 3 * 60 * 60 * 1000,
      tz: 'America/Puerto_Rico',
      capacity: 24,
      blocked_seats: 0,
      party_min: 1,
      party_max: 8,
      booking_mode: 'confirmed',
      price_status: priceCents === null ? 'not_charged' : 'approved',
      price_cents: priceCents,
      currency: priceCents === null ? null : 'USD',
      policy_version_id: policy,
      low_seats_threshold: 6,
      state: 'published',
      synthetic: 1,
      ...stamp,
    });
  testSession('demo-prueba-a', at(5, 19, 30), null, 'demo-politica-a');
  testSession('demo-prueba-b', at(12, 19, 30), 100, 'demo-politica-b');

  const guest = (
    n: number,
    session: string,
    party: number,
    status: string,
    source: string,
    terms: {policy: string; priceStatus: string; price: number | null} | null,
  ) => {
    const id = `demo-booking-${n}`;
    add('bookings', {
      id,
      reference: `PAP-DEMO${String(n).padStart(2, '0')}`,
      session_id: session,
      party_size: party,
      lead_name: `Cliente de prueba ${String(n).padStart(2, '0')}`,
      contact_kind: 'email',
      contact_value: `cliente${String(n).padStart(2, '0')}@example.com`,
      note: null,
      status,
      exception_reason: null,
      source,
      token_digest: null,
      accepted_policy_version_id: terms?.policy ?? null,
      accepted_at: terms ? now : null,
      terms_price_status: terms?.priceStatus ?? null,
      unit_price_cents: terms?.price ?? null,
      currency: terms?.price != null ? 'USD' : null,
      checked_in_at: null,
      synthetic: 1,
      version: 1,
      created_at: now,
      updated_at: now,
    });
    if (terms) {
      add('term_acceptances', {
        id: `${id}:terms`,
        booking_id: id,
        session_id: session,
        policy_version_id: terms.policy,
        price_status: terms.priceStatus,
        unit_price_cents: terms.price,
        currency: terms.price != null ? 'USD' : null,
        accepted_at: now,
        channel: 'guest_page',
        mutation_id: `seed:${id}`,
      });
    }
  };
  const termsA = {policy: 'demo-politica-a', priceStatus: 'not_charged', price: null};
  const termsB = {policy: 'demo-politica-b', priceStatus: 'approved', price: 100};
  guest(1, 'demo-prueba-a', 2, 'confirmed', 'web', termsA);
  guest(2, 'demo-prueba-a', 4, 'confirmed', 'instagram_dm', termsA);
  guest(3, 'demo-shrek-1', 4, 'inquiry', 'instagram_dm', null);
  guest(4, 'demo-prueba-b', 2, 'pending_payment', 'web', termsB);
  return rows;
}

/** INSERT for one seed row; with `where`, only when it holds (inside a ledger batch). */
export function seedInsert(row: SeedRow, where?: Sql): Sql {
  const columns = Object.keys(row.values);
  const values = Object.values(row.values);
  const list = values.reduce<Sql>((acc, value, index) => (index ? sql`${acc}, ${value}` : sql`${value}`), raw(''));
  return sql`INSERT INTO ${raw(row.table)} (${raw(columns.join(', '))}) SELECT ${list} WHERE ${where ?? raw('1')}`;
}

const literal = (value: SqlValue) =>
  value === null ? 'NULL' : typeof value === 'number' ? String(value) : `'${value.replaceAll("'", "''")}'`;

/** The seed as a SQL file for `wrangler d1 execute --file`. */
export function seedSqlFile(rows: SeedRow[]): string {
  return (
    rows
      .map(
        row =>
          `INSERT INTO ${row.table} (${Object.keys(row.values).join(', ')}) VALUES (${Object.values(row.values)
            .map(literal)
            .join(', ')});`,
      )
      .join('\n') + '\n'
  );
}
