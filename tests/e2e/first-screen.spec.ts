// Brief §13.1 and DESIGN.md "The first screen": before scrolling, the business name, the
// Calendario heading, the month controls and the first session with its action.
import {expect, test} from '@playwright/test';
import {inFirstViewport, isDesktop, noHorizontalScroll} from './fixtures.ts';

const sizes = [
  {project: 'desktop', width: 1440, height: 900},
  {project: 'mobile', width: 390, height: 844},
  {project: 'mobile', width: 360, height: 640},
];

for (const size of sizes) {
  test(`first screen at ${size.width}×${size.height}`, async ({page}, info) => {
    test.skip(info.project.name !== size.project);
    await page.setViewportSize({width: size.width, height: size.height});
    await page.goto('/');
    const name = page.getByRole('link', {name: /Proyección al Paladar/}).first();
    const heading = page.getByRole('heading', {level: 1, name: 'Calendario'});
    await expect(heading).toBeVisible();
    expect(await inFirstViewport(page, name)).toBe(true);
    expect(await inFirstViewport(page, heading)).toBe(true);
    expect(await inFirstViewport(page, page.getByRole('button', {name: 'Mes siguiente'}))).toBe(true);
    expect(await inFirstViewport(page, page.getByRole('button', {name: 'Hoy'}))).toBe(true);
    if (isDesktop(page)) {
      const first = page.getByRole('table').getByRole('button').first();
      await expect(first).toBeVisible();
      expect(await inFirstViewport(page, first)).toBe(true);
      expect(await inFirstViewport(page, page.getByRole('button', {name: 'Ver detalles'}))).toBe(true);
    } else {
      const first = page.locator('main a[href^="/funciones/"]').first();
      await expect(first).toBeVisible();
      expect(await inFirstViewport(page, first)).toBe(true);
    }
    // No centered promotional hero: the page title is left-aligned.
    expect(await heading.evaluate(el => getComputedStyle(el).textAlign)).not.toBe('center');
    await noHorizontalScroll(page);
  });
}
