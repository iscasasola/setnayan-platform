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
 *
 * 🔄 THE FORM CHANGED 2026-09-24 — THE CONCEPT DID NOT (owner, "event menu by
 * moment"). *"papic is the life source of setnayan"* · Logo Maker at row 26 of
 * 27 *"feels so far"*. The Studio HEADING is dissolved inside an event: each
 * product is a row at its MOMENT in the event's own menu, marked ✦. So the
 * 2026-08-21 promise — the products do not disappear when you open a wedding,
 * and they open THAT wedding — is now kept by the event menu, and these tests
 * pin it there:
 *   1 · every product the Studio group would have drawn is a row in the event
 *       menu, and the shell does NOT also draw the group (listed once);
 *   2 · the shelf has exactly one door, the event menu's `studio` row, now
 *       called "Suite" (the group's "All services" row is dropped, not kept
 *       beside it);
 *   3 · "Browse by category" is gone inside an event (owner: Your Team is
 *       where couples search, negotiate and build).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { railToolsSignedIn, railToolsSignedOut } from '@/lib/studio-rail';
import { STUDIO_HUB_ALL_LABEL, studioHubHref } from '@/lib/studio-hub';
import { STUDIO_APPS } from '@/lib/studio-apps';
import { STUDIO_ABSORBED } from '@/lib/customer-menu';
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

/* ── 1 · THE PRODUCTS STAY — AT THEIR MOMENTS ─────────────────────────── */

test('inside an event every Studio product is still a row, at its moment', () => {
  const tools = railToolsSignedIn({ eventId: EVENT_ID, count: 1, profile: WEDDING_PROFILE });
  const studioRows = tools.map((t) => ({ key: t.key, href: t.href, name: t.name }));
  const menu = buildCustomerNavGroups(EVENT_ID, { websiteEnabled: true, studioRows });
  const rows = menu.flatMap((g) => g.items);
  /*
    Every product row the group would have drawn, minus the ones a ruling
    folds into an existing row: `pawebsite` (one door → the Event Hub
    Controller row), `__all__` (the `studio` row IS the Suite), and — owner
    2026-09-24, *"remove the 3D Plan menu. since the 3D version is on the
    seatplan already"* — `pa3d`, ABSORBED into Seat plan.
  */
  for (const t of tools) {
    if (t.key === 'pawebsite' || t.key === '__all__') continue;
    const absorbed = STUDIO_ABSORBED[t.key];
    if (absorbed) {
      // Folded is not lost: the host row stands, and CLAIMS the product's page.
      const host = rows.find((r) => r.key === absorbed.into);
      assert.ok(host, `${t.key} was absorbed into "${absorbed.into}", which is not in the menu — the product vanished`);
      assert.ok(
        host!.alsoMatch?.includes(t.href.split('?')[0]!),
        `${t.key}'s page (${t.href}) lights nothing — the host row does not claim it`,
      );
      assert.ok(!rows.some((r) => r.key === t.key), `${t.key} is drawn beside the row it was folded into`);
      continue;
    }
    const row = rows.find((r) => r.key === t.key);
    assert.ok(row, `${t.key} vanished from the event menu when the Studio group dissolved`);
    assert.equal(row!.href, t.href, `${t.key} no longer opens THIS wedding's tool`);
    assert.equal(row!.studio, true, `${t.key} lost its ✦ — it is a Studio product`);
  }
  assert.ok(
    !rows.some((r) => r.key === 'pawebsite' || r.key === '__all__'),
    'a folded product row came back beside the row it was folded into',
  );
});

test('the shell does not ALSO draw the Studio group inside an event', () => {
  /*
    Listed once. The event layout names its event (`studioEventId`), and the
    rail's caller hands the group an EMPTY list for it — said by the list, per
    `the-rail-renders-what-it-is-handed.test.ts`, never by a second gate at the
    group's render boundary.
  */
  const shellHost = code(read('app', '_components', 'frontdoor', 'app-rail-shell.tsx'));
  assert.match(
    shellHost,
    /tools=\{\s*studioEventId\s*\?\s*\[\]\s*:/,
    'inside an event the shell draws the Studio group again — every product ' +
      'would be listed twice, once at its moment and once under a heading the ' +
      'owner dissolved (2026-09-24)',
  );
});

test('"Browse by category" is not drawn inside an event', () => {
  /*
    REVERSED AGAIN 2026-09-24 — owner: *"we already have your team as where
    they search, negotiate and build their suppliers."* This test pinned the
    group to `insideEvent` (2026-08-22); inside an event is the only place it
    ever drew, so removing it there removes it.
  */
  assert.equal(SHELL.indexOf('Browse by category'), -1, 'the category group is back in the rail');
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
  assert.match(
    LAYOUT,
    /railToolsSignedIn\(\{\s*eventId,\s*count:\s*1,\s*profile\s*\}\)/,
    'the event layout no longer builds the product rows for THIS event — the ' +
      'event menu would lose every ✦ row with nothing thrown',
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

test('the event menu has exactly one door to the shelf, and it is called Suite or Studio once', () => {
  /*
    🔄 2026-09-24. This used to pin the rail DROPPING the event menu's `studio`
    row, because the shell's Studio group ended in an "All services" row to
    the same page. The group is dissolved inside an event, so the rule turns
    round: the `studio` row STAYS — it is now the only door — and the group's
    `__all__` row is the one dropped. Measured on the builder's real output.
  */
  const tools = railToolsSignedIn({ eventId: EVENT_ID, count: 1, profile: WEDDING_PROFILE });
  const rows = buildCustomerNavGroups(EVENT_ID, {
    websiteEnabled: true,
    studioRows: tools.map((t) => ({ key: t.key, href: t.href, name: t.name })),
  }).flatMap((g) => g.items);
  const doors = rows.filter((r) => r.href === studioHubHref(EVENT_ID));
  assert.deepEqual(
    doors.map((r) => r.key),
    ['studio'],
    'the shelf must have exactly one door in the event menu — the `studio` row',
  );
  assert.ok(
    !rows.some((r) => r.label === STUDIO_HUB_ALL_LABEL),
    `"${STUDIO_HUB_ALL_LABEL}" is back beside the Suite row — two words for one page`,
  );
  assert.ok(
    !/i\.key !== 'studio'/.test(CTX),
    'the event rail drops its `studio` row again — with the Studio group gone ' +
      'the desktop rail would have NO door to the shelf',
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
  /* 🔄 2026-09-24: the event menu's Suite row is built in the ONE tree,
     `lib/customer-menu.ts`; `customer-nav-config.ts` is now only its rail
     projection, so the resolver check follows the row to where it lives. */
  const nav = code(read('lib', 'customer-menu.ts'));
  for (const [name, src] of [
    ['studio-rail.ts', rail],
    ['customer-menu.ts', nav],
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
