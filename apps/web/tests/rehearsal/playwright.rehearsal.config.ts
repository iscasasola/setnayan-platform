import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the RELEASE REHEARSAL walk only
 * (`.github/workflows/release-rehearsal.yml`).
 *
 * Separate from `apps/web/playwright.config.ts` on purpose: `pnpm test:e2e`
 * (the `e2e` workflow, a required check on every PR) must never pick this up —
 * it needs a seeded database, which only the rehearsal workflow has.
 *
 * One worker, no retries: the walk is ONE story in order (the guest's reply
 * must exist before the host can see it), and a retry would hide a step that
 * only works the second time — which is exactly what a rehearsal is for.
 *
 * 375×812 with an Android Chrome identity: the owner approves every screen at
 * 375, and the engine is Chromium, so the identity matches the engine.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /journey\.spec\.ts$/,
  timeout: 20 * 60_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    ...devices['Pixel 5'],
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    baseURL: process.env.REHEARSAL_BASE_URL || 'http://localhost:3000',
    headless: true,
    locale: 'en-PH',
    timezoneId: 'Asia/Manila',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: 'off',
    video: 'off',
  },
});
