import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerMenuTree, matchesMenuSection } from './customer-menu';

const EVENT_ID = 'evt-test';

/** The event's Studio products as the layout hands them over (plain data). */
const STUDIO = [
  { key: 'papic', href: `/dashboard/${EVENT_ID}/studio/papic`, name: 'Papic' },
  { key: 'mood-board', href: `/dashboard/${EVENT_ID}/studio/mood-board`, name: 'Mood Board' },
];

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

// --- default (no gating): the planning bar — 2026-09-24, event menu by moment:
//     Overview · Papic · Your Team · Guests · Event Hub Controller. Papic
//     replaced the Suite tab (owner: "papic is the life source of setnayan");
//     the Suite stays in ☰ as the list's closing row. -----------------------
test('planning bar is the five tabs of the owner-approved roster', () => {
  const keys = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true, studioRows: STUDIO }).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'papic', 'explore', 'guests', 'launch']);
  // Empty hideKeys is a no-op.
  const keys2 = buildCustomerMenuTree(EVENT_ID, { hideKeys: [], websiteEnabled: true, studioRows: STUDIO }).map((m) => m.key);
  assert.deepEqual(keys2, keys);
});

test('without product rows there is no Papic tab (it is picked out of the tree, never invented)', () => {
  const keys = buildCustomerMenuTree(EVENT_ID, { websiteEnabled: true }).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'explore', 'guests', 'launch']);
});

// --- Simple Event gating: drop Explore (vendors) + Budget ------------------
test('hideKeys drops the named top menus (Simple Event = no explore/budget)', () => {
  const keys = buildCustomerMenuTree(EVENT_ID, {
    hideKeys: ['explore', 'budget'],
    studioRows: STUDIO,
  }).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'papic', 'guests']);
});

test('hideKeys with just explore drops only explore', () => {
  const keys = buildCustomerMenuTree(EVENT_ID, { hideKeys: ['explore'], studioRows: STUDIO }).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'papic', 'guests']);
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

test('flag ON leaves Guests childless, and the Studio anchor dock is retired', () => {
  for (const on of [false, true]) {
    // Guests is deliberately a plain, childless menu (owner 2026-07-10).
    const guests = menu('guests', on);
    assert.equal(guests.children, undefined);
  }
  /* 🔄 2026-09-24: the Studio anchor dock (Setnayan AI · Website · Capture ·
     Branding) rode on the planning bar's Suite tab. Papic took that slot and
     each anchor became a row at its moment, so no phone menu docks anchors. */
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const tree = buildCustomerMenuTree(EVENT_ID, { phase, websiteEnabled: true, studioRows: STUDIO });
    assert.ok(
      tree.every((m) => (m.children ?? []).every((c) => c.kind !== 'anchor')),
      `${phase}: a phone menu docks Studio anchors again`,
    );
    assert.ok(!tree.some((m) => m.key === 'studio'), `${phase}: the Suite is a bar tab again`);
  }
});

// --- phase takeovers are unaffected (they carry no explore/budget) ---------
// 🔤 'services' (day-of) and 'editorial' (after) became 'launch' on 2026-09-02
// (EH3): one key, one word — "Event Hub" — in all three phases. The KEY is what
// is pinned here; the word itself is held by
// `one-menu-word-in-all-three-phases.test.ts`, which is where a rename must go
// red rather than being edited green in two places.
test('Day-of / After rosters are the owner-approved five', () => {
  /* 2026-09-24: Now→Overview (key stays 'now'), Papic replaces Seats (Seat plan
     stays in ☰ and The day's strip), Review→Your Team (key stays 'review'). */
  const dayof = buildCustomerMenuTree(EVENT_ID, {
    phase: 'dayof',
    hideKeys: ['budget'],
    websiteEnabled: true,
    studioRows: STUDIO,
  });
  assert.deepEqual(dayof.map((m) => m.key), ['now', 'papic', 'checkin', 'launch', 'schedule']);
  assert.equal(dayof[0]!.label, 'Overview');
  const after = buildCustomerMenuTree(EVENT_ID, {
    phase: 'after',
    hideKeys: ['budget'],
    websiteEnabled: true,
    studioRows: STUDIO,
  });
  assert.deepEqual(after.map((m) => m.key), ['home', 'papic', 'galleries', 'review', 'launch']);
  const review = after.find((m) => m.key === 'review')!;
  assert.equal(review.label, 'Your Team');
  assert.equal(review.href, `/dashboard/${EVENT_ID}/vendors?tab=build`);
});

test('every phase gates by the same tree: a vendor-free kind has no Your Team tab after the day either', () => {
  const after = buildCustomerMenuTree(EVENT_ID, {
    phase: 'after',
    hideKeys: ['explore', 'budget'],
    websiteEnabled: true,
    studioRows: STUDIO,
  }).map((m) => m.key);
  assert.deepEqual(after, ['home', 'papic', 'galleries', 'launch']);
});
