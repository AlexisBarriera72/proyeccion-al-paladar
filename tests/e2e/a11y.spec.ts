// Brief §13.10: axe on every page, the open reservation dialog, a staff menu and the guest's request sheet, keyboard use, text
// spacing (WCAG 1.4.12) and 200% zoom without horizontal scrolling.
import {expect, test} from '@playwright/test';
import {randomBytes, randomUUID} from 'node:crypto';
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

test('axe finds nothing on a staff booking page or in its open "Más acciones" menu', async ({page}) => {
  await page.setExtraHTTPHeaders(OWNER);
  await page.goto('/equipo/reservaciones/');
  await page.getByLabel('Buscar por nombre, contacto o referencia').fill('Cliente de prueba 02');
  await page.getByRole('link', {name: /Cliente de prueba 02/}).click();
  await expect(page.getByRole('heading', {level: 1, name: 'Cliente de prueba 02'})).toBeVisible();
  await page.waitForLoadState('networkidle');
  const onPage = await new AxeBuilder({page}).analyze();
  expect(onPage.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.getByRole('button', {name: 'Más acciones'}).click();
  await expect(page.getByRole('menu')).toBeVisible();
  const inMenu = await new AxeBuilder({page}).analyze();
  expect(inMenu.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('axe finds nothing on the guest page or in its request sheet', async ({page}, info) => {
  // A confirmed reservation made through the API, so the page offers "Pedir un cambio o una cancelación".
  const token = randomBytes(32).toString('base64url');
  const {session} = await (await page.request.get('/api/public/sessions/demo-prueba-a')).json();
  const made = await page.request.post('/api/public/bookings', {
    headers: {'Idempotency-Key': randomUUID(), Origin: 'http://127.0.0.1:8788'},
    data: {
      intent: 'reserve',
      sessionId: 'demo-prueba-a',
      partySize: 1,
      leadName: `Cliente e2e axe ${info.project.name}`,
      contactKind: 'email',
      contactValue: `axe-${info.project.name}@example.com`,
      note: null,
      token,
      terms: {
        policyVersionId: session.terms.policyVersionId,
        priceStatus: session.terms.priceStatus,
        unitPriceCents: session.terms.unitPriceCents,
        currency: session.terms.currency,
      },
      acceptedTerms: true,
    },
  });
  expect(made.status()).toBe(200);
  await page.goto(`/reservacion/${token}/`);
  await expect(page.getByRole('heading', {level: 1, name: 'Tu reservación'})).toBeVisible();
  await page.waitForLoadState('networkidle');
  const onPage = await new AxeBuilder({page}).analyze();
  expect(onPage.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.getByRole('button', {name: 'Pedir un cambio o una cancelación'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400);
  const inSheet = await new AxeBuilder({page}).include('[role="dialog"]').analyze();
  expect(inSheet.violations.map(v => v.id)).toEqual([]);
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
