// Staff: access by role, the restricted Staff role, manual entry with a duplicate warning,
// and recording a test payment before confirming.
import {expect, test} from '@playwright/test';
import {OWNER, STAFF} from './fixtures.ts';

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
  await page.getByLabel('Monto (USD)').fill('2.00');
  await page.getByRole('button', {name: 'Registrar movimiento'}).click();
  await expect(page.getByText('Movimiento registrado.')).toBeVisible();
  await expect(page.getByText(/Neto recibido: \$2\.00/)).toBeVisible();
  await page.getByRole('button', {name: 'Confirmar', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Confirmar', exact: true}).click();
  await expect(page.getByText('Hecho.')).toBeVisible();
  await expect(page.getByText('Confirmada').first()).toBeVisible();
});
