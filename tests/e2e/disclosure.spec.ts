// Features that moved behind a button stay one tap away, keep their state honest, and leave
// the required facts in view: the phone menu, the announced policy's quote, the reservation
// sheet's note, "Cambiar" links and the Instagram handoff.
import {expect, test} from '@playwright/test';
import {invisibleInMain, isDesktop} from './fixtures.ts';

test('phones keep the site links behind "Menú"; computers show them inline', async ({page}) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', {name: 'Principal'});
  const menu = page.getByRole('button', {name: 'Menú'});
  if (isDesktop(page)) {
    await expect(menu).toBeHidden();
    await expect(nav.getByRole('link', {name: 'Condiciones'})).toBeVisible();
    return;
  }
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', {name: 'Condiciones'})).toBeVisible();
  await expect(nav.getByRole('link', {name: 'Calendario'})).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', {name: 'Condiciones'}).click();
  await expect(page.getByRole('heading', {level: 1, name: 'Condiciones de reservación'})).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('the announced policy keeps its label in view and its quote behind a button', async ({page}) => {
  await page.goto('/funciones/demo-shrek-1/');
  const detail = page.locator('article').first();
  await expect(detail.getByText('Anunciada; fecha de efectividad por confirmar')).toBeVisible();
  await expect(detail.getByText('Aplica solo si los dueños la confirman.')).toBeVisible();
  const quote = detail.locator('blockquote');
  await expect(quote).toHaveCount(0);
  const open = detail.getByRole('button', {name: 'Leer el texto de su publicación'});
  await expect(open).toHaveAttribute('aria-expanded', 'false');
  await open.click();
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  await expect(quote).toBeVisible();
  await expect(detail.getByRole('link', {name: 'Ver la publicación original'})).toBeVisible();
});

test('the sheet names the session, edits from the review, and keeps the Instagram message behind a button', async ({
  page,
}, info) => {
  const name = `Cliente e2e aviso ${info.project.name}`;
  await page.goto('/funciones/demo-shrek-1/');
  await page.getByRole('button', {name: 'Solicitar plazas'}).click();
  const dialog = page.getByRole('dialog');
  const step = (title: string | RegExp) =>
    expect(dialog.getByRole('heading', {name: title, exact: true})).toBeVisible();
  await step('Sesión');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Tu grupo');
  // Focus follows the step, after the previous step's exit animation, so the change is announced.
  await expect(dialog.getByRole('heading', {name: 'Tu grupo', exact: true})).toBeFocused();
  await expect(dialog.getByText('DEMO · Cena inspirada en Shrek', {exact: true})).toBeVisible();
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Datos de contacto');
  await dialog.getByLabel('Nombre de quien reserva').fill(name);
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill('787-555-0143');
  // The note is optional, so it waits behind its own button.
  await expect(dialog.getByLabel('Nota (opcional)')).toHaveCount(0);
  await dialog.getByRole('button', {name: 'Añadir una nota (opcional)'}).click();
  await dialog.getByLabel('Nota (opcional)').fill('Una silla alta.');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Revisa tu solicitud');
  // "Cambiar" goes back to that step and keeps what was typed.
  await dialog.getByRole('button', {name: 'Cambiar Tu grupo'}).click();
  await step('Tu grupo');
  await dialog.getByRole('button', {name: 'Una persona más'}).click();
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Datos de contacto');
  await expect(dialog.getByLabel('Nota (opcional)')).toHaveValue('Una silla alta.');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Revisa tu solicitud');
  await expect(dialog).toContainText('3 personas');
  await dialog.getByRole('button', {name: 'Enviar solicitud'}).click();
  await expect(dialog.getByText(/^Solicitud recibida/)).toBeVisible();
  await expect(dialog.getByRole('heading', {name: /^Solicitud recibida/})).toBeFocused();
  // The receipt still names its session (DEMO included), in the sheet's fixed header.
  await expect(dialog.getByText('DEMO · Cena inspirada en Shrek', {exact: true})).toBeInViewport();
  // The handoff is optional: closed until asked for, and its message reads cleanly.
  const handoff = dialog.getByRole('button', {name: 'Avísales por Instagram'});
  await expect(handoff).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog.getByRole('textbox', {name: 'Avísales por Instagram'})).toHaveCount(0);
  await handoff.click();
  const message = dialog.getByRole('textbox', {name: 'Avísales por Instagram'});
  await expect(message).toBeVisible();
  const text = await message.inputValue();
  expect(text).toMatch(/^Hola\. Envié la solicitud PAP-/);
  expect(text).toContain('Somos 3 personas.');
  expect(text).not.toContain('..');
  await expect(dialog.getByRole('button', {name: 'Copiar mensaje y abrir Instagram'})).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Hacer otra solicitud'})).toBeVisible();
  await expect(dialog.getByRole('link', {name: 'Ver mi reservación'})).toBeVisible();
});

test('every guest page finishes showing its content (none stays invisible)', async ({page}) => {
  for (const path of [
    '/',
    '/funciones/demo-prueba-a/',
    '/funciones/demo-shrek-1/',
    '/politicas/',
    '/reservacion/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/',
    '/no-existe/',
  ]) {
    await page.goto(path);
    expect(await invisibleInMain(page), path).toEqual([]);
  }
});

test('a missing acceptance brings its checkbox and error into view', async ({page}) => {
  await page.goto('/funciones/demo-prueba-a/');
  await page.getByRole('button', {name: 'Reservar plazas'}).click();
  const dialog = page.getByRole('dialog');
  const step = (title: string | RegExp) =>
    expect(dialog.getByRole('heading', {name: title, exact: true})).toBeVisible();
  await step('Sesión');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Tu grupo');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Datos de contacto');
  await dialog.getByLabel('Nombre de quien reserva').fill('Cliente e2e sin aceptar');
  await dialog.getByRole('textbox', {name: 'Teléfono'}).fill('787-555-0144');
  await dialog.getByRole('button', {name: 'Continuar'}).click();
  await step('Revisa tu reservación');
  await dialog.getByRole('button', {name: 'Reservar plazas'}).click();
  await expect(dialog.getByRole('checkbox', {name: 'Acepto estas condiciones.'})).toBeFocused();
  await expect(dialog.getByText('Acepta las condiciones para continuar.')).toBeInViewport();
});
