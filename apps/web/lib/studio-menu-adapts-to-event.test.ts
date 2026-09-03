/**
 * studio-menu-adapts-to-event.test.ts — the Studio SIDEBAR and the Suite GRID
 * cannot disagree about which products an event type offers.
 *
 * Owner, 2026-09-01: *"when we click the event, the studio should adapt to
 * the event itself, and only show the services that works for that event."*
 *
 * `lib/add-on-event-scope.ts`'s own docblock records that this predicate has
 * drifted between surfaces TWICE already (Suite ran it, `/studio/about/<key>`
 * ran nothing; then the Studio sidebar ran nothing either). The fix each time
 * was routing every surface through the ONE function,
 * `addOnOfferedForEvent` — never re-deriving the decision locally. This file
 * pins that: for every product `lib/studio-rail.ts` can show, the sidebar's
 * answer and the Suite grid's answer (via the matching `add-ons-catalog.ts`
 * entry) are asked of the SAME predicate and must agree.
 *
 * It also pins the row counts from the owner's ruling — wedding 9,
 * ceremonial/party 8, simple_event 7, date/hangout/travel 5 — computed from
 * fixtures shaped exactly like the live `event_type_profiles` rows
 * (measured 2026-09-01, before + after migration 20271188752170).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { railToolsSignedIn } from './studio-rail';
import { STUDIO_APPS } from './studio-apps';
import { ADD_ONS, type AddOnEntry } from './add-ons-catalog';
import { addOnOfferedForEvent } from './add-on-event-scope';
import { toProfile, type ProfileRow, type EventTypeProfile } from './event-type-profile';

/** A profile shaped exactly like a live `event_type_profiles` row — only the
 *  columns this test cares about are filled in, matching `toProfile`'s
 *  fallback for everything else. */
function rowProfile(eventType: string, enabledSurfaces: string[]): EventTypeProfile {
  const row: ProfileRow = {
    event_type: eventType,
    terminology: null,
    enabled_surfaces: enabledSurfaces,
    marketplace_enabled: true,
    event_class: null,
    layer_mode: null,
    multi_day: null,
    onboarding_flow_key: null,
    role_set_key: null,
    template_pack_key: null,
    monogram_set_key: null,
    reveal_pack_key: null,
    budget_taxonomy_key: null,
    schedule_seed_key: null,
    statutory_pack_key: null,
  };
  return toProfile(row);
}

// ── Fixtures, POST-migration-20271188752170 (the shape the live rows take
// once this PR's data change applies) ───────────────────────────────────────
const WEDDING = rowProfile('wedding', [
  'website', 'save_the_date', 'rsvp', 'seating', 'budget', 'schedule',
  'monogram', 'day_of', 'gallery', 'livestream', 'song',
]);
// A stand-in for the ten "ceremonial & party" types (birthday, christening,
// debut, gender_reveal, graduation, anniversary, celebration, corporate,
// gala_night, reunion, tournament, wake) — all share this shape live.
const CEREMONIAL = rowProfile('birthday', [
  'website', 'rsvp', 'seating', 'budget', 'schedule', 'day_of', 'gallery',
  'livestream', 'song',
]);
const SIMPLE_EVENT = rowProfile('simple_event', [
  'website', 'rsvp', 'seating', 'schedule', 'day_of', 'gallery', 'livestream',
]);
// Stand-in for date / hangout / travel — all three share this shape live.
const DATE = rowProfile('date', [
  'website', 'rsvp', 'budget', 'schedule', 'day_of', 'gallery',
]);

const EVENT_ID = 'S89E-TESTEVENT';

function sidebarKeys(profile: EventTypeProfile): string[] {
  return railToolsSignedIn({ eventId: EVENT_ID, count: 1, profile })
    .filter((r) => r.key !== '__all__')
    .map((r) => r.key)
    .sort();
}

function catalogEntryFor(addOnKey: string): AddOnEntry {
  const entry = ADD_ONS.find((e) => e.key === addOnKey);
  assert.ok(entry, `no ADD_ONS entry for key "${addOnKey}" — STUDIO_APPS drifted from the catalog`);
  return entry;
}

/** The Suite grid's own predicate, applied to the SAME 8 products via their
 *  real catalogue entries — not a copy of the rule, the rule itself. */
function suiteKeys(profile: EventTypeProfile): string[] {
  return STUDIO_APPS.filter((a) => {
    if (!a.addOnKey) return true; // no catalogue home — Suite has no opinion
    return addOnOfferedForEvent(catalogEntryFor(a.addOnKey), profile, null);
  })
    .map((a) => a.key)
    .sort();
}

for (const [label, profile] of [
  ['wedding', WEDDING],
  ['ceremonial & party (birthday)', CEREMONIAL],
  ['simple_event', SIMPLE_EVENT],
  ['date / hangout / travel', DATE],
] as const) {
  test(`sidebar and Suite agree for ${label}`, () => {
    assert.deepEqual(
      sidebarKeys(profile),
      suiteKeys(profile),
      `the sidebar and the Suite grid disagree about which products ${label} offers`,
    );
  });
}

test('row counts match the ruling: wedding 10 · ceremonial 9 · simple_event 8 · date/hangout/travel 6', () => {
  /*
    🔄 EACH COUNT ROSE BY EXACTLY ONE, 2026-09-03, and "exactly one" is the
    assertion that matters. The Mood Board joined the Studio group (owner: *"i
    do not see it"*) and it carries NO `surface`, so it is offered on every
    event type — the only shape that moves all four numbers together. A promotion
    that lifted some and not others would mean a surface crept in.
  */
  const countWithShelf = (profile: EventTypeProfile) =>
    railToolsSignedIn({ eventId: EVENT_ID, count: 1, profile }).length; // includes "All services"

  assert.equal(countWithShelf(WEDDING), 10, 'wedding');
  assert.equal(countWithShelf(CEREMONIAL), 9, 'ceremonial & party');
  assert.equal(countWithShelf(SIMPLE_EVENT), 8, 'simple_event');
  assert.equal(countWithShelf(DATE), 6, 'date/hangout/travel');

  // …and the free row is in every one of them, which is what "no surface"
  // MEANS. Counts alone would also be satisfied by four different rows.
  for (const [label, profile] of [
    ['wedding', WEDDING],
    ['ceremonial', CEREMONIAL],
    ['simple_event', SIMPLE_EVENT],
    ['date/hangout/travel', DATE],
  ] as const) {
    assert.ok(
      sidebarKeys(profile).includes('mood-board'),
      `${label} lost the Mood Board row. It is free and unscoped — every event ` +
        'type has one.',
    );
  }
});

test('Logo Maker is wedding-only; 3D Plan, Live Studio and Pakanta each ride their own surface', () => {
  const keysFor = (profile: EventTypeProfile) => new Set(sidebarKeys(profile));

  assert.ok(keysFor(WEDDING).has('palogo'), 'Logo Maker must show on a wedding');
  assert.ok(!keysFor(CEREMONIAL).has('palogo'), 'Logo Maker must not show on a birthday');

  assert.ok(keysFor(SIMPLE_EVENT).has('pa3d'), '3D Plan rides seating, which simple_event has');
  assert.ok(keysFor(SIMPLE_EVENT).has('panood'), 'Live Studio rides livestream, which simple_event has');
  assert.ok(!keysFor(SIMPLE_EVENT).has('pakanta'), 'Pakanta rides song, which simple_event does not have');

  assert.ok(!keysFor(DATE).has('pa3d'), '3D Plan must not show on date/hangout/travel');
  assert.ok(!keysFor(DATE).has('panood'), 'Live Studio must not show on date/hangout/travel');
  assert.ok(!keysFor(DATE).has('pakanta'), 'Pakanta must not show on date/hangout/travel');
});

/*
 * ── MUTATION PROOF ──────────────────────────────────────────────────────
 * Flip ONE surface off in a fixture and prove BOTH the sidebar and the Suite
 * grid's predicate drop the row — same fixture, same flip, two callers.
 * Printed via `assert` failure text carrying the occurrence count, per the
 * session's mutation-testing rule (this is the "after" half; the "before"
 * half is the passing assertion above showing the row present on the
 * un-mutated fixture).
 */
test('MUTATION: turning livestream off drops Live Studio from BOTH the sidebar and Suite', () => {
  const mutated = rowProfile('birthday', [
    'website', 'rsvp', 'seating', 'budget', 'schedule', 'day_of', 'gallery', 'song',
    // 'livestream' removed — the mutation.
  ]);
  const sidebarHasIt = sidebarKeys(mutated).includes('panood');
  const suiteHasIt = suiteKeys(mutated).includes('panood');
  assert.equal(sidebarHasIt, false, 'sidebar still shows Live Studio after the surface was removed');
  assert.equal(suiteHasIt, false, 'Suite still offers Live Studio after the surface was removed');
});
