import { test, expect } from '@playwright/test';

/**
 * Homepage critical-path tests (Task #35).
 *
 * Renders the marketing-site landing page and asserts the load-bearing
 * CTAs are present. If this test breaks, signup conversion is broken —
 * every other test in the suite assumes a couple can land on `/` and
 * see the primary action surface.
 *
 * Selectors target the actual copy on
 * `apps/web/app/_components/marketing/_sections.tsx` (the consolidated
 * marketing surface shipped via the 2026-05-28 v2.1 visual treatment
 * port · supersedes the prior `_Hero.tsx` file referenced here pre-2026-05-28)
 * plus `apps/web/app/_components/site-header.tsx`. Per the orphan-prevention
 * convention, every assertion here references a real route + real copy
 * shipping on `origin/main`.
 *
 * Hero structure note (2026-06-24 memory-home repositioning · PR-H): the h1 is
 * "Your wedding is one day." and the punchline "Keep it forever." renders as a
 * styled display span (not a heading). The brand phrase "SET NA 'YAN" stays in
 * the eyebrow above the headline, so the heading assertion targets the h1 copy
 * and the brand phrase is still verified as text via a case-insensitive
 * "Set na" match (tolerates the uppercase eyebrow + any apostrophe codepoint).
 * (CI renders this keynote fallback because no hero video is published there.)
 */
test.describe('Homepage', () => {
  test('renders with primary CTAs', async ({ page }) => {
    await page.goto('/');

    // Hero headline — `_sections.tsx` ships the h1 "Your wedding is one day."
    // with the punchline "Keep it forever." rendered as a styled span beneath.
    await expect(
      page.getByRole('heading', { name: /Your wedding is one day/i }),
    ).toBeVisible();
    // Punchline + brand phrase still present (eyebrow keeps "SET NA 'YAN").
    // "forever." is its own styled span, so match that single text node.
    await expect(page.getByText(/forever/i).first()).toBeVisible();
    await expect(page.getByText(/Set na/i).first()).toBeVisible();

    // Hero primary CTA — `_sections.tsx` ships "Start planning" → /signup.
    // Multiple instances render across the page; `.first()` picks the hero
    // one which is what couples see above the fold.
    await expect(
      page.getByRole('link', { name: /Start planning/i }).first(),
    ).toBeVisible();

    // Site header desktop sign-in link — `site-header.tsx` ships
    // "Sign in" gated to md+. 1280×800 viewport in the config is md+,
    // so the link must be visible without opening the mobile sheet.
    await expect(
      page.getByRole('link', { name: /^Sign in$/i }).first(),
    ).toBeVisible();
  });

  test('homepage responds with 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });
});
