import { test, expect } from '@playwright/test';

/**
 * Homepage critical-path tests (Task #35).
 *
 * Renders the marketing-site landing page and asserts the load-bearing CTAs are
 * present. If this test breaks, signup conversion is broken — every other test
 * in the suite assumes a couple can land on `/` and see the primary action
 * surface.
 *
 * 2026-08-13 — `/` IS THE FRONT DOOR. The owner ruled the ELN cinematic
 * homepage retired completely, and it is deleted along with its pillars, its
 * Spotlight strip and the flag that used to choose between the two. The page is
 * now `FrontDoor` (apps/web/app/_components/frontdoor/), ported from
 * `prototypes/front_door_and_seam_2026-08-12.html`.
 *
 * ⚠ TWO THINGS THIS FILE USED TO ASSERT ARE GONE FROM THE PRODUCT, verified
 * against the LIVE site rather than inferred: the hero headline ("Keep your
 * memories." / "Plan your moments.") and the "Start planning · free" CTA to
 * /onboarding/wedding — the front door carries NO /onboarding link at all.
 * Planning is behind sign-in by design, which the rail states outright.
 * The retired § 5 copy is preserved in the corpus at
 * `RETIRED_ELN_HOMEPAGE_COPY_2026-08-13.md`.
 *
 * What is checked on load now:
 *   • the accessible h1 → "Setnayan — plan your event, keep it for life"
 *   • the brand phrase "Set na 'yan" (the one § 5 line that survived)
 *   • the signed-out rail prompt → "Sign in to save suppliers…"
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

    /* ⚠ RE-POINTED 2026-08-13 — `/` IS THE FRONT DOOR NOW.
       This block asserted the ELN cinematic hero ("Keep your memories." /
       "Plan your moments.") and a "Start planning · free" CTA pointing at
       /onboarding/wedding. The owner retired that page completely, and BOTH
       are gone from the live front door — verified against www.setnayan.com,
       not inferred: the headline strings return 0 hits and there is no
       /onboarding href anywhere on the page.

       🔑 THE MISSING CTA IS BY DESIGN, NOT A REGRESSION. The front door gates
       planning behind sign-in — its own prompt says so in as many words ("Sign
       in to save suppliers, plan your event, and keep your photos"), the same
       ruling that made the Marketplace signed-in only. It is still a real
       change to the funnel, so it is asserted here rather than merely deleted:
       if a "Start planning" CTA ever returns to the front door, somebody
       decided that, and this test should be the place they say so. */

    // The page's accessible heading. It is visually hidden (`fd-sr-only`) — the
    // front door leads with the feed, not a hero — so this asserts it EXISTS in
    // the accessibility tree rather than that it is painted.
    await expect(
      page.getByRole('heading', { name: /Setnayan .* plan your event/i }),
    ).toHaveCount(1);

    // Brand phrase — the tagline survived the swap ("Set na 'yan", any
    // apostrophe codepoint). Pinned in lib/home-front-copy.test.ts too.
    await expect(page.getByText(/Set na/i).first()).toBeVisible();

    // The signed-out rail's prompt — this is what replaced the hero CTA, and it
    // is the only thing on the front door that tells a stranger what signing in
    // buys them.
    await expect(page.getByText(/Sign in to save suppliers/i).first()).toBeVisible();

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
