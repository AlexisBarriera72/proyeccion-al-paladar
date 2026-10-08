// The brief's motion values (DESIGN.md, "Motion"; research/BUILD_PROMPT.md §0), imported from
// src/lib/motion.ts itself: one spring, a 0.05 s stagger, and items that enter from 12px below.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SPRING, itemVariants, pageVariants} from '../../src/lib/motion.ts';

const SRC = new URL('../../src/', import.meta.url);
const sources = fs
  .readdirSync(SRC, {encoding: 'utf8', recursive: true})
  .filter(file => /\.tsx?$/.test(file))
  .map(file => ({file: `src/${file.replaceAll('\\', '/')}`, text: fs.readFileSync(new URL(file, SRC), 'utf8')}));

test('no other spring or stagger anywhere in src/', () => {
  const values = (name: string) =>
    sources.flatMap(({file, text}) =>
      [...text.matchAll(new RegExp(`\\b${name}:\\s*([\\d.]+)`, 'g'))].map(m => ({file, value: Number(m[1])})),
    );
  const stiffness = values('stiffness');
  const damping = values('damping');
  const stagger = values('staggerChildren');
  assert.ok(stiffness.length > 0 && damping.length > 0 && stagger.length > 0, 'the scan found no motion values');
  // A bare {type: 'spring'} would fall back to motion's default spring.
  const springs = sources.flatMap(({file, text}) => [...text.matchAll(/\btype:\s*['"]spring['"]/g)].map(() => file));
  assert.deepEqual(springs, ['src/lib/motion.ts'], 'type: spring outside the shared SPRING');
  assert.deepEqual(
    [
      ...stiffness.filter(({value}) => value !== 300).map(({file, value}) => `${file}: stiffness ${value}`),
      ...damping.filter(({value}) => value !== 30).map(({file, value}) => `${file}: damping ${value}`),
      ...stagger.filter(({value}) => value !== 0.05).map(({file, value}) => `${file}: staggerChildren ${value}`),
    ],
    [],
  );
});

test('one shared spring: stiffness 300, damping 30', () => {
  assert.deepEqual({...SPRING}, {type: 'spring', stiffness: 300, damping: 30});
});

test('the page container staggers its children by 0.05 s', () => {
  const show = pageVariants.show as {transition?: {staggerChildren?: number}};
  assert.equal(show.transition?.staggerChildren, 0.05);
});

test('items enter from {opacity: 0, y: 12} to {opacity: 1, y: 0} with the shared spring', () => {
  assert.deepEqual(itemVariants.hidden, {opacity: 0, y: 12});
  const {transition, ...shown} = itemVariants.show as Record<string, unknown>;
  assert.deepEqual(shown, {opacity: 1, y: 0});
  assert.deepEqual(transition, {...SPRING});
});
