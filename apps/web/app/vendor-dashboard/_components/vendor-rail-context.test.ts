/**
 * vendor-rail-context.test.ts — the shop's menu, moved into the shared rail.
 *
 * One Shell slice 2 (2026-08-14). These hold the four things that break
 * SILENTLY when the vendor tree changes chrome — every one of them fails with
 * no error, no log and a page that still renders.
 *
 *   1. A LITERAL ACTIVE STATE. The front-door rail shipped with `Home`
 *      hardcoded `data-on="true"`. Repeat that here and all 63 vendor screens
 *      say you are on the Overview.
 *   2. A DRIFTED KEY. `overview · shop · customers · performance · on-the-day`
 *      are read by the staff role filter, the admin nav registry, the
 *      localStorage section state and the badge map. Rename one and three of
 *      those four fail without a word.
 *   3. THE SENTINEL. Every vendor route starts with `/vendor-dashboard/`, so
 *      Overview's prefix branch has to be dead or it lights everywhere.
 *   4. A CONTROL LEFT BEHIND. The layout still has to carry the four
 *      cron-free sweeps, the content <main> the phone carousel needs, and an
 *      account menu a desktop vendor can actually reach to sign out.
 *
 * ⚠ WHAT THIS FILE CANNOT SEE: it never renders React. It reads the real
 * source and calls the real resolver — so it catches a deleted line and a
 * wrong rule, and it would NOT catch a prop declared in a type and forgotten
 * in the signature. That exact miss is recorded in `lib/nav-badges.test.ts`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Relative, not '@/lib/…': under `tsx --test` the alias hands back a module
// whose named exports are empty, so the loop below would run zero times and
// report a pass. The `checked` floor catches that too — belt and braces.
import { NAV_SLOT_DEFAULTS } from '../../../lib/nav-registry-defaults';

import { activeRailKey } from '@/app/_components/frontdoor/rail-active';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import {
  VENDOR_DESTINATIONS,
  resolveVendorDestinations,
} from './vendor-nav-destinations';

/**
 * A registry slot as the registry really returns one.
 *
 * 🪤 THE FIRST CUT OF THIS FIXTURE WAS `{ label, icon: null } as never`, and
 * both tests using it died inside `navIconComponent` reading `.kind` of null.
 * The code was right and the FIXTURE was lying — `NavSlotLite.icon` is a
 * required descriptor, and the cast is what let an impossible shape through.
 * A cast that silences the type checker in a test buys a failure that blames
 * the wrong file.
 */
const slot = (label: string): NavSlotLite => ({
  label,
  icon: { kind: 'none', lucideName: null, customRef: null, customUrl: null },
  isHidden: false,
});

const HERE = import.meta.dirname;
const RAIL = join(HERE, 'vendor-rail-context.tsx');
const LAYOUT = join(HERE, '..', 'layout.tsx');
const read = (p: string) => readFileSync(p, 'utf8');

/**
 * Source with comments and JSX comment blocks stripped.
 *
 * 🔑 WITHOUT THIS EVERY GUARD BELOW IS DECORATION. This file's own prose
 * quotes `data-on="true"` while explaining why it must never appear, so a raw
 * substring search would fail on the correct code and pass on nothing.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE ACTIVE ROW IS DERIVED, NEVER WRITTEN DOWN
   ══════════════════════════════════════════════════════════════════════════ */

test('no rail row hardcodes its own active state', () => {
  const src = code(read(RAIL));
  const literals = src.match(/data-on=(["']true["']|\{\s*(?:true|'true'|"true")\s*\})/g) ?? [];
  assert.deepEqual(
    literals,
    [],
    'A literal `data-on` is the bug One Shell slice 0 was written to close: it ' +
      'throws nothing and lights the same row on all 63 vendor screens. ' +
      `Found ${literals.length}: ${literals.join(', ')}`,
  );
});

test('every rail row also tells a screen reader, not just the eye', () => {
  const src = code(read(RAIL));
  // One `aria-current` per `data-on`. A rail that only LOOKS right is half right.
  const dataOn = (src.match(/\bdata-on=/g) ?? []).length;
  const ariaCurrent = (src.match(/\baria-current=/g) ?? []).length;
  assert.ok(dataOn > 0, 'the rail context renders no rows at all');
  assert.equal(
    ariaCurrent,
    dataOn,
    `${dataOn} rows carry data-on but ${ariaCurrent} carry aria-current.`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE KEYS ARE THE CONTRACT
   ══════════════════════════════════════════════════════════════════════════ */

/*
  TWO ASSERTIONS, NOT ONE, AND THE SPLIT IS THE POINT. The SET is owner-locked
  and load-bearing in four systems. The ORDER is a display choice and was
  re-cut on 2026-08-26. Pinning both in a single deepEqual made a re-order
  look like a lock being broken, which is how a real guard gets weakened by
  somebody in a hurry.
*/
test('the five destination KEYS are exactly the owner-locked five', () => {
  assert.deepEqual(
    [...VENDOR_DESTINATIONS.map((d) => d.key)].sort(),
    ['customers', 'on-the-day', 'overview', 'performance', 'shop'],
    'Owner-locked 2026-07-12 ("overview, my shop, my customers, my performance, ' +
      'BEO are all 1-page each"). These keys are ALSO the staff role-filter set, ' +
      'the `vendor.sidebar.<key>` registry slots and the localStorage section ' +
      'state. Adding a sixth row here is a product change, not a chrome change.',
  );
});

/*
  ── THE TWO PLACES A ROW IS NAMED MUST AGREE ────────────────────────────────
  `resolveVendorDestinations` REPLACES the in-code label with the registry's
  whenever a slot exists, so the registry default is what a shop owner actually
  reads and the in-code word is only the fallback when a read fails. Rename one
  and not the other and the app has two answers to one question, with NO error
  to notice: a fresh deployment shows the registry word, a failed registry read
  shows the code word. That is the shape this repo keeps paying for.

  DERIVED FROM BOTH SIDES, never a hand-typed third copy of the word.
*/
test('every destination is named the same in the code and in the rename registry', () => {
  const bySlot = new Map(
    NAV_SLOT_DEFAULTS.filter((d) => d.area === 'vendor-sidebar').map((d) => [d.key, d]),
  );
  let checked = 0;
  for (const d of VENDOR_DESTINATIONS) {
    const slot = bySlot.get(`vendor.sidebar.${d.key}`);
    if (!slot) continue;
    checked += 1;
    assert.equal(
      slot.label,
      d.label,
      `"${d.key}" is "${d.label}" in the code and "${slot.label}" in the registry. ` +
        'The registry wins, so the code word is what nobody sees — rename in both.',
    );
  }
  // A FLOOR, so a renamed slot key cannot empty the loop and report a pass.
  assert.equal(checked, 5, `only ${checked} of the five destinations had a registry slot`);
});

test('the rail order is the 2026-08-26 re-cut — people before setup', () => {
  assert.deepEqual(
    VENDOR_DESTINATIONS.map((d) => d.key),
    ['overview', 'customers', 'shop', 'performance', 'on-the-day'],
    'Owner re-cut 2026-08-26 ("yes i agree"): My Customers sits ahead of My ' +
      'Shop because people are the daily job and setting up a shop is a once. ' +
      'Order is display-only — nothing reads it — so this is the assertion to ' +
      'edit if the order changes again. The KEY SET above is the one that is ' +
      'locked.',
  );
});

test('the landing row is labelled Today, not Overview', () => {
  assert.equal(
    VENDOR_DESTINATIONS.find((d) => d.key === 'overview')?.label,
    'Today',
    'Re-cut 2026-08-26. The key stays `overview` on purpose — four systems ' +
      'read it and three fail silently — but the WORD a shop owner reads is ' +
      '"Today", the same rename the admin console took the same week.',
  );
});

test('every destination points inside the vendor tree', () => {
  for (const d of VENDOR_DESTINATIONS) {
    assert.ok(
      d.href === '/vendor-dashboard' || d.href.startsWith('/vendor-dashboard/'),
      `${d.key} points at ${d.href}, which is outside the shop.`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE SENTINEL — OVERVIEW CLAIMS ONE URL, NOT SIXTY-THREE
   ══════════════════════════════════════════════════════════════════════════ */

test('Overview lights on its own URL', () => {
  assert.equal(activeRailKey(VENDOR_DESTINATIONS, '/vendor-dashboard'), 'overview');
});

test('Overview does NOT light on any sibling hub', () => {
  for (const path of [
    '/vendor-dashboard/shop',
    '/vendor-dashboard/customers',
    '/vendor-dashboard/performance',
    '/vendor-dashboard/on-the-day',
    '/vendor-dashboard/subscription',
    '/vendor-dashboard/notifications',
  ]) {
    assert.notEqual(
      activeRailKey(VENDOR_DESTINATIONS, path),
      'overview',
      `Overview lit on ${path}. The sentinel matchPrefix is gone, so the ` +
        'default prefix rule is matching every route under /vendor-dashboard/.',
    );
  }
});

test('a hub claims its own deep routes', () => {
  assert.equal(
    activeRailKey(VENDOR_DESTINATIONS, '/vendor-dashboard/customers/abc123'),
    'customers',
  );
});

test('a sibling with a shared prefix does not steal the row', () => {
  // The trailing-slash rule in match-path.ts, exercised: without it
  // `/vendor-dashboard/shop` would claim `/vendor-dashboard/shopfront`.
  assert.notEqual(
    activeRailKey(VENDOR_DESTINATIONS, '/vendor-dashboard/shopfront'),
    'shop',
  );
});

test('a URL belonging to no row lights NOTHING — never the first row', () => {
  assert.equal(activeRailKey(VENDOR_DESTINATIONS, '/vendor-dashboard/notifications'), null);
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · STAFF ARE NOT LOCKED OUT OF A PAGE THEY MAY OPEN
   ══════════════════════════════════════════════════════════════════════════ */

test('an owner sees all five', () => {
  const rows = resolveVendorDestinations({ role: 'admin' });
  assert.deepEqual(rows.map((r) => r.key), [
    'overview',
    'customers',
    'shop',
    'performance',
    'on-the-day',
  ]);
});

test('an agent still gets the two surfaces they may work', () => {
  const rows = resolveVendorDestinations({ role: 'agent' });
  assert.deepEqual(
    rows.map((r) => r.key),
    ['overview', 'customers'],
    '/vendor-dashboard admits the owner OR any team member. A rail that ' +
      'renders nothing for staff strands people who can legitimately open ' +
      'the page — they would see a shop menu with no rows in it.',
  );
  assert.ok(rows.length > 0, 'staff got an EMPTY menu, which reads as a broken page');
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · THE COUNTS SURVIVE THE MOVE
   ══════════════════════════════════════════════════════════════════════════ */

test('both live counts land on My Customers, summed, and nowhere else', () => {
  const rows = resolveVendorDestinations({ role: 'admin', bookingsBadge: 3, threadsBadge: 2 });
  const badged = rows.filter((r) => r.badge);
  assert.deepEqual(badged.map((r) => r.key), ['customers']);
  assert.equal(badged[0]?.badge?.count, 5);
});

test('a zero count shows NO badge — never a 0', () => {
  const rows = resolveVendorDestinations({ role: 'admin', bookingsBadge: 0, threadsBadge: 0 });
  assert.deepEqual(rows.filter((r) => r.badge).map((r) => r.key), []);
});

/* ══════════════════════════════════════════════════════════════════════════
   6 · AN ADMIN RENAME REACHES THE LAPTOP, NOT ONLY THE PHONE
   ══════════════════════════════════════════════════════════════════════════ */

test('the registry renames a row', () => {
  const rows = resolveVendorDestinations({
    role: 'admin',
    navSlots: { 'vendor.sidebar.customers': slot('My Couples') },
  });
  const row = rows.find((r) => r.key === 'customers');
  assert.equal(
    row?.label,
    'My Couples',
    'The rail hard-coded its own words, so an admin rename applies on the ' +
      'phone and not on the laptop — two answers to one question.',
  );
});

test('a renamed row keeps its count — the registry runs BEFORE the badges', () => {
  const rows = resolveVendorDestinations({
    role: 'admin',
    bookingsBadge: 4,
    threadsBadge: 0,
    navSlots: { 'vendor.sidebar.customers': slot('My Couples') },
  });
  const row = rows.find((r) => r.key === 'customers');
  assert.equal(row?.label, 'My Couples');
  assert.equal(row?.badge?.count, 4, 'the rename overwrote the badge');
});

test('an absent registry fails OPEN to the in-code words, never to a blank menu', () => {
  const rows = resolveVendorDestinations({ role: 'admin', navSlots: undefined });
  assert.equal(rows.length, 5);
  assert.equal(rows.find((r) => r.key === 'shop')?.label, 'My Shop');
});

/* ══════════════════════════════════════════════════════════════════════════
   7 · THE LAYOUT DID NOT LOSE ANYTHING ON THE WAY THROUGH
   ══════════════════════════════════════════════════════════════════════════ */

test('the shared rail is mounted, and the shop menu is pushed into it', () => {
  const src = code(read(LAYOUT));
  assert.match(src, /<AppRailShell/, 'the vendor tree does not wear the shared rail');
  assert.match(src, /railContext=\{/, 'the rail is mounted with no shop menu in it');
  assert.match(src, /<VendorRailContext/, 'the shop menu component is not rendered');
});

test('the shop content still carries the view-transition name, on a <main>', () => {
  /*
    ⚠ THIS USED TO ASSERT `<SidebarShell>` WAS STILL MOUNTED. That component is
    deleted (2026-08-15) — it had been rendering no `<aside>` at any width
    since slice 2 and no top bar since slice 4, leaving it as a wrapper for the
    three things below. The RULE did not go with it, so the assertion moved to
    the wrapper that owns the job instead of being dropped.

    `.sn-vt-page` is the only element in the app with
    `view-transition-name: sn-page`; the phone's bottom-nav carousel freezes
    the document around exactly it. ZERO leaves the tap animating NOTHING at
    widths where the rail never paints; TWO makes the browser skip the
    transition outright. And it must be a `<main>` — the shared shell yields
    its landmark in the app variant, so a `<div>` here gives this tree none.
  */
  const src = code(read(LAYOUT));
  const named = src.match(/\bsn-vt-page\b/g) ?? [];
  assert.equal(
    named.length,
    1,
    `expected exactly one sn-vt-page in the vendor layout, saw ${named.length}.`,
  );
  assert.match(
    src,
    /<main className="sn-vt-page"/,
    'The named element is not a <main>; this tree would have no landmark.',
  );
  assert.equal(
    (src.match(/<main\b/g) ?? []).length,
    1,
    'One landmark per page.',
  );
  assert.equal(
    (src.match(/<aside\b/g) ?? []).length,
    0,
    'The vendor layout draws its own <aside> — that stacks a second rail ' +
      'under the shared one at 1024+.',
  );
});

test('the shop content still stands on the warm ground, and not on the slide', () => {
  /*
    🔑 THE ONE THAT WOULD HAVE SHOWN. This tree's outer <div> is `app-surface`
    with NO background at all — `.sn-ambient` came from the deleted shell's own
    root, inside the content column. Dropping it puts all 63 supplier screens
    on plain white, with nothing thrown.

    ⚠ It must stay a SEPARATE element from `.sn-vt-page`: merged, the painted
    ground enters the view-transition snapshot and slides with the page.
  */
  const src = code(read(LAYOUT));
  assert.match(
    src,
    /className="sn-ambient min-h-screen"/,
    'The `.sn-ambient` ground is gone from the vendor content column.',
  );
  assert.doesNotMatch(
    src,
    /className="[^"]*\bsn-ambient\b[^"]*\bsn-vt-page\b|className="[^"]*\bsn-vt-page\b[^"]*\bsn-ambient\b/,
    'The ground and the view-transition name are on the same element.',
  );
});

test('all five cron-free sweeps still ride on this layout', () => {
  const src = code(read(LAYOUT));
  // There is NO scheduler behind these. Drop one in a rewrite and the vendor
  // ghosting nudge, the creator-offer refund or the booking-fee notice simply
  // stops, with no error anywhere — the silent-absence class this repo keeps
  // paying for. The brief for this session did not warn about them; the admin
  // one did, and the vendor layout has four.
  for (const sweep of [
    'runLoginGhostingCheck',
    'maybeSweepExpiredCreatorOffers',
    'maybeSweepVendorBookingFeeNotifications',
    'sweep_vendor_tier_expiry',
    // PR-H — the day-5 nudge and the 7-day close. It rides BOTH layouts because
    // production is pre-launch-quiet: an admin-only mount would hang a
    // supplier's deadline on somebody opening /admin.
    'maybeRunLockRequestExpiry',
    /*
      "Your credit is about to expire" (owner 2026-08-28). Registered here the
      moment it was added, because this list is the only thing standing between
      a cron-free sweep and silent removal.

      🔑 IT IS FLEET-WIDE, WHICH IS WHY LOSING IT IS WORSE THAN LOSING A
      PER-VISITOR SWEEP: it is the only thing that reaches a shop that is NOT
      opening this page, and those are precisely the shops that lapse. Dropping
      it takes the warning away from everybody it was built for while every
      screen still looks correct.
    */
    'maybeSweepVendorCreditWarnings',
  ]) {
    assert.ok(
      new RegExp(`\\b${sweep}\\b`).test(src),
      `${sweep} left the vendor layout. Nothing schedules it anywhere else.`,
    );
  }
  assert.equal(
    (src.match(/\bafter\(/g) ?? []).length,
    6,
    'the count of post-response jobs changed',
  );
});

test('a desktop vendor can still reach the account menu, and so Sign out', () => {
  const src = code(read(LAYOUT));
  const switcher = src.slice(src.indexOf('const topBar'));
  assert.match(switcher, /<AccountSwitcher/, 'the top bar lost the account panel');
  assert.doesNotMatch(
    switcher,
    /className="lg:hidden"\s*>\s*<AccountSwitcher/,
    'The account panel is mobile-only again. The sidebar plaque that used to ' +
      'carry it on desktop left with the sidebar, and this panel holds the ' +
      'ONLY Sign out on every vendor screen (owner 2026-08-13). Gating it ' +
      'behind a breakpoint strands every desktop vendor, silently.',
  );
});

test('the Plan hub keeps a persistent door', () => {
  const rail = code(read(RAIL));
  const layout = code(read(LAYOUT));
  assert.match(layout, /planHref="\/vendor-dashboard\/subscription"/);
  assert.match(rail, /href=\{planHref\}/);
  // Everything else linking to the plan hub is a contextual upsell inside a
  // page. Lose this row and a vendor reaches their own plan only by first
  // walking into a paywall.
});
