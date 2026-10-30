// Empty, error and replaced-link states say exactly what happened.
import {expect, test, type Page} from '@playwright/test';
import {OWNER} from './fixtures.ts';

test('empty: the brief’s exact text and the official profile only', async ({page}) => {
  await page.route('**/api/public/sessions?*', route => route.fulfill({json: {sessions: []}}));
  await page.goto('/');
  await expect(
    page.getByText('Aún no hay fechas publicadas. Consulta las próximas experiencias en Instagram.'),
  ).toBeVisible();
  await expect(page.getByRole('link', {name: 'Ver Instagram'})).toHaveAttribute(
    'href',
    'https://www.instagram.com/proyeccionalpaladarpr/',
  );
});

test('error: a retry that keeps the page, then the dates', async ({page}) => {
  let fail = true;
  await page.route('**/api/public/sessions?*', route => (fail ? route.abort() : route.continue()));
  await page.goto('/');
  await expect(page.getByText('No pudimos cargar las fechas.')).toBeVisible();
  fail = false;
  await page.getByRole('button', {name: 'Intentar de nuevo'}).click();
  await expect(page.getByText('No pudimos cargar las fechas.')).toHaveCount(0);
  // A calendar card (computers) or an agenda link (phones).
  await expect(page.locator('main td button, main a[href^="/funciones/"]').first()).toBeVisible();
});

test('a link that is no longer valid says so', async ({page}) => {
  await page.goto('/reservacion/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/');
  await expect(page.getByText('Este enlace ya no es válido. Pide uno nuevo al equipo.')).toBeVisible();
});

const monthName = (ms: number) =>
  new Intl.DateTimeFormat('es-PR', {month: 'long', year: 'numeric', timeZone: 'America/Puerto_Rico'}).format(ms);

/** Serves the sessions as only one bookable session, moved to `at`. */
async function oneSessionAt(page: Page, at: number) {
  await page.route('**/api/public/sessions?*', async route => {
    const {sessions} = await (await route.fetch()).json();
    const one = sessions.find(
      (s: {startsAt: number | null; action: string}) => s.startsAt !== null && s.action !== 'none',
    );
    await route.fulfill({json: {sessions: [{...one, startsAt: at, endsAt: at + 3 * 60 * 60 * 1000}]}});
  });
}

test('with no date left this month, it opens on the next date’s month and says so', async ({page}) => {
  // Only one session, two months out: nothing is left this month.
  const later = Date.now() + 62 * 24 * 60 * 60 * 1000;
  await oneSessionAt(page, later);
  await page.goto('/');
  const month = monthName(later);
  await expect(page.getByRole('heading', {level: 2, name: month})).toBeVisible();
  await expect(page.getByText(`No quedan fechas este mes. Te mostramos ${month}.`)).toBeVisible();
  await expect(page.locator('main td button, main a[href^="/funciones/"]').first()).toBeVisible();
  // "Hoy" goes back to this month: it is empty, says so, and offers the next date.
  await page.getByRole('button', {name: 'Hoy'}).click();
  await expect(page.getByRole('heading', {level: 2, name: monthName(Date.now())})).toBeVisible();
  await expect(page.getByText('No hay fechas en este mes.')).toBeVisible();
  await expect(page.getByText(/^No quedan fechas este mes/)).toHaveCount(0);
  await page.getByRole('button', {name: 'Ver próxima fecha'}).click();
  await expect(page.getByRole('heading', {level: 2, name: month})).toBeVisible();
  await expect(page.getByText('No hay fechas en este mes.')).toHaveCount(0);
  await expect(page.locator('main td button, main a[href^="/funciones/"]').first()).toBeVisible();
});

test('a date left this month keeps the calendar on this month', async ({page}) => {
  const soon = Date.now() + 60 * 1000;
  await oneSessionAt(page, soon);
  await page.goto('/');
  await expect(page.locator('main td button, main a[href^="/funciones/"]').first()).toBeVisible();
  await expect(page.getByRole('heading', {level: 2, name: monthName(soon)})).toBeVisible();
  await expect(page.getByText(/^No quedan fechas este mes/)).toHaveCount(0);
});

test('a month after the last date says so, with no next date to offer', async ({page}) => {
  await page.goto('/');
  for (let i = 0; i < 3; i++) await page.getByRole('button', {name: 'Mes siguiente'}).click();
  await expect(page.getByText('No hay fechas en este mes.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Ver próxima fecha'})).toHaveCount(0);
});

test('Excepciones: settings that fail to load are not called unapproved', async ({page}) => {
  let fail = true;
  await page.setExtraHTTPHeaders(OWNER);
  await page.route('**/api/equipo/catalog', route => (fail ? route.abort() : route.continue()));
  await page.goto('/equipo/excepciones/');
  const problem = page.getByRole('alert').filter({hasText: 'No se pudo cargar el proceso aprobado.'});
  await expect(problem).toBeVisible();
  await expect(page.getByText('El proceso para estos casos no está aprobado todavía.')).toHaveCount(0);
  fail = false;
  await problem.getByRole('button', {name: 'Intentar de nuevo'}).click();
  await expect(problem).toHaveCount(0);
  // The demo's process is approved, so it waits behind its button.
  await expect(page.getByRole('button', {name: 'Ver proceso aprobado'})).toBeVisible();
});
