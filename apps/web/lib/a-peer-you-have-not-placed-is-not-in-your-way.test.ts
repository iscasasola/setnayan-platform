/**
 * A PEER WHOSE POSITION YOU HAVE NEVER RECEIVED IS NOT STANDING AT THE ORIGIN.
 *
 * Presence carries a NAME and a COLOUR. It has never carried a position. So a
 * peer joins the roster before anyone knows where they are — and `sendMove`
 * transmits only while moving (plus one settle frame), so nothing closes that
 * gap on its own.
 *
 * `reconcilePresence` used to seed them at `x: 0, z: 0`. That is not a neutral
 * placeholder: `pctToWorldM` maps 50%/50% to the origin, so (0,0) is the exact
 * CENTRE of the room — on most floors, the dance floor. Every un-broadcast peer
 * was therefore drawn standing in the middle of the party, stacked on top of
 * each other.
 *
 * ⚠ WHY THIS STOPPED BEING COSMETIC. It was a rendering wart for as long as
 * nothing consumed those coordinates. The moment the public walk began yielding
 * to peers, the same phantom pile started SHOVING the local walker away from
 * the room centre — a guest joining could nudge your avatar from a spot nobody
 * was standing in. A wrong answer that had been merely visible became load-
 * bearing on movement.
 *
 * The fix is to say "unknown" instead of guessing: `placed` is false until real
 * coordinates arrive, and `activeRemotes` — the ONE point both the renderer and
 * `remoteMovers` read — drops unplaced peers. Neither draws them in an invented
 * spot nor walks around one.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcilePresence,
  applyMove,
  activeRemotes,
  remoteMovers,
  type RemoteMap,
} from './plan3d-room';

const roster = (...ids: string[]) => ids.map((id) => ({ id, name: id, color: '#c9a24a' }));
const move = (map: RemoteMap, id: string, x: number, z: number, t = 1): RemoteMap =>
  applyMove(map, { id, x, z, vx: 0, vz: 0, h: 0, m: false, t }, 'me', t);

test('presence alone never places a peer — it carries no position to place them with', () => {
  const map = reconcilePresence(new Map(), roster('a'), 'me', 0);
  assert.equal(map.get('a')?.present, true, 'they ARE here');
  assert.equal(map.get('a')?.placed, false, 'but we have not been told WHERE');
});

test('an unplaced peer is not DRAWN — the origin pile is gone', () => {
  const map = reconcilePresence(new Map(), roster('a', 'b', 'c'), 'me', 0);
  assert.equal(
    activeRemotes(map, { x: 0, z: 0 }, 10).length,
    0,
    'three peers who never broadcast must not all render at the room centre',
  );
});

test('an unplaced peer is not IN YOUR WAY — it cannot shove the local walker', () => {
  // The regression that made this worth fixing: the walker yields to peers, so
  // a phantom at the origin would push a guest off the centre of the floor.
  const map = reconcilePresence(new Map(), roster('ghost'), 'me', 0);
  assert.equal(remoteMovers(map, { x: 0, z: 0 }, 10).length, 0);
});

test('the first real position places them, and then they count for both', () => {
  let map = reconcilePresence(new Map(), roster('a'), 'me', 0);
  map = move(map, 'a', 3, 4);
  assert.equal(map.get('a')?.placed, true);
  assert.equal(activeRemotes(map, { x: 0, z: 0 }, 10).length, 1, 'now drawable');
  assert.equal(remoteMovers(map, { x: 0, z: 0 }, 10).length, 1, 'now avoidable');
  assert.deepEqual(
    { x: map.get('a')!.x, z: map.get('a')!.z },
    { x: 3, z: 4 },
    'and at the position they actually sent',
  );
});

test('a later presence sync never UN-places someone already located', () => {
  // Presence re-syncs constantly (every join/leave). If a sync reset `placed`,
  // a settled peer would blink out of the room — and back to the origin — every
  // time somebody else opened the page.
  let map = reconcilePresence(new Map(), roster('a'), 'me', 0);
  map = move(map, 'a', 5, 5);
  map = reconcilePresence(map, roster('a', 'b'), 'me', 100);
  assert.equal(map.get('a')?.placed, true, 'a stays placed across a re-sync');
  assert.equal(map.get('b')?.placed, false, 'b is new and still unknown');
  assert.deepEqual(activeRemotes(map, { x: 0, z: 0 }, 10).map((p) => p.id), ['a']);
});

test('a peer who left but was located still renders — leaving is not forgetting', () => {
  // `present: false` peers walk home rather than vanishing; that is a separate
  // contract and this change must not quietly break it.
  let map = reconcilePresence(new Map(), roster('a'), 'me', 0);
  map = move(map, 'a', 2, 2);
  map = reconcilePresence(map, [], 'me', 100);
  assert.equal(map.get('a')?.present, false);
  assert.equal(activeRemotes(map, { x: 0, z: 0 }, 10).length, 1, 'still drawable on the way out');
  assert.equal(remoteMovers(map, { x: 0, z: 0 }, 10).length, 0, 'but absent peers are not dodged');
});
