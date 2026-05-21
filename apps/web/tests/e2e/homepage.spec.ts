import { test, expect } from '@playwright/test';

/**
 * Homepage critical-path tests (Task #35).
 *
 * Renders the marketing-site landing page and asserts the load-bearing
 * CTAs are present. If this test breaks, signup conversion is broken —
 * every other test in the suite assumes a couple can land on `/` and
 * see the primary action surface.
 *
 * Selectors target the actual copy on `apps/web/app/page-sections/_Hero.tsx`
 * + `apps/web/app/_components/site-header.tsx`. Per the orphan-prevention
 * convention, every assertion here references a real route + real copy
 * shipping on `origin/main`.
 */
test.describe('Homepage', () => {
  test('renders with primary CTAs', async ({ page }) => {
    await page.goto('/');

    // Hero headline — `_Hero.tsx` line 49 ships "Planning a wedding?"
    await expect(
      page.getByRole('heading', { name: /Planning a wedding/i }),
    ).toBeVisible();

    // Hero primary CTA — `_Hero.tsx` line 73 ships "Start planning"
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
