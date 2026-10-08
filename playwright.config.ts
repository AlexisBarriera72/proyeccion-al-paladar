import {defineConfig} from '@playwright/test';

// The browser tests run the built site on a local Worker with a fresh database
// (scripts/test-server.mjs). One worker: the tests share that database.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8788',
    browserName: 'chromium',
    locale: 'es-PR',
    timezoneId: 'America/Puerto_Rico',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node --disable-warning=ExperimentalWarning scripts/test-server.mjs',
    url: 'http://127.0.0.1:8788/api/public/config',
    // PAP_REUSE=1 reuses a server you started (scripts/test-server.mjs) while debugging one spec.
    reuseExistingServer: process.env.PAP_REUSE === '1',
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {name: 'desktop', use: {viewport: {width: 1440, height: 900}}},
    {name: 'mobile', use: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}},
  ],
});
