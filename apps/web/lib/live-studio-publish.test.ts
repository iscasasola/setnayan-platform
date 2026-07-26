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
  decideProgramAir,
  limitPublishedManifest,
  programSourceAllowed,
  type ProgramChannel,
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
  const actions = read('../app/panood/control/[eventId]/actions.ts');

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
    /const owned = await canPublishMultiCam\(admin, eventId\)/.test(program),
    'the program surface must resolve the real entitlement through the shared helper',
  );
  // Service-role, not the operator's session: `orders` RLS is purchaser-scoped, so a
  // coordinator running the encoder for a couple who paid would otherwise read
  // "not owned" and be downgraded to the free bar and one camera, mid-wedding.
  assert.ok(
    /const admin = createAdminClient\(\);/.test(program),
    'the program surface must resolve the entitlement with the service-role client',
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

/* ══════════════════════════════════════════════════════════════════════════════
   5. ⭐ WAVE 5 — THE PROGRAM OUTPUT (the third publication path)

   The pop-out the host's own encoder captures. Everything above gates a
   Setnayan-hosted page; this gates a pipe we do not own, and it is the difference
   between "rehearse free" and "broadcast free via OBS". Same money-code standard.
   ══════════════════════════════════════════════════════════════════════════════ */

/** A camera channel as the program gate sees it. Bound by default — unbound is the exception. */
function chan(over: Partial<ProgramChannel> & { slot: string | null }): ProgramChannel {
  return { featured: false, mainStage: false, status: 'live', ...over };
}

/** Three joined cameras: CH 2 is the ★ default, CH 3 is what the host has cut up. */
const THREE_CHANNELS: ProgramChannel[] = [
  chan({ slot: 'cam1', featured: true }),
  chan({ slot: 'cam2', mainStage: true }),
  chan({ slot: 'cam3' }),
];

test('PROGRAM — an entitled host puts every joined camera on air, and their cut is what goes out', () => {
  const air = decideProgramAir({ owned: true, channels: THREE_CHANNELS });
  assert.deepEqual(air.permittedSlots, ['cam1', 'cam2', 'cam3']);
  assert.equal(air.airSlot, 'cam2', 'the cut is what airs');
  assert.equal(air.withheld, null);
  assert.equal(
    air.enforced,
    false,
    'a paid broadcast must never be restricted by this gate — no path can block it',
  );
});

test('PROGRAM — ⭐ a FREE host cannot get a multi-cam program frame', () => {
  const air = decideProgramAir({ owned: false, channels: THREE_CHANNELS });
  assert.equal(air.permittedSlots.length, 1, 'THE PAYWALL: one camera, never two');
  assert.deepEqual(air.permittedSlots, ['cam1'], 'the ★ default channel, not the cut');
  assert.equal(air.airSlot, 'cam1');
  assert.equal(air.withheld, 'multi_cam_locked');
  assert.equal(air.publish.reason, 'multi_cam_locked', 'reuses the ONE count decision');
});

test('PROGRAM — ⭐ the free pin is CUT-BLIND: switching cameras cannot move what airs', () => {
  // The whole bypass in one test. If the pin followed `mainStage`, a free host would
  // have a live vision mixer: cut → the encoder follows → a full multi-cam broadcast
  // for ₱0. Every cut below must leave the aired slot exactly where it was.
  const aired = new Set<string | null>();
  for (const cut of ['cam1', 'cam2', 'cam3']) {
    const channels = THREE_CHANNELS.map((c) => ({ ...c, mainStage: c.slot === cut }));
    aired.add(decideProgramAir({ owned: false, channels }).airSlot);
  }
  assert.deepEqual([...aired], ['cam1'], 'the free program output must not follow the cut');
});

test('PROGRAM — the free tier still gets a REAL single-camera broadcast', () => {
  // The /pricing promise. One camera, entitled or not, is never withheld.
  const one = decideProgramAir({ owned: false, channels: [chan({ slot: 'cam1', mainStage: true })] });
  assert.deepEqual(one.permittedSlots, ['cam1']);
  assert.equal(one.airSlot, 'cam1');
  assert.equal(one.withheld, null, 'nothing is withheld when the cut IS the free channel');
  assert.equal(one.publish.allowed, true);
});

test('PROGRAM — the host chooses WHICH camera is their free one (the ★ default control)', () => {
  const moved = THREE_CHANNELS.map((c) => ({ ...c, featured: c.slot === 'cam3' }));
  assert.deepEqual(decideProgramAir({ owned: false, channels: moved }).permittedSlots, ['cam3']);
});

test('PROGRAM — nothing cut is nothing on air, free tier included', () => {
  // The pin decides WHICH camera goes out, never WHETHER one does. A controller
  // reading "Nothing on Channel 1 yet" while the encoder quietly sends a camera is
  // exactly the silent mismatch this gate exists to prevent.
  const noCut = THREE_CHANNELS.map((c) => ({ ...c, mainStage: false }));
  for (const owned of [true, false]) {
    const air = decideProgramAir({ owned, channels: noCut });
    assert.equal(air.airSlot, null, `owned=${owned}: an uncut Channel 1 must air nothing`);
    assert.equal(air.withheld, null, 'nothing was asked for, so nothing was withheld');
  }
  // The permitted list is unchanged — the paywall is about what MAY air, not whether
  // the host has got round to cutting yet.
  assert.deepEqual(decideProgramAir({ owned: false, channels: noCut }).permittedSlots, ['cam1']);
});

test('PROGRAM — cutting a channel no phone has joined still reports the real on-air camera', () => {
  // Compared by CHANNEL, not slot: the host put an empty channel on Channel 1, so
  // their controller shows "waiting for this camera's picture" while the encoder is
  // still sending the pinned one. That difference has to be reported, not swallowed.
  const channels = [
    chan({ slot: 'cam1', featured: true }),
    chan({ slot: null, mainStage: true }),
  ];
  const air = decideProgramAir({ owned: false, channels });
  assert.equal(air.airSlot, 'cam1');
  assert.equal(air.requestedSlot, null);
  assert.equal(air.withheld, 'multi_cam_locked');
});

test('PROGRAM — a channel with no camera joined is not a source, and does not count', () => {
  const channels = [chan({ slot: null, featured: true }), chan({ slot: 'cam2' })];
  const air = decideProgramAir({ owned: false, channels });
  assert.deepEqual(air.permittedSlots, ['cam2'], 'the empty ★ channel cannot air');
  assert.equal(air.publish.requested, 1, 'unbound channels must not inflate the channel count');

  const none = decideProgramAir({ owned: false, channels: [chan({ slot: null })] });
  assert.deepEqual(none.permittedSlots, []);
  assert.equal(none.airSlot, null, 'nothing joined = nothing on air, stated not faked');
});

test('PROGRAM — with no ★ default, the free pin falls back to a channel that is actually live', () => {
  const channels = [
    chan({ slot: 'cam1', status: 'offline' }),
    chan({ slot: 'cam2', status: 'live' }),
  ];
  assert.deepEqual(decideProgramAir({ owned: false, channels }).permittedSlots, ['cam2']);
});

test('ATTACK — ⭐ a direct PostgREST PATCH of the host-writable columns cannot widen the gate', () => {
  // `live_studio_roam_zones` UPDATE RLS is ROW-level (couple_can_update_event's
  // sibling) and the anon key is public, so a host can absolutely rewrite their own
  // `is_featured` / `is_main_stage` / `status` columns straight through PostgREST.
  // They may: those columns only choose WHICH channel the pin lands on. The COUNT
  // comes from `orders`, which the same host cannot forge (orders_insert_status_guard
  // / orders_update_status_guard, migration 20270920010000 — a non-admin writer is
  // restricted to draft/submitted/awaiting_payment/cancelled).
  const patched: ProgramChannel[] = [
    chan({ slot: 'cam1', featured: true, mainStage: true, status: 'live' }),
    chan({ slot: 'cam2', featured: true, mainStage: true, status: 'live' }),
    chan({ slot: 'cam3', featured: true, mainStage: true, status: 'live' }),
  ];
  const air = decideProgramAir({ owned: false, channels: patched });
  assert.equal(air.permittedSlots.length, 1, 'every flag set on every row still yields ONE camera');
  assert.equal(air.enforced, true);
});

test('ATTACK — ⭐ a tampered console cannot paint a forbidden camera on the capture surface', () => {
  // The bridge is a plain `window` property in the host's own browser, so a host with
  // devtools can publish whatever they like onto it. `programSourceAllowed` is what the
  // pop-out applies to the frame that ARRIVES, against a list resolved server-side on
  // its own render — so the answer does not depend on the sender being honest.
  const air = decideProgramAir({ owned: false, channels: THREE_CHANNELS });
  assert.equal(programSourceAllowed(air, 'cam1'), true, 'the permitted channel still airs');
  for (const forged of ['cam2', 'cam3', 'cam9', 'photos', 'live_bg']) {
    assert.equal(programSourceAllowed(air, forged), false, `${forged} must be refused`);
  }
});

test('ATTACK — a lapsed entitlement bites on the NEXT render, not "whenever something rewrites a column"', () => {
  // Same reasoning as the public read gate: permission is re-asked at the point of
  // render, so a refund/revocation reduces the program output on the next paint
  // rather than leaving a paid-shaped frame up until some unrelated write happens.
  const before = decideProgramAir({ owned: true, channels: THREE_CHANNELS });
  const after = decideProgramAir({ owned: false, channels: THREE_CHANNELS });
  assert.equal(before.permittedSlots.length, 3);
  assert.equal(after.permittedSlots.length, 1);
});

test('PROGRAM — an entitled host is never blocked, whatever source arrives', () => {
  // The failure mode that would matter most on the day: a gate that fights a paid
  // console. `enforced: false` short-circuits every check, including legacy wall
  // sources the unified controller does not know about.
  const air = decideProgramAir({ owned: true, channels: THREE_CHANNELS });
  for (const src of ['cam1', 'cam9', 'photos', 'live_bg', null]) {
    assert.equal(programSourceAllowed(air, src), true, `${src} must not be blocked for a paid host`);
  }
});

/* ── 6. WIRING — the path to air exists, and it is gated at both ends ───────── */

test('WIRING — ⭐ the UNIFIED controller installs the program bridge (the path to air)', () => {
  // The Wave 4 gap: `installProgramBridge` had exactly one caller (the legacy control
  // room), so a cut on the unified controller reached the monitor and stopped.
  const bridge = read(
    '../app/panood/control/[eventId]/_components/program-bridge.tsx',
  );
  assert.ok(bridge.includes('installProgramBridge('), 'the unified controller stopped installing the bridge');
  assert.ok(
    bridge.includes("`/panood/program/${eventId}`"),
    'the controller must open the real program route, not a new surface',
  );
  // ONE bridge, not a fork: it must come from the shipped module.
  assert.ok(
    /from '@\/lib\/panood-program-bridge'/.test(bridge),
    'the controller must reuse lib/panood-program-bridge — a second bridge would split the surface',
  );
  // And ONE WebRTC viewer: opening its own would steal the phones from the host's own
  // monitor mid-ceremony (the transport is one-publisher → one-viewer per slot).
  assert.ok(
    !/from '@\/lib\/panood-webrtc'/.test(bridge) && !/watchPanoodCameras\s*\(/.test(bridge),
    'the bridge host must subscribe to Wave 4’s shared viewer, never open its own',
  );

  const page = read('../app/panood/control/[eventId]/page.tsx');
  assert.ok(page.includes('<ProgramBridgeHost'), 'the controller page must mount the bridge host');
});

test('WIRING — ⭐ the controller publishes the PERMITTED slot, never the raw cut', () => {
  const bridge = read(
    '../app/panood/control/[eventId]/_components/program-bridge.tsx',
  );
  // The single most important line in the file: what goes onto the bridge.
  assert.ok(
    /source:\s*allowed\s*\?\s*air\.airSlot\s*:\s*null/.test(bridge),
    'the published source must be the server-decided air slot',
  );
  assert.ok(
    /stream:\s*allowed\s*\?\s*stream\s*:\s*null/.test(bridge),
    'the published stream must be gated by the same decision',
  );
  assert.ok(
    !/source:\s*mainStageSlot/.test(bridge),
    'publishing the host’s cut directly is the bypass this wave exists to close',
  );
  // The subscription itself must be to the permitted slot, so a free host's other
  // cameras are never even handed to the bridge.
  assert.ok(
    /useCameraFeed\(air\.airSlot\)/.test(bridge),
    'the bridge host must subscribe to the permitted slot, not the cut',
  );

  const page = read('../app/panood/control/[eventId]/page.tsx');
  assert.ok(page.includes('decideProgramAir('), 'the controller must resolve the air decision server-side');
});

test('WIRING — ⭐ the CAPTURE SURFACE re-decides server-side and refuses a forbidden frame', () => {
  // The enforcement point. The controller half runs in the host's browser and is
  // advisory by nature; this one is not.
  const page = read('../app/panood/program/[eventId]/page.tsx');
  assert.ok(page.includes('decideProgramAir('), 'the program route must resolve its own air decision');
  assert.ok(
    page.indexOf('decideProgramAir(') > page.indexOf('canPublishMultiCam('),
    'the decision must be made from the resolved entitlement',
  );

  const surface = read('../app/panood/program/[eventId]/program-surface.tsx');
  assert.ok(surface.includes('programSourceAllowed('), 'the capture surface stopped checking the source');
  // The gated values, not the raw frame, are what reach the <video> elements.
  assert.ok(
    /const stream = sourceAllowed \? frame\.stream : null/.test(surface),
    'the surface must paint the gated stream, never frame.stream directly',
  );
  assert.ok(
    !/<StreamLayer stream=\{frame\.stream\}/.test(surface),
    'a raw frame.stream render is a hole straight through the gate',
  );
  // Honest states only: a refused source gets a named card, not a black rectangle.
  assert.ok(surface.includes('<WithheldCard />'), 'a refused source must say so on the picture');
});

test('WIRING — the flag keeps this dark, and the legacy Cast product untouched', () => {
  const page = read('../app/panood/program/[eventId]/page.tsx');
  assert.ok(
    page.indexOf('liveStudioRoamEnabled()') < page.indexOf('decideProgramAir('),
    'the program gate must sit inside the NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED branch',
  );
  // An event with no Live Studio channels is a legacy Cast broadcast: nothing to gate,
  // and its own paywall (lib/panood-watermark.ts) is left exactly as it is.
  assert.ok(
    /if \(channels\.length > 0\) \{\s*\n\s*air = decideProgramAir\(/.test(page),
    'a channel-less legacy event must not be gated by the unified paywall',
  );
});
