/**
 * ⭐ THE HOST WITH A SETNAYAN CHANNEL IS NOT TOLD TO GO GET ONE.
 *
 * Measured in production on 2026-08-31, the day the pool first held a healthy grant:
 *
 *   oauth_grants (BYO, per event)       1 row, 0 live   ← a revoked July grant
 *   live_studio_roam_channel_pool       1 row, verified, available
 *   live_studio_channel_grants (pool)   1 row, connection_health = 'ok'
 *
 * `goLivePanood` has preferred the POOL channel since Wave 9. The BUTTON that calls
 * it read `oauth_grants` filtered by event_id — the BYO table, and only that — so it
 * rendered "Connect your YouTube channel first", the one instruction Wave 9 exists to
 * abolish, while the hidden button would have worked.
 *
 * 🔑 EVERY FACT WAS TRUE AND NONE OF THEM REACHED THE RENDER. These tests pin the
 * predicate that now carries them there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { poolRouteToAir } from './live-studio-readiness';
import { automaticGoLiveAvailable } from './live-studio-manual-air';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

const facts = (o: Partial<Parameters<typeof poolRouteToAir>[0]> = {}) => ({
  channelAvailable: true,
  channelConnected: true,
  channelNeedsReauth: false,
  ...o,
});

test('⭐ the exact production state of 2026-08-31 is a route to air', () => {
  assert.equal(poolRouteToAir(facts()), true);
});

test('each precondition alone is enough to refuse — no accidental pass', () => {
  // The conjunction, tested one predicate at a time. Deleting any single term from
  // poolRouteToAir must turn exactly one of these red.
  assert.equal(poolRouteToAir(facts({ channelAvailable: false })), false, 'pool empty or exhausted');
  assert.equal(poolRouteToAir(facts({ channelConnected: false })), false, 'nobody has connected it');
  assert.equal(poolRouteToAir(facts({ channelNeedsReauth: true })), false, 'Google is rejecting the token');
});

test('needs-reauth is a HARD no, not a warning', () => {
  // There is no token to broadcast with, so one-tap would be a button that cannot
  // work — the precise thing automaticGoLiveAvailable exists to prevent.
  assert.equal(poolRouteToAir(facts({ channelNeedsReauth: true })), false);
});

test('⭐ a pool-served host reaches the SAME verdict as a BYO host', () => {
  const byo = automaticGoLiveAvailable({ oauthReady: true, connected: true });
  const pooled = automaticGoLiveAvailable({ oauthReady: true, connected: poolRouteToAir(facts()) });
  assert.equal(pooled, byo, 'the pool must not be a second-class route to air');
  assert.equal(pooled, true);
});

test('the OAuth client still gates both — a pool channel cannot substitute for it', () => {
  assert.equal(
    automaticGoLiveAvailable({ oauthReady: false, connected: poolRouteToAir(facts()) }),
    false,
  );
});

/* ── The wiring, not just the predicate ─────────────────────────────────────
   The bug was never in a pure function — it was a page asking the wrong table.
   A green predicate with the call site still reading oauth_grants alone would
   reproduce the defect exactly, so the source is asserted too.                */

test('⭐ the controller gates on the route to air, NOT on the BYO grant alone', () => {
  const page = repoFile('app/panood/control/[eventId]/page.tsx');
  assert.match(page, /connected=\{hasRouteToAir\}/, 'TransportRow must receive the combined route');
  assert.doesNotMatch(
    page,
    /connected=\{!!youtubeGrant\}/,
    'gating on the BYO grant alone is the 2026-08-31 defect',
  );
  assert.match(page, /poolRouteToAir\(/, 'the pool must actually be consulted');
});

test('the stale "Google app review" reason is gone from the transport row', () => {
  // oauthReady means "the YOUTUBE_OAUTH_* env vars resolve" — nothing to do with a
  // Google review, and the copy promised an email that could never arrive.
  const row = repoFile('app/panood/control/[eventId]/transport-row.tsx');
  assert.doesNotMatch(row, /app review clears with Google/);
  assert.doesNotMatch(row, /We’ll email/);
});
