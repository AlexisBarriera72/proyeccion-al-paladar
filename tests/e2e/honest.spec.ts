// Brief §13.9 and §13.13: unknowns stay unknown, the announced policy is quoted and labeled,
// photos carry their source, and nothing reads like a review or a fake checkout.
import {expect, test} from '@playwright/test';

test('a session without approved details says "por confirmar"', async ({page}) => {
  await page.goto('/funciones/demo-shrek-1/');
  const detail = page.locator('article').first();
  await expect(detail.getByText('Precio por confirmar')).toBeVisible();
  await expect(detail.getByText('Lugar por confirmar')).toBeVisible();
  await expect(detail).not.toContainText('$0');
  await expect(detail.getByText('Anunciada; fecha de efectividad por confirmar')).toBeVisible();
  await expect(detail.getByText('Aplica solo si los dueños la confirman.')).toBeVisible();
});

test('photos name their source and pending permission', async ({page}) => {
  await page.goto('/');
  await expect(
    page.getByText('Evento anterior. Fuente: @proyeccionalpaladarpr. Permiso de uso por confirmar.').first(),
  ).toBeVisible();
});

test('no reviews, ratings or checkout anywhere a guest goes', async ({page}) => {
  for (const path of ['/', '/funciones/demo-prueba-b/', '/politicas/']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText(/★|estrellas|reseña|testimonio|tarjeta de crédito|checkout/i);
  }
});

test('the terms page shows the approved terms in force', async ({page}) => {
  await page.goto('/politicas/');
  await expect(page.getByRole('heading', {name: 'Vigentes'})).toBeVisible();
  await expect(page.getByText(/^Vigente desde/).first()).toBeVisible();
});
