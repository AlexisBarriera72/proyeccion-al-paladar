// Brief §13.7: the same Puerto Rico times from any device time zone, and correct .ics instants.
import {expect, test} from '@playwright/test';

async function whenText(browser: import('@playwright/test').Browser, timezoneId: string) {
  const context = await browser.newContext({timezoneId, locale: 'es-PR', baseURL: 'http://127.0.0.1:8788'});
  const page = await context.newPage();
  await page.goto('/funciones/demo-prueba-a/');
  const text = await page.locator('article dd').first().innerText();
  await context.close();
  return text;
}

test('Los Angeles and Madrid see Puerto Rico time', async ({browser, request}, info) => {
  test.skip(info.project.name !== 'desktop');
  const pr = await whenText(browser, 'America/Puerto_Rico');
  expect(await whenText(browser, 'America/Los_Angeles')).toBe(pr);
  expect(await whenText(browser, 'Europe/Madrid')).toBe(pr);
  expect(pr).toContain('hora de Puerto Rico');
  // The instant behind it is the API's UTC value; 7:30 p. m. in Puerto Rico is 23:30 UTC.
  const {session} = await (await request.get('/api/public/sessions/demo-prueba-a')).json();
  expect(new Date(session.startsAt).toISOString()).toMatch(/T23:30:00\.000Z$/);
});
