/**
 * What the event needs (Level 1 onboarding, owner 2026-10-08) — the presets, the rows and what the
 * dashboard drops. Matrix: corpus EVENT_COVERAGE_MATRIX_2026-10-08_fable.md §2–§3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRESET_BY_TYPE,
  LIMIT_LINE_BY_TYPE,
  NEEDS_OF_PRESET,
  defaultNeedsFor,
  defaultPresetFor,
  needRowSub,
  needRows,
  needsColumns,
  needsHiddenNavKeys,
  needsHidesStage,
  needsHidesStudioTile,
  readEventNeeds,
  sanitizeNeeds,
  setupPatchFromNeeds,
  switchOnRows,
  toggleNeed,
} from './event-needs';

/** The twenty types that ship (prod `event_type_vocab`, measured 2026-10-18). */
export const SHIPPING_TYPES = [
  'wedding', 'debut', 'gender_reveal', 'birthday', 'celebration', 'travel', 'corporate', 'tournament',
  'christening', 'anniversary', 'graduation', 'reunion', 'gala_night', 'simple_event', 'date', 'hangout',
  'wake', 'concert', 'open_house', 'grand_opening',
] as const;

const M = { marketplace: true };

test('every shipping type has its own preset and limit line — none falls through to a guess', () => {
  for (const t of SHIPPING_TYPES) {
    assert.ok(DEFAULT_PRESET_BY_TYPE[t], `${t} has no preset`);
    assert.ok(LIMIT_LINE_BY_TYPE[t], `${t} has no limit line`);
  }
  assert.equal(Object.keys(DEFAULT_PRESET_BY_TYPE).length, SHIPPING_TYPES.length);
  // A limit line names only what ships — never a type we do not have (controller 2026-10-18: no "Memorial").
  assert.equal(LIMIT_LINE_BY_TYPE.anniversary, 'Yearly by itself — the years are counted for you.');
  for (const t of SHIPPING_TYPES) assert.doesNotMatch(LIMIT_LINE_BY_TYPE[t]!, /memorial/i, `${t}'s limit line points at a type that does not exist`);
});

test('the matrix §2 defaults: simple · open · list · full', () => {
  assert.deepEqual(
    ['simple_event', 'date', 'hangout'].map(defaultPresetFor),
    ['simple', 'simple', 'simple'],
  );
  assert.equal(defaultPresetFor('birthday'), 'open');
  assert.equal(defaultPresetFor('wake'), 'open');
  assert.equal(defaultPresetFor('corporate'), 'list');
  assert.equal(defaultPresetFor('wedding'), 'full');
  assert.equal(defaultPresetFor('some_new_type'), 'open');
});

test('Simple = name · place · Papic: one QR, no list, no suppliers, cover + photos only', () => {
  assert.deepEqual(NEEDS_OF_PRESET.simple, { oneQr: true, guestList: false, suppliers: false, hubDetails: false });
  // frame 3's right-hand words
  const n = defaultNeedsFor('hangout', M);
  assert.deepEqual(
    needRows(M).map((r) => needRowSub(r, n)),
    ['always on', 'no guest list', 'off', 'off', 'cover + photos only'],
  );
});

test('a vendor-free type never draws or switches on Suppliers', () => {
  const scope = { marketplace: false };
  assert.ok(!needRows(scope).includes('suppliers'));
  assert.equal(defaultNeedsFor('birthday', scope).suppliers, false);
  assert.equal(toggleNeed(defaultNeedsFor('simple_event', scope), 'suppliers', scope).suppliers, false);
  assert.deepEqual(switchOnRows({ guestList: false, suppliers: false, hubDetails: false }, scope), ['guests', 'hub']);
});

test('guests always have a way in — the last of One QR / Guest list cannot be switched off', () => {
  const simple = defaultNeedsFor('hangout', M);
  const off = toggleNeed(simple, 'oneQr', M);
  assert.equal(off.oneQr, false);
  assert.equal(off.guestList, true);
  const list = defaultNeedsFor('corporate', M);
  const noList = toggleNeed(list, 'guestList', M);
  assert.equal(noList.guestList, false);
  assert.equal(noList.oneQr, true);
  assert.equal(toggleNeed(simple, 'papic', M), simple);
});

test('the needs land on the setup answers that already have a home', () => {
  assert.deepEqual(setupPatchFromNeeds(NEEDS_OF_PRESET.simple), { reply: 'no', entry: 'one_qr', requests: false, guests: 'later', papic: 'yes' });
  assert.deepEqual(setupPatchFromNeeds(NEEDS_OF_PRESET.list), { reply: 'yes', entry: 'personal', requests: false, papic: 'yes' });
  // both on = a list, and anyone with the link may ask (Guest list + requests)
  assert.equal(setupPatchFromNeeds({ ...NEEDS_OF_PRESET.list, oneQr: true }).requests, true);
  assert.deepEqual(needsColumns(NEEDS_OF_PRESET.simple), { guest_list_on: false, suppliers_on: false, hub_details_on: false });
});

test('the wire is never trusted', () => {
  const d = defaultNeedsFor('birthday', M);
  assert.deepEqual(sanitizeNeeds('x', d, M), d);
  assert.deepEqual(sanitizeNeeds({ oneQr: false, guestList: false, suppliers: 'yes', hubDetails: true }, d, M), {
    oneQr: true,
    guestList: false,
    suppliers: d.suppliers,
    hubDetails: true,
  });
  assert.equal(sanitizeNeeds({ suppliers: true }, d, { marketplace: false }).suppliers, false);
});

test('NULL is never asked = ON — every event made before this reads as it did', () => {
  assert.deepEqual(readEventNeeds(null), { guestList: true, suppliers: true, hubDetails: true });
  assert.deepEqual(readEventNeeds({ guest_list_on: null }), { guestList: true, suppliers: true, hubDetails: true });
  const all = readEventNeeds({});
  assert.deepEqual(needsHiddenNavKeys(all), []);
  for (const s of ['save_the_date', 'rsvp-stage', 'rsvp', 'event', 'editorial']) assert.equal(needsHidesStage(s, all), false);
  assert.equal(needsHidesStudioTile('gifts', all), false);
});

test('off is absent: the bar, the Maker stages and the Studio tiles drop it', () => {
  const simple = readEventNeeds({ guest_list_on: false, suppliers_on: false, hub_details_on: false });
  assert.deepEqual(needsHiddenNavKeys(simple), ['guests', 'explore']);
  assert.deepEqual(
    ['save_the_date', 'rsvp-stage', 'rsvp', 'event', 'editorial'].filter((s) => !needsHidesStage(s, simple)),
    ['event'],
  );
  assert.deepEqual(
    ['info', 'look', 'logo', 'mood', 'schedule', 'story', 'march', 'seats', 'gifts', 'prints'].filter((t) => !needsHidesStudioTile(t, simple)),
    ['info', 'look'],
  );
  const open = readEventNeeds({ guest_list_on: false, suppliers_on: true, hub_details_on: true });
  assert.deepEqual(
    ['save_the_date', 'rsvp-stage', 'rsvp', 'event', 'editorial'].filter((s) => !needsHidesStage(s, open)),
    ['rsvp', 'event', 'editorial'],
  );
  /* 🗂 R1 (owner 2026-10-28): the RSVP tile left Studio for Guests ⚙ — with no guest list there is no Guests tab, so no
     RSVP setting is drawn anywhere; no Studio tile is dropped for it any more. */
  assert.deepEqual(['info', 'look', 'logo', 'mood', 'schedule', 'story', 'march', 'seats', 'gifts', 'prints'].filter((t) => needsHidesStudioTile(t, open)), []);
  assert.deepEqual(switchOnRows(simple, M), ['guests', 'suppliers', 'hub']);
});
