/**
 * nav-badges.test.ts — the phone must not know less than the laptop.
 *
 * The bottom nav has rendered badges since it shipped: a dot, a count, a tone
 * and an sr-only label, in both its flat and accordion paths. The ADMIN bar used
 * it. The couple's bar and the vendor's bar passed nothing — while their desktop
 * sidebars, on the same layout, fed by counts the layout had already fetched,
 * showed them. Nothing errored. Both bars rendered perfectly, just emptier, on
 * the device the owner and every vendor actually work from.
 *
 * These tests hold two lines:
 *   1. The badge RULE lives in one place, so the sidebar and the bar cannot
 *      drift into showing different numbers for the same thing.
 *   2. Both bars actually PASS it. A helper nobody calls is the shape this
 *      codebase keeps re-discovering — a mechanism built and never proven
 *      reachable.
 *
 * ⚠ WHAT THESE TESTS CANNOT CATCH, PROVEN ON THIS VERY CHANGE. The first cut
 * added `bookingsBadge` / `threadsBadge` to VendorBottomNav's prop TYPE and
 * forgot to destructure them in the signature. Every test below stayed green,
 * because they read SOURCE TEXT — the names were present, just not bound. The
 * TYPECHECKER caught it (`Cannot find name 'bookingsBadge'`), and CI's tsc is
 * the only detector for that class. Same shape as the payment guard whose seven
 * tests passed while its query could never run: a name appearing is not a name
 * being used, and a test that greps cannot tell the difference.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { customerGuestsBadge, vendorCustomersBadge } from './nav-badges';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const CUSTOMER_BAR = 'app/dashboard/[eventId]/_components/customer-bottom-nav.tsx';
const CUSTOMER_SIDEBAR_CONFIG = 'app/dashboard/[eventId]/_components/customer-nav-config.ts';
const CUSTOMER_LAYOUT = 'app/dashboard/[eventId]/layout.tsx';
const VENDOR_BAR = 'app/vendor-dashboard/_components/vendor-bottom-nav.tsx';
/**
 * The vendor's DESKTOP badge derivation.
 *
 * ⚠ REPOINTED 2026-08-14, NOT DROPPED (One Shell slice 2). This was
 * `_components/vendor-sidebar.tsx`, which the shared-rail conversion deleted
 * — it had no importers left. The rule it is held to is unchanged: whatever
 * derives the vendor's desktop counts must derive them from `nav-badges.ts`
 * and must not hand-build a badge literal beside it.
 */
const VENDOR_DESKTOP_BADGES =
  'app/vendor-dashboard/_components/vendor-nav-destinations.ts';
const VENDOR_LAYOUT = 'app/vendor-dashboard/layout.tsx';

// ── ZERO AND UNKNOWN ARE THE SAME VALUE HERE, AND NEITHER IS A BADGE ────────

test('no badge is rendered for zero, null or undefined', () => {
  for (const v of [0, null, undefined, -3]) {
    assert.equal(customerGuestsBadge(v), undefined, `guests badge for ${String(v)}`);
  }
  assert.equal(vendorCustomersBadge(0, 0), undefined);
  assert.equal(vendorCustomersBadge(null, null), undefined);
  assert.equal(vendorCustomersBadge(undefined, undefined), undefined);
  // Both layouts fail-soft their count fetches to 0/null on ANY error, so a
  // badge reading "0" would claim "nothing is waiting" on exactly the request
  // that could not find out. Same shape as filing an unmeasured queue under
  // "N queues are clear" — it is the one place a reader has been told not to look.
});

test('a real count produces a badge that names what it counts', () => {
  const g = customerGuestsBadge(142);
  assert.equal(g?.count, 142);
  assert.equal(g?.tone, 'neutral');
  assert.match(g!.label!, /142 guests/);
  // Singular is not a detail: "1 guests" on a wedding's first RSVP is the first
  // thing the couple ever reads from this product.
  assert.match(customerGuestsBadge(1)!.label!, /^1 guest$/);
});

test('the vendor badge sums the two counts but never hides the split', () => {
  const b = vendorCustomersBadge(3, 2);
  assert.equal(b?.count, 5);
  assert.equal(b?.tone, 'orange', 'work waiting wears the accent; a guest count does not');
  assert.match(b!.label!, /3 new inquiries/);
  assert.match(b!.label!, /2 unread threads/);
  // "5" alone could be five people asking to book or five unread lines of chat.
  // Those deserve different urgency, so the dot carries the sum and the label
  // carries the split.
});

test('one side present still badges', () => {
  assert.equal(vendorCustomersBadge(4, 0)?.count, 4);
  assert.equal(vendorCustomersBadge(0, 7)?.count, 7);
});

// ── ONE RULE, NOT TWO COPIES ────────────────────────────────────────────────

test('every nav that shows these counts derives them from this file', () => {
  for (const f of [CUSTOMER_BAR, CUSTOMER_SIDEBAR_CONFIG, VENDOR_BAR, VENDOR_DESKTOP_BADGES]) {
    assert.ok(
      /from '@\/lib\/nav-badges'/.test(read(f)),
      `${f} no longer imports the shared badge rule. Whatever replaced it is a ` +
        `second derivation of the same number — which is how the payouts badge ` +
        `and the list beneath it counted different things, both valid, in silence.`,
    );
  }
});

test('nobody hand-builds a badge literal beside the shared helper', () => {
  for (const f of [CUSTOMER_BAR, CUSTOMER_SIDEBAR_CONFIG, VENDOR_BAR, VENDOR_DESKTOP_BADGES]) {
    assert.ok(
      !/badge:\s*\{\s*count:/.test(read(f)),
      `${f} constructs a badge object inline again. The helper exists so the ` +
        `phone and the sidebar cannot disagree; a literal beside it defeats that.`,
    );
  }
});

// ── AND THE BARS ACTUALLY CALL IT ───────────────────────────────────────────

test("the couple's phone bar applies the guests badge", () => {
  const src = read(CUSTOMER_BAR);
  assert.ok(
    /customerGuestsBadge\(guestCount\)/.test(src),
    'The couple bar imports the helper without calling it on the count.',
  );
  assert.ok(
    /\.\.\.\(badge \? \{ badge \} : \{\}\)/.test(src),
    'The computed badge is never spread onto the tab, so it is derived and dropped ' +
      '— the state the whole bar was in before this test existed.',
  );
});

test("the vendor's phone bar applies the customers badge AFTER the label overlay", () => {
  const src = read(VENDOR_BAR);
  assert.ok(
    /vendorCustomersBadge\(bookingsBadge, threadsBadge\)/.test(src),
    'The vendor bar does not build the badge from its two counts.',
  );
  const overlayAt = src.indexOf('navSlots[`vendor.bottom-nav.');
  const badgeAt = src.indexOf('vendorCustomersBadge(bookingsBadge');
  assert.ok(
    overlayAt > 0 && badgeAt > overlayAt,
    'The badge is applied BEFORE the admin label/icon overlay, so an admin ' +
      'relabelling the Customers tab would silently drop its count — the overlay ' +
      'rebuilds each item and only carries the fields it names.',
  );
});

// ── THE COUNTS REACH THE BARS AT ALL ────────────────────────────────────────

/**
 * Slice exactly one JSX element by tag name, `<Tag` through its closing `/>`.
 *
 * A windowed regex (`<Tag[\s\S]{0,240}prop=`) is NOT good enough here, and that
 * is not hypothetical: the vendor layout mentions `bookingsPending` four times,
 * including on the SIDEBAR a few lines above. A window wide enough to cover the
 * bottom nav's props also swept up the sidebar's, so the guard would have passed
 * on a layout that fed the desktop and starved the phone — the precise bug.
 */
function jsxElement(src: string, tag: string): string {
  const start = src.indexOf(`<${tag}`);
  assert.ok(start >= 0, `${tag} is not rendered at all`);
  const end = src.indexOf('/>', start);
  assert.ok(end > start, `${tag} has no self-closing tag`);
  return src.slice(start, end + 2);
}

test('both layouts pass their already-fetched counts to the phone bar', () => {
  const bar = jsxElement(read(VENDOR_LAYOUT), 'VendorBottomNav');
  assert.ok(
    /bookingsBadge=\{bookingsPending\}/.test(bar) && /threadsBadge=\{threadsUnread\}/.test(bar),
    'The vendor layout computes both counts for the sidebar and stops there. ' +
      'That is the exact defect this file exists for: the laptop knew, the phone did not.',
  );
  const couple = jsxElement(read(CUSTOMER_LAYOUT), 'CustomerBottomNav');
  assert.ok(
    /guestCount=\{guestCount\}/.test(couple),
    'The couple layout resolves guestCount for the sidebar and does not hand it ' +
      'to the phone bar.',
  );
});

test('the desktop sidebars still get their counts — this was additive', () => {
  // The port lesson from the same week: a change that makes one surface better
  // must be shown not to have quietly taken something from another.
  //
  // ⚠ RETARGETED 2026-08-14, NOT RELAXED (One Shell slice 2). The vendor's
  // desktop menu is no longer `<VendorSidebar>` inside the old rail — it is
  // `<VendorRailContext>` inside the shared front-door rail. The rule is
  // unchanged and still one-directional: whatever renders the vendor's
  // destinations on a laptop must be handed both counts. Only the name of the
  // element that renders them moved.
  //
  // ⚠ RESPELLED 2026-08-15, NOT RELAXED. Slice 2 passed the counts as object
  // properties into a resolver CALLED IN THE LAYOUT — and that call is what
  // took the whole vendor dashboard down, because building a row list on the
  // server means resolving a React icon component on the server. The rail is
  // a client component and resolves its own rows now, so the counts travel as
  // JSX props again. Same one-directional rule, same two values, same
  // element; only the punctuation between them changed.
  // See `app/vendor-dashboard/_components/vendor-nav-boundary.test.ts`.
  const sidebar = jsxElement(read(VENDOR_LAYOUT), 'VendorRailContext');
  assert.ok(
    /bookingsBadge=\{bookingsPending\}/.test(sidebar) &&
      /threadsBadge=\{threadsUnread\}/.test(sidebar),
    'The vendor DESKTOP MENU lost a count while the phone gained one.',
  );
  assert.ok(
    /guestCount=\{guestCount\}/.test(jsxElement(read(CUSTOMER_LAYOUT), 'CustomerSidebar')),
    'The couple SIDEBAR lost its guest count.',
  );
});
