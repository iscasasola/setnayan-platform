import { test, expect } from '@playwright/test';

/**
 * Homepage critical-path tests (Task #35).
 *
 * Renders the marketing-site landing page and asserts the load-bearing CTAs are
 * present. If this test breaks, signup conversion is broken — every other test
 * in the suite assumes a couple can land on `/` and see the primary action
 * surface.
 *
 * 2026-06-29 — ELN-style homepage reskin (PR #2432). The homepage is now the
 * cinematic no-scroll gate rendered by `HomeReskin`
 * (apps/web/app/_components/home/HomeReskin.tsx). The OLD "_sections.tsx" hero
 * ("Your wedding is one day." / "Keep it forever.") was removed. These
 * assertions target the reskin's INITIAL gate state — everything checked here is
 * visible on load WITHOUT opening the gate (no scroll/unlock required):
 *   • h1 `.hr-htitle` → "Keep your memories." / "Plan your moments."
 *   • eyebrow `.hr-kick` → the brand phrase "Set na 'yan"
 *   • hero primary CTA → "Start planning · free" link → /onboarding/wedding
 *   • nav "Sign in" link → /login (the real Google + Apple + email auth)
 *
 * The gate is a client island, so the elements hydrate after first paint;
 * Playwright's auto-waiting handles that. All four assertions are above the
 * fold in the gate, so none depend on the unlock/scroll interaction.
 */
test.describe('Homepage', () => {
  test('renders with primary CTAs', async ({ page }) => {
    await page.goto('/');

    // Hero headline — the reskin's h1 carries both lines (a <br> between them),
    // so the accessible name is "Keep your memories.Plan your moments.". Match
    // each line independently so a copy tweak to one doesn't fail the smoke test.
    const heroHeading = page.getByRole('heading', { name: /Keep your memories/i });
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toHaveText(/Plan your moments/i);

    // Brand phrase — the eyebrow keeps "Set na 'yan" (any apostrophe codepoint).
    await expect(page.getByText(/Set na/i).first()).toBeVisible();

    // Hero primary CTA — "Start planning · free" → /onboarding/wedding. (Uses a
    // non-breaking space around the middot, so match the leading words only.)
    const startPlanning = page.getByRole('link', { name: /Start planning/i }).first();
    await expect(startPlanning).toBeVisible();
    await expect(startPlanning).toHaveAttribute('href', '/onboarding/wedding');

    // Nav sign-in — the reskin's glass nav ships a "Sign in" link → the real
    // /login (Google + Apple + email). Visible in the gate on every viewport.
    const signIn = page.getByRole('link', { name: /^Sign in$/i }).first();
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', '/login');
  });

  test('homepage responds with 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });
});
