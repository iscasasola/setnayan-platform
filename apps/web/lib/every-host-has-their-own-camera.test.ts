/**
 * 👥 EVERY HOST HAS THEIR OWN HOST CAMERA, AND EVERY ONE SPENDS THE ONE SHARED POOL (owner 2026-10-31, DECISION_LOG
 * "SEVEN OWNER ANSWERS" item 3 — asked "Should co-hosts each get a camera, and are host shots free?", answered
 * *"yes. papic credits still"*). A host is `event_members.member_type = 'couple'`: the couple AND every co-host.
 *
 * 🔑 WHAT THIS REPLACES. There was ONE Uploads camera per event (seat `PAPIC_UPLOADS_CAMERA_INDEX`), claimed by whichever
 * host pressed first; the Memories page read that one seat and told every other host *"Adding photos on this event is
 * set up on the other host’s account"*. The cameras are now a BLOCK (`isHostCameraSeatIndex`), each host's own resolved
 * by one pure rule (`hostCameraPick`) that the Memories render and the claim (`startAddingPhotos`) BOTH ask through
 * `readHostCamera` — so the sheet and the claim cannot disagree about whose camera is whose.
 *
 * Held here, in two halves:
 *   1 · THE RULE (pure): two hosts get two cameras, a host keeps theirs, nobody is handed another host's, the block
 *       never reaches the paid range, and every camera in the block is metered and gated as an upload;
 *   2 · THE WIRING (source): no reader pins the single seat again, the page mints for the viewer's OWN id, and every
 *       place that asks "is this the uploads camera?" asks the block, not the one index.
 * The database half (two co-hosts claim their own cameras, both spend the one pool, a stranger gets none) is
 * `tests/db/the-uploads-camera-is-claimed-once.db.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAPIC_CAMERA_INDEX_BASE,
  PAPIC_FREE_ONE_CAMERA_INDEX,
  PAPIC_HOST_CAMERA_LAST_INDEX,
  PAPIC_UPLOADS_CAMERA_INDEX,
  hostCameraPick,
  hostCameraSeat,
  isHostCameraSeatIndex,
  papicSeatCaptureSource,
  type HostCameraRow,
} from './papic-cameras';
import { stripComments } from './strip-comments';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const row = (seat_index: number, claimer_user_id: string | null, revoked_at: string | null = null): HostCameraRow => ({
  seat_id: `seat-${seat_index}`,
  seat_index,
  claim_qr_token: `tok-${seat_index}`,
  claimer_user_id,
  revoked_at,
});

test('1 · a brand-new event: the first host is offered seat 150, the original Uploads camera', () => {
  assert.deepEqual(hostCameraPick([], 'host-a'), { kind: 'mint', index: PAPIC_UPLOADS_CAMERA_INDEX });
});

test('2 · 🚨 two hosts, two cameras — the second host is never handed the first host\'s camera', () => {
  const rows = [row(150, 'host-a')];
  assert.equal(hostCameraPick(rows, 'host-a').kind, 'mine');
  const b = hostCameraPick(rows, 'host-b');
  assert.deepEqual(b, { kind: 'mint', index: 151 }, 'the co-host is told the camera is the other host\'s again');
  // …and once theirs is minted and claimed, each keeps their own.
  const both = [row(150, 'host-a'), row(151, 'host-b')];
  assert.equal(hostCameraSeat(hostCameraPick(both, 'host-a'))?.seat_index, 150);
  assert.equal(hostCameraSeat(hostCameraPick(both, 'host-b'))?.seat_index, 151);
});

test('3 · an unclaimed camera is a spare the next host claims — never a second mint beside it', () => {
  const rows = [row(150, 'host-a'), row(151, null)];
  assert.deepEqual(hostCameraPick(rows, 'host-b'), { kind: 'spare', seat: rows[1] });
  assert.equal(hostCameraPick(rows, 'host-a').kind, 'mine', 'a host with a camera is offered the spare too');
});

test('4 · a revoked camera keeps its index (the UNIQUE spans it) and is nobody\'s', () => {
  const rows = [row(150, 'host-a', '2026-10-01T00:00:00Z'), row(151, 'host-b')];
  assert.deepEqual(hostCameraPick(rows, 'host-a'), { kind: 'mint', index: 152 });
});

test('5 · the block is used up before it ever reaches the paid range', () => {
  const rows: HostCameraRow[] = [];
  for (let i = PAPIC_UPLOADS_CAMERA_INDEX; i <= PAPIC_HOST_CAMERA_LAST_INDEX; i += 1) rows.push(row(i, `h${i}`));
  assert.deepEqual(hostCameraPick(rows, 'one-more'), { kind: 'full' });
  assert.ok(PAPIC_HOST_CAMERA_LAST_INDEX < PAPIC_CAMERA_INDEX_BASE, 'the host block runs into the paid cameras');
  assert.ok(!isHostCameraSeatIndex(PAPIC_FREE_ONE_CAMERA_INDEX), 'the free One camera (110) reads as a host camera');
  assert.ok(!isHostCameraSeatIndex(PAPIC_CAMERA_INDEX_BASE), 'a paid camera reads as a host camera');
});

test('6 · 🪙 nothing is free: every host camera is metered as an upload, exactly as seat 150 always was', () => {
  for (const i of [PAPIC_UPLOADS_CAMERA_INDEX, 151, PAPIC_HOST_CAMERA_LAST_INDEX]) {
    assert.equal(papicSeatCaptureSource(i), 'upload', `host camera ${i} is not charged as an upload`);
  }
  for (const i of [100, 110, 200, null]) assert.equal(papicSeatCaptureSource(i), 'camera');
});

test('7 · 🚨 no reader pins the single Uploads seat again — the page and the claim both ask readHostCamera', () => {
  const page = read('app/dashboard/[eventId]/memories/page.tsx');
  const actions = read('app/dashboard/[eventId]/studio/papic/actions.ts');
  for (const [name, src] of [['memories/page.tsx', page], ['studio/papic/actions.ts', actions]] as const) {
    assert.doesNotMatch(src, /\.eq\('seat_index',\s*PAPIC_UPLOADS_CAMERA_INDEX\)/, `${name} reads the ONE Uploads seat again — every host but its claimer is shut out`);
    assert.match(src, /readHostCamera\(admin, eventId, user\.id\)/, `${name} no longer resolves THIS host's camera`);
  }
  assert.doesNotMatch(page, /takenByOther|UPLOADS_TAKEN_LINE|data-add-photos-taken/, 'the page tells a host the camera is "the other host\'s" again');
});

test('8 · 🔒 the Memories mint is for the viewer\'s OWN id, never anything a form could send', () => {
  const page = read('app/dashboard/[eventId]/memories/page.tsx');
  const call = /provisionUploadsCameraAdmin\(admin, eventId, \{[^}]*\}, ([^)]*)\)/.exec(page);
  assert.ok(call, 'the Memories mint no longer names whose camera it is minting');
  assert.equal(call[1]!.trim(), 'user.id', 'the Memories mint is keyed on something other than the signed-in viewer');
});

test('9 · every "is this the uploads camera?" asks the BLOCK, not the one index', () => {
  for (const rel of ['lib/papic-uploads-open-rule.ts', 'lib/papic-uploads-open.ts', 'lib/papic-gallery.ts']) {
    const src = read(rel);
    assert.match(src, /isHostCameraSeatIndex\(/, `${rel} no longer asks the host-camera block`);
    assert.doesNotMatch(src, /[!=]==\s*PAPIC_UPLOADS_CAMERA_INDEX/, `${rel} compares to the one index — a co-host's camera escapes it`);
  }
  const cams = read('lib/papic-cameras.ts');
  const source = /export function papicSeatCaptureSource[\s\S]*?\n}/.exec(cams)?.[0] ?? '';
  assert.match(source, /isHostCameraSeatIndex\(seatIndex\)/, 'a co-host\'s upload is charged as a camera shot');
});
