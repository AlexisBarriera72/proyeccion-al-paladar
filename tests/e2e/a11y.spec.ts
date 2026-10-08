// Brief §13.10: axe on every page and the open reservation dialog, keyboard use, text
// spacing (WCAG 1.4.12) and 200% zoom without horizontal scrolling.
import {expect, test} from '@playwright/test';
import {AxeBuilder} from '@axe-core/playwright';
import {OWNER, noHorizontalScroll} from './fixtures.ts';

const PAGES = [
  '/',
  '/?lang=en',
  '/funciones/demo-prueba-a/',
  '/funciones/demo-shrek-1/',
  '/politicas/',
  '/reservacion/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/',
  '/no-existe/',
  '/equipo/',
  '/equipo/sesiones/demo-prueba-a/',
  '/equipo/reservaciones/',
  '/equipo/excepciones/',
  '/equipo/configuracion/',
];

for (const path of PAGES) {
  test(`axe finds nothing on ${path}`, async ({page}) => {
    await page.setExtraHTTPHeaders(OWNER);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('axe finds nothing in the open reservation dialog', async ({page}) => {
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({page}).include('[role="dialog"]').analyze();
  expect(results.violations.map(v => v.id)).toEqual([]);
});

test('the keyboard reaches a session and its action', async ({page}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', {name: 'Ir al contenido'})).toBeFocused();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const href = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('href') ?? '');
    const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
    if (href.startsWith('/funciones/') || /DEMO/.test(label)) break;
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', {name: /Reservar plazas|Solicitar plazas/})).toBeVisible();
});

test('text spacing and 200% zoom keep the page usable', async ({page}) => {
  await page.goto('/');
  await page.addStyleTag({
    content:
      '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
  });
  await noHorizontalScroll(page);
  const size = page.viewportSize()!;
  await page.setViewportSize({width: Math.round(size.width / 2), height: Math.round(size.height / 2)});
  await noHorizontalScroll(page);
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
});
