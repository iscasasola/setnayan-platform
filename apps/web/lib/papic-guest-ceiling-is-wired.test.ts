/**
 * THE CEILING IS WIRED — the two seams the database test cannot reach.
 *
 * `tests/db/papic-guest-spend-ceiling.db.test.ts` proves the gate BINDS. It
 * cannot prove the app ever tells the gate what a capture cost, nor what the
 * offline queue does with a refusal. Both of those are TypeScript, and both
 * have their own history:
 *
 *   • A meter fed a wrong cost is the "four limits that governed nothing"
 *     failure with an extra step — the ceiling would be real and every clip
 *     would spend 1 credit against it instead of 8.
 *   • A drain classification left undecided is the 2026-08-18 defect: a shot
 *     retried fifty times and evicted in silence, with the photographer told it
 *     was saved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { drainGuestCaptureWith, type GuestPostResult } from './offline/service-handlers/papic-drain';
import { papicCaptureCost, PAPIC_POINTS_PER_SNIPPET } from './papic-cameras';

const ROUTE = readFileSync(
  join(import.meta.dirname, '..', 'app', 'api', 'papic', 'guest-capture', 'route.ts'),
  'utf8',
);

test('the route hands the RPC the cost it already computed — not a literal, not nothing', () => {
  assert.match(
    ROUTE,
    /p_points_cost:\s*cost,/,
    'without this the ceiling meters every clip as one credit instead of eight',
  );
  assert.match(
    ROUTE,
    /const cost = papicCaptureCost\(/,
    'and `cost` must still come from the ONE place that owns the credit weights',
  );
  assert.doesNotMatch(
    ROUTE,
    /p_points_cost:\s*\d/,
    'a literal here would be a second copy of a money rule',
  );
  assert.equal(papicCaptureCost('clip'), PAPIC_POINTS_PER_SNIPPET);
  assert.equal(papicCaptureCost('clip'), 8);
  assert.equal(papicCaptureCost('photo'), 1);
});

test('🪤 one call carries every argument the record needs — no ladder that could degrade a clip', () => {
  // ⏭ THE LADDER IS GONE, AND THAT IS THE FIX (20271276810836). The route used
  // to descend 9 → 8 → 7 → 6 → 3 → 2 argument-shapes of papic_record_guest_capture
  // so a deploy race could not record every clip as a photo. It now makes ONE
  // call — papic_record_guest_capture_and_spend, which books the points and
  // writes the row in one transaction — and deploy-prod applies migrations
  // BEFORE the code goes live (the seat path's measured reasoning, which ships
  // with no ladder either). What this test still holds is the property the
  // ladder existed for: the call carries media_type, the length, the poster,
  // the cost, the shutter minute and the shutter id, every time.
  const calls = [...ROUTE.matchAll(/admin\.rpc\('papic_record_guest_capture_and_spend', \{([^}]*)\}/gs)];
  assert.equal(calls.length, 1, 'exactly one call books and records');
  const args = ((calls[0]?.[1] ?? '').match(/p_[a-z0-9_]+(?=:)/g) ?? []).sort();
  assert.deepEqual(args, [
    'p_captured_at', 'p_client_capture_id', 'p_consent_to_public', 'p_duration_ms',
    'p_guest_id', 'p_media_type', 'p_points_cost', 'p_poster_r2_key', 'p_r2_object_key',
  ]);
  // The only papic_record_guest_capture call left is the early answer to a
  // shutter that already landed (`p_guest_id` + `p_client_capture_id`), asked
  // before any upload or booking — it writes nothing and spends nothing.
  const record = [...ROUTE.matchAll(/admin\.rpc\('papic_record_guest_capture', \{([^}]*)\}/gs)]
    .map((m) => ((m[1] ?? '').match(/p_[a-z0-9_]+:/g) ?? []).length);
  assert.deepEqual(record, [2], 'a direct record call writes a row with no points booked');
});

const payload = () => ({
  mode: 'guest' as const,
  media_type: 'photo' as const,
  content_type: 'image/jpeg',
  filename: 'p.jpg',
  bytes: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
  captured_at_ms: 1,
});

test('🚨 a ceiling refusal on a DRAINED shot is kept and surfaced — never dropped, never a false success', async () => {
  // ⚖ THE DECISION §7d DEMANDED BE MADE EXPLICITLY. Terminal would throw away a
  // photograph the guest watched themselves take. Unregistered would retry it
  // ~50 times and let the 7-day TTL evict it in silence while the screen said
  // it was saved. So it is registered as retryable, with the pool, because a
  // ceiling can be LIFTED exactly as a pot can be topped up.
  const post = async (): Promise<GuestPostResult> => ({
    ok: false,
    status: 409,
    body: { status: 'quota_exhausted', reason: 'guest_spend_ceiling' } as {
      status?: string; error?: string;
    },
  });
  const result = await drainGuestCaptureWith(post, payload());
  assert.deepEqual(result, { ok: false, error: 'camera_points_exhausted' });
  assert.notEqual(result.ok, true, 'ok:true is the DEQUEUE signal — it would discard the shot');
});

test('the refusal carries a reason, so the guest’s screen can stop inheriting the pot’s copy', () => {
  const MIGRATION = readFileSync(
    join(import.meta.dirname, '..', '..', '..', 'supabase', 'migrations',
      '20271184624871_papic_shots_per_guest_ceiling.sql'),
    'utf8',
  );
  assert.match(MIGRATION, /'reason', 'guest_spend_ceiling'/);
  assert.match(MIGRATION, /'reason', 'per_guest_credits'/);
  assert.match(ROUTE, /reason\?: string;/, 'and the route must carry it through to the client');
});
