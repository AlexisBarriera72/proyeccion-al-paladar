// The design contract (DESIGN.md), read from computed styles: Inter and the type scale, one
// accent family, no blur, gradients or glows, and calendar cells that never move.
import {expect, test} from '@playwright/test';
import {OWNER, isDesktop} from './fixtures.ts';

test('type scale: Inter, page title, body, helper and tabular numbers', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true);
  const h1 = await page.getByRole('heading', {level: 1}).evaluate(el => {
    const s = getComputedStyle(el);
    return {family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, spacing: s.letterSpacing, line: s.lineHeight};
  });
  const size = isDesktop(page) ? 44 : 32;
  expect(h1.family).toMatch(/^Inter/);
  expect(h1.size).toBe(`${size}px`);
  expect(h1.weight).toBe('500');
  expect(parseFloat(h1.spacing)).toBeCloseTo(size * -0.04, 1);
  expect(parseFloat(h1.line)).toBeCloseTo(size * 1.08, 1);
  const body = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return [s.fontSize, s.lineHeight];
  });
  expect(body).toEqual(['16px', '24px']);
  const helper = await page
    .locator('main p.text-muted')
    .first()
    .evaluate(el => [getComputedStyle(el).fontSize, getComputedStyle(el).lineHeight]);
  expect(helper).toEqual(['14px', '20px']);
  const numeric = await page
    .locator('.tabular-nums')
    .first()
    .evaluate(el => getComputedStyle(el).fontVariantNumeric);
  expect(numeric).toContain('tabular-nums');
});

const AUDIT = `(() => {
  const parse = value => {
    const m = /rgba?\\(([^)]+)\\)/.exec(value);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return {r, g, b, a};
  };
  const hsl = ({r, g, b}) => {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2;
    if (max === min) return {h: 0, s: 0, l};
    const d = max - min;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
    return {h, s, l};
  };
  const found = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('img, picture, svg[data-photo]')) continue;
    const s = getComputedStyle(el);
    for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'outlineColor', 'fill', 'stroke']) {
      const c = parse(s[prop]);
      if (!c || c.a === 0) continue;
      const {h, s: sat, l} = hsl(c);
      if (sat > 0.15 && l > 0.08 && l < 0.95 && !(h >= 15 && h <= 45)) found.push(el.tagName + ' ' + prop + ' ' + s[prop]);
    }
    if (s.backdropFilter && s.backdropFilter !== 'none') found.push(el.tagName + ' backdrop-filter');
    if (s.filter && s.filter !== 'none') found.push(el.tagName + ' filter ' + s.filter);
    if (s.backgroundImage && s.backgroundImage !== 'none') found.push(el.tagName + ' background-image ' + s.backgroundImage);
    if (s.textShadow && s.textShadow !== 'none') found.push(el.tagName + ' text-shadow');
    for (const m of (s.boxShadow || '').matchAll(/rgba?\\([^)]+\\)/g)) {
      const c = parse(m[0]);
      if (c && c.a > 0 && hsl(c).s > 0.15) found.push(el.tagName + ' colored shadow ' + m[0]);
    }
  }
  return [...new Set(found)];
})()`;

for (const [name, path] of [
  ['calendar', '/'],
  ['session', '/funciones/demo-prueba-a/'],
  ['terms', '/politicas/'],
  ['staff', '/equipo/reservaciones/'],
]) {
  test(`one accent and no banned effects: ${name}`, async ({page}) => {
    await page.setExtraHTTPHeaders(OWNER);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(AUDIT)).toEqual([]);
  });
}

test('calendar cells never move', async ({page}) => {
  test.skip(!isDesktop(page));
  await page.goto('/');
  const cell = page
    .locator('td')
    .filter({has: page.getByRole('button')})
    .first();
  await cell.hover();
  expect(await cell.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await cell.getByRole('button').first().click();
  expect(await cell.evaluate(el => getComputedStyle(el).transform)).toBe('none');
});

test('loading keeps its size: layout shift stays under 0.02', async ({page}) => {
  await page.addInitScript(() => {
    (window as unknown as {__cls: number}).__cls = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as unknown as {value: number; hadRecentInput: boolean}[]) {
        if (!entry.hadRecentInput) (window as unknown as {__cls: number}).__cls += entry.value;
      }
    }).observe({type: 'layout-shift', buffered: true});
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as {__cls: number}).__cls)).toBeLessThanOrEqual(0.02);
});
