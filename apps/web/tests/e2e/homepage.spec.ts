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
 *   • nav "Sign in" button → opens the login popup overlay (owner 2026-06-30:
 *     "login should be like the rest of the upper menu. a popup") — the real
 *     Google + Apple + email auth, now in a dialog instead of a link to /login
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

    // Nav sign-in — owner 2026-06-30 "login should be like the rest of the upper
    // menu. a popup." Pressing it must open the real login (Google + Apple +
    // email) OVER this page and must NOT navigate.
    //
    // ⚠ THIS ASSERTED `getByRole('button')` UNTIL 2026-08-13, and that pinned
    // the wrong thing. The control is now a real <Link href="/login"> whose
    // press is intercepted — deliberately, so it still works before hydration
    // and with JavaScript off, supports middle-click / open-in-new-tab, and
    // satisfies `@next/next/no-html-link-for-pages`. `aria-haspopup="dialog"`
    // keeps that truthful to a screen reader: a link, that opens a dialog.
    //
    // 🔑 SO THIS NOW ASSERTS THE RULE INSTEAD OF THE ELEMENT — the dialog opens
    // AND THE URL DOES NOT CHANGE. The old version never checked the second
    // half, which is the actual owner instruction: a popup, not a navigation.
    // Element type is an implementation detail; "you did not leave the page" is
    // the promise.
    const urlBefore = page.url();
    const signIn = page.getByRole('link', { name: /^Sign in$/i }).first();
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('aria-haspopup', 'dialog');
    await signIn.click();
    // The popup is a role=dialog labelled "Sign in" carrying the email field +
    // the "Continue" submit — assert it opens (the popup behavior the owner
    // asked for).
    const dialog = page.getByRole('dialog', { name: /^Sign in$/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/^Email$/i)).toBeVisible();
    // And we are still on the page we started on — no navigation happened.
    expect(page.url()).toBe(urlBefore);
  });

  test('homepage responds with 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });
});
