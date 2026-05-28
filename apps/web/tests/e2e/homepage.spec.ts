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
 * Apostrophe note: the h1 ships with a curly Unicode right-single-quote
 * (U+2019 `'`) honoring the v2.1 template's brand typography. The regex
 * below matches both `'` and `'` so a future revert to straight
 * apostrophe wouldn't surprise-break this test.
 */
test.describe('Homepage', () => {
  test('renders with primary CTAs', async ({ page }) => {
    await page.goto('/');

    // Hero headline — `_sections.tsx` line 133 ships "Set na 'yan."
    await expect(
      page.getByRole('heading', { name: /Set na ['’]yan/i }),
    ).toBeVisible();

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
