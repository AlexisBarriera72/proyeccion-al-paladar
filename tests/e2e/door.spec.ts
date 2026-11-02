// The door: the booking number guests show on arrival, their number by text (the local test
// server's stand-in provider sends nothing), Recepción's search and guests who arrive without a
// reservation. Also the reservation sheet's fixes from the November review.
import {randomUUID} from 'node:crypto';
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

test('a guest who asks gets their number by text, and the receipt and their page show it large', async ({
  page,
}, info) => {
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await toContact(page);
  const dialog = page.getByRole('dialog');
  const name = `Cliente e2e texto ${info.project.name}`;
  await dialog.getByLabel('Nombre de quien reserva').fill(name);
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill('787-555-0142');
  await dialog.getByRole('checkbox', {name: 'Envíame mi número de reservación por texto cuando se confirme.'}).check();
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await expect(dialog.getByText('Pediste tu número por texto.')).toBeVisible();
  await dialog.getByRole('checkbox', {name: 'Acepto estas condiciones.'}).check();
  await dialog.getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(dialog.getByRole('heading', {name: 'Reservación confirmada'})).toBeVisible();
  // The number for the door, large, and what the provider answered: nothing more.
  const ticket = dialog.locator('[data-ticket]');
  await expect(ticket.getByText('Tu número para la entrada')).toBeVisible();
  await expect(ticket.getByText(/^PAP-[A-Z0-9]{6}$/)).toBeVisible();
  const size = await ticket.getByText(/^PAP-[A-Z0-9]{6}$/).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(32);
  await expect(ticket.getByText('Muéstralo en la entrada al llegar.')).toBeVisible();
  await expect(
    dialog.getByText('Te enviamos tu número por texto al ••• 0142. Guarda este enlace para ver tu reservación.'),
  ).toBeVisible();
  await expect(dialog.getByText('No te enviamos ningún mensaje', {exact: false})).toHaveCount(0);
  await page.getByRole('link', {name: 'Ver mi reservación'}).click();
  const door = page.locator('[data-door-number]');
  await expect(door.getByText('Tu número para la entrada')).toBeVisible();
  await expect(door.getByText(/^PAP-[A-Z0-9]{6}$/)).toBeVisible();
  await expect(door.getByText('Te enviamos tu número por texto al ••• 0142.')).toBeVisible();
  await release(page, name);
});

test('without the guest asking, no text is sent and the receipt says no message was sent', async ({page}, info) => {
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await toContact(page);
  const dialog = page.getByRole('dialog');
  const name = `Cliente e2e sin texto ${info.project.name}`;
  await dialog.getByLabel('Nombre de quien reserva').fill(name);
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill('787-555-0143');
  await expect(dialog.getByRole('checkbox', {name: /por texto/})).not.toBeChecked();
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await dialog.getByRole('checkbox', {name: 'Acepto estas condiciones.'}).check();
  await dialog.getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(dialog.getByRole('heading', {name: 'Reservación confirmada'})).toBeVisible();
  await expect(
    dialog.getByText('No te enviamos ningún mensaje. Guarda este enlace para ver tu solicitud.'),
  ).toBeVisible();
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
  await sheet
    .getByRole('checkbox', {name: 'El cliente aceptó recibir su número por texto cuando se confirme.'})
    .check();
  // The terms must be accepted in person first.
  await sheet.getByRole('button', {name: 'Registrar y dar número'}).click();
  await expect(sheet.getByText('Confirma que el cliente aceptó las condiciones.')).toBeVisible();
  await sheet.getByRole('checkbox', {name: 'El cliente leyó y aceptó estas condiciones en persona.'}).check();
  await sheet.getByRole('button', {name: 'Registrar y dar número'}).click();
  const result = sheet.locator('[data-walk-in-result]');
  await expect(result.getByText('Número para la entrada')).toBeVisible();
  await expect(result.getByText(/^PAP-[A-Z0-9]{6}$/)).toBeVisible();
  await expect(result.getByText(/^Confirmada\. Llegada registrada a las /)).toBeVisible();
  await expect(result.getByText(/^Número enviado por texto a ••• 01(77|78)\.$/)).toBeVisible();
  await sheet.getByRole('button', {name: 'Listo'}).click();
  // Their booking is on tonight's list, already arrived.
  await page.getByRole('searchbox', {name: 'Número, nombre o teléfono'}).fill(name);
  await expect(page.getByRole('link', {name})).toBeVisible();
  await expect(page.getByText(/^Llegó a las /)).toBeVisible();
  await release(page, name);
});
