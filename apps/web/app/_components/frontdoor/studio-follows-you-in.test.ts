/**
 * studio-follows-you-in.test.ts — the Studio group does not vanish when you
 * open a wedding, and the shelf is not listed twice.
 *
 * ─── WHAT THE OWNER SAW ──────────────────────────────────────────────────
 * 2026-08-21, comparing the rail before and after opening an event: *"when we
 * enter an event it becomes suite and other features are added there. This
 * seem wrong since we lose the consistency of the concept. What we want is for
 * that Studio to still show on the sidebar, but now it is link to that event."*
 *
 * Seven named products taught a stranger what Setnayan makes, and then
 * disappeared at the exact moment that person finally had somewhere to open
 * them — replaced by ONE row under a second name.
 *
 * ─── THE THREE THINGS THAT MUST HOLD, AND WHY EACH FAILS SILENTLY ────────
 *   1 · THE GROUP DOES NOT COLLAPSE. Re-adding `railContext ? null :` around
 *       it is a one-token edit that reads like tidying, renders a perfectly
 *       good rail, and puts the product back exactly where the owner objected.
 *   2 · THE SHELF IS REACHABLE. The named products are not the whole shelf —
 *       the free parts, the upgrades and the order history live on the hub. The
 *       event menu's own row for it is deliberately dropped (see 3), so if the
 *       group loses its "All services" row the hub has NO door on the desktop
 *       rail at all, and nothing throws.
 *   3 · IT IS NOT LISTED TWICE. Dropping the event menu's hub row must happen
 *       in the RAIL only. The same builder feeds the phone's bottom bar, which
 *       carries no Studio group — take it out there and a phone loses its only
 *       door to the shelf.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { railToolsSignedIn, railToolsSignedOut } from '@/lib/studio-rail';
import { STUDIO_HUB_ALL_LABEL, studioHubHref } from '@/lib/studio-hub';
import { STUDIO_APPS } from '@/lib/studio-apps';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { buildCustomerNavGroups } from '@/app/dashboard/[eventId]/_components/customer-nav-config';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');

function read(...p: string[]): string {
  return readFileSync(join(WEB, ...p), 'utf8');
}
/**
 * Strip comments — a docblock quoting a gate is not a gate.
 *
 * 🪤 LINE COMMENTS COME OFF FIRST, AND THAT ORDER IS THE WHOLE POINT. The
 * usual spelling in this repo strips block comments first, and
 * `customer-nav-config.ts` contains the line `// hub + /studio/* (mood-board…`.
 * That `/*` opens a comment the block regex then closes at the NEXT `*\/`,
 * hundreds of lines later — swallowing real code on the way. Measured: the
 * file reduced to 18% of itself and `studioHubHref(` vanished from it, so an
 * assertion that the code READS the shared resolver failed while the code did.
 * A stripper that eats the thing you are looking for turns every check into a
 * false negative, which is the one failure that looks like a real finding.
 */
function code(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

const SHELL = code(read('app', '_components', 'frontdoor', 'front-door-shell.tsx'));
const CTX = code(
  read('app', 'dashboard', '[eventId]', '_components', 'event-rail-context.tsx'),
);
const LAYOUT = code(read('app', 'dashboard', '[eventId]', 'layout.tsx'));

const EVENT_ID = 'S89E-ABCDEFGHJK';

/* ── 1 · THE GROUP STAYS ──────────────────────────────────────────────────── */

test('the Studio group is not gated on the absence of an event context', () => {
  /*
    🔑 ANCHOR ON THE GROUP'S OWN HEADING, NOT ON THE FILE. The rail has three
    animated groups and two of them ARE gated this way on purpose (Marketplace
    collapses; the context group renders only when there is one). A file-level
    search for `railContext ? null` therefore matches whatever this test is
    trying to forbid AND two things it must not touch — it could never fail.
    So: find the heading, then read only the code immediately before it.
  */
  const at = SHELL.indexOf('Studio <small>the things you make</small>');
  assert.ok(at > -1, 'the Studio group heading is gone from the rail');

  const before = SHELL.slice(Math.max(0, at - 400), at);
  assert.ok(
    !/railContext\s*\?\s*null/.test(before),
    'the Studio group is collapsed again when a wedding is open — the exact ' +
      'thing the owner objected to on 2026-08-21. Saw: ...' + before.slice(-120),
  );
  assert.ok(
    !/!\s*railContext/.test(before),
    'the Studio group is gated on there being no event context',
  );
});

test('the Marketplace category group shows only inside an event', () => {
  /*
    REVERSED 2026-08-22 — owner: *"marketplace is best shown inside an event,
    not when they just logged in."* This used to assert the opposite polarity
    (collapse INSIDE an event, show on the front door / board). The group now
    gates on `insideEvent`, not `railContext` — the admin console and the
    vendor dashboard also push a `railContext` and must NOT show a couple's
    supplier marketplace, which a bare `railContext ?` gate would have done.
  */
  const at = SHELL.indexOf('>Browse by category<');
  assert.ok(at > -1, 'the category group label is missing');
  // 260, not 700: the unrelated `railContext ? (<div>{railContext}</div>) :
  // null` context-group wrapper (section 2b) sits just above this group, and
  // a wider window would match ITS railContext instead of this group's own
  // gate — a false pass on the "no railContext" assertion below.
  const before = SHELL.slice(Math.max(0, at - 260), at);
  assert.ok(
    /insideEvent\s*\?/.test(before),
    'the Marketplace category group is not gated on insideEvent — it must ' +
      'show only inside a specific event, not on the front door or board',
  );
  assert.ok(
    !/railContext/.test(before),
    'the Marketplace category group is still reading railContext — the admin ' +
      'console and vendor dashboard would then show it too',
  );
});

/* ── 2 · THE ROWS OPEN *THAT* EVENT ───────────────────────────────────────── */

test('the event layout tells the rail which wedding is open', () => {
  assert.match(
    LAYOUT,
    /studioEventId=\{eventId\}/,
    'the event layout stopped naming its own event, so the Studio rows fall ' +
      'back to guessing — and somebody with two weddings gets sent to the ' +
      'board to pick while already standing inside one.',
  );
});

test('with an event, every product row opens inside that event', () => {
  const rows = railToolsSignedIn({
    eventId: EVENT_ID,
    count: 3,
    profile: WEDDING_PROFILE,
  });
  const products = rows.filter((r) => r.key !== '__all__');
  /*
    ⚠ THE EXPECTED COUNT IS THE NON-DOORWAY PRODUCTS, NOT ALL OF STUDIO_APPS
    (2026-09-05). `marketplace` · `guest-list` · `seat-plan` are public
    description pages that LEAVE the Studio group the moment an event opens —
    owner: *"do not double the marketplace"* · *"Marketplace will disappear on
    studio once we enter an event just like guestlist"* · *"and seat plan"* —
    because the event's own rail already carries Guests, Marketplace→/vendors
    and Seat plan. See `StudioApp.doorwayOnly`.

    🔑 THIS DOES NOT WEAKEN THE GUARD, AND THE LOOP BELOW IS WHY. What this test
    protects is that a product which IS in the in-event rail opens INSIDE the
    event rather than falling back to its public page. A doorway row is not
    dropped silently — it is dropped by a declared field, and
    `studio-menu-adapts-to-event.test.ts` asserts both halves: absent with an
    event, present without one. Comparing against a derived count keeps this
    assertion honest if a doorway row is ever added or removed.
  */
  /* 🔄 ALSO FILTERED BY GROUP (2026-09-06). STUDIO_APPS stopped being "the
     Studio rail" the day the owner split the rail by kind: it is now every
     product that HAS a doorway page, and `railGroup` says which group renders
     it. Samahan is in Together, the five planning tools are in Planner. */
  const expected = STUDIO_APPS.filter(
    (a) => (a.railGroup ?? 'studio') === 'studio' && !a.doorwayOnly,
  ).length;
  assert.equal(
    products.length,
    expected,
    'a product row was dropped for a wedding, which enables every surface',
  );
  for (const r of products) {
    assert.ok(
      r.href.startsWith(`/dashboard/${EVENT_ID}/`),
      `${r.key} opens ${r.href} — not this wedding`,
    );
  }
});

/* ── 3 · THE SHELF HAS EXACTLY ONE DOOR ───────────────────────────────────── */

test('the group ends with one door to the rest of the shelf', () => {
  const rows = railToolsSignedIn({
    eventId: EVENT_ID,
    count: 1,
    profile: WEDDING_PROFILE,
  });
  const all = rows.filter((r) => r.name === STUDIO_HUB_ALL_LABEL);
  assert.equal(all.length, 1, `expected exactly one "${STUDIO_HUB_ALL_LABEL}" row`);
  assert.equal(rows[rows.length - 1]?.name, STUDIO_HUB_ALL_LABEL, 'it must be last');
  assert.equal(all[0]?.href, studioHubHref(EVENT_ID));
});

test('with no event there is no shelf row, because there is no shelf', () => {
  for (const studio of [
    { eventId: null, count: 0, profile: null },
    { eventId: null, count: 4, profile: null },
  ]) {
    const rows = railToolsSignedIn(studio);
    assert.ok(
      rows.every((r) => r.name !== STUDIO_HUB_ALL_LABEL),
      'an "All services" row with no event to open would be a fake door',
    );
  }
  assert.ok(
    railToolsSignedOut().every((r) => r.name !== STUDIO_HUB_ALL_LABEL),
    'a stranger is offered a door into somebody else’s services shelf',
  );
});

test('the shelf is not called Studio twice in one rail', () => {
  /*
    🔑 THE FILTER IS ASSERTED BY ITS EFFECT, NOT BY ITS SPELLING. A first cut
    matched the string `key !== 'studio'` in the source, which a rename to a
    constant would have quietly defeated while still working. This walks the
    real builder's output through the real predicate instead.
  */
  assert.match(
    CTX,
    /items:\s*g\.items\.filter\(\(i\) => i\.key !== 'studio'\)/,
    'the event rail no longer drops the hub row, so the rail now carries both ' +
      'a row and a group heading for the same shelf',
  );

  // …and the row it drops is one the shared builder really produces, so the
  // filter cannot quietly become a no-op against a renamed key.
  const keys = buildCustomerNavGroups(EVENT_ID).flatMap((g) =>
    g.items.map((i) => i.key),
  );
  assert.ok(
    keys.includes('studio'),
    'the builder no longer produces a `studio` row — the rail filter is now ' +
      'dead code, and the PHONE has lost its only door to the shelf',
  );
});

/* ── 4 · ONE BRANCH DECIDES THE HUB, NOT THREE ────────────────────────────── */

test('nobody hand-types the /suite ↔ /studio branch a second time', () => {
  /*
    The rail's "All services" row and the nav builder's own row must land on
    the SAME page. Two copies of `flag ? '/suite' : '/studio'` is not a
    mechanism — it is the drift that sends the rail to a page the bottom bar
    calls something else, with nothing thrown.
  */
  const rail = code(read('lib', 'studio-rail.ts'));
  const nav = code(
    read('app', 'dashboard', '[eventId]', '_components', 'customer-nav-config.ts'),
  );
  for (const [name, src] of [
    ['studio-rail.ts', rail],
    ['customer-nav-config.ts', nav],
  ] as const) {
    assert.ok(
      /studioHubHref\(/.test(src),
      `${name} no longer reads the shared hub resolver`,
    );
    assert.ok(
      !/\?\s*`\$\{base\}\/suite`|'\/suite'\s*:\s*'\/studio'/.test(src),
      `${name} hand-types the suite/studio branch again`,
    );
  }
});
