import {expect, type Locator, type Page} from '@playwright/test';

export const OWNER = {'x-test-access-email': 'owner@example.com'};
export const STAFF = {'x-test-access-email': 'staff@example.com'};

/** True when the element's box lies inside the first viewport. */
export async function inFirstViewport(page: Page, selector: ReturnType<Page['locator']>) {
  const box = await selector.boundingBox();
  const viewport = page.viewportSize()!;
  return Boolean(
    box && box.y >= 0 && box.y + box.height <= viewport.height && box.x >= 0 && box.x + box.width <= viewport.width,
  );
}

export async function noHorizontalScroll(page: Page) {
  const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(scroll, 'no horizontal page scroll').toBeLessThanOrEqual(width);
}

/** Bookings visible to staff for a search term (through the API, as the owner). */
export async function bookingCount(page: Page, q: string): Promise<number> {
  const response = await page.request.get(`/api/equipo/bookings?q=${encodeURIComponent(q)}`, {headers: OWNER});
  return (await response.json()).bookings.length;
}

export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

/** The element's box once the page's entry animation has settled (the same box twice in a row). */
export async function settledBox(locator: Locator) {
  let previous = '';
  for (let i = 0; i < 40; i++) {
    const box = await locator.boundingBox();
    const key = JSON.stringify(box);
    if (box && key === previous) return box;
    previous = key;
    await locator.page().waitForTimeout(100);
  }
  throw new Error('the element kept moving');
}
