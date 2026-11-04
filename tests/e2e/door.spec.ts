// The door: the booking number guests show on arrival, Recepción's search and guests who arrive
// without a reservation. Also the reservation sheet's fixes from the November review.
import {randomBytes, randomUUID} from 'node:crypto';
import {expect, test, type Page} from '@playwright/test';
import {OWNER, isDesktop} from './fixtures.ts';

const HOUR = 60 * 60 * 1000;

/**
 * The demo test session has few seats and later specs book it too: each test here books one
 * seat and cancels what it booked when it ends, so the shared demo data stays as it was.
 */
async function release(page: Page, name: string) {
  const response = await page.request.get(`/api/equipo/bookings?q=${encodeURIComponent(name)}`, {headers: OWNER});
  for (const b of (await response.json()).bookings as {id: string; status: string; version: number}[]) {
    if (!['inquiry', 'pending_payment', 'confirmed', 'exception'].includes(b.status)) continue;
    const cancelled = await page.request.post(`/api/equipo/bookings/${b.id}/actions`, {
      headers: {...OWNER, 'idempotency-key': randomUUID()},
      data: {action: 'cancel', expectedVersion: b.version},
    });
    expect(cancelled.status()).toBe(200);
  }
}

/** One person: the smallest group, so the shared demo session keeps its seats. */
async function onePerson(page: Page) {
  const dialog = page.getByRole('dialog');
  const less = dialog.getByRole('button', {name: 'Una persona menos'});
  while (await less.isEnabled()) await less.click();
}

/** Steps change with an exit animation; each step's heading says the new step is in place. */
async function toContact(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', {name: 'Sesión', exact: true})).toBeVisible();
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await expect(dialog.getByRole('heading', {name: 'Tu grupo', exact: true})).toBeVisible();
  await onePerson(page);
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await expect(dialog.getByRole('heading', {name: 'Datos de contacto', exact: true})).toBeVisible();
}

/** Staff pages on the demo test session's own day, two hours before it starts. */
async function onShowDay(page: Page) {
  const response = await page.request.get('/api/public/sessions/demo-prueba-a');
  const startsAt: number = (await response.json()).session.startsAt;
  await page.setExtraHTTPHeaders({...OWNER, 'x-test-now': String(startsAt - 2 * HOUR)});
}

test('a confirmed guest gets a large number for the door on the receipt and their page', async ({page}, info) => {
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await toContact(page);
  const dialog = page.getByRole('dialog');
  const name = `Cliente e2e puerta ${info.project.name}`;
  await dialog.getByLabel('Nombre de quien reserva').fill(name);
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill('787-555-0142');
  // Nothing is sent to the guest's phone: the site offers no texts.
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await dialog.getByRole('checkbox', {name: 'Acepto estas condiciones.'}).check();
  await dialog.getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(dialog.getByRole('heading', {name: 'Reservación confirmada'})).toBeVisible();
  // The number for the door, large enough to read across a counter.
  const ticket = dialog.locator('[data-ticket]');
  await expect(ticket.getByText('Tu número para la entrada')).toBeVisible();
  await expect(ticket.getByText(/^PAP-[A-Z0-9]{6}$/)).toBeVisible();
  const size = await ticket.getByText(/^PAP-[A-Z0-9]{6}$/).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(32);
  await expect(ticket.getByText('Muéstralo en la entrada al llegar.')).toBeVisible();
  await expect(
    dialog.getByText('No te enviamos ningún mensaje. Guarda este enlace para ver tu solicitud.'),
  ).toBeVisible();
  // The private link carries its token in the fragment, never in the path.
  await expect(page.getByRole('link', {name: 'Ver mi reservación'})).toHaveAttribute(
    'href',
    /\/reservacion\/#[A-Za-z0-9_-]{43}$/,
  );
  await page.getByRole('link', {name: 'Ver mi reservación'}).click();
  const door = page.locator('[data-door-number]');
  await expect(door.getByText('Tu número para la entrada')).toBeVisible();
  await expect(door.getByText(/^PAP-[A-Z0-9]{6}$/)).toBeVisible();
  await release(page, name);
});

test('the group size can be cleared and retyped without jumping to the limit', async ({page}) => {
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  const field = dialog.getByRole('spinbutton', {name: 'Cuántas personas'});
  // A size within today's limit: the seats left on the shared demo session, at most 3.
  const target = String(Math.min(3, Number(await field.getAttribute('max'))));
  await field.click();
  await field.press('End');
  await field.press('Backspace');
  await expect(field).toHaveValue('');
  await expect(dialog.getByRole('button', {name: 'Continuar'})).toBeDisabled();
  await field.pressSequentially(target);
  await expect(field).toHaveValue(target);
  await expect(dialog.getByRole('button', {name: 'Continuar'})).toBeEnabled();
});

test('a reopened receipt stays still: the popcorn bursts only when the server confirms', async ({page}, info) => {
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await toContact(page);
  const dialog = page.getByRole('dialog');
  const name = `Cliente e2e popcorn ${info.project.name}`;
  await dialog.getByLabel('Nombre de quien reserva').fill(name);
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill('787-555-0144');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await dialog.getByRole('checkbox', {name: 'Acepto estas condiciones.'}).check();
  await dialog.getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(dialog.getByRole('heading', {name: 'Reservación confirmada'})).toBeVisible();
  await expect(dialog.locator('[data-popcorn]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(page.getByRole('dialog').getByRole('heading', {name: 'Reservación confirmada'})).toBeVisible();
  await expect(page.getByRole('dialog').locator('[data-popcorn]')).toHaveCount(0);
  await release(page, name);
});

test('on a computer, another session’s sheet never shows this session’s receipt', async ({page}, info) => {
  test.skip(!isDesktop(page), 'the side panel is for computers; phones open each session on its own page');
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await toContact(page);
  const dialog = page.getByRole('dialog');
  const name = `Cliente e2e panel ${info.project.name}`;
  await dialog.getByLabel('Nombre de quien reserva').fill(name);
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill('787-555-0145');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await dialog.getByRole('checkbox', {name: 'Acepto estas condiciones.'}).check();
  await dialog.getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(dialog.getByRole('heading', {name: 'Reservación confirmada'})).toBeVisible();
  await page.keyboard.press('Escape');
  // An in-app move to another session, as a click in the calendar makes it.
  await page.evaluate(() => {
    history.pushState(null, '', '/funciones/demo-shrek-1/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.getByRole('button', {name: 'Solicitar plazas'}).click();
  const other = page.getByRole('dialog');
  await expect(other.getByRole('heading', {name: 'Sesión', exact: true})).toBeVisible();
  await expect(other.getByRole('definition').filter({hasText: 'DEMO · Cena inspirada en Shrek'})).toBeVisible();
  await expect(other.getByRole('heading', {name: 'Reservación confirmada'})).toHaveCount(0);
  await release(page, name);
});

test('Recepción finds tonight’s guest by number, name or phone, and checks them in', async ({page}) => {
  await onShowDay(page);
  await page.goto('/equipo/esta-noche/');
  const find = page.getByRole('searchbox', {name: 'Número, nombre o teléfono'});
  await find.fill('demo01');
  await expect(page.getByText('1 resultado')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Cliente de prueba 01'})).toBeVisible();
  await find.fill('cliente de prueba');
  await expect(page.getByText('2 resultados')).toBeVisible();
  await find.fill('PAP-DEMO01');
  await page.getByRole('button', {name: 'Registrar llegada'}).click();
  await expect(page.getByText(/^Llegó a las /)).toBeVisible();
  await expect(page.getByRole('button', {name: 'Deshacer llegada'})).toBeFocused();
  // Leave the shared demo booking as it was.
  await page.getByRole('button', {name: 'Deshacer llegada'}).click();
  await expect(page.getByRole('button', {name: 'Registrar llegada'})).toBeVisible();
  await find.fill('nadie con este nombre');
  await expect(
    page.getByText('Ninguna reservación de hoy coincide. Si llegó sin reservación, regístrala.'),
  ).toBeVisible();
});

test('a guest without a reservation gets a number at the door when seats remain', async ({page}, info) => {
  await onShowDay(page);
  await page.goto('/equipo/esta-noche/');
  await page.getByRole('button', {name: 'Llegó sin reservación'}).first().click();
  const sheet = page.getByRole('dialog', {name: 'Llegada sin reservación'});
  await expect(sheet.getByLabel('Sesión de hoy')).toHaveValue('demo-prueba-a');
  const name = `Cliente e2e en la puerta ${info.project.name}`;
  await sheet.getByLabel('Personas', {exact: true}).fill('1');
  await sheet.getByLabel('Nombre', {exact: true}).fill(name);
  await sheet
    .getByLabel('Contacto', {exact: true})
    .fill(info.project.name === 'desktop' ? '787-555-0177' : '787-555-0178');
  // The terms must be accepted in person first.
  await sheet.getByRole('button', {name: 'Registrar y dar número'}).click();
  await expect(sheet.getByText('Confirma que el cliente aceptó las condiciones.')).toBeVisible();
  await sheet.getByRole('checkbox', {name: 'El cliente leyó y aceptó estas condiciones en persona.'}).check();
  await sheet.getByRole('button', {name: 'Registrar y dar número'}).click();
  const result = sheet.locator('[data-walk-in-result]');
  await expect(result.getByText('Número para la entrada')).toBeVisible();
  await expect(result.getByText(/^PAP-[A-Z0-9]{6}$/)).toBeVisible();
  // The time in parentheses, so a Spanish "p. m." never runs into the sentence's own period.
  await expect(result.getByText(/^Confirmada\. Llegada registrada \(\d{1,2}:\d{2}\s[ap]\.\sm\.\)\.$/)).toBeVisible();
  await sheet.getByRole('button', {name: 'Listo'}).click();
  // Their booking is on tonight's list, already arrived.
  await page.getByRole('searchbox', {name: 'Número, nombre o teléfono'}).fill(name);
  await expect(page.getByRole('link', {name})).toBeVisible();
  await expect(page.getByText(/^Llegó a las /)).toBeVisible();
  await release(page, name);
});

test('the private link keeps its token out of every request, and older links still open', async ({page}, info) => {
  // A reservation through the API, with a known token.
  const token = randomBytes(32).toString('base64url');
  const {session} = await (await page.request.get('/api/public/sessions/demo-prueba-a')).json();
  const name = `Cliente e2e enlace ${info.project.name}`;
  const made = await page.request.post('/api/public/bookings', {
    headers: {'Idempotency-Key': randomUUID(), Origin: 'http://127.0.0.1:8788'},
    data: {
      intent: 'reserve',
      sessionId: 'demo-prueba-a',
      partySize: 1,
      leadName: name,
      contactKind: 'email',
      contactValue: `enlace-${info.project.name}@example.com`,
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
  // Every URL the page asks the server for: the token may go in a request body, never in a URL.
  const urls: string[] = [];
  page.on('request', request => urls.push(request.url()));
  await page.goto(`/reservacion/#${token}`);
  await expect(page.getByRole('heading', {level: 1, name: 'Tu reservación'})).toBeVisible();
  await expect(page.locator('[data-door-number]')).toBeVisible();
  expect(urls.filter(url => url.includes(token))).toEqual([]);
  // An older link with the token in the path still opens, and the address bar drops it to the fragment.
  await page.goto(`/reservacion/${token}/`);
  await expect(page.getByRole('heading', {level: 1, name: 'Tu reservación'})).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/reservacion/');
  expect(new URL(page.url()).hash).toBe(`#${token}`);
  await release(page, name);
});

test('after a refused submit, keyboard focus stays on the button that sent it', async ({page}) => {
  // The server refuses the reservation (as when the last seats went to someone else).
  await page.route('**/api/public/bookings', route =>
    route.fulfill({status: 409, json: {ok: false, error: 'no_seats', replayed: false}}),
  );
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await toContact(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre de quien reserva').fill('Cliente e2e foco');
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill('787-555-0149');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await dialog.getByRole('checkbox', {name: 'Acepto estas condiciones.'}).check();
  const submit = dialog.getByRole('button', {name: 'Reservar plazas'});
  await submit.focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('alert')).toContainText('Ya no quedan plazas suficientes');
  // Focus never fell to the page: it is still on the button, inside the open sheet.
  await expect(submit).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
});

test('in a staff sheet, a refusal keeps focus on its send button', async ({page}) => {
  await onShowDay(page);
  await page.route('**/api/equipo/walk-ins', route =>
    route.fulfill({status: 409, json: {ok: false, error: 'no_seats', replayed: false}}),
  );
  await page.goto('/equipo/esta-noche/');
  await page.getByRole('button', {name: 'Llegó sin reservación'}).first().click();
  const sheet = page.getByRole('dialog', {name: 'Llegada sin reservación'});
  await sheet.getByLabel('Personas', {exact: true}).fill('1');
  await sheet.getByLabel('Nombre', {exact: true}).fill('Cliente e2e foco equipo');
  await sheet.getByLabel('Contacto', {exact: true}).fill('787-555-0150');
  await sheet.getByRole('checkbox', {name: 'El cliente leyó y aceptó estas condiciones en persona.'}).check();
  const send = sheet.getByRole('button', {name: 'Registrar y dar número'});
  await send.focus();
  await page.keyboard.press('Enter');
  await expect(sheet.getByText('No hay plazas suficientes.')).toBeVisible();
  await expect(send).toBeFocused();
});
