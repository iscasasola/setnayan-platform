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
 * Hero structure note (2026-06-13 premium redesign): the h1 is now the
 * emotional hook "Goodbye, Viber chaos." and the brand punchline
 * "Hello, Set na 'yan." renders as a styled display span (not a heading).
 * So the heading assertion targets the h1 copy, and the brand phrase
 * "Set na 'yan" is verified as text. The brand line uses a curly Unicode
 * apostrophe, so the text match keys on the unambiguous "Set na" prefix to
 * tolerate any apostrophe codepoint.
 */
test.describe('Homepage', () => {
  test('renders with primary CTAs', async ({ page }) => {
    await page.goto('/');

    // Hero headline — `_sections.tsx` ships the h1 "Goodbye, Viber chaos."
    // (the emotional hook) with the brand line "Hello, Set na 'yan." rendered
    // as a styled span beneath it.
    await expect(
      page.getByRole('heading', { name: /Goodbye, Viber chaos/i }),
    ).toBeVisible();
    // Brand phrase still present (prefix match tolerates any apostrophe form).
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
