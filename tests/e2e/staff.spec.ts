// Staff: access by role, the restricted Staff role, manual entry with a duplicate warning,
// recording a test payment before confirming, the "Más acciones" menu, the section links on
// computers and phones, and Configuración's tabs.
import {expect, test} from '@playwright/test';
import {OWNER, STAFF} from './fixtures.ts';

const SECTIONS = [
  'Calendario',
  'Esta noche',
  'Sesiones',
  'Reservaciones',
  'Excepciones',
  'Pedidos',
  'Experiencias',
  'Configuración',
  'Historial',
];

test('an email that is not on the team gets no access', async ({page}) => {
  await page.setExtraHTTPHeaders({'x-test-access-email': 'nadie@example.com'});
  const response = await page.goto('/equipo/');
  expect(response?.status()).toBe(403);
  await expect(page.getByText('Sin acceso al área del equipo')).toBeVisible();
});

test('the Staff role sees settings it cannot change, and no demo reset', async ({page}) => {
  await page.setExtraHTTPHeaders(STAFF);
  await page.goto('/equipo/configuracion/');
  await expect(page.getByText('Solo un dueño puede cambiar la configuración.').first()).toBeVisible();
  await expect(page.getByLabel('Confirmaciones en línea')).toBeDisabled();
  await expect(page.getByRole('heading', {name: 'Restablecer demostración'})).toHaveCount(0);
});

test('a request entered by hand warns about a possible duplicate', async ({page}) => {
  await page.setExtraHTTPHeaders(OWNER);
  await page.goto('/equipo/reservaciones/nueva/?session=demo-shrek-1');
  await page.getByLabel('Nombre', {exact: true}).fill('Cliente de prueba 03');
  await expect(page.getByText('Posible duplicado en esta sesión, con el mismo nombre o contacto:')).toBeVisible();
});

test('record a test payment, then confirm', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop', 'one run changes the shared booking');
  await page.setExtraHTTPHeaders(OWNER);
  await page.goto('/equipo/reservaciones/');
  await page.getByLabel('Buscar por nombre, contacto o referencia').fill('Cliente de prueba 04');
  await page.getByRole('link', {name: /Cliente de prueba 04/}).click();
  await expect(page.getByText('Pendiente de pago').first()).toBeVisible();
  // The payment form opens in a dialog from the Pagos panel; its submit has the same name.
  await page.getByRole('button', {name: 'Registrar movimiento'}).click();
  await page.getByRole('dialog').getByLabel('Monto (USD)').fill('2.00');
  await page.getByRole('dialog').getByRole('button', {name: 'Registrar movimiento'}).click();
  await expect(page.getByText('Movimiento registrado.')).toBeVisible();
  await expect(page.getByText(/Neto recibido: \$2\.00/)).toBeVisible();
  await page.getByRole('button', {name: 'Confirmar', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Confirmar', exact: true}).click();
  await expect(page.getByText('Hecho.')).toBeVisible();
  await expect(page.getByText('Confirmada').first()).toBeVisible();
});

test('a rare booking action opens from "Más acciones", and Escape returns focus there', async ({page}) => {
  await page.setExtraHTTPHeaders(OWNER);
  await page.goto('/equipo/reservaciones/');
  await page.getByLabel('Buscar por nombre, contacto o referencia').fill('Cliente de prueba 03');
  await page.getByRole('link', {name: /Cliente de prueba 03/}).click();
  await expect(page.getByRole('heading', {level: 1, name: 'Cliente de prueba 03'})).toBeVisible();
  const more = page.getByRole('button', {name: 'Más acciones'});
  await more.click();
  await expect(page.getByRole('menu')).toBeVisible();
  // "Crear enlace nuevo" is offered on every status; Escape closes its dialog without sending.
  await page.getByRole('menuitem', {name: 'Crear enlace nuevo'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', {name: 'Crear enlace nuevo'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(page.getByText('Enlace nuevo. Cópialo ahora; no se volverá a mostrar.')).toHaveCount(0);
});

test('the nine sections: one header row on computers, a "Secciones" sheet on phones', async ({page}, info) => {
  await page.setExtraHTTPHeaders(OWNER);
  await page.goto('/equipo/');
  await expect(page.getByRole('heading', {level: 1, name: 'Calendario'})).toBeVisible();
  if (info.project.name === 'mobile') {
    await expect(page.getByRole('navigation', {name: 'Secciones del equipo'})).toHaveCount(0);
    await page.getByRole('button', {name: 'Secciones'}).click();
    const nav = page.getByRole('dialog').getByRole('navigation', {name: 'Secciones del equipo'});
    await expect(nav.getByRole('link')).toHaveCount(SECTIONS.length);
    for (const name of SECTIONS) await expect(nav.getByRole('link', {name: new RegExp(`^${name}`)})).toBeVisible();
    await nav.getByRole('link', {name: /^Reservaciones/}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', {level: 1, name: 'Reservaciones'})).toBeVisible();
  } else {
    await expect(page.getByRole('button', {name: 'Secciones'})).toHaveCount(0);
    const nav = page.getByRole('navigation', {name: 'Secciones del equipo'});
    await expect(nav.getByRole('link')).toHaveCount(SECTIONS.length);
    for (const name of SECTIONS) await expect(nav.getByRole('link', {name: new RegExp(`^${name}`)})).toBeVisible();
  }
});

test('Configuración opens the tab its link names', async ({page}) => {
  await page.setExtraHTTPHeaders(OWNER);
  await page.goto('/equipo/configuracion/?tab=lugares');
  await expect(page.getByRole('tab', {name: 'Lugares'})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', {name: 'Reglas'})).toHaveAttribute('aria-selected', 'false');
  const panel = page.getByRole('tabpanel', {name: 'Lugares'});
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', {name: 'Nuevo lugar'})).toBeEnabled();
  await expect(panel.getByRole('button', {name: 'Editar Sala de prueba (DEMO)'})).toBeVisible();
  // Only the chosen tab is mounted, so the rules are not on the page.
  await expect(page.getByLabel('Confirmaciones en línea')).toHaveCount(0);
});
