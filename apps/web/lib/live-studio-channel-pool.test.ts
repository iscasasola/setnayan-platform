/**
 * ⭐ WAVE 9 — the SETNAYAN-OWNED CHANNEL POOL, tested from the directions that
 * can cost money or leak a credential.
 * Live_Studio_Unified_Spec_2026-07-25.md § 4h.
 *
 *   1. GRANT SHAPE     — the platform grant is CHANNEL-keyed, lives in its own
 *                        service-role-only table, and the per-event BYO path in
 *                        `oauth_grants` is untouched.
 *   2. NO TOKEN ESCAPES— the view type the admin board renders has no token
 *                        field, the page never selects one, and the migration
 *                        grants no RLS policy on the grants table.
 *   3. PROVISIONING    — creates + mirrors broadcasts for an ENTITLED event, and
 *                        does NOT bypass Wave 3's publish gate for an un-entitled
 *                        one (3 broadcasts created, exactly 1 published).
 *   4. POOL SAFETY     — checkout is idempotent, cannot double-assign a channel,
 *                        and a failed provision does NOT strand one checked out.
 *   5. READINESS       — false without credentials, and the encoder caveat is on
 *                        EVERY branch including the green one.
 *   6. FLAG-OFF        — provisioning is a no-op and readiness renders nothing.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BLOCKED_HEADLINE,
  ENCODER_NOTICE,
  READY_HEADLINE,
  decideBroadcastReadiness,
  type ReadinessFacts,
} from './live-studio-readiness';
import { buildRoamManifest, type RoamStreamRow, type RoamZoneRow } from './live-studio-roam-provision';
import { limitPublishedManifest } from './live-studio-publish-pure';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');
const migration = (name: string) =>
  readFileSync(resolve(HERE, '..', '..', '..', 'supabase', 'migrations', name), 'utf8');

/**
 * Strip comments before asserting "this file does not mention X".
 *
 * Necessary, not fussy: these modules document the traps they avoid IN PROSE
 * ("never add an RLS policy", "must not suggest a phone can stream to YouTube"),
 * so a naive substring search matches the warning against the very thing it warns
 * about. The assertions below are about CODE, so they read code.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* ══════════════════════════════════════════════════════════════════════════════
   1 + 2 · GRANT SHAPE AND CREDENTIAL CONTAINMENT

   These are source assertions rather than behaviour assertions on purpose. The
   property that matters — "a couple can never read the Setnayan channel's refresh
   token" — is enforced by the ABSENCE of an RLS policy and by which columns the
   render path selects. Neither shows up in a unit test that calls a function; both
   break silently in a future edit. So they are pinned here.
   ══════════════════════════════════════════════════════════════════════════════ */

const MIGRATION = 'supabase/migrations/20271005481398_live_studio_channel_grants.sql';

test('the platform grant is CHANNEL-keyed, not event-keyed', () => {
  const sql = migration('20271005481398_live_studio_channel_grants.sql');
  assert.match(
    sql,
    /channel_pool_id\s+bigint NOT NULL UNIQUE\s+REFERENCES public\.live_studio_roam_channel_pool\(id\)/,
    'the grant must be keyed on the pool channel — one Setnayan channel serving many events',
  );
  // The CREATE TABLE body only — the header prose explains why event_id is absent.
  const body = sql.slice(
    sql.indexOf('CREATE TABLE IF NOT EXISTS public.live_studio_channel_grants'),
    sql.indexOf('CREATE INDEX IF NOT EXISTS live_studio_channel_grants_expiry_idx'),
  );
  assert.ok(body.length > 0);
  assert.ok(
    !/\bevent_id\b/.test(codeOf(body)),
    'the grants table must carry NO event_id: a platform channel belongs to no single event',
  );
});

test('🔒 the grants table has RLS ON and NO policy — service role only', () => {
  const sql = migration('20271005481398_live_studio_channel_grants.sql');
  assert.match(sql, /ALTER TABLE public\.live_studio_channel_grants ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /ALTER TABLE public\.live_studio_channel_oauth_state ENABLE ROW LEVEL SECURITY/);
  // The one thing that would turn this into a credential leak: any policy at all.
  // `is_admin()` would not save it — RLS is row-level, so a policy exposes the
  // refresh_token column too.
  assert.ok(
    !/CREATE POLICY[\s\S]*ON public\.live_studio_channel_grants/.test(sql),
    'NEVER add an RLS policy to live_studio_channel_grants — it puts a platform credential on the PostgREST wire',
  );
  assert.ok(
    !/CREATE POLICY[\s\S]*ON public\.live_studio_channel_oauth_state/.test(sql),
    'a readable OAuth state token is a CSRF bypass',
  );
});

test('🔒 the admin board cannot render a token — the view type has no token field', () => {
  const lib = repoFile('lib/live-studio-channel-grants.ts');
  // The exported view the page consumes.
  const view = lib.slice(
    lib.indexOf('export type PoolChannelGrantView'),
    lib.indexOf('type GrantRow'),
  );
  assert.ok(view.length > 0, 'PoolChannelGrantView must exist');
  assert.ok(!/refresh_token|refreshToken/.test(view), 'PoolChannelGrantView must never carry a refresh token');
  assert.ok(!/accessToken\b/.test(view), 'PoolChannelGrantView must never carry an access token');

  const page = repoFile('app/admin/live-studio-channels/page.tsx');
  assert.ok(!/refresh_token|access_token\b/.test(page), 'the admin page must never select a token column');
  const actions = repoFile('app/admin/live-studio-channels/actions.ts');
  assert.ok(!/refresh_token|access_token\b/.test(actions), 'no admin action may touch a token column');
});

test('🔒 the grants module is server-only and the BYO path is untouched', () => {
  const lib = repoFile('lib/live-studio-channel-grants.ts');
  assert.match(lib, /^import 'server-only';$/m, 'platform credentials must never reach a client bundle');

  // The per-event BYO grant still writes oauth_grants, unchanged.
  const broadcast = repoFile('lib/panood-broadcast.ts');
  assert.match(broadcast, /from\('oauth_grants'\)/);
  // …and the new module never touches that table, so the two cannot collide.
  assert.ok(
    !/oauth_grants/.test(codeOf(lib)),
    'the platform grant must not read or write the per-couple table',
  );
  assert.match(codeOf(lib), /from\('live_studio_channel_grants'\)/);
});

test('the pool OAuth start route is admin-gated AND flag-gated', () => {
  const route = repoFile('app/api/oauth/youtube/pool/start/route.ts');
  assert.match(route, /requireAdminAction\(\)/, 'connecting a platform channel is admin-only');
  assert.match(route, /liveStudioRoamEnabled\(\)/, 'and dark behind the Live Studio flag');
});

test('the shared callback keeps the BYO branch first — the pool branch is pure fallthrough', () => {
  const cb = repoFile('app/api/oauth/youtube/callback/route.ts');
  const byoLookup = cb.indexOf(".from('oauth_state')");
  const poolCall = cb.indexOf('completePoolChannelConnect({');
  assert.ok(byoLookup > -1 && poolCall > byoLookup, 'the per-event lookup must run first');
  // The pool branch sits inside the `if (!stateRow)` arm, i.e. exactly where the
  // route already returned state_not_found — so no existing connection changes.
  assert.match(cb, /if \(!stateRow\) \{[\s\S]{0,900}completePoolChannelConnect/);
  assert.match(cb, /return redirectWithError\(url, null, 'state_not_found'\);/);
});

/* ══════════════════════════════════════════════════════════════════════════════
   3 · PROVISIONING vs THE PUBLISH GATE

   The load-bearing claim: provisioning may CREATE N broadcasts for anyone (that
   is Setnayan's own cost), but only an ENTITLED event gets more than one of them
   PUBLISHED. The gate is `mirrorRoamManifest`, and provisioning must not add a
   second one beside it.
   ══════════════════════════════════════════════════════════════════════════════ */

function zone(id: number, over: Partial<RoamZoneRow> = {}): RoamZoneRow {
  return {
    id,
    zone_index: id,
    label: `Camera ${id}`,
    venue_label: null,
    is_featured: id === 1,
    is_main_stage: false,
    status: 'live',
    ...over,
  };
}
function stream(zoneId: number, videoId: string): RoamStreamRow {
  return { zone_id: zoneId, broadcast_id: videoId, status: 'ready' };
}

test('ENTITLED · 3 provisioned broadcasts all reach the public manifest', () => {
  const built = buildRoamManifest(
    [zone(1), zone(2), zone(3)],
    [stream(1, 'aaaaaaaaaaa'), stream(2, 'bbbbbbbbbbb'), stream(3, 'ccccccccccc')],
  );
  assert.equal(built.length, 3);
  assert.equal(limitPublishedManifest(built, true).length, 3);
});

test('🚨 UN-ENTITLED · 3 provisioned broadcasts, exactly ONE published', () => {
  const built = buildRoamManifest(
    [zone(1), zone(2), zone(3)],
    [stream(1, 'aaaaaaaaaaa'), stream(2, 'bbbbbbbbbbb'), stream(3, 'ccccccccccc')],
  );
  const published = limitPublishedManifest(built, false);
  assert.equal(published.length, 1, 'provisioning must not become a way around the § 4d paywall');
  assert.equal(published[0]?.videoId, 'aaaaaaaaaaa', 'the free channel is the host’s ★ default');
  // Reduction is by OMISSION: the other video ids never leave the server.
  const serialised = JSON.stringify(published);
  assert.ok(!serialised.includes('bbbbbbbbbbb') && !serialised.includes('ccccccccccc'));
});

test('provisioning adds NO second paywall — it defers to mirrorRoamManifest', () => {
  const src = repoFile('lib/live-studio-roam-provision.ts');
  const fn = codeOf(src.slice(src.indexOf('export async function provisionRoamBroadcasts')));
  assert.ok(
    !/canPublishMultiCam\(|decidePublish\(|limitPublishedManifest\(/.test(fn),
    'the publish gate lives in mirrorRoamManifest and must stay the only one',
  );
  assert.match(fn, /await mirrorRoamManifest\(admin, eventId\)/, 'provisioning must end at the gate');
  // …and the gate it defers to really does ask.
  const mirror = src.slice(
    src.indexOf('export async function mirrorRoamManifest'),
    src.indexOf('export async function checkoutPoolChannel'),
  );
  assert.match(mirror, /canPublishMultiCam\(admin, eventId\)/);
  assert.match(mirror, /limitPublishedManifest\(built, owned\)/);
});

test('broadcasts are created UNLISTED — omission cannot hide a public video', () => {
  const src = repoFile('lib/live-studio-roam-provision.ts');
  assert.match(
    src,
    /privacyStatus: 'unlisted'/,
    'these live on a SETNAYAN channel; a public broadcast is discoverable from the channel page regardless of what the manifest omits',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   4 · POOL SAFETY — idempotency, no double-assignment, no stranding
   ══════════════════════════════════════════════════════════════════════════════ */

test('a channel cannot be double-assigned — the DB index is the backstop, not the code', () => {
  const foundation = readFileSync(
    resolve(HERE, '..', '..', '..', 'supabase', 'migrations', '20270919193341_live_studio_roam_rename.sql'),
    'utf8',
  );
  assert.match(
    foundation,
    /CREATE UNIQUE INDEX IF NOT EXISTS live_studio_roam_channel_pool_one_per_event[\s\S]*?WHERE status = 'checked_out' AND checked_out_event_id IS NOT NULL/,
    'one channel per event must be enforced in the database, not only by a read-then-write',
  );
  const src = repoFile('lib/live-studio-roam-provision.ts');
  const checkout = src.slice(
    src.indexOf('export async function checkoutPoolChannel'),
    src.indexOf('export async function returnPoolChannel'),
  );
  // Idempotent: an event already holding a channel gets the same one back.
  assert.match(checkout, /\.eq\('checked_out_event_id', eventId\)/);
  assert.match(checkout, /if \(existing\) return existing as RoamChannelRow;/);
  // Lost-update guard: the claim only lands if the row is STILL available.
  assert.match(checkout, /\.eq\('status', 'available'\) \/\/ lost-update guard/);
  // Only verified channels are ever claimed.
  assert.match(checkout, /\.eq\('verified', true\)/);
});

test('per-zone streams are single-active — a replayed provision cannot double-spend quota', () => {
  const foundation = readFileSync(
    resolve(HERE, '..', '..', '..', 'supabase', 'migrations', '20270919193341_live_studio_roam_rename.sql'),
    'utf8',
  );
  assert.match(foundation, /live_studio_roam_streams_one_active_per_zone/);
  const src = repoFile('lib/live-studio-roam-provision.ts');
  const fn = src.slice(src.indexOf('export async function provisionRoamBroadcasts'));
  assert.match(fn, /existingZoneIds\.has\(zone\.id\)/, 'zones with a live stream are reused, not re-created');
  assert.match(fn, /insErr\.code === '23505'/, 'a racing insert counts as reused, not as an error');
});

test('🚨 a failed provision does NOT strand a channel checked out', () => {
  const src = repoFile('lib/live-studio-roam-provision.ts');
  const fn = src.slice(src.indexOf('export async function provisionRoamBroadcasts'));
  // No token → release before returning.
  assert.match(
    fn,
    /if \(!accessToken\) \{[\s\S]{0,600}releasePoolChannelIfIdle\(admin, eventId\)/,
    'a credential failure must give the channel back',
  );
  // Total YouTube failure with nothing created → release before returning.
  assert.match(
    fn,
    /if \(youtubeError && created === 0 && reused === 0\) \{[\s\S]{0,400}releasePoolChannelIfIdle\(admin, eventId\)/,
  );
  // …but the safe release REFUSES while streams are still running, so a partial
  // success cannot hand a live wedding's channel to the next event.
  const safe = src.slice(
    src.indexOf('export async function releasePoolChannelIfIdle'),
    src.indexOf('WAVE 9 — YOUTUBE BROADCAST PROVISIONING'),
  );
  assert.match(safe, /\.not\('status', 'in', '\("complete","errored"\)'\)/);
  assert.match(safe, /if \(\(data \?\? \[\]\)\.length > 0\) return false;/);
});

test('a lost checkout race retries onto ANOTHER channel instead of reporting "none free"', () => {
  const src = repoFile('lib/live-studio-roam-provision.ts');
  const checkout = src.slice(
    src.indexOf('export async function checkoutPoolChannel'),
    src.indexOf('export async function returnPoolChannel'),
  );
  assert.match(checkout, /for \(let attempt = 0; attempt < 4; attempt \+= 1\)/, 'bounded retry, not a spin');
  assert.match(checkout, /if \(claimed\) return claimed as RoamChannelRow;/);
  // An empty pool exits after at most one stale-checkout reclaim sweep (2026-09-02)
  // — see live-studio-roam-reclaim-guard.test.ts for the sweep's own safety pins —
  // the retry loop itself is still for CONTENTION, not for hope.
  assert.match(checkout, /if \(freeErr \|\| !free\) \{/);
  assert.match(checkout, /return null; \/\/ pool genuinely empty/);
});

test('an ORPHANED checkout (event deleted) is still releasable by an admin', () => {
  const actions = repoFile('app/admin/live-studio-channels/actions.ts');
  const fn = actions.slice(actions.indexOf('export async function releaseChannel'));
  // Releases by CHANNEL id and clears the row directly when there is no event —
  // `checked_out_event_id` is ON DELETE SET NULL, so nothing keyed by event can
  // find that row.
  assert.match(fn, /\.eq\('id', id\)/);
  assert.match(fn, /checked_out_event_id: null/);
  // And the admin status dropdown refuses to quietly un-check-out a held channel.
  assert.match(actions, /This channel is checked out to an event — release it first\./);
});

/* ══════════════════════════════════════════════════════════════════════════════
   4b · GO-LIVE — the couple's Google account is genuinely off the critical path
   ══════════════════════════════════════════════════════════════════════════════ */

const GO_LIVE = 'app/dashboard/[eventId]/studio/panood/setup/actions.ts';

test('⭐ go-live prefers the SETNAYAN pool channel, with BYO only as fallback', () => {
  const src = repoFile(GO_LIVE);
  const fn = src.slice(src.indexOf('export async function goLivePanood'), src.indexOf('export async function endPanoodBroadcast'));
  const poolAt = fn.indexOf('resolveEventBroadcastToken(createAdminClient(), eventId)');
  const byoAt = fn.indexOf('getEventYoutubeAccessToken(eventId)');
  assert.ok(poolAt > -1, 'go-live must be able to use a Setnayan channel');
  assert.ok(byoAt > poolAt, 'the pool must be tried FIRST — Wave 9 removes the couple’s Google account');
  // …and the pool attempt is flag-gated, so flag-off go-live is the original path.
  assert.match(fn, /if \(liveStudioRoamEnabled\(\)\) \{[\s\S]{0,300}resolveEventBroadcastToken/);
});

test('go-live never tells a host to connect a channel they are not allowed to connect', () => {
  const src = repoFile(GO_LIVE);
  const fn = src.slice(src.indexOf('export async function goLivePanood'), src.indexOf('export async function endPanoodBroadcast'));

  // ── THE PROPERTY IS UNCHANGED; THE QUESTION IT ASKS IS FIXED ────────────────
  // What must hold: a host who CANNOT connect their own Google account is never
  // told to. That is the Wave 9 promise and it still stands.
  //
  // This used to be pinned to the exact ternary `liveStudioRoamEnabled() ? … : …`,
  // and the roam flag turned out to be the wrong question. It is ON in production
  // while the Setnayan pool holds ZERO channels and ZERO grants, so EVERY host
  // without a connection was told "this is on our side — contact Setnayan" while
  // the Connect button sat rendered on the page they were reading. The owner was
  // being told to contact himself, and the guard was holding that in place.
  //
  // The thing that actually closes the BYO door is `liveStudioPoolOnly()` — it
  // removes the couple's Connect button and makes /api/oauth/youtube/start refuse
  // with 409. So THAT is what the copy must branch on, and this asserts it.
  assert.match(
    fn,
    /liveStudioPoolOnly\(\)\s*\?\s*'No Setnayan broadcast channel is available[^']*'\s*:\s*'Connect your YouTube channel first[^']*'/,
    'the no-token copy must branch on whether the BYO door is OPEN (pool-only), not on the roam flag',
  );

  // And the roam flag must NOT be what decides this copy again.
  assert.doesNotMatch(
    fn,
    /liveStudioRoamEnabled\(\)\s*\?\s*'No Setnayan broadcast channel is available/,
    'the roam flag is back to deciding this message — it is on while the pool is empty',
  );
});

test('go-live provisions the ROAM broadcasts — the mirror finally has a caller', () => {
  const src = repoFile(GO_LIVE);
  const fn = src.slice(src.indexOf('export async function goLivePanood'), src.indexOf('export async function endPanoodBroadcast'));
  assert.match(fn, /await provisionRoamBroadcasts\(admin, eventId, \{/);
  // AFTER the single-cam broadcast is persisted: the free single-camera stream is
  // a published promise and must not depend on multi-cam provisioning succeeding.
  const persistAt = fn.indexOf('await createPanoodBroadcast(');
  assert.ok(persistAt > -1 && fn.indexOf('await provisionRoamBroadcasts(') > persistAt);
  // Flag-gated — asserted by BRACE MATCHING, not by character distance.
  //
  // ⚠ This used to read `/if \(liveStudioRoamEnabled\(\)\) \{[\s\S]{0,1400}provisionRoamBroadcasts/`,
  // i.e. "the call appears within 1400 characters of the gate". That is not the
  // property — the property is that the call is INSIDE the gated block — and the
  // proxy broke the moment a comment was added above the call (2026-08-10),
  // failing a change that moved nothing. A guard that fails on prose trains you
  // to loosen it, which is how the real assertion gets thrown away.
  // ⚠ goLivePanood has TWO `if (liveStudioRoamEnabled())` blocks — the token
  // lookup near the top and the provisioning one near the bottom. The old
  // distance regex anchored on the FIRST and matched 1400 characters straight
  // out the other side of it, so it would have passed with the call ungated
  // entirely. Every gate is checked now, and at least one must CONTAIN the call.
  const code = codeOf(fn);
  const blocks: string[] = [];
  for (const m of code.matchAll(/if \(liveStudioRoamEnabled\(\)\) \{/g)) {
    let depth = 0;
    for (let i = code.indexOf('{', m.index); i < code.length; i += 1) {
      if (code[i] === '{') depth += 1;
      else if (code[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(code.slice(m.index, i));
          break;
        }
      }
    }
  }
  assert.ok(blocks.length > 0, 'the roam flag gate must still be here');
  assert.ok(
    blocks.some((b) => /provisionRoamBroadcasts\(/.test(b)),
    'provisioning must sit INSIDE a roam flag gate',
  );
});

test('🚨 ENDING a broadcast never claims a channel, and never releases one', () => {
  const src = repoFile(GO_LIVE);
  const end = src.slice(src.indexOf('export async function endPanoodBroadcast'));
  // Read-only token lookup — the claiming variant must not appear here.
  //
  // 2026-07-26 (recording handoff): the client is now hoisted into `admin`, because
  // completeRoamBroadcasts needs the same one. This assertion therefore pins the two
  // PROPERTIES the old single literal encoded, rather than the literal — and pins
  // them harder, because the flag gate is now named explicitly instead of being
  // implied by where the call sat:
  //   ① the admin client is constructed ONLY behind the flag (it throws without
  //      SUPABASE_SERVICE_ROLE_KEY, and a flag-off End must not gain a way to fail);
  //   ② the token comes from the READ-ONLY accessor.
  assert.match(
    end,
    /const admin = liveStudioRoamEnabled\(\) \? createAdminClient\(\) : null/,
    'the service-role client must stay flag-gated in End',
  );
  assert.match(end, /getHeldChannelAccessToken\(admin, eventId\)/);
  assert.ok(
    !/resolveEventBroadcastToken|checkoutPoolChannel/.test(codeOf(end)),
    'pressing End must not consume pool inventory',
  );
  // And no release: § 4h hands the recording back BEFORE wipe+reuse, and that
  // VOD pull is not built. Release is an explicit admin act.
  assert.ok(
    !/returnPoolChannel|releasePoolChannelIfIdle/.test(codeOf(end)),
    'auto-releasing on End would let the next wedding wipe this couple’s recording',
  );
  assert.match(src, /THE POOL CHANNEL IS DELIBERATELY \*NOT\* RELEASED HERE/);
});

test('getHeldChannelAccessToken is read-only — it cannot check a channel out', () => {
  const src = repoFile('lib/live-studio-roam-provision.ts');
  const fn = codeOf(
    src.slice(
      src.indexOf('export async function getHeldChannelAccessToken'),
      src.indexOf('export async function resolveEventBroadcastToken'),
    ),
  );
  assert.ok(fn.length > 0);
  assert.ok(!/\.update\(|checkoutPoolChannel/.test(fn), 'this lookup must never write to the pool');
  assert.match(fn, /\.eq\('status', 'checked_out'\)/);
});

/* ══════════════════════════════════════════════════════════════════════════════
   5 · READINESS — truthful, and never claims the encoder is handled
   ══════════════════════════════════════════════════════════════════════════════ */

const ALL_GOOD: ReadinessFacts = {
  oauthConfigured: true,
  channelAvailable: true,
  channelConnected: true,
  channelNeedsReauth: false,
  cameraCount: 2,
  provisionedCount: 2,
};

test('readiness is FALSE without credentials', () => {
  const d = decideBroadcastReadiness({ ...ALL_GOOD, oauthConfigured: false });
  assert.equal(d.state, 'blocked');
  assert.equal(d.headline, BLOCKED_HEADLINE);
  assert.equal(d.blockers[0]?.key, 'oauth_configured');
});

test('readiness is FALSE when no Setnayan channel is connected', () => {
  assert.equal(decideBroadcastReadiness({ ...ALL_GOOD, channelConnected: false }).state, 'blocked');
  assert.equal(decideBroadcastReadiness({ ...ALL_GOOD, channelAvailable: false }).state, 'blocked');
  const stale = decideBroadcastReadiness({ ...ALL_GOOD, channelNeedsReauth: true });
  assert.equal(stale.state, 'blocked');
  assert.equal(stale.blockers[0]?.key, 'channel_healthy');
});

test('readiness is FALSE with no cameras', () => {
  const d = decideBroadcastReadiness({ ...ALL_GOOD, cameraCount: 0 });
  assert.equal(d.state, 'blocked');
  assert.equal(d.blockers[0]?.key, 'cameras');
});

test('readiness is TRUE when everything Setnayan controls is in place', () => {
  const d = decideBroadcastReadiness(ALL_GOOD);
  assert.equal(d.state, 'ready');
  assert.equal(d.headline, READY_HEADLINE);
  assert.equal(d.blockers.length, 0);
});

test('🚨 the ENCODER caveat is on EVERY branch, green included', () => {
  const cases: ReadinessFacts[] = [
    ALL_GOOD,
    { ...ALL_GOOD, oauthConfigured: false },
    { ...ALL_GOOD, channelConnected: false },
    { ...ALL_GOOD, cameraCount: 0 },
    { oauthConfigured: false, channelAvailable: false, channelConnected: false, channelNeedsReauth: true, cameraCount: 0, provisionedCount: 0 },
  ];
  for (const facts of cases) {
    assert.equal(decideBroadcastReadiness(facts).encoderNotice, ENCODER_NOTICE);
  }
  // The green headline itself names the remaining human step rather than
  // congratulating: "Ready to broadcast — START YOUR ENCODER".
  assert.match(READY_HEADLINE, /encoder/i);
});

test('🚫 no copy anywhere implies a phone or a browser can stream to YouTube', () => {
  assert.match(ENCODER_NOTICE, /cannot push a livestream on its own/i);
  assert.match(ENCODER_NOTICE, /OBS/);
  // Asserted over the CODE (comments stripped), because these modules document
  // the very claim they must never make.
  const files = [
    'lib/live-studio-readiness.ts',
    'app/_components/live-studio/broadcast-readiness.tsx',
    'app/admin/live-studio-channels/page.tsx',
  ];
  for (const f of files) {
    const src = codeOf(repoFile(f));
    assert.ok(
      !/phone[^.]{0,80}(stream|push|broadcast)s?\s+(straight\s+)?to\s+YouTube/i.test(src),
      `${f} must not suggest a phone→YouTube path — it does not exist`,
    );
    assert.ok(
      !/you'?re all set|all set!|nothing else to do/i.test(src),
      `${f} must not tell a host they are done — the encoder is still required`,
    );
  }
  // And the honest limit is stated on the admin board, not buried.
  assert.match(repoFile('app/admin/live-studio-channels/page.tsx'), /does not make Live Studio turnkey/i);
});

/* ══════════════════════════════════════════════════════════════════════════════
   6 · FLAG-OFF — zero behaviour change
   ══════════════════════════════════════════════════════════════════════════════ */

test('flag OFF · provisioning is a no-op before it reads anything', async () => {
  const previous = process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
  delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
  try {
    const { provisionRoamBroadcasts } = await import('./live-studio-roam-provision');
    // A client that throws on ANY use: if the flag check is not first, this fails.
    const exploding = new Proxy(
      {},
      {
        get() {
          throw new Error('the flag-off path must not touch the database');
        },
      },
    ) as never;
    const result = await provisionRoamBroadcasts(exploding, 'evt-1');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'flag_off');
    assert.equal(result.created, 0);
    assert.equal(result.published, 0);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
    else process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = previous;
  }
});

test('flag OFF · the admin surface does not exist, and nothing links to it', () => {
  const page = repoFile('app/admin/live-studio-channels/page.tsx');
  assert.match(page, /if \(!liveStudioRoamEnabled\(\)\) notFound\(\);/, 'the route must 404 when dark');
  const nav = repoFile('app/admin/_components/admin-nav-groups.tsx');
  assert.match(
    nav,
    /envFlagEnabled\(process\.env\.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED\)[\s\S]{0,400}live-studio-channels/,
    'the nav entry must be conditional — a row pointing at a 404 is worse than no row',
  );
  const actions = repoFile('app/admin/live-studio-channels/actions.ts');
  assert.match(actions, /if \(!liveStudioRoamEnabled\(\)\) throw new Error/, 'every action is flag-gated too');
});

test('flag OFF · readiness resolves to nothing rather than to a state', () => {
  const server = repoFile('lib/live-studio-readiness-server.ts');
  assert.match(server, /if \(!liveStudioRoamEnabled\(\)\) return null;/);
});

test('🚨 WAVE 8 COLLISION GUARD — Wave 9 touches no controller file', () => {
  // Wave 8 owns app/dashboard/[eventId]/studio/live-studio-control/**. The
  // readiness card is therefore a self-contained component in shared space, and
  // this test fails if a future edit sneaks an import of it back into that tree
  // before Wave 8 has landed. (Delete this test when Wave 8 mounts the card.)
  const card = repoFile('app/_components/live-studio/broadcast-readiness.tsx');
  assert.match(card, /export function BroadcastReadiness/);
  assert.ok(
    !/live-studio-control/.test(codeOf(card)),
    'the shared card must not import from the Wave 8 directory',
  );
  // It is self-contained: a server component with no client boundary and no data
  // fetching of its own, so mounting it is genuinely two lines for Wave 8.
  assert.ok(!/'use client'/.test(card), 'the card must stay a server component');
  assert.ok(!/createAdminClient|createClient/.test(codeOf(card)), 'the card must take a resolved decision, not fetch');
});

// Keep the migration path referenced so a rename breaks this file loudly rather
// than silently skipping the RLS assertions above.
test('the Wave 9 migration is where these tests think it is', () => {
  assert.doesNotThrow(() =>
    readFileSync(resolve(HERE, '..', '..', '..', MIGRATION), 'utf8'),
  );
});
