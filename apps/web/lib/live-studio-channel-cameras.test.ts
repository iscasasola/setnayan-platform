/**
 * Live Studio · QR camera-join — pure logic (Wave 4).
 *
 * The DB half of this wave is verified against the real replayed schema in
 * tests/db/live-studio-channel-join.db.test.ts (binding, cross-event refusal,
 * revocation, the sweep). What is left here is the READ-SIDE half of the status
 * rule, and it is worth its own file because it is the piece that decides whether
 * the host's controller tells the truth about a camera that walked out:
 *
 *   the stored column records the last OBSERVED transition;
 *   resolveChannelStatus applies the TIMEOUT the database cannot observe.
 *
 * The one transition nobody can write is a phone leaving — a closed tab, a locked
 * screen, a walk out of signal. Waiting for that write is how a controller ends up
 * showing "Camera connected" over a camera that left ten minutes ago.
 *
 * Also pins `cameraSlotForIndex`, because the phone and the host's viewer must
 * spell the WebRTC slot key identically or the host gets a permanently black tile
 * with no error anywhere.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANNEL_HEARTBEAT_MS,
  CHANNEL_STALE_MS,
  cameraSlotForIndex,
  resolveChannelStatus,
} from './live-studio-channel-cameras';
import { channelReadyCaption } from './live-studio-control';

const NOW = new Date('2026-07-25T12:00:00.000Z');
const agoMs = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

/* ── The slot key ─────────────────────────────────────────────────────────── */

test('the slot key matches what the phone publishes on', () => {
  // panood-camera-publish.tsx calls the same helper. If these two ever spell it
  // differently the host sees a black tile and nothing logs an error.
  assert.equal(cameraSlotForIndex(1), 'cam1');
  assert.equal(cameraSlotForIndex(12), 'cam12');
});

/* ── An unjoined channel ──────────────────────────────────────────────────── */

test('a channel with no camera bound is planned, whatever the column says', () => {
  // Belt for the brace: if a stale 'live' ever survived an unbind, the honest read
  // is still "nothing has joined".
  assert.equal(
    resolveChannelStatus({ status: 'live', lastSeenAt: agoMs(1_000), bound: false, now: NOW }),
    'planned',
  );
  assert.equal(
    resolveChannelStatus({ status: 'planned', lastSeenAt: null, now: NOW }),
    'planned',
  );
});

test('a seat nobody holds is "waiting", even with a fresh-looking heartbeat', () => {
  // The cross-product leak: the LEGACY Cast cameras page reissues the same seats
  // and clears `claimer_user_id` without touching this channel's row, so a zone can
  // sit at 'live' with a recent last_seen_at and an EMPTY seat. Reading that as
  // "Camera connected" would send a host on stage believing a camera is on them.
  assert.equal(
    resolveChannelStatus({
      status: 'live',
      lastSeenAt: agoMs(1_000),
      bound: true,
      claimed: false,
      now: NOW,
    }),
    'planned',
  );
});

test('the pre-Wave-4 state reads as "Waiting for a camera"', () => {
  // Every channel in the database sat here permanently before this wave, because
  // nothing wrote the column at all.
  assert.equal(
    channelReadyCaption(resolveChannelStatus({ status: 'planned', lastSeenAt: null, now: NOW })),
    'Waiting for a camera',
  );
});

/* ── A joined, beating camera ─────────────────────────────────────────────── */

test('a fresh heartbeat means connected', () => {
  const status = resolveChannelStatus({ status: 'live', lastSeenAt: agoMs(2_000), now: NOW });
  assert.equal(status, 'live');
  assert.equal(channelReadyCaption(status), 'Camera connected');
});

test('one missed beat does NOT flap a working camera to "dropped out"', () => {
  // The window is 3× the beat on purpose. A church's wifi drops a request; an
  // operator who runs across the room to fix a camera that was never broken is a
  // real cost on a day that cannot be re-run.
  assert.ok(CHANNEL_STALE_MS > CHANNEL_HEARTBEAT_MS * 2, 'window must absorb a missed beat');
  assert.equal(
    resolveChannelStatus({ status: 'live', lastSeenAt: agoMs(CHANNEL_HEARTBEAT_MS + 500), now: NOW }),
    'live',
  );
});

/* ── The camera that walked out ───────────────────────────────────────────── */

test('a stale heartbeat reads as dropped out, even though the column still says live', () => {
  // THE case this function exists for. Nothing wrote 'offline' — nothing could,
  // the phone is gone — so the read side is the only place the truth can appear.
  const status = resolveChannelStatus({
    status: 'live',
    lastSeenAt: agoMs(CHANNEL_STALE_MS + 1_000),
    now: NOW,
  });
  assert.equal(status, 'offline');
  assert.equal(channelReadyCaption(status), 'Camera dropped out');
});

test('a claimed camera that never beat at all is not "connected"', () => {
  // Claiming is not delivering: a phone that denied camera permission, or whose
  // browser never ran the beat, has joined nothing the host can use.
  assert.equal(resolveChannelStatus({ status: 'live', lastSeenAt: null, now: NOW }), 'offline');
});

test('an unparseable timestamp fails to "dropped out", never to "connected"', () => {
  // Fail-closed on the honesty axis: the expensive mistake is claiming a camera is
  // up when it isn't.
  assert.equal(
    resolveChannelStatus({ status: 'live', lastSeenAt: 'not-a-date', now: NOW }),
    'offline',
  );
});

test('a stored offline stays offline — no timeout can make it more true', () => {
  assert.equal(resolveChannelStatus({ status: 'offline', lastSeenAt: agoMs(1_000), now: NOW }), 'offline');
});

/* ── The host's own decision ──────────────────────────────────────────────── */

test('a host-disabled channel outranks every camera signal', () => {
  // Matches the RPC, which excludes 'disabled' from its cascade. A phone must not
  // be able to switch back on a channel the host turned off.
  const status = resolveChannelStatus({ status: 'disabled', lastSeenAt: agoMs(1_000), now: NOW });
  assert.equal(status, 'disabled');
  assert.equal(channelReadyCaption(status), 'Turned off');
});

test('an unrecognised column value degrades to planned, not to connected', () => {
  assert.equal(resolveChannelStatus({ status: 'wat', lastSeenAt: agoMs(1_000), now: NOW }), 'planned');
  assert.equal(resolveChannelStatus({ status: null, lastSeenAt: null, now: NOW }), 'planned');
});

/* ── The read side and the write side agree ───────────────────────────────── */

test('the staleness window matches the RPC sweep’s interval', () => {
  // The migration's sweep uses INTERVAL '60 seconds'. These are the same rule seen
  // from two sides; if they drift, a channel is 'offline' on one surface and 'live'
  // on the other.
  assert.equal(CHANNEL_STALE_MS, 60_000);
});
