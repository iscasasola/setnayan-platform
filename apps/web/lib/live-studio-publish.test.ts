/**
 * ⭐ THE LIVE STUDIO PAYWALL — "rehearse free, pay to broadcast" (owner-locked
 * 2026-07-25 · Live_Studio_Unified_Spec § 4d). This is MONEY CODE: it is the only
 * thing standing between a free host and a real multi-camera wedding broadcast, so
 * it is tested from both directions —
 *
 *   1. DECISION   — 0 or 1 published channel is always allowed (the free
 *                   single-camera livestream, which /pricing promises); 2+ needs
 *                   LIVE_STUDIO.
 *   2. REDUCTION  — an un-entitled event's manifest is cut to the ONE on-air channel
 *                   by OMISSION, using the same selector guest-pick uses, so the
 *                   other channels' video ids never leave the server.
 *   3. FAIL-CLOSED— every path that cannot resolve the entitlement publishes ONE
 *                   channel, never many.
 *   4. WIRING     — the gate is actually CALLED at both enforcement points (the
 *                   manifest mirror and the public read), and the old
 *                   `requireLiveStudioOwned` has NOT crept back onto the rehearsal
 *                   actions. Pure-function correctness is worthless if the call
 *                   site quietly disappears, and this is the class of regression a
 *                   relocated paywall invites.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FREE_PUBLISHED_CHANNEL_LIMIT,
  canPublishMultiCam,
  decidePublish,
  limitPublishedManifest,
} from './live-studio-publish';
import { applyGuestPick, type RoamManifest } from './live-studio-roam';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(HERE, rel), 'utf8');

/** A published channel. `videoId` must be a real 11-char YouTube id to survive parsing. */
function entry(over: Partial<RoamManifest[number]> & { zoneIndex: number }): RoamManifest[number] {
  return {
    label: `Camera ${over.zoneIndex}`,
    venueLabel: null,
    videoId: `vid${String(over.zoneIndex).padStart(8, '0')}`.slice(0, 11),
    featured: false,
    mainStage: false,
    status: 'live',
    ...over,
  };
}

const THREE_CAM: RoamManifest = [
  entry({ zoneIndex: 1, label: 'Ceremony', featured: true }),
  entry({ zoneIndex: 2, label: 'Garden Aisle', mainStage: true }),
  entry({ zoneIndex: 3, label: 'Photo Booth' }),
];

/* ── 1. THE DECISION ───────────────────────────────────────────────────────── */

test('FREE — the free tier publishes exactly ONE channel', () => {
  assert.equal(FREE_PUBLISHED_CHANNEL_LIMIT, 1);
});

test('DECISION — one published channel is free (the /pricing "Single-camera livestream" promise)', () => {
  const one = decidePublish({ owned: false, channelCount: 1 });
  assert.equal(one.allowed, true);
  assert.equal(one.permitted, 1);
  assert.equal(one.reason, null);
});

test('DECISION — publishing NOTHING is never refused (taking a stream down is not a purchase)', () => {
  assert.equal(decidePublish({ owned: false, channelCount: 0 }).allowed, true);
});

test('DECISION — two or more published channels require the unlock', () => {
  const two = decidePublish({ owned: false, channelCount: 2 });
  assert.equal(two.allowed, false);
  assert.equal(two.reason, 'multi_cam_locked');
  assert.equal(two.permitted, 1, 'the free host still gets their one camera');

  const many = decidePublish({ owned: false, channelCount: 12 });
  assert.equal(many.allowed, false);
  assert.equal(many.permitted, 1);
});

test('DECISION — a paid host publishes every channel they configured', () => {
  const paid = decidePublish({ owned: true, channelCount: 12 });
  assert.equal(paid.allowed, true);
  assert.equal(paid.permitted, 12);
  assert.equal(paid.reason, null);
});

test('DECISION — a garbage channel count cannot bluff its way past the limit', () => {
  // The invariant that matters is `permitted`: whatever nonsense arrives, a free
  // host is never told they may publish more than one channel. Non-finite input
  // (NaN / Infinity) normalises to 0 and negatives clamp to 0 — "publish nothing",
  // which is the safe reading of an unusable count.
  for (const n of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5, 1.9]) {
    const d = decidePublish({ owned: false, channelCount: n });
    assert.ok(d.permitted <= FREE_PUBLISHED_CHANNEL_LIMIT, `permitted leaked for ${n}`);
  }
  assert.equal(decidePublish({ owned: false, channelCount: Number.NaN }).permitted, 0);
  assert.equal(decidePublish({ owned: false, channelCount: 1.9 }).permitted, 1);
  // A real count above the limit is still refused — the clamp is not a bypass.
  assert.equal(decidePublish({ owned: false, channelCount: 3 }).allowed, false);
});

/* ── 2. THE REDUCTION (this is what a guest actually receives) ─────────────── */

test('REDUCTION — a paid event publishes its whole manifest untouched', () => {
  assert.deepEqual(limitPublishedManifest(THREE_CAM, true), THREE_CAM);
});

test('REDUCTION — a free event publishes ONLY the channel that is on air', () => {
  const out = limitPublishedManifest(THREE_CAM, false);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.label, 'Garden Aisle', 'the cut channel survives');
  // THE POINT: the other ids are not merely hidden, they are absent — someone
  // reading the page source finds nothing to watch.
  const shipped = JSON.stringify(out);
  assert.ok(!shipped.includes(THREE_CAM[0]!.videoId), 'a withheld channel’s video id leaked');
  assert.ok(!shipped.includes(THREE_CAM[2]!.videoId), 'a withheld channel’s video id leaked');
});

test('REDUCTION — with nothing cut, the free event falls back to the featured channel', () => {
  const noCut = THREE_CAM.map((e) => ({ ...e, mainStage: false }));
  const out = limitPublishedManifest(noCut, false);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.label, 'Ceremony', 'the default channel, not an empty page');
});

test('REDUCTION — a single-channel or empty manifest is a no-op either way', () => {
  const one = [entry({ zoneIndex: 1, mainStage: true })];
  assert.deepEqual(limitPublishedManifest(one, false), one);
  assert.deepEqual(limitPublishedManifest([], false), []);
  assert.deepEqual(limitPublishedManifest([], true), []);
});

test('REDUCTION — guest-pick cannot re-expand what the paywall removed', () => {
  // The composition that matters on the public page: gate FIRST, guest-pick after.
  // Even with guest-pick ON (the owner default once multi-cam is unlocked), a free
  // event's guests are offered exactly one channel.
  const published = applyGuestPick(limitPublishedManifest(THREE_CAM, false), true);
  assert.equal(published.length, 1);
  assert.equal(published[0]!.label, 'Garden Aisle');
});

test('ATTACK — a manifest written straight into the column is still reduced at read time', () => {
  // THREAT: `events` UPDATE RLS is ROW-level (couple_can_update_event), and the
  // Supabase anon key is public — so a host can PATCH live_studio_roam_manifest
  // through PostgREST, bypassing every server action AND the write gate in
  // mirrorRoamManifest. What defeats that is the READ gate: whatever the column
  // says, an un-entitled event is served one channel.
  const selfPublished: RoamManifest = [
    entry({ zoneIndex: 1, label: 'Ceremony', mainStage: true }),
    entry({ zoneIndex: 2, label: 'Reception' }),
    entry({ zoneIndex: 3, label: 'Booth' }),
    entry({ zoneIndex: 4, label: 'Drone' }),
  ];
  const served = applyGuestPick(limitPublishedManifest(selfPublished, false), true);
  assert.equal(served.length, 1, 'a hand-written manifest must not reach guests intact');
  assert.equal(served[0]!.label, 'Ceremony');
});

/* ── 3. FAIL-CLOSED ────────────────────────────────────────────────────────── */

test('FAIL-CLOSED — an entitlement lookup that throws publishes ONE channel, not many', async () => {
  const exploding = {
    from() {
      throw new Error('database on fire mid-wedding');
    },
  } as never;
  assert.equal(await canPublishMultiCam(exploding, 'S89E-abc'), false);
  assert.equal(limitPublishedManifest(THREE_CAM, false).length, 1);
});

test('FAIL-CLOSED — a missing event id resolves to "not owned"', async () => {
  const never = {
    from() {
      throw new Error('should not be reached');
    },
  } as never;
  assert.equal(await canPublishMultiCam(never, ''), false);
});

/* ── 4. WIRING — the gate is called where it has to be ─────────────────────── */

test('WIRING — the manifest mirror (the ONLY writer of the public manifest) applies the gate', () => {
  const src = read('./live-studio-roam-provision.ts');
  // The one function that writes events.live_studio_roam_manifest.
  const mirror = src.slice(src.indexOf('export async function mirrorRoamManifest'));
  assert.ok(mirror.includes('canPublishMultiCam('), 'the mirror stopped asking the entitlement');
  assert.ok(mirror.includes('limitPublishedManifest('), 'the mirror stopped reducing the manifest');
  // And it writes the REDUCED value, never the raw build.
  assert.ok(
    /live_studio_roam_manifest:\s*manifest\b/.test(mirror),
    'the mirror must persist the gated manifest',
  );
  assert.ok(
    !/live_studio_roam_manifest:\s*built\b/.test(mirror),
    'the mirror must not persist the ungated build',
  );
});

test('WIRING — the PUBLIC read re-applies the gate (permission does not persist)', () => {
  const loaders = read('../app/[slug]/_lib/loaders.ts');
  assert.ok(loaders.includes('limitPublishedManifest('), 'the public loader stopped gating');
  assert.ok(loaders.includes('canPublishMultiCam('), 'the public loader stopped asking');
  // Order matters: reduce, THEN honor guest-pick. The reverse would let guest-pick
  // hand back channels the paywall had removed.
  assert.ok(
    loaders.indexOf('limitPublishedManifest(') < loaders.indexOf('applyGuestPick('),
    'the paywall must be applied BEFORE guest-pick',
  );
});

test('WIRING — the rehearsal actions have NOT had the old entitlement gate re-added', () => {
  const actions = read('../app/dashboard/[eventId]/studio/live-studio-control/setup/actions.ts');

  // The gate may still guard the ⚡ highlight actions (paid, on-air) and nothing
  // else. Two call sites, both inside markHighlight / deleteHighlight.
  const calls = actions.match(/^\s*await requireLiveStudioOwned\(eventId\);/gm) ?? [];
  assert.equal(calls.length, 2, 'requireLiveStudioOwned call count changed — is a rehearsal action gated again?');

  const fnBody = (name: string) => {
    const start = actions.indexOf(`export async function ${name}(`);
    assert.ok(start > -1, `${name} not found`);
    const next = actions.indexOf('\nexport async function ', start + 1);
    return actions.slice(start, next === -1 ? undefined : next);
  };

  for (const gated of ['markHighlight', 'deleteHighlight']) {
    assert.ok(fnBody(gated).includes('await requireLiveStudioOwned(eventId);'), `${gated} lost its gate`);
  }
  // The rehearsal + configuration half of § 4d: host-gated ONLY.
  for (const free of [
    'addRoamZone',
    'deleteRoamZone',
    'renameRoamZone',
    'cutToMainStage',
    'clearMainStage',
    'setFeaturedRoamZone',
    'setMonogramOverlay',
    'setLowerThird',
    'setEventQrOverlay',
    'setGuestPick',
    'saveControlWatchUrl',
    'clearControlWatchUrl',
  ]) {
    const body = fnBody(free);
    assert.ok(
      body.includes('await requireHostMembership(eventId);'),
      `${free} must still be host-gated — rehearse-free is not auth-free`,
    );
    assert.ok(
      !body.includes('await requireLiveStudioOwned(eventId);'),
      `${free} is a REHEARSAL action (§ 4d) — the paywall belongs at publication, not here`,
    );
  }
});

test('WIRING — the surface that actually reaches air resolves overlays from the REAL entitlement', () => {
  // Wave 3 introduced a deliberate `resolveOverlays({ owned: true })` on the
  // CONTROLLER, for the placement rehearsal. That is safe only because the surface
  // an encoder captures keeps asking the real thing. A copy-paste of `owned: true`
  // into the program page would hand a free host the paid overlays on air.
  const program = read('../app/panood/program/[eventId]/page.tsx');
  assert.ok(
    /const owned = await eventSkuActive\(supabase, eventId, LIVE_STUDIO_SKU\)/.test(program),
    'the program surface must resolve the real LIVE_STUDIO entitlement',
  );
  assert.ok(
    !/owned:\s*true/.test(program),
    'the program surface must never hardcode owned:true — that is the paid overlays on a free broadcast',
  );
  assert.ok(
    /resolveOverlays\(\{\s*owned,/.test(program),
    'the program surface must pass the resolved entitlement into resolveOverlays',
  );
});

test('WIRING — the free tier’s Setnayan bar is still unstrippable by construction', () => {
  const overlays = read('./live-studio-overlays.ts');
  // It is DERIVED from the entitlement, never stored — so there is no column a free
  // host can flip and no request to replay. Wave 3 let free hosts write their OWN
  // lower third, which is only safe because of exactly this.
  const fnStart = overlays.indexOf('export function resolveOverlays');
  assert.ok(fnStart > -1, 'resolveOverlays not found');
  // Slice to the function's closing brace at column 0, so the I/O half of the module
  // (which legitimately names the raw columns in its SELECT) is not scanned.
  const resolver = overlays.slice(fnStart, overlays.indexOf('\n}\n', fnStart) + 3);
  assert.ok(
    /!owned\s*\n?\s*\?\s*\{\s*title: SETNAYAN_LOWER_THIRD\.title/.test(resolver),
    'the free branch must force the SETNAYAN bar without consulting the stored setting',
  );
  assert.ok(
    !/lower_third_enabled/.test(resolver),
    'resolveOverlays must not read the raw column — the free branch has to ignore it',
  );
});
