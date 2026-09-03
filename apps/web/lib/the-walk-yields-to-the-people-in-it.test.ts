/**
 * THE PUBLIC WALK MUST YIELD TO THE PEOPLE IN THE ROOM.
 *
 * The guest walk rendered its peers and then walked straight THROUGH them.
 * Both halves of the fix already shipped and neither was wrong:
 *
 *   · `remoteMovers()` (lib/plan3d-room.ts) — the producer. Zero call sites.
 *     Its own docblock claimed it "Feeds plan3d-scene's REMOTE_MOVERS".
 *   · `REMOTE_MOVERS` (plan3d-scene.tsx) — the consumer. A hard-coded empty
 *     array whose comment reads "empty (today, always)".
 *
 * ⚠ THIS IS WHY THE PHYSICS HALF OF THIS FILE CANNOT BE THE WHOLE GUARD.
 * `separateAgents` and `remoteMovers` were both CORRECT and both fully unit-
 * tested while guests walked through each other for weeks. A pure-function
 * test cannot see a missing call site. The source assertions below are the
 * half that actually pins the defect — they are not belt-and-braces.
 *
 * ⚠ AND THE SOURCE MUST BE COMMENT-STRIPPED FIRST. The fix's own comments name
 * `separateAgents`, `remoteMovers` and `pushOutOfDiscs` in prose; matched
 * against raw source, every assertion here would pass on a file whose code had
 * been deleted and whose comments remained. That exact failure — "the only
 * surviving match was a comment" — is on the record in this repo's CLAUDE.md.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { remoteMovers, type RemoteMap, type RemotePlayer } from './plan3d-room';
import { separateAgents } from './seating-3d';

const WALK = join(
  import.meta.dirname,
  '..',
  'app',
  '[slug]',
  'venue',
  '_components',
  'guest-venue-3d.tsx',
);

const peer = (over: Partial<RemotePlayer> & { id: string }): RemotePlayer => ({
  name: 'Peer',
  color: '#888888',
  x: 0,
  z: 0,
  vx: 0,
  vz: 0,
  h: 0,
  moving: false,
  recvAt: 1_000,
  present: true,
  placed: true,
  greetUntil: 0,
  ...over,
});

const mapOf = (...ps: RemotePlayer[]): RemoteMap => new Map(ps.map((p) => [p.id, p]));

/* ── 1 · THE PHYSICS. Necessary, and provably not sufficient. ─────────────── */

test('a peer standing where the walker is heading pushes it off that spot', () => {
  const now = 1_000;
  const self = { x: 0, z: 0 };
  const movers = remoteMovers(mapOf(peer({ id: 'a', x: 0.1, z: 0 })), self, now, 8);
  assert.equal(movers.length, 1, 'a present peer must reach the separation pass');

  const [steered] = separateAgents([self, ...movers], 0.5, 1 / 60);
  const moved = Math.hypot(steered!.x - self.x, steered!.z - self.z);
  assert.ok(moved > 1e-6, 'the walker must be displaced away from an overlapping peer');
});

test('an ABSENT peer is not something you have to walk around', () => {
  // Someone who left is still rendered while they walk home, but they are no
  // longer a body in the room — yielding to a ghost would read as a stumble.
  const movers = remoteMovers(mapOf(peer({ id: 'gone', present: false })), { x: 0, z: 0 }, 1_000, 8);
  assert.equal(movers.length, 0);
});

test('the pass is capped, so a busy room cannot uncap an O(n^2) loop on a phone', () => {
  const many = Array.from({ length: 30 }, (_, i) => peer({ id: `p${i}`, x: i * 0.2, z: 0 }));
  assert.equal(remoteMovers(mapOf(...many), { x: 0, z: 0 }, 1_000, 8).length, 8);
});

/* ── 2 · THE WIRE. The half that would have caught the real bug. ──────────── */

const src = () => stripComments(readFileSync(WALK, 'utf8'));

test('the public walk actually CALLS the producer and the separation pass', () => {
  const s = src();
  assert.match(
    s,
    /remoteMovers\(/,
    'guest-venue-3d must call remoteMovers — a producer with no call site is ' +
      'exactly the state this file exists to prevent.',
  );
  assert.match(s, /separateAgents\(/, 'the walk must run the separation pass');
});

test('the re-clamp runs AFTER separation, or dodging a peer walks through a table', () => {
  // Ordering is the whole contract: the path is pre-routed around obstacles, so
  // a sidestep is the ONE thing that can push the figure into one. Clamping
  // before the sidestep would be a no-op that still reads as protection.
  const s = src();
  const sep = s.indexOf('separateAgents(');
  const clamp = s.indexOf('pushOutOfDiscs(', sep);
  assert.ok(sep !== -1, 'no separation pass to order against');
  assert.ok(
    clamp !== -1,
    'no pushOutOfDiscs AFTER separateAgents — a separation sidestep can push ' +
      'the walker inside a table the pre-routed path had already cleared.',
  );
});

test('separation is skipped when nobody is there — a solo walk pays nothing', () => {
  assert.match(
    src(),
    /\.size > 0/,
    'the pass must be gated on a non-empty peer map; an empty room must not ' +
      'allocate or re-clamp, because that is the common case on a phone.',
  );
});

test('a seated guest is never shoved off their own chair', () => {
  // The walker stays MOUNTED but bodyless while its owner is seated, and its
  // position feeds the shared-room broadcaster — so separation running outside
  // the translating branch would slide a seated guest across every peer's
  // window. Pin it INSIDE the branch that advances the gait.
  const s = src();
  const branch = s.indexOf('phaseRef.current += delta * RUN_CLOCK_RAD_S');
  const sep = s.indexOf('separateAgents(');
  const elseArm = s.indexOf('} else {', branch);
  assert.ok(branch !== -1 && sep !== -1 && elseArm !== -1, 'walk loop shape changed');
  assert.ok(
    sep > branch && sep < elseArm,
    'the separation pass must sit inside the translating branch, before the ' +
      'arrived/at-rest arm — otherwise it runs while the guest is seated.',
  );
});
