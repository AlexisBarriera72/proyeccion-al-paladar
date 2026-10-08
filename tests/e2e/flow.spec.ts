// The reservation flow end to end, its honest results, and interrupted or offline submits.
import {expect, test, type Page} from '@playwright/test';
import fs from 'node:fs';
import {bookingCount} from './fixtures.ts';

/** Downloads the .ics the way a guest does (the CSP rightly blocks fetching blob: URLs). */
async function icsText(page: Page): Promise<string> {
  const link = page.getByRole('link', {name: 'Añadir a mi calendario'});
  await expect(link).toHaveAttribute('download', /\.ics$/);
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  return fs.readFileSync((await download.path())!, 'utf8');
}

/** Steps change with an exit animation; each step's heading says the new step is in place. */
async function fillToReview(page: Page, name: string, phone = '787-555-0142') {
  const dialog = page.getByRole('dialog');
  const step = (title: string | RegExp) =>
    expect(dialog.getByRole('heading', {name: title, exact: true})).toBeVisible();
  await step('Sesión');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Tu grupo');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Datos de contacto');
  await dialog.getByLabel('Nombre de quien reserva').fill(name);
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill(phone);
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await expect(dialog.getByRole('heading', {name: /^Revisa tu (reservación|solicitud)$/})).toBeVisible();
}

test('reserve a self-confirmable session: confirmed, with a link and a calendar file', async ({page}, info) => {
  const name = `Cliente e2e reserva ${info.project.name}`;
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  await fillToReview(page, name);
  await expect(page.getByText('Al confirmar, se reservan tus plazas.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(page.getByText('Acepta las condiciones para continuar.')).toBeVisible();
  await page.getByRole('checkbox', {name: 'Acepto estas condiciones.'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(page.getByRole('heading', {name: 'Reservación confirmada'})).toBeVisible();
  await expect(
    page.getByText('No te enviamos ningún mensaje. Guarda este enlace para ver tu solicitud.'),
  ).toBeVisible();
  expect(await icsText(page)).toContain('STATUS:CONFIRMED');
  await page.getByRole('link', {name: 'Ver mi reservación'}).click();
  await expect(page.getByRole('heading', {level: 1, name: 'Tu reservación'})).toBeVisible();
  await expect(page.getByText('Confirmada', {exact: true})).toBeVisible();
  expect(await bookingCount(page, name)).toBe(1);
});

test('request seats: received, never called confirmed, and the .ics is tentative', async ({page}, info) => {
  const name = `Cliente e2e solicitud ${info.project.name}`;
  await page.goto('/funciones/demo-shrek-1/');
  await page.getByRole('button', {name: 'Solicitar plazas'}).click();
  await fillToReview(page, name);
  await page.getByRole('button', {name: 'Enviar solicitud'}).click();
  await expect(
    page.getByText('Solicitud recibida. El equipo debe confirmar disponibilidad y condiciones.'),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).not.toContainText(/confirmada|pagad|enviamos tu/i);
  const content = await icsText(page);
  expect(content).toContain('STATUS:TENTATIVE');
  expect(content).toContain('SUMMARY:Solicitud pendiente:');
});

test('a lost response is retried with the same key and saved once', async ({page}, info) => {
  const name = `Cliente e2e perdida ${info.project.name}`;
  let interrupted = false;
  await page.route('**/api/public/bookings', async route => {
    if (interrupted) return route.continue();
    interrupted = true;
    await route.fetch(); // the server receives and saves it...
    await route.abort(); // ...but the answer never arrives
  });
  await page.goto('/funciones/demo-shrek-1/');
  await page.getByRole('button', {name: 'Solicitar plazas'}).click();
  await fillToReview(page, name);
  await page.getByRole('button', {name: 'Enviar solicitud'}).click();
  await expect(page.getByText('No sabemos si llegó tu solicitud. Vuelve a intentarlo; no se duplicará.')).toBeVisible();
  await page.getByRole('button', {name: 'Intentar de nuevo'}).click();
  await expect(page.getByText(/^Solicitud recibida/)).toBeVisible();
  expect(await bookingCount(page, name)).toBe(1);
});

test('offline: nothing is sent and the draft stays', async ({page, context}, info) => {
  const name = `Cliente e2e sin red ${info.project.name}`;
  await page.goto('/funciones/demo-shrek-1/');
  await page.getByRole('button', {name: 'Solicitar plazas'}).click();
  await fillToReview(page, name);
  await context.setOffline(true);
  await page.getByRole('button', {name: 'Enviar solicitud'}).click();
  await expect(page.getByText('Estás sin conexión. Tu solicitud no se envió.')).toBeVisible();
  await expect(page.getByText(/^Solicitud recibida/)).toHaveCount(0);
  await context.setOffline(false);
  await page.reload();
  await page.getByRole('button', {name: 'Solicitar plazas'}).click();
  await expect(page.getByRole('heading', {name: 'Revisa tu solicitud'})).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(name);
  expect(await bookingCount(page, name)).toBe(0);
});

test('the dialog holds focus and returns it on Escape', async ({page}) => {
  await page.goto('/funciones/demo-prueba-a/');
  const trigger = page.getByRole('button', {name: 'Reservar plazas'});
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
