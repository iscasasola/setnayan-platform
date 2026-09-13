import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerMenuTree, matchesMenuSection } from './customer-menu';

const EVENT_ID = 'evt-test';

/** Run `fn` with the Explore-replan flag forced to a value, then restore it.
 *  `isExploreReplanEnabled()` reads process.env at CALL time and
 *  `buildCustomerMenuTree` calls it per invocation, so this is enough — no
 *  module cache to bust. */
function withReplanFlag(on: boolean, fn: () => void) {
  const prev = process.env.NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED;
  process.env.NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED = on ? 'true' : 'false';
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED;
    else process.env.NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED = prev;
  }
}

const menu = (key: string, on: boolean) => {
  let found: ReturnType<typeof buildCustomerMenuTree>[number] | undefined;
  withReplanFlag(on, () => {
    found = buildCustomerMenuTree(EVENT_ID).find((m) => m.key === key);
  });
  if (!found) throw new Error(`menu ${key} missing from the planning tree`);
  return found;
};

// --- default (no gating): the planning tree (Budget removed 2026-07-10 — it
//     now lives inside the Explore/Merkado takeover) ------------------------
test('planning tree has the canonical menus when hideKeys is empty/absent', () => {
  const keys = buildCustomerMenuTree(EVENT_ID).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'guests', 'explore', 'studio']);
  // Empty array is also a no-op.
  const keys2 = buildCustomerMenuTree(EVENT_ID, { hideKeys: [] }).map((m) => m.key);
  assert.deepEqual(keys2, ['home', 'guests', 'explore', 'studio']);
});

// --- Simple Event gating: drop Explore (vendors) + Budget ------------------
test('hideKeys drops the named top menus (Simple Event = no explore/budget)', () => {
  const keys = buildCustomerMenuTree(EVENT_ID, {
    hideKeys: ['explore', 'budget'],
  }).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'guests', 'studio']);
});

test('hideKeys with just explore drops only explore', () => {
  const keys = buildCustomerMenuTree(EVENT_ID, { hideKeys: ['explore'] }).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'guests', 'studio']);
});

// --- Explore replan: the mobile takeover dock is gone (BUILD_SPEC §5) ------
//     Owner complaint #1 — "why is the subnav still present?" The Coverage Strip
//     is the navigator; the 4 chips (Shortlist · Build · Budget · Plans) are
//     emitted only while the flag is OFF, so the flag stays a kill-switch.
test('flag OFF: Explore still carries the 4 takeover tab children (production-identical)', () => {
  const explore = menu('explore', false);
  assert.deepEqual(
    (explore.children ?? []).map((c) => c.key),
    ['shortlist', 'build', 'budget', 'compare'],
  );
  assert.equal(explore.sectionMatch, `/dashboard/${EVENT_ID}/vendors`);
  assert.equal(explore.sectionMatchExact, true);
  assert.equal(explore.subnavLabel, 'Services sections');
  // Every child is a tab child carrying its admin-registry slot.
  for (const c of explore.children ?? []) {
    assert.equal(c.kind, 'tab');
    assert.equal(c.slotKey, `customer.budget-subnav.${c.key}`);
  }
  // The dock SHOWS on the takeover root while the flag is off.
  assert.equal(matchesMenuSection(`/dashboard/${EVENT_ID}/vendors`, explore), true);
});

test('flag ON: Explore emits no dock — no children, no sectionMatch', () => {
  const explore = menu('explore', true);
  assert.equal(explore.children, undefined);
  assert.equal(explore.sectionMatch, undefined);
  assert.equal(explore.sectionMatchExact, undefined);
  assert.equal(explore.subnavLabel, undefined);
  // `customer-section-subnav.tsx` gates on BOTH: no sectionMatch ⇒ the menu is
  // never the activeMenu, and no children ⇒ `inSection` is false anyway.
  assert.equal(matchesMenuSection(`/dashboard/${EVENT_ID}/vendors`, explore), false);
  // The bottom-nav TAB must still light on /vendors — only the dock went away.
  assert.equal(explore.activeMatch, `/dashboard/${EVENT_ID}/vendors`);
  assert.equal(explore.href, `/dashboard/${EVENT_ID}/vendors`);
});

test('flag ON leaves the OTHER docks intact (Studio anchors + Guests journey)', () => {
  for (const on of [false, true]) {
    const studio = menu('studio', on);
    assert.ok((studio.children ?? []).length > 0, 'Studio keeps its anchor dock');
    assert.ok(studio.sectionMatch, 'Studio keeps its sectionMatch');
    // Guests is deliberately a plain, childless menu (owner 2026-07-10) — assert
    // that it stays that way so this change can't be blamed for it later.
    const guests = menu('guests', on);
    assert.equal(guests.children, undefined);
  }
});

// --- phase takeovers are unaffected (they carry no explore/budget) ---------
// 🔤 'services' (day-of) and 'editorial' (after) became 'launch' on 2026-09-02
// (EH3): one key, one word — "Event Hub" — in all three phases. The KEY is what
// is pinned here; the word itself is held by
// `one-menu-word-in-all-three-phases.test.ts`, which is where a rename must go
// red rather than being edited green in two places.
test('Day-of / After phase rosters ignore hideKeys', () => {
  const dayof = buildCustomerMenuTree(EVENT_ID, {
    phase: 'dayof',
    hideKeys: ['explore', 'budget'],
  }).map((m) => m.key);
  assert.deepEqual(dayof, ['now', 'checkin', 'seats', 'launch', 'schedule']);
  const after = buildCustomerMenuTree(EVENT_ID, {
    phase: 'after',
    hideKeys: ['explore', 'budget'],
  }).map((m) => m.key);
  assert.deepEqual(after, ['home', 'review', 'launch', 'galleries']);
});
