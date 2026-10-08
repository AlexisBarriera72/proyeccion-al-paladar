// Idea 9: the first visit stays small; the staff area and the reservation flow load later.
import {expect, test} from '@playwright/test';
import {gzipSync} from 'node:zlib';

const BUDGET_GZIP = 160 * 1024;

test('first visit JavaScript stays within budget', async ({page}, info) => {
  test.skip(info.project.name !== 'desktop');
  const scripts: {url: string; body: Buffer}[] = [];
  page.on('response', async response => {
    if (response.request().resourceType() === 'script')
      scripts.push({url: response.url(), body: await response.body()});
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const total = scripts.reduce((sum, s) => sum + gzipSync(s.body).length, 0);
  expect(scripts.some(s => /StaffApp|ReserveFlow/.test(s.url))).toBe(false);
  expect(total).toBeLessThanOrEqual(BUDGET_GZIP);
});
