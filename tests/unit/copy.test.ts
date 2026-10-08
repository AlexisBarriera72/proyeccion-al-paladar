// Interface copy (DESIGN.md, "Copy rules"): Spanish and English carry the same keys, every key the code
// asks for exists, and every string follows the brief's rules: 20 words or fewer per sentence,
// none of the banned words, no emoji. "Every string" is the four dictionaries plus the photo
// alt texts and captions in src/photos.ts, the only interface text that lives outside them.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {es} from '../../src/i18n/es.ts';
import {en} from '../../src/i18n/en.ts';
import {staffEn, staffEs} from '../../src/staff/copy.ts';
import {photos} from '../../src/photos.ts';
import {PAYMENT_METHODS, paymentSchema} from '../../shared/schemas.ts';
import {publishChecks} from '../../worker/admin-rules.ts';
import {confirmable} from '../../worker/rules.ts';

const ROOT = new URL('../../', import.meta.url);
const read = (file: string) => fs.readFileSync(new URL(file, ROOT), 'utf8');

const dictionaries: Record<string, Record<string, string>> = {es, en, staffEs, staffEn};
const guestKeys = new Set(Object.keys(es));
const staffKeys = new Set(Object.keys(staffEs));
const namespaces = new Set([...guestKeys, ...staffKeys].map(key => key.split('.')[0]));

/** Every interface string: [where, text]. */
const strings: [string, string][] = [
  ...Object.entries(dictionaries).flatMap(([name, dictionary]) =>
    Object.entries(dictionary).map(([key, value]): [string, string] => [`${name} ${key}`, value]),
  ),
  ...Object.values(photos).flatMap(photo =>
    (['es', 'en'] as const).flatMap((lang): [string, string][] => [
      [`photo ${photo.slot} alt.${lang}`, photo.alt[lang]],
      ...(photo.caption ? [[`photo ${photo.slot} caption.${lang}`, photo.caption[lang]] as [string, string]] : []),
    ]),
  ),
];

// Every .ts and .tsx file in src/, except the dictionaries themselves. Guest pages load only the
// guest dictionary (src/lib/i18n.tsx); only src/staff/ merges the staff one over it.
const SRC = new URL('src/', ROOT);
const sources = fs
  .readdirSync(SRC, {encoding: 'utf8', recursive: true})
  .map(file => file.replaceAll('\\', '/'))
  .filter(file => /\.tsx?$/.test(file) && !file.startsWith('i18n/') && file !== 'staff/copy.ts')
  .map(file => ({file: `src/${file}`, text: fs.readFileSync(new URL(file, SRC), 'utf8')}));
const knownIn = (file: string, key: string) =>
  file.startsWith('src/staff/') ? guestKeys.has(key) || staffKeys.has(key) : guestKeys.has(key);

test('Spanish and English have the same keys', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort(), 'guest: src/i18n/es.ts and en.ts');
  assert.deepEqual(Object.keys(staffEn).sort(), Object.keys(staffEs).sort(), 'staff: src/staff/copy.ts');
});

test('every string is filled in (a photo alt may be empty only in both languages: a decorative image)', () => {
  const empty = strings
    .filter(([where]) => !/^photo \S+ alt\./.test(where))
    .filter(([, value]) => typeof value !== 'string' || !value.trim())
    .map(([where]) => where);
  assert.ok(
    strings.some(([where]) => where.startsWith('photo ')),
    'the photo strings were not collected',
  );
  assert.deepEqual(empty, []);
  const halfAlt = Object.values(photos)
    .filter(photo => Boolean(photo.alt.es.trim()) !== Boolean(photo.alt.en.trim()))
    .map(photo => photo.slot);
  assert.deepEqual(halfAlt, []);
});

test('every literal t() key in src/ exists, in the dictionary that page loads', () => {
  const missing: string[] = [];
  let found = 0;
  const patterns = [
    /\bt\(\s*'([^'\n]+)'/g,
    /\bt\(\s*"([^"\n]+)"/g,
    // t(cond ? 'a' : 'b'): both branches.
    /\bt\(\s*[^'"`()\n]+\?\s*'([^'\n]+)'\s*:\s*'([^'\n]+)'/g,
  ];
  for (const {file, text} of sources) {
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        for (const key of match.slice(1).filter(Boolean)) {
          found++;
          if (!knownIn(file, key)) missing.push(`${file}: ${key}`);
        }
      }
    }
  }
  assert.ok(found > 300, `only ${found} t() calls were found; the scan is broken`);
  assert.deepEqual(missing, []);
});

test('every key-shaped string in src/ names a real key (keys passed through variables, like the staff nav)', () => {
  const missing: string[] = [];
  for (const {file, text} of sources) {
    for (const [, , key] of text.matchAll(/(['"])([a-z][A-Za-z]*(?:\.[A-Za-z0-9_-]+)+)\1/g)) {
      if (namespaces.has(key.split('.')[0]) && !knownIn(file, key)) missing.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

// ---------------------------------------------------------------- dynamic keys: t(`family.${value}`)

/** The string members of `export type <name> = 'a' | 'b'` in shared/types.ts. */
function union(name: string): string[] {
  const match = read('shared/types.ts').match(new RegExp(`export type ${name} =([^;]+);`));
  assert.ok(match, `type ${name} in shared/types.ts`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

/** The values a column's CHECK (column IN (...)) allows, from migrations/0001_init.sql. */
function column(table: string, name: string): string[] {
  const block = read('migrations/0001_init.sql').match(new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(block, `table ${table}`);
  const check = block[1].match(new RegExp(`\\b${name} TEXT[^,]*?CHECK \\(\\s*${name} IN \\(([^)]*)\\)`));
  assert.ok(check, `${table}.${name} CHECK`);
  return [...check[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

/**
 * Every rejection code the rules name (code: '…'), and every exception reason they store. The
 * exception reasons are shown with no fallback (Queues, Bookings). Codes from the HTTP layer
 * (worker/http.ts, staff-api.ts, index.ts) are not listed here: useOutcome() in src/staff/ui.tsx
 * shows them through 'reason.generic' when they have no entry of their own.
 */
function rejectionCodes(): string[] {
  const text = read('worker/rules.ts') + read('worker/admin-rules.ts');
  const codes = [...text.matchAll(/\bcode: '([a-z_]+)'/g), ...text.matchAll(/exception_reason = '([a-z_]+)'/g)];
  return [...new Set(codes.map(m => m[1]))];
}

const now = Date.now();
// Which dictionary each family must live in: guest pages load only the guest one; the staff
// area loads both (src/lib/i18n.tsx).
const families: Record<string, {values: string[]; dictionary: 'guest' | 'staff'}> = {
  'status.': {values: union('Availability'), dictionary: 'guest'},
  'bstatus.': {values: union('BookingStatus'), dictionary: 'guest'},
  'bhelp.': {values: union('BookingStatus'), dictionary: 'guest'},
  'reply.': {values: union('BookingStatus'), dictionary: 'staff'},
  'ses.state.': {values: union('SessionState'), dictionary: 'staff'},
  'ses.price.': {values: union('PriceStatus'), dictionary: 'staff'},
  'role.': {values: union('Role'), dictionary: 'staff'},
  'source.': {values: union('Source'), dictionary: 'staff'},
  'kind.': {values: [...paymentSchema.shape.kind.options], dictionary: 'staff'},
  'method.': {values: [...PAYMENT_METHODS], dictionary: 'staff'},
  'reason.': {values: rejectionCodes(), dictionary: 'staff'},
  'check.': {values: [...publishChecks(now), ...confirmable(now, 's')].map(c => c.code), dictionary: 'staff'},
  'exp.status.': {values: column('experiences', 'status'), dictionary: 'staff'},
  'pol.state.': {values: column('policy_versions', 'state'), dictionary: 'staff'},
  'bk.proposal.': {values: column('term_proposals', 'status'), dictionary: 'staff'},
  'req.kind.': {values: column('booking_requests', 'kind'), dictionary: 'staff'},
};

test('every dynamic key family in src/ is one this test checks', () => {
  const used = new Set<string>();
  for (const {text} of sources) {
    for (const [, prefix] of text.matchAll(/`((?:[A-Za-z]+\.)+)\$\{/g)) {
      if (namespaces.has(prefix.split('.')[0])) used.add(prefix);
    }
  }
  assert.ok(used.size >= 10, `only ${used.size} dynamic families were found; the scan is broken`);
  assert.deepEqual(
    [...used].filter(prefix => !(prefix in families)),
    [],
  );
});

test('every value a dynamic key family can take has its copy', () => {
  assert.ok(families['reason.'].values.length > 30, 'the rejection codes were not found in worker/');
  const missing: string[] = [];
  for (const [prefix, {values, dictionary}] of Object.entries(families)) {
    assert.ok(values.length > 0, `no values found for ${prefix}*`);
    for (const value of values) {
      const key = prefix + value;
      if (!(dictionary === 'guest' ? guestKeys : staffKeys).has(key)) missing.push(`${key} (${dictionary})`);
    }
  }
  assert.deepEqual(missing, []);
});

// ---------------------------------------------------------------- the brief's writing rules

/** Sentences end at . ! or ? followed by a space or the end of the string. */
const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])(?:\s+|$)/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
/** Whitespace-separated words; a {placeholder} is one word. */
const words = (sentence: string) =>
  sentence
    .replace(/\{\w+\}/g, 'X')
    .split(/\s+/)
    .filter(Boolean).length;

test('the sentence and word counting works', () => {
  assert.deepEqual(sentences('Cine. Sabores. Emociones.'), ['Cine.', 'Sabores.', 'Emociones.']);
  assert.deepEqual(sentences('¿Retirar tu solicitud? No se puede deshacer.'), [
    '¿Retirar tu solicitud?',
    'No se puede deshacer.',
  ]);
  assert.deepEqual(sentences('Escribe un correo válido, como nombre@ejemplo.com.'), [
    'Escribe un correo válido, como nombre@ejemplo.com.',
  ]);
  assert.equal(words('Hola, {name}. Gracias'), 3);
  assert.equal(words('{count} plazas disponibles'), 3);
});

test('every sentence has 20 words or fewer', () => {
  const long: string[] = [];
  for (const [where, value] of strings) {
    for (const sentence of sentences(value)) {
      const count = words(sentence);
      if (count > 20) long.push(`${where}: ${count} words: "${sentence}"`);
    }
  }
  assert.deepEqual(long, []);
});

// The brief's banned words in any capitalization and inflection, and the Spanish equivalents
// DESIGN.md names, conjugated. Letters on either side mean a different word ("elevador" and
// "eleven" are fine).
const BANNED = new RegExp(
  `(?<!\\p{L})(${[
    'seamless(?:ly)?',
    'leverag(?:e|es|ed|ing)',
    'robust(?:ly|ness)?',
    'revolutioni[sz](?:e|es|ed|ing)',
    'unlock(?:s|ed|ing)?',
    'ecosystems?',
    'cutting[-\\u2010\\u2011\\s]edge',
    'elevat(?:e|es|ed|ing)',
    'fluid[oa]s?',
    'aprovech\\p{L}*',
    'robust[oa]s?',
    'revolucion\\p{L}*',
    'desbloque\\p{L}*',
    'ecosistemas?',
    'vanguardia',
    'elev(?:ar|o|as|a|amos|an|é|aste|ó|aron|aba|abas|ábamos|aban|aré|arás|ará|aremos|arán|aría|arían|e|es|emos|ando|ad[oa]s?)',
  ].join('|')})(?!\\p{L})`,
  'iu',
);

test('the banned-word check catches every listed word', () => {
  for (const word of [
    'Seamless',
    'LEVERAGE',
    'robust',
    'Revolutionize',
    'unlock',
    'Ecosystem',
    'Cutting-edge',
    'cutting edge',
    'elevate',
  ]) {
    assert.match(word, BANNED);
  }
  for (const word of [
    'fluido',
    'aprovechar',
    'robusto',
    'revolucionar',
    'desbloquear',
    'ecosistema',
    'vanguardia',
    'elevar',
    'Elevamos',
    'elevando',
    'elevó',
    'eleva',
  ]) {
    assert.match(word, BANNED);
  }
  for (const word of ['elevador', 'elevadores', 'eleven', 'relevante']) assert.doesNotMatch(word, BANNED);
});

test('no banned word appears in the copy', () => {
  const found = strings
    .filter(([, value]) => BANNED.test(value))
    .map(([where, value]) => `${where}: ${value.match(BANNED)?.[0]}`);
  assert.deepEqual(found, []);
});

test('no emoji anywhere in the copy', () => {
  const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}/u;
  assert.match('Listo ✅', EMOJI);
  const keys = Object.values(dictionaries).flatMap(dictionary => Object.keys(dictionary));
  const found = [
    ...keys.filter(key => EMOJI.test(key)),
    ...strings.filter(([, value]) => EMOJI.test(value)).map(([where, value]) => `${where}: ${value}`),
  ];
  assert.deepEqual(found, []);
});
