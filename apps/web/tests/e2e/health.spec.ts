import { test, expect } from '@playwright/test';

/**
 * Health-endpoint tests (Task #35).
 *
 * `/api/health` is a shallow liveness probe and MUST always return 200
 * with `{ ok: true }` regardless of downstream service state — Better
 * Stack uptime monitoring (per iteration 0035) polls this every 60s
 * and a non-200 pages the on-call engineer.
 *
 * `/api/health/deep` is the dependency-aware probe (Supabase + R2 +
 * Resend + Sentry). It returns 200 when everything is reachable, 503
 * when a dependency is down. In CI the test environment may not have
 * all envs wired, so 503 is an acceptable response — the assertion
 * here is "the route doesn't crash", not "everything is healthy."
 */
test.describe('Health endpoints', () => {
  test('/api/health returns 200 with ok=true', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('/api/health/deep returns 200 or 503', async ({ request }) => {
    const res = await request.get('/api/health/deep');
    // 503 is acceptable when env vars are unset in the test environment
    // (CI preview deployments wire real envs; local `pnpm dev` against
    // a partial .env will surface 503 with a degraded-dependency body).
    expect([200, 503]).toContain(res.status());
  });
});
