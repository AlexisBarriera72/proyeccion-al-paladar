// The design contract (DESIGN.md, "Sala y boleto"), read from computed styles: Fraunces titles
// over Inter text and the type scale; one accent family (amber on paper, brass on the dark band);
// texture only on the dark band; no blur, glows or colored shadows; the marquee can be paused
// and stays still under reduced motion; and calendar cells that never move.
import {expect, test} from '@playwright/test';
import {OWNER, isDesktop} from './fixtures.ts';

/** True when a face of this family has actually loaded (not just a fallback being available). */
const loaded = (family: string) =>
  `[...document.fonts].some(face => face.family.replace(/["']/g, '') === ${JSON.stringify(family)} && face.status === 'loaded')`;

test('type scale: Fraunces titles, Inter text, helper and tabular numbers', async ({page}) => {
  await page.goto('/');
  const heading = page.getByRole('heading', {level: 1});
  await expect(heading).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(loaded('Fraunces'))).toBe(true);
  expect(await page.evaluate(loaded('Inter'))).toBe(true);
  const h1 = await heading.evaluate(el => {
    const s = getComputedStyle(el);
    return {family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, spacing: s.letterSpacing, line: s.lineHeight};
  });
  const size = isDesktop(page) ? 64 : 40;
  expect(h1.family).toMatch(/^Fraunces/);
  expect(h1.size).toBe(`${size}px`);
  expect(h1.weight).toBe('500');
  expect(parseFloat(h1.spacing)).toBeCloseTo(size * -0.02, 1);
  expect(parseFloat(h1.line)).toBeCloseTo(size * 1.04, 1);
  const body = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return [s.fontFamily.split(',')[0].replace(/["']/g, ''), s.fontSize, s.lineHeight];
  });
  expect(body).toEqual(['Inter', '16px', '24px']);
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
  expect(numeric).toContain('lining-nums');
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
    // One accent family: every saturated color is amber or brass (hue 15 to 45), including the
    // warm paper and the dark band's browns.
    for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'outlineColor', 'fill', 'stroke']) {
      const c = parse(s[prop]);
      if (!c || c.a === 0) continue;
      const {h, s: sat, l} = hsl(c);
      if (sat > 0.15 && l > 0.08 && l < 0.95 && !(h >= 15 && h <= 45)) found.push(el.tagName + ' ' + prop + ' ' + s[prop]);
    }
    if (s.backdropFilter && s.backdropFilter !== 'none') found.push(el.tagName + ' backdrop-filter');
    if (s.filter && s.filter !== 'none') found.push(el.tagName + ' filter ' + s.filter);
    // Texture lives only on the dark band (header, page band, footer): a still grain, and on page
    // bands one soft amber glow. Nothing else draws a background image or a gradient.
    if (s.backgroundImage && s.backgroundImage !== 'none') {
      const onBand = el.hasAttribute('data-texture') && s.backgroundColor === 'rgb(23, 17, 13)';
      const gradients = (s.backgroundImage.match(/gradient\\(/g) || []).length;
      const grain = s.backgroundImage.includes('feTurbulence');
      if (!onBand || !grain || gradients > 1) found.push(el.tagName + ' background-image ' + s.backgroundImage.slice(0, 80));
    }
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
  test(`one accent, texture only on the band, no banned effects: ${name}`, async ({page}) => {
    await page.setExtraHTTPHeaders(OWNER);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(AUDIT)).toEqual([]);
    // The band is there: the header (and on guest pages the footer) carry the texture.
    expect(await page.locator('[data-texture]').count()).toBeGreaterThan(0);
  });
}

test('the marquee can be paused, is hidden from screen readers, and is still under reduced motion', async ({
  page,
  browser,
}, info) => {
  await page.goto('/politicas/');
  const strip = page.locator('[data-marquee]');
  await expect(strip).toHaveAttribute('aria-hidden', 'true');
  const track = strip.locator('> div');
  expect(await track.evaluate(el => getComputedStyle(el).animationName)).toBe('marquee');
  expect(await track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('running');
  const pause = page.getByRole('button', {name: 'Pausar el texto en movimiento'});
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  expect(await track.evaluate(el => getComputedStyle(el).animationPlayState)).toBe('paused');

  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: info.project.use.viewport ?? undefined,
    baseURL: 'http://127.0.0.1:8788',
  });
  const still = await context.newPage();
  await still.goto('/politicas/');
  await expect(still.locator('[data-marquee]')).toHaveCount(1);
  expect(await still.locator('[data-marquee] > div').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  // Nothing moves, so there is nothing to pause.
  await expect(still.getByRole('button', {name: 'Pausar el texto en movimiento'})).toHaveCount(0);
  await context.close();
});

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
