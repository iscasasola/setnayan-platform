/**
 * Guard suite for the Studio add-ons' event-type SURFACE tagging (2026-06-28).
 * The `surface` field gates wedding-only tools out of non-wedding Studio hubs
 * (studio/page.tsx filters by surfaceEnabled). This locks the intended mapping so
 * a wedding-only tool can't silently become universal (or vice-versa).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADD_ONS } from './add-ons-catalog';

const byKey = new Map(ADD_ONS.map((a) => [a.key, a] as const));

test('wedding-surface add-ons carry the right surface', () => {
  const expected: Record<string, string> = {
    'save-the-date': 'save_the_date',
    rsvp: 'rsvp',
    event: 'website',
    editorial: 'website',
    'landing-page': 'website',
    'animated-monogram': 'monogram',
    // Papic Buong Araw (PAPIC_GUEST) — the flat guest-camera pass needs a guest
    // ROSTER, so it hides wherever the type has no RSVP surface (simple_event).
    // NOTE: `surface` alone does NOT deny travel (its profile enables rsvp) —
    // lib/papic-event-access.ts carries that deny.
    'papic-guest': 'rsvp',
  };
  for (const [key, surface] of Object.entries(expected)) {
    const entry = byKey.get(key);
    assert.ok(entry, `add-on "${key}" should exist`);
    assert.equal(entry!.surface, surface, `${key} surface`);
  }
});

test('universal in-app services carry NO surface (shown for every event type)', () => {
  // A representative set of non-wedding-gated services — they must stay universal.
  for (const key of ['setnayan-ai', 'papic', 'panood', 'pakanta', 'mood-board', 'seating']) {
    const entry = byKey.get(key);
    if (!entry) continue; // tolerate catalog churn — only assert when present
    assert.equal(entry.surface, undefined, `${key} must stay universal (no surface)`);
  }
});

test('Papic Buong Araw stays unbuyable until its Phase-0 gates land', () => {
  // The live catalog row is still pax-priced at ₱2,999 (verdict gate 0b is an
  // owner DB action), the event-scoped points pool (0c) is unbuilt, and the
  // ROPA row + DPO consent-text sign-off (0d/0e) are open. A 'live' card would
  // show the wrong price and open a buy path that cannot honour it. Flip this
  // assertion in the SAME PR that flips the status — never before.
  const entry = byKey.get('papic-guest');
  assert.ok(entry, 'papic-guest add-on should exist (the doorway is gate 0h)');
  assert.equal(entry!.status, 'coming_soon');
  assert.equal(entry!.serviceKey, 'PAPIC_GUEST');
});

test('every surface value is a known ProfileSurface', () => {
  const valid = new Set(['website', 'save_the_date', 'rsvp', 'seating', 'budget', 'schedule', 'monogram', 'day_of', 'gallery']);
  for (const a of ADD_ONS) {
    if (a.surface !== undefined) {
      assert.ok(valid.has(a.surface), `${a.key}: "${a.surface}" is not a ProfileSurface`);
    }
  }
});
