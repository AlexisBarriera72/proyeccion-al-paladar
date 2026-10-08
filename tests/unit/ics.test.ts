import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildIcs, foldLine, icsStatusFor} from '../../shared/ics.ts';

test('a request that holds no seats is TENTATIVE; only a confirmed booking is CONFIRMED', () => {
  assert.equal(icsStatusFor('inquiry'), 'TENTATIVE');
  assert.equal(icsStatusFor('pending_payment'), 'TENTATIVE');
  assert.equal(icsStatusFor('exception'), 'TENTATIVE');
  assert.equal(icsStatusFor('confirmed'), 'CONFIRMED');
  assert.equal(icsStatusFor('cancelled'), 'CANCELLED');
});

test('the event uses UTC instants, CRLF lines and folding at 75 octets', () => {
  const ics = buildIcs({
    uid: 'PAP-K7Q2MX@proyeccionalpaladar',
    start: Date.UTC(2026, 9, 16, 23, 0),
    end: null,
    summary: 'Solicitud pendiente: DEMO · Cena inspirada en Shrek',
    description: 'Esta solicitud no reserva plazas. El equipo debe confirmar disponibilidad y condiciones.',
    location: null,
    url: 'https://example.com/reservacion/abc',
    status: 'TENTATIVE',
    stamp: Date.UTC(2026, 9, 8, 16, 0),
  });
  assert.match(ics, /\r\nDTSTART:20261016T230000Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261017T000000Z\r\n/);
  assert.match(ics, /\r\nSTATUS:TENTATIVE\r\n/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.ok(!/[^\r]\n/.test(ics), 'every line ends in CRLF');
});

test('folding never splits a multi-byte character', () => {
  const folded = foldLine('DESCRIPTION:' + 'ñ'.repeat(80));
  for (const part of folded.split('\r\n ')) assert.ok(!part.includes('�'));
  assert.equal(folded.replaceAll('\r\n ', ''), 'DESCRIPTION:' + 'ñ'.repeat(80));
});
