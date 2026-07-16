import { test, expect } from '@playwright/test';

/**
 * Creator-economy PUBLIC surfaces — browser-level smoke (creator-loop
 * verification suite, 2026-07-17).
 *
 * Runs against the same no-real-DB server the rest of the e2e job uses
 * (dummy Supabase env). With zero reachable data these pages must degrade to
 * their honest EMPTY/DENY states — which is exactly the deny-by-default
 * behavior under test:
 *
 *   • /realstories renders the hub WITHOUT the "From Our Storytellers" shelf
 *     (publish ≠ listed; zero featured chapters ⇒ no #storytellers section —
 *     the S1 shelf contract).
 *   • an unknown /u/[slug] profile 404s (strangers can't distinguish
 *     "hidden" from "nonexistent").
 *   • an unknown chapter URL under a profile 404s.
 *
 * The DB half of the loop (RLS, featuring predicate, escrow money paths) is
 * exercised for real in tests/db/creator-loop.db.test.ts against a full
 * migration replay. (/realstories is ISR-prerendered at build time with its
 * loader errors caught, so it serves its empty state under the standard dummy
 * e2e env — no extra env vars needed.)
 */
test.describe('Creator public surfaces', () => {
  test('/realstories renders the hub with NO storytellers shelf when nothing is featured', async ({
    page,
  }) => {
    const res = await page.goto('/realstories');
    expect(res?.status()).toBe(200);

    // The hub itself is up (h1 present).
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Deny-by-default: zero featured chapters ⇒ the shelf section is absent
    // entirely — no #storytellers anchor, no "From Our Storytellers" label.
    await expect(page.locator('#storytellers')).toHaveCount(0);
    await expect(page.getByText('From Our Storytellers')).toHaveCount(0);
  });

  test('unknown /u/[slug] profile fails closed (never renders a profile)', async ({ page }) => {
    // With a real DB an unknown slug is a clean 404 (resolvePublicProfile →
    // notFound()). In this no-DB e2e environment the resolver's Supabase call
    // fails at the network layer and the route surfaces an error status
    // instead — still fail-closed. Assert the contract observable in both
    // environments: an error status and no profile content.
    const res = await page.goto('/u/__no_such_storyteller__');
    expect(res?.status()).toBeGreaterThanOrEqual(400);
    await expect(page.getByText('__no_such_storyteller__')).toHaveCount(0);
  });

  test('unknown chapter under a profile 404s', async ({ page }) => {
    const res = await page.goto('/u/__no_such_storyteller__/c/S89C-0000000000');
    expect(res?.status()).toBe(404);
  });
});
