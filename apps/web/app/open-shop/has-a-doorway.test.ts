/**
 * A signed-in person with no shop can REACH /open-shop.
 *
 * ── WHY THIS EXISTS (2026-08-10) ───────────────────────────────────────────
 * /open-shop is a finished wizard whose own docblock lists "logged in, no shop
 * → the onboarding wizard" as a supported state. Every doorway to it pointed
 * somewhere a signed-in customer never goes:
 *
 *   • /vendors ....................... the PUBLIC marketing page (3 links), not
 *                                      linked from any dashboard surface
 *   • /vendor-dashboard/shop ......... requires ALREADY having a shop
 *
 * And the one apparent fallback — `if (data === 'no-vendor') redirect('/open-
 * shop')` in vendor-dashboard/shop/page.tsx — is DEAD CODE: the vendor-dashboard
 * LAYOUT redirects any non-vendor to /dashboard, and a layout runs before the
 * page it wraps. It reads like a safety net and can never fire.
 *
 * So the account could see a tile headed "Yours to run" under a Store glyph
 * with no way to run anything.
 *
 * 🔑 TWO doorways, not one, because they reach DIFFERENT people. The launcher
 * only renders for an account with 0 or 2+ active events — a couple with
 * exactly ONE is redirected straight into that event (`active.length === 1 &&
 * !hasConsole`) and never sees the launcher. The switcher is on every surface
 * and is the only one that reaches them. Prod today: of the 5 test accounts,
 * two are in exactly that single-event state.
 *
 * ⚠ DELIBERATELY NARROW, matching vendor-dashboard/activities/has-a-doorway.
 * A blanket "every route must be linked" check fires on redirect stubs, QR
 * deep-links and dynamic segments — all correct, all unlinked. A guard that
 * cries wolf teaches its reader to skim past the one time it is right. This
 * asserts two specific doorways for one specific page.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname);
const WEB = join(HERE, '../..');

const SWITCHER = join(WEB, 'app/_components/account-switcher/account-switcher.tsx');
const LAUNCHER = join(WEB, 'app/dashboard/(launcher)/page.tsx');

test('the account switcher offers /open-shop to someone with no shop', () => {
  const src = readFileSync(SWITCHER, 'utf8');
  assert.ok(
    src.includes('href="/open-shop"'),
    'The switcher is the ONLY doorway that reaches a couple with exactly one ' +
      'event — they never see the launcher. Without this they cannot open a ' +
      'shop from inside the app at all.',
  );
  // Gated on NOT having a shop: a vendor already gets the "Shop" console tile
  // in the rail above, and offering both is two doors to two different places
  // wearing the same word.
  assert.ok(
    src.includes('data.context.canOpenShop'),
    'The link must be gated on canOpenShop (shops OWNED vs the cap), not on ' +
      '!hasVendor — see the shared-flag test below.',
  );
});

/*
 * ⚠ REMOVED 2026-08-19 — "the launcher offers /open-shop to someone with no shop".
 *
 * The owner made the account home only his events, which deleted the "Yours to
 * run" tile this asserted on. The DOOR is not lost: the account switcher carries
 * "Create your shop" on every width, behind the SAME `canOpenShop` gate, and the
 * test above (`the switcher offers /open-shop…`) covers it.
 *
 * Deleted rather than repointed, because a second assertion on the same door
 * would say the switcher must carry it twice.
 */


/**
 * THE BUG THIS PAIR OF GATES EXISTS TO PREVENT.
 *
 * `hasVendorAccess` / `hasVendor` is true when the user owns a shop **OR sits
 * on any `vendor_team_members` row**. `canOpenShop` counts only shops they OWN
 * against `MAX_SHOPS_PER_USER`. For a team member who owns nothing the two
 * disagree: `hasVendor` is TRUE, `canOpenShop` is TRUE.
 *
 * Gating the create-door on `!hasVendor` therefore hid it from exactly the
 * people most likely to want their own shop — a second shooter, an assistant,
 * anyone a vendor added to their team — while the cap allowed them one. It
 * shipped that way in the first release of this doorway (2026-08-10) and was
 * caught the same day. Prod had 0 people in that state, so nobody was blocked.
 *
 * A future reader "simplifying" these two conditions back to `!hasVendor` gets
 * this test.
 */
test('neither doorway gates on hasVendor — that flag includes team members', () => {
  for (const [name, path] of [
    ['switcher', SWITCHER],
    ['launcher', LAUNCHER],
  ] as const) {
    const visible = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    // The create-door's own condition must not be written in terms of the
    // access flag. Both spellings appear in this repo.
    assert.ok(
      !/!\s*(data\.context\.hasVendor|roles\.hasVendorAccess)\s*\?\s*<OpenShopRow/.test(
        visible,
      ),
      `${name}: the create-door is gated on !hasVendor again — that hides it ` +
        `from a team member who owns no shop but is allowed one.`,
    );
  }
});

/**
 * The visible words, which are an OWNER INSTRUCTION and not a style choice.
 * The first release said "Open your shop"; the owner corrected it, because in a
 * list where every other row takes you INTO something, "Open" reads as "go to
 * my shop" — the one thing this row does not do.
 */
test('the doorway says "Create your shop", not "Open your shop"', () => {
  // ⚠ NARROWED 2026-08-19 to the switcher alone. There were two doorways; the
  // launcher's went with the "Yours to run" tile when the account home became
  // events-only. The wording rule is unchanged — it just has one carrier now.
  for (const [name, path] of [['switcher', SWITCHER]] as const) {
    const src = readFileSync(path, 'utf8');
    assert.ok(
      src.includes('Create your shop'),
      `${name}: the owner asked for "Create your shop" (2026-08-10).`,
    );
    // Comments explaining the rename legitimately quote the old label, so this
    // checks only what a person can actually read on screen.
    const visible = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    assert.ok(
      !visible.includes('Open your shop'),
      `${name}: "Open your shop" is back in the UI — it reads as "go to my ` +
        `shop", which is what the owner corrected.`,
    );
  }
});

/**
 * The reason the doorways above had to be added at all. If someone later makes
 * this redirect reachable (by moving the vendor gate out of the layout), that
 * is a real third doorway — but until then it must not be mistaken for one.
 */
test('the shop-page redirect is still unreachable, so it is not a doorway', () => {
  const layout = readFileSync(join(WEB, 'app/vendor-dashboard/layout.tsx'), 'utf8');
  assert.ok(
    layout.includes("redirect('/dashboard')"),
    'The vendor-dashboard layout no longer bounces non-vendors. Re-check ' +
      'whether vendor-dashboard/shop\'s `no-vendor` redirect now reaches ' +
      'people — if it does, this file\'s reasoning needs updating.',
  );
});
