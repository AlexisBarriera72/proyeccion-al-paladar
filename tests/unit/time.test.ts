import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLongDate,
  formatTime,
  monthGrid,
  parsePrLocal,
  prDateKey,
  prDayBounds,
  prLocalToUtc,
} from '../../shared/time.ts';

test('Puerto Rico wall-clock times map to UTC instants', () => {
  assert.equal(prLocalToUtc(2026, 10, 16, 19, 0), Date.UTC(2026, 9, 16, 23, 0));
  assert.equal(parsePrLocal('2026-10-16', '19:00'), Date.UTC(2026, 9, 16, 23, 0));
  assert.equal(parsePrLocal('2026-02-30', '19:00'), null);
  assert.equal(parsePrLocal('2026-10-16', '7pm'), null);
});

test('display is Puerto Rico time whatever the process time zone is', () => {
  const ms = Date.UTC(2026, 9, 17, 2, 30); // 10:30 PM on the 16th in Puerto Rico
  assert.equal(prDateKey(ms), '2026-10-16');
  // ICU separates the time and its period with a no-break space.
  const plain = (text: string) => text.replace(/\s/g, ' ');
  assert.equal(plain(formatTime(ms, 'es')), '10:30 p. m.');
  assert.equal(plain(formatTime(ms, 'en')), '10:30 PM');
  assert.match(formatLongDate(ms, 'es'), /viernes, 16 de octubre de 2026/);
  const [start, end] = prDayBounds(ms);
  assert.equal(start, Date.UTC(2026, 9, 16, 4, 0));
  assert.equal(end - start, 24 * 60 * 60 * 1000);
});

test('the month grid starts on Monday', () => {
  const cells = monthGrid(2026, 10); // October 1, 2026 is a Thursday
  assert.deepEqual(cells.slice(0, 4), [null, null, null, 1]);
  assert.equal(cells.length % 7, 0);
});
