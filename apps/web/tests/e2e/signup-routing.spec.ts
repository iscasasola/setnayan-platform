import { test, expect } from '@playwright/test';

/**
 * Signup routing + 404 tests (Task #35).
 *
 * Verifies the two signup variants (couple-default + vendor via
 * `?as=vendor`) don't 500 + that the email field is reachable for
 * keyboard-first signups. Also verifies the 404 surface renders the
 * editorial-brand-voice copy from `apps/web/app/not-found.tsx`
 * (per `feedback_setnayan_no_dev_text_post_launch` — terse, polite,
 * no dev jargon).
 *
 * Doesn't actually submit the form (would write a real auth row);
 * a separate auth-flow test can mock Supabase + drive the full path.
 */
test.describe('Signup routing', () => {
  test('/signup renders couple form with email field', async ({ page }) => {
    await page.goto('/signup');
    // The signup page has its own heading; first H1/H2 should be visible
    await expect(page.getByRole('heading').first()).toBeVisible();
    // Email input is labeled "Email" with htmlFor="email" — getByLabel
    // resolves through the label-for association.
    await expect(page.getByLabel(/^Email$/i)).toBeVisible();
  });

  test('/signup?as=vendor renders vendor variant', async ({ page }) => {
    const res = await page.goto('/signup?as=vendor');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('unknown route returns 404 with editorial copy', async ({ page }) => {
    // Use a deeply-nested path under `/dashboard/` that doesn't match
    // any segment-defined route. A top-level slug like `/anything` is
    // caught by `app/[slug]/page.tsx` (the personal-invitation handler
    // from iteration 0002), which in test/dev environments without
    // Supabase credentials throws 500 instead of `notFound()` — that's
    // an env-dependent path, not a 404 surface. The nested-dashboard
    // path is unambiguous: no route matches, Next routes to not-found.
    const res = await page.goto('/dashboard/__no_such_event__/__no_such_section__/__no_such_leaf__');
    expect(res?.status()).toBe(404);
    // Copy from `apps/web/app/not-found.tsx` line 14 — the editorial
    // model that supersedes "skeleton placeholder" dev jargon.
    await expect(
      page.getByText(/doesn.+t exist on Setnayan/i),
    ).toBeVisible();
  });
});
