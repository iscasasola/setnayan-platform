import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  plannerRailItems,
  builderRailItems,
  togetherRailItems,
} from './free-tools-rail';
import { railToolsSignedIn } from './studio-rail';

/**
 * THE WHOLE REASON THIS FILE IS SHORT.
 *
 * The first draft of Planner/Builder listed Guest List, Seat Plan, Schedule,
 * Budget and Marketplace — copied from a design prototype that was never
 * checked against `EventRailContext`. All five already exist as real, active
 * rows in the event's own menu (`customer-nav-config.ts`): Guests →
 * `/guests`, Marketplace → `/vendors`, Schedule → `/schedule`, Seat plan →
 * `/seating`, Budget → `/budget`. Adding a second copy under a new heading
 * would be the exact "same destination, two names" defect
 * `event-rail-context.tsx`'s own docblock warns against.
 *
 * This test pins the fix two ways: the CURRENT lists resolve correctly, and
 * neither Planner nor Builder ever points at one of the five hrefs the event
 * menu already owns — so a future edit that quietly re-adds "Guest List" or
 * "Marketplace" here fails loudly instead of shipping a duplicate door.
 */

const EVENT_ID = 'S89E-ABCDEFGHJK';

// The event menu's OWN hrefs (`customer-nav-config.ts`), named once so both
// assertions below read against the same list rather than two hand-typed
// copies that could quietly drift apart from each other.
const EVENT_MENU_HREFS = [
  `/dashboard/${EVENT_ID}/guests`,
  `/dashboard/${EVENT_ID}/vendors`,
  `/dashboard/${EVENT_ID}/schedule`,
  `/dashboard/${EVENT_ID}/seating`,
  `/dashboard/${EVENT_ID}/budget`,
];

test('the in-event Planner is empty — its one gap closed, and it must not re-open as a duplicate', () => {
  /*
    🔄 THIS TEST USED TO PIN ONE ROW, AND THAT ROW HAD BECOME A DUPLICATE.
    Planner held Mood Board on the reasoning that the board *"lives inside
    Studio → Branding, not the event's own top-level menu"* — true when written,
    false from 2026-09-03, when the owner promoted the Mood Board into the
    Studio rail group (*"i do not see it"*). For three days the in-event rail
    carried Mood Board twice, at the same href, in two groups.

    🔴 AND THIS GUARD COULD NOT HAVE CAUGHT IT. Its duplicate check compared
    Planner only against `EVENT_MENU_HREFS` — the event's own menu — so a
    collision with the STUDIO group was outside everything it looked at. The
    check below now spans both, which is the actual fix; emptying the list is
    only today's consequence of it.

    Planner is not dead: `plannerDoorwayRows` fills it OUTSIDE an event with the
    five free planning tools' doorways. Inside one it is empty, and an empty
    array renders no group rather than a heading over nothing.
  */
  const items = plannerRailItems(EVENT_ID);
  assert.deepEqual(
    items,
    [],
    'Planner grew an in-event row again. Before adding one, check it against ' +
      'BOTH the event menu and the Studio group — the last row here duplicated ' +
      'Studio and no test noticed for three days.',
  );
});

test('nothing in Planner or Builder duplicates a Studio row or the event menu', () => {
  /*
    The rule the test above should always have enforced, applied to every group
    that sits beside Studio. `railToolsSignedIn` is asked for the SAME event, so
    this compares the real lists rather than two hand-typed ones.

    ⚠ The two Together pairs that share a destination are deliberate and
    documented in `front-door-shell.tsx` — Together is not checked here for that
    reason, and adding it would mean encoding those exceptions, which is how a
    guard starts crying wolf.
  */
  const studioHrefs = railToolsSignedIn({
    eventId: EVENT_ID,
    count: 1,
    profile: null,
  }).map((r) => r.href);

  for (const item of [...plannerRailItems(EVENT_ID), ...builderRailItems(EVENT_ID)]) {
    assert.ok(
      !EVENT_MENU_HREFS.includes(item.href),
      `"${item.name}" duplicates an href the event menu already owns: ${item.href}`,
    );
    assert.ok(
      !studioHrefs.includes(item.href),
      `"${item.name}" duplicates a STUDIO row: ${item.href} — the collision ` +
        'class that went unnoticed for three days in 2026-09.',
    );
  }
});

test('Builder is exactly Compare + Contracts, nothing the event menu already carries', () => {
  const items = builderRailItems(EVENT_ID);
  assert.equal(items.length, 2, 'Builder grew past its two verified gaps');
  const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
  assert.equal(byKey['builder-compare']?.href, '/explore/compare');
  assert.equal(
    byKey['builder-contracts']?.href,
    `/dashboard/${EVENT_ID}/contracts`,
  );
  for (const item of items) {
    assert.ok(
      !EVENT_MENU_HREFS.includes(item.href),
      `Builder item "${item.name}" duplicates an href the event menu already owns: ${item.href}`,
    );
  }
});

test('Together is account-level (Samahan) plus event-scoped chat, resolved honestly', () => {
  const withEvent = togetherRailItems(EVENT_ID);
  assert.equal(withEvent.length, 4);
  const byKey = Object.fromEntries(withEvent.map((i) => [i.key, i]));

  // Samahan is a real account-level route — confirmed NOT nested under
  // `[eventId]` (the `(account)` route group adds no path segment) — so it
  // must not vary with which event happens to be open.
  assert.equal(byKey['together-samahan']?.href, '/dashboard/samahan');
  assert.equal(byKey['together-samahan-stories']?.href, '/dashboard/samahan');

  // Vendor/Event chat ARE event-scoped — with a known event, they open the
  // real thread, never a generic page.
  assert.equal(
    byKey['together-vendor-chat']?.href,
    `/dashboard/${EVENT_ID}/messages`,
  );
  assert.equal(
    byKey['together-event-chat']?.href,
    `/dashboard/${EVENT_ID}/messages`,
  );
});

test('Together never guesses a thread when no event is known', () => {
  const withoutEvent = togetherRailItems(null);
  const byKey = Object.fromEntries(withoutEvent.map((i) => [i.key, i]));

  // No fabricated eventId in the href — falls back to the board, same
  // fallback `railToolsSignedIn` already uses for an ambiguous Studio row.
  assert.equal(byKey['together-vendor-chat']?.href, '/dashboard');
  assert.equal(byKey['together-event-chat']?.href, '/dashboard');

  // Samahan is unaffected either way — it was never event-scoped.
  assert.equal(byKey['together-samahan']?.href, '/dashboard/samahan');
});

test('every row has a non-empty key, href and name — no accidental blank row', () => {
  const all = [
    ...plannerRailItems(EVENT_ID),
    ...builderRailItems(EVENT_ID),
    ...togetherRailItems(EVENT_ID),
    ...togetherRailItems(null),
  ];
  for (const item of all) {
    assert.ok(item.key.length > 0, 'a row has an empty key');
    assert.ok(item.href.startsWith('/'), `href "${item.href}" is not a real path`);
    assert.ok(item.name.length > 0, 'a row has an empty name');
  }
});
