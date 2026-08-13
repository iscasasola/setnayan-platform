import { test, expect } from '@playwright/test';

/**
 * Homepage critical-path tests (Task #35).
 *
 * `/` IS THE FRONT DOOR. The cinematic `HomeReskin` gate it replaced — the
 * no-scroll opening + 5-pillar dock, owner-approved 2026-06-29 — was retired
 * completely on the owner's word after he saw the replacement live
 * (`DECISION_LOG.md` 2026-08-13). This file used to assert that gate's four
 * elements; every one of them is gone, so every assertion here is new.
 *
 * What it pins now is what a visitor must be able to do on the front page:
 *   • the page answers at all;
 *   • the rail is there — the thing the whole design is built around;
 *   • SEARCH works signed out, which is the single problem this page exists to
 *     solve (the Marketplace GROUP is signed-in only; finding one supplier you
 *     already need is not browsing a directory);
 *   • Sign in opens OVER the page and does NOT navigate — owner 2026-06-30,
 *     *"login should be like the rest of the upper menu. a popup"*.
 *
 * ⚠ IT ASSERTS BEHAVIOUR, NOT ELEMENT TYPES. An earlier version required the
 * sign-in to be a `<button>`; it is a real `<Link>` whose press is intercepted,
 * so that it works before hydration and with JavaScript off and so middle-click
 * still reaches /login. Pinning the tag broke on a change that improved the
 * control. The rule is "you did not leave the page", and that is what is
 * checked.
 */
test.describe('Homepage', () => {
  test('renders the front door', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);

    // The rail — the design's spine. Present on every width (below 1024 it is
    // off-canvas, so this asserts presence, not visibility).
    await expect(page.locator('nav.fd-rail')).toHaveCount(1);

    /*
      The wordmark — asserted in TITLE CASE, and that is the point of the
      assertion, not an accident of it.

      🔒 Google refused OAuth brand verification on 2026-07-25 partly because
      the ALL-CAPS wordmark did not read as a match for the consent-screen app
      name. The page renders capitals via `text-transform` while the markup —
      and therefore the ACCESSIBLE NAME, which is what a reviewer's tooling and
      a screen reader read — says "Setnayan". This line is the live proof of
      that: an earlier draft asserted 'SETNAYAN' and could not find the element,
      which is exactly the evidence wanted.
      Brand lock: the full spelling, never STNYN.
    */
    await expect(page.getByRole('link', { name: 'Setnayan', exact: true }).first()).toBeVisible();

    // Search answers a SIGNED-OUT person — deliberate, and the one thing this
    // page exists for. It is a real GET form to the marketplace.
    const search = page.getByRole('search').first();
    await expect(search).toBeVisible();
    await expect(search.getByRole('searchbox')).toBeVisible();
  });

  test('signing in opens over the page and does not navigate', async ({ page }) => {
    await page.goto('/');
    const urlBefore = page.url();

    // A real link, announced as opening a dialog — both halves true at once.
    const signIn = page.getByRole('link', { name: /^Sign in$/i }).first();
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('aria-haspopup', 'dialog');

    await signIn.click();

    const dialog = page.getByRole('dialog', { name: /^Sign in$/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/^Email$/i)).toBeVisible();

    // The whole point: still here.
    expect(page.url()).toBe(urlBefore);
  });

  test('homepage responds with 200', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
  });
});
