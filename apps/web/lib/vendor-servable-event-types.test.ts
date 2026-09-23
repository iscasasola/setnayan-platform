/**
 * EXECUTES lib/vendor-servable-event-types.ts, and READS the supplier-side
 * callers so none of them slips back onto the shared, unfiltered vocab.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isVendorServable, vendorServableEventTypes } from './vendor-servable-event-types';
import type { EventTypeRow } from '@/app/dashboard/(account)/create-event/_components/event-types';
import { stripComments } from './strip-comments';

const row = (key: string, enabled = true): EventTypeRow => ({
  key, label: key, emoji: '🎉', enabled, onboardingHref: null, heroPhotoUrl: null, description: null,
});
const VOCAB = [row('wedding'), row('debut'), row('simple_event'), row('wake'), row('secret', false)];

test('a type whose profile turns the marketplace off is not one a supplier may serve', () => {
  const flags = new Map([['wedding', true], ['simple_event', false]]);
  assert.deepEqual(vendorServableEventTypes(VOCAB, flags).map((t) => t.key), ['wedding', 'debut', 'wake', 'secret']);
  assert.equal(isVendorServable(flags, 'simple_event'), false);
});

test('a missing or null flag means the column DEFAULT (true) — the 8 pre-column types stay servable', () => {
  const flags = new Map<string, boolean | null>([['debut', null]]);
  assert.deepEqual(vendorServableEventTypes(VOCAB, flags).map((t) => t.key), VOCAB.map((t) => t.key));
  assert.equal(isVendorServable(new Map(), 'anything'), true);
});

test('🔴 it gates on the COLUMN, never the name: a renamed vendor-free type is still filtered, and simple_event with the flag on is NOT', () => {
  assert.deepEqual(vendorServableEventTypes(VOCAB, new Map([['wake', false]])).map((t) => t.key), ['wedding', 'debut', 'simple_event', 'secret']);
  assert.ok(vendorServableEventTypes(VOCAB, new Map([['simple_event', true]])).some((t) => t.key === 'simple_event'));
});

test('order is the vocab’s own and `enabled` is untouched — suppliers may pre-tag an unlaunched type', () => {
  const out = vendorServableEventTypes(VOCAB, new Map([['simple_event', false]]));
  assert.equal(out[out.length - 1]?.key, 'secret');
  assert.equal(out[out.length - 1]?.enabled, false);
});

// ── the callers are a source fact, so they are read ────────────────────────
const SUPPLIER_SIDE = [
  'app/open-shop/page.tsx',
  'app/open-shop/actions.ts',
  'app/vendor-dashboard/services/new/page.tsx',
  'app/vendor-dashboard/services/new/[category]/page.tsx',
  'app/vendor-dashboard/services/_components/services-manager.tsx',
  'app/vendor-dashboard/services/coverage-actions.ts',
];

test('🔴 every supplier-side picker and validator reads the SERVABLE roster, not the shared vocab', () => {
  for (const f of SUPPLIER_SIDE) {
    const src = stripComments(readFileSync(f, 'utf8'));
    assert.doesNotMatch(src, /\bgetEventTypeVocab\b/, `${f} reads the unfiltered vocab — a supplier can tick a type no couple can search by`);
    assert.match(src, /\bgetVendorServableEventTypes\b/, `${f} does not read the servable roster at all`);
  }
  const db = stripComments(readFileSync('lib/event-types-db.ts', 'utf8'));
  assert.match(db, /vendorServableEventTypes\(/, 'the server reader must go through the pure rule');
  assert.match(db, /marketplace_enabled/, 'and read the flag off event_type_profiles');
  assert.doesNotMatch(db, /simple_event/, 'the reader must not name the type — the column is the gate');
});
