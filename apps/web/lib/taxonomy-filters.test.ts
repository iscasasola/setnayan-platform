/**
 * Unit suite for the shared couple-side taxonomy scoping predicates.
 * These invariants are load-bearing (never-empty, include-only faith, the
 * wedding guard, mixed-union) — see taxonomy-filters.ts + the design doc.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CEREMONY_TYPE_TO_FAITH,
  buildCoupleFaithSet,
  passesEventTypeFilter,
  passesFaithFilter,
  resolveEventType,
} from './taxonomy-filters';
import { WEDDING_FAITH_KEYS } from './taxonomy';

// ── resolveEventType — event-side never-empty guard ─────────────────────────

test('resolveEventType: NULL/blank/whitespace = wedding (legacy rows must not lose wedding-only tiles)', () => {
  assert.equal(resolveEventType(null), 'wedding');
  assert.equal(resolveEventType(undefined), 'wedding');
  assert.equal(resolveEventType(''), 'wedding');
  assert.equal(resolveEventType('   '), 'wedding');
  assert.equal(resolveEventType('birthday'), 'birthday');
});

// ── buildCoupleFaithSet ──────────────────────────────────────────────────────

test('catholic wedding → {Catholic}', () => {
  const set = buildCoupleFaithSet({ eventType: 'wedding', ceremonyType: 'catholic' });
  assert.deepEqual([...set], ['Catholic']);
});

test('WEDDING GUARD: corporate event with the default ceremony_type=catholic must NOT narrow', () => {
  // events.ceremony_type is NOT NULL DEFAULT 'catholic' — every non-wedding
  // event carries a stale faith. Guard on event_type, never ceremony presence.
  const set = buildCoupleFaithSet({ eventType: 'corporate', ceremonyType: 'catholic' });
  assert.equal(set.size, 0);
});

test('NULL event_type counts as wedding (never-empty event side) → faith applies', () => {
  const set = buildCoupleFaithSet({ eventType: null, ceremonyType: 'muslim' });
  assert.deepEqual([...set], ['Muslim']);
});

test('MIXED inter-faith = UNION of both rites (additive)', () => {
  const set = buildCoupleFaithSet({
    eventType: 'wedding',
    ceremonyType: 'catholic',
    secondaryCeremonyType: 'muslim',
  });
  assert.equal(set.size, 2);
  assert.ok(set.has('Catholic') && set.has('Muslim'));
});

test("literal 'mixed' primary contributes nothing (fail-open); secondary still counts", () => {
  const set = buildCoupleFaithSet({
    eventType: 'wedding',
    ceremonyType: 'mixed',
    secondaryCeremonyType: 'inc',
  });
  assert.deepEqual([...set], ['INC']);
});

test('civil wedding → {Civil} (first-class key, not "no filtering")', () => {
  const set = buildCoupleFaithSet({ eventType: 'wedding', ceremonyType: 'civil' });
  assert.deepEqual([...set], ['Civil']);
});

test('unmapped/garbage ceremony types → empty set (fail-open, never throw)', () => {
  assert.equal(buildCoupleFaithSet({ ceremonyType: 'not_a_rite' }).size, 0);
  assert.equal(buildCoupleFaithSet({}).size, 0);
});

test('every CEREMONY_TYPE_TO_FAITH value is a canonical WEDDING_FAITH_KEYS member', () => {
  const allowed = new Set<string>(WEDDING_FAITH_KEYS);
  for (const [ct, faith] of Object.entries(CEREMONY_TYPE_TO_FAITH)) {
    assert.ok(allowed.has(faith), `ceremony "${ct}" maps to unknown faith "${faith}"`);
  }
});

// ── passesFaithFilter — INCLUDE-only ─────────────────────────────────────────

test('empty faith set = no narrowing: tagged AND untagged both pass (anonymous visitors)', () => {
  const none = new Set<string>();
  assert.equal(passesFaithFilter(null, none), true);
  assert.equal(passesFaithFilter('Muslim', none), true);
});

test('untagged services ALWAYS pass — "untagged always delivered"', () => {
  assert.equal(passesFaithFilter(null, new Set(['Catholic'])), true);
  assert.equal(passesFaithFilter(undefined, new Set(['Muslim'])), true);
  assert.equal(passesFaithFilter('', new Set(['INC'])), true);
});

test('tagged service passes only a matching couple (include-only exclusivity)', () => {
  const catholic = new Set(['Catholic']);
  assert.equal(passesFaithFilter('Catholic', catholic), true);
  assert.equal(passesFaithFilter('Muslim', catholic), false);
});

test('mixed couple (union set) sees BOTH rites" specialist services', () => {
  const mixed = new Set(['Catholic', 'Muslim']);
  assert.equal(passesFaithFilter('Muslim', mixed), true);
  assert.equal(passesFaithFilter('Catholic', mixed), true);
  assert.equal(passesFaithFilter('INC', mixed), false);
});

test('civil couple: universal + Civil pass, religious-tagged excluded (the documented intent)', () => {
  const civil = new Set(['Civil']);
  assert.equal(passesFaithFilter(null, civil), true);
  assert.equal(passesFaithFilter('Civil', civil), true);
  assert.equal(passesFaithFilter('Muslim', civil), false);
  assert.equal(passesFaithFilter('Catholic', civil), false);
});

// ── passesEventTypeFilter — FAIL-OPEN ────────────────────────────────────────

test('NULL/empty applicable list = universal (FAIL-OPEN; serves every event)', () => {
  assert.equal(passesEventTypeFilter(null, 'birthday'), true);
  assert.equal(passesEventTypeFilter(undefined, 'corporate'), true);
  assert.equal(passesEventTypeFilter([], 'debut'), true);
});

test('allow-list admits listed events, excludes others', () => {
  assert.equal(passesEventTypeFilter(['wedding'], 'wedding'), true);
  assert.equal(passesEventTypeFilter(['wedding'], 'birthday'), false);
  assert.equal(passesEventTypeFilter(['wedding', 'debut'], 'debut'), true);
});

test('event-side never-empty: NULL event_type tests as wedding against the allow-list', () => {
  // A legacy NULL-event_type row must keep seeing wedding-only tiles.
  assert.equal(passesEventTypeFilter(['wedding'], null), true);
  assert.equal(passesEventTypeFilter(['birthday'], null), false);
});
