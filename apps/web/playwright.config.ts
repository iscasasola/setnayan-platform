import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Setnayan (Task #35).
 *
 * Critical-path E2E tests live in `./tests/e2e`. Per the multiple agent
 * audits flagging "no E2E test infrastructure", this is the foundation
 * future PRs extend by copying patterns from the six tests shipped today.
 *
 * V1 scope: Chromium only. Firefox + WebKit add CI time without catching
 * the bugs Setnayan actually ships (PH market is Chromium-heavy via
 * Chrome / Edge / Brave / Samsung Internet; Safari + Firefox round out
 * later in V1.x once V1 launch reliability is proven).
 *
 * baseURL defaults to localhost:3000 so `pnpm test:e2e` works against
 * a local `pnpm dev`. CI sets `E2E_BASE_URL` to the Vercel preview URL.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // CI gets two retries to absorb cold-start flake on the Vercel preview.
  // Locally, fail fast so the dev sees the real failure mode immediately.
  retries: process.env.CI ? 2 : 0,
  // GitHub Actions reporter on CI for inline annotations; HTML for local
  // so the dev can open the trace + screenshots after a failed run.
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 800 },
    // Capture a Playwright trace ONLY on the first retry — keeps CI
    // artifact size sane while still giving us a trace to inspect when
    // a flake reproduces.
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
