// Brief §13.17 and §13.18: reduced motion shows everything at once; the magnetic pull is
// on the main CTA only, at most 3px, with a fine pointer only.
import {expect, test} from '@playwright/test';
import {isDesktop, settledBox} from './fixtures.ts';

test('reduced motion: content is in place immediately', async ({browser}, info) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: info.project.use.viewport ?? undefined,
    baseURL: 'http://127.0.0.1:8788',
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  const styles = await page
    .locator('main section')
    .first()
    .evaluate(el => {
      const s = getComputedStyle(el.parentElement!);
      const own = getComputedStyle(el);
      return [s.opacity, s.transform, own.opacity, own.transform];
    });
  expect(styles).toEqual(['1', 'none', '1', 'none']);
  await context.close();
});

test('magnetic CTA: up to 3px with a mouse, none on touch', async ({page}) => {
  await page.goto('/funciones/demo-prueba-a/');
  const cta = page.getByRole('button', {name: 'Reservar plazas'});
  await expect(cta).toBeVisible();
  const inner = cta.locator('span').first();
  if (!isDesktop(page)) {
    expect(await inner.evaluate(el => (el as HTMLElement).style.transform)).toBe('');
    return;
  }
  // Measure after the panel's entry animation, or the pointer can end up outside the button.
  const box = await settledBox(cta);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, {steps: 5});
  await page.waitForTimeout(600);
  const shift = await inner.evaluate(el => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return [Math.abs(m.m41), Math.abs(m.m42)];
  });
  expect(shift[0]).toBeGreaterThan(0);
  expect(Math.max(...shift)).toBeLessThanOrEqual(3);
  // The hit area never moves.
  expect(await cta.boundingBox()).toEqual(box);
});
