/**
 * Unit suite for the shared-room pure core (lib/plan3d-room). The realtime
 * multiplayer surface can't run in CI, so ALL the decision logic — throttle,
 * dead-reckoning, pose/heading, presence + greet reducers, prune, cap ordering
 * — is pushed here and proven deterministically (every fn takes `nowMs`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldBroadcastMove,
  speedOf,
  poseFromSpeed,
  headingFromVel,
  deadReckon,
  isMoveStale,
  renderRemote,
  reconcilePresence,
  applyMove,
  applyGreet,
  pruneRemotes,
  isGreetable,
  activeRemotes,
  BROADCAST_INTERVAL_MS,
  RUN_AT_MPS,
  STAND_BELOW_MPS,
  DEADRECKON_CAP_S,
  MOVE_STALE_MS,
  GREET_WAVE_MS,
  type RemotePlayer,
  type RemoteMap,
  type RoomPeer,
  type MoveMsg,
} from './plan3d-room';

// ── throttle / only-while-moving ─────────────────────────────────────────────

test('shouldBroadcastMove: while moving, gates to one per interval', () => {
  assert.equal(shouldBroadcastMove(1000, 1000 - BROADCAST_INTERVAL_MS, true, true), true, 'exactly interval → send');
  assert.equal(shouldBroadcastMove(1000, 1000 - BROADCAST_INTERVAL_MS + 1, true, true), false, 'a hair early → hold');
  assert.equal(shouldBroadcastMove(1000, 1000 - 1000, true, false), true, 'long past interval → send');
});

test('shouldBroadcastMove: idle is silent, but STOP sends exactly one settle frame', () => {
  // not moving, wasn't moving → nothing (never spam while parked).
  assert.equal(shouldBroadcastMove(9e9, 0, false, false), false);
  // just stopped this frame (moving false, wasMoving true) → one frame so peers
  // land the final resting pos, regardless of the throttle gate.
  assert.equal(shouldBroadcastMove(1000, 999, false, true), true);
  // and the NEXT idle frame (wasMoving now false) is silent again.
  assert.equal(shouldBroadcastMove(1001, 1000, false, false), false);
});

// ── motion → pose / heading ──────────────────────────────────────────────────

test('poseFromSpeed: stand / walk / run thresholds', () => {
  assert.equal(poseFromSpeed(0), 'stand');
  assert.equal(poseFromSpeed(STAND_BELOW_MPS - 1e-6), 'stand');
  assert.equal(poseFromSpeed(STAND_BELOW_MPS), 'walk');
  assert.equal(poseFromSpeed(1.2), 'walk');
  assert.equal(poseFromSpeed(RUN_AT_MPS - 1e-6), 'walk');
  assert.equal(poseFromSpeed(RUN_AT_MPS), 'run');
  assert.equal(poseFromSpeed(3), 'run');
});

test('headingFromVel: atan2(x,z) when moving; holds fallback when ~still', () => {
  assert.ok(Math.abs(headingFromVel(1, 0, 42) - Math.atan2(1, 0)) < 1e-9);
  assert.ok(Math.abs(headingFromVel(0, 1, 42) - Math.atan2(0, 1)) < 1e-9);
  // below the stand threshold → keep the last heading (no spin-to-zero)
  assert.equal(headingFromVel(0, 0, 42), 42);
  assert.equal(headingFromVel(0.01, 0.01, 7), 7);
});

test('speedOf is euclidean', () => {
  assert.equal(speedOf(3, 4), 5);
});

// ── dead-reckoning ───────────────────────────────────────────────────────────

test('deadReckon: extrapolates a moving peer along its velocity, capped', () => {
  const p = { x: 0, z: 0, vx: 2, vz: 0, moving: true, recvAt: 1000 };
  // 100 ms later → 0.2 m along +x
  assert.deepEqual(deadReckon(p, 1100), { x: 0.2, z: 0 });
  // way past the cap → clamps at DEADRECKON_CAP_S of velocity, never further
  const capped = deadReckon(p, 1000 + 10_000);
  assert.equal(capped.x, 2 * DEADRECKON_CAP_S);
  assert.equal(capped.z, 0);
});

test('deadReckon: a standing snapshot never drifts', () => {
  const p = { x: 5, z: -3, vx: 9, vz: 9, moving: false, recvAt: 1000 };
  assert.deepEqual(deadReckon(p, 9_999_999), { x: 5, z: -3 });
});

test('isMoveStale: a moving peer gone silent past the window is stale', () => {
  assert.equal(isMoveStale({ moving: true, recvAt: 0 }, MOVE_STALE_MS), false, 'at the edge, not yet');
  assert.equal(isMoveStale({ moving: true, recvAt: 0 }, MOVE_STALE_MS + 1), true);
  assert.equal(isMoveStale({ moving: false, recvAt: 0 }, MOVE_STALE_MS + 5000), false, 'a standing peer is never stale');
});

test('renderRemote: a stale mover renders standing (frozen), fresh mover walks', () => {
  const base: RemotePlayer = {
    id: 'a', name: 'A', color: '#fff', x: 0, z: 0, vx: 1, vz: 0, h: 1.2, moving: true, recvAt: 0, present: true, greetUntil: 0,
  };
  const fresh = renderRemote(base, 100);
  assert.equal(fresh.pose, 'walk');
  assert.equal(fresh.heading, 1.2);
  const stale = renderRemote(base, MOVE_STALE_MS + 500);
  assert.equal(stale.pose, 'stand', 'stale → stand');
  // position freezes at the capped dead-reckon (does not keep sliding)
  assert.equal(stale.pos.x, 1 * DEADRECKON_CAP_S);
});

test('renderRemote: waving flag reflects greetUntil vs now', () => {
  const p: RemotePlayer = {
    id: 'a', name: 'A', color: '#fff', x: 0, z: 0, vx: 0, vz: 0, h: 0, moving: false, recvAt: 0, present: true, greetUntil: 5000,
  };
  assert.equal(renderRemote(p, 4999).waving, true);
  assert.equal(renderRemote(p, 5000).waving, false);
});

// ── presence reconcile ───────────────────────────────────────────────────────

const peer = (id: string, name = id, color = '#abc'): RoomPeer => ({ id, name, color });

test('reconcilePresence: spawns new peers, drops self, marks left peers absent', () => {
  let map: RemoteMap = new Map();
  map = reconcilePresence(map, [peer('me'), peer('a', 'Ana'), peer('b', 'Ben')], 'me', 1000);
  assert.equal(map.size, 2, 'self excluded');
  assert.equal(map.get('a')?.name, 'Ana');
  assert.equal(map.get('a')?.present, true);
  assert.equal(map.get('a')?.recvAt, 1000, 'seeded fresh at join');

  // b leaves the roster → kept but marked absent (so it can walk home)
  map = reconcilePresence(map, [peer('me'), peer('a', 'Ana')], 'me', 2000);
  assert.equal(map.size, 2, 'b retained until pruned');
  assert.equal(map.get('b')?.present, false);
  assert.equal(map.get('b')?.moving, false, 'absent peer stops');
  assert.equal(map.get('a')?.present, true);
});

test('reconcilePresence: refreshes name/colour without wiping live motion', () => {
  let map: RemoteMap = new Map();
  map = reconcilePresence(map, [peer('a', 'Ana', '#111')], 'me', 0);
  map = applyMove(map, { id: 'a', x: 3, z: 4, vx: 1, vz: 0, h: 0.5, m: true, t: 1 }, 'me', 100);
  map = reconcilePresence(map, [peer('a', 'Ana Cruz', '#222')], 'me', 200);
  const a = map.get('a')!;
  assert.equal(a.name, 'Ana Cruz');
  assert.equal(a.color, '#222');
  assert.equal(a.x, 3, 'motion preserved across a presence sync');
  assert.equal(a.moving, true);
});

// ── move reducer ─────────────────────────────────────────────────────────────

test('applyMove: ignores self-echo and rosterless ghosts', () => {
  let map: RemoteMap = new Map();
  map = reconcilePresence(map, [peer('a')], 'me', 0);
  // self echo → untouched (identity-equal)
  assert.equal(applyMove(map, { id: 'me', x: 1, z: 1, vx: 0, vz: 0, h: 0, m: false, t: 1 }, 'me', 1), map);
  // a move for a peer NOT in the roster → dropped (no ghost)
  assert.equal(applyMove(map, { id: 'ghost', x: 1, z: 1, vx: 0, vz: 0, h: 0, m: true, t: 1 }, 'me', 1), map);
  // a real peer's move lands
  const after = applyMove(map, { id: 'a', x: 2, z: -2, vx: 0.5, vz: 0, h: 1, m: true, t: 1 }, 'me', 500);
  assert.equal(after.get('a')?.x, 2);
  assert.equal(after.get('a')?.recvAt, 500);
});

// ── greet reducer ────────────────────────────────────────────────────────────

test('applyGreet: plays the wave on the SENDER, gated on presence; ignores own echo', () => {
  let map: RemoteMap = new Map();
  map = reconcilePresence(map, [peer('a'), peer('b')], 'me', 0);
  // someone (a) waves at me → a's figure waves
  map = applyGreet(map, { from: 'a', to: 'me', t: 1 }, 'me', 1000);
  assert.equal(map.get('a')?.greetUntil, 1000 + GREET_WAVE_MS);
  // my own greet echo → no-op (I play it optimistically)
  assert.equal(applyGreet(map, { from: 'me', to: 'a', t: 1 }, 'me', 2000), map);
  // greet from an absent peer → no-op (no greeting ghosts)
  let gone: RemoteMap = reconcilePresence(map, [peer('a')], 'me', 3000); // b left
  const before = gone;
  gone = applyGreet(gone, { from: 'b', to: null, t: 1 }, 'me', 4000);
  assert.equal(gone, before, 'absent sender → ignored');
});

test('isGreetable: only a present peer can be greeted (no ghosts)', () => {
  let map: RemoteMap = new Map();
  map = reconcilePresence(map, [peer('a')], 'me', 0);
  assert.equal(isGreetable(map.get('a')), true);
  map = reconcilePresence(map, [], 'me', 1000); // a left
  assert.equal(isGreetable(map.get('a')), false);
  assert.equal(isGreetable(undefined), false);
});

// ── prune ────────────────────────────────────────────────────────────────────

test('pruneRemotes: drops long-absent peers, keeps present + recently-left', () => {
  let map: RemoteMap = new Map();
  map = reconcilePresence(map, [peer('a'), peer('b')], 'me', 0);
  map = reconcilePresence(map, [peer('a')], 'me', 1000); // b left at t=1000 (recvAt stays 0 from join)
  // b's recvAt is its join stamp (0); GONE window 5000 from now=4000 → not yet
  assert.equal(pruneRemotes(map, 4000, 5000).has('b'), true);
  // now=6000 → 6000-0 > 5000 → dropped; a (present) always kept
  const pruned = pruneRemotes(map, 6000, 5000);
  assert.equal(pruned.has('b'), false);
  assert.equal(pruned.has('a'), true);
  // no-op prune returns the same reference (no needless re-render)
  assert.equal(pruneRemotes(pruned, 6001, 5000), pruned);
});

// ── active subset: present-first, nearest-first, capped ──────────────────────

test('activeRemotes: present-first then nearest, capped', () => {
  let map: RemoteMap = new Map();
  map = reconcilePresence(map, [peer('far'), peer('near'), peer('mid')], 'me', 0);
  map = applyMove(map, { id: 'far', x: 100, z: 0, vx: 0, vz: 0, h: 0, m: false, t: 1 }, 'me', 1);
  map = applyMove(map, { id: 'near', x: 1, z: 0, vx: 0, vz: 0, h: 0, m: false, t: 1 }, 'me', 1);
  map = applyMove(map, { id: 'mid', x: 10, z: 0, vx: 0, vz: 0, h: 0, m: false, t: 1 }, 'me', 1);
  const order = activeRemotes(map, { x: 0, z: 0 }, 100).map((p) => p.id);
  assert.deepEqual(order, ['near', 'mid', 'far']);
  // cap
  assert.equal(activeRemotes(map, { x: 0, z: 0 }, 100, 2).length, 2);
});

test('activeRemotes: a present peer always outranks an absent one, even if closer', () => {
  let map: RemoteMap = new Map();
  map = reconcilePresence(map, [peer('present'), peer('leaving')], 'me', 0);
  map = applyMove(map, { id: 'present', x: 50, z: 0, vx: 0, vz: 0, h: 0, m: false, t: 1 }, 'me', 1); // far
  map = applyMove(map, { id: 'leaving', x: 1, z: 0, vx: 0, vz: 0, h: 0, m: false, t: 1 }, 'me', 1); // near
  map = reconcilePresence(map, [peer('present')], 'me', 2); // 'leaving' goes absent
  const order = activeRemotes(map, { x: 0, z: 0 }, 100).map((p) => p.id);
  assert.deepEqual(order, ['present', 'leaving'], 'present outranks nearer-but-absent');
});
