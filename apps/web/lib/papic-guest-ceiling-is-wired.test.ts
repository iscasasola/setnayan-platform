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
import { papicCaptureCost, PAPIC_POINTS_PER_CLIP } from './papic-cameras';

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
  assert.equal(papicCaptureCost('clip'), PAPIC_POINTS_PER_CLIP);
  assert.equal(papicCaptureCost('clip'), 8);
  assert.equal(papicCaptureCost('photo'), 1);
});

test('🪤 the deploy-window rung exists — the migration and Vercel race, and a clip must not degrade', () => {
  // Both fire on a push to main. For the minutes where this code is live and
  // 20271184624871 is not, the 7-arg call 42883s; without a 6-arg rung it would
  // fall to shapes that cannot carry media_type, recording every clip of that
  // window as a photo.
  const rungs = [...ROUTE.matchAll(/admin\.rpc\('papic_record_guest_capture', \{([^}]*)\}/gs)]
    // 🪤 `[a-z0-9_]`, not `[a-z_]` — `p_r2_object_key` and `p_poster_r2_key`
    // carry a DIGIT, so the obvious character class silently counted 5 and 4.
    .map((m) => (m[1].match(/p_[a-z0-9_]+:/g) ?? []).length);
  assert.deepEqual(
    rungs,
    [7, 6, 3, 2],
    'the ladder must descend one argument-shape at a time, 7 → 6 → 3 → 2',
  );
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
