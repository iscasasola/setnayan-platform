/**
 * 📷 GUARD — A HOST'S LIVE PHOTO FROM THE EVENT HUB CAMERA COSTS THE CAMERA PRICE; A FILE ADDED BY HAND STAYS ×3
 * (owner 2026-11-22: "Make it 1." — specs DECISION_LOG "A HOST'S LIVE PHOTOS FROM THE EVENT HUB CAMERA COST 1×").
 *
 * WHERE THE ×3 WAS APPLIED: two seams, both asking `papicSeatCaptureSource(seat_index)` and nothing else — the record
 * (`recordSeatCapture`, app/papic/actions.ts) and the presign gate (`/api/upload`). Every capture on a host camera's
 * seat was "added by hand", which was true while that seat was only the Memories file picker and stopped being true
 * when the host's Hub camera opened the same seat (#8133). The split is made THERE: the seat AND the Add-photos door's
 * own word. No price is typed here — every number is read from `papicCaptureCost` / `PAPIC_UPLOAD_MULTIPLIER`.
 *
 *   1 · host live = the camera price (×1) · host hand-added = the camera price × the multiplier — photo and clip;
 *   2 · both seams ask the ONE split, with the caller's word — and neither can price a non-host seat as an upload;
 *   3 · ONLY the Add-photos door says "added": on the presign AND on the record. No camera lane says it;
 *   4 · the guest path is untouched: a camera shot is the camera price, a phone upload the upload price.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PAPIC_HOST_CAMERA_LAST_INDEX, PAPIC_UPLOADS_CAMERA_INDEX, papicSeatCaptureSource } from '@/lib/papic-cameras';
import { PAPIC_UPLOAD_MULTIPLIER, papicCaptureCost, papicClipCostFloor } from '@/lib/papic-cameras-pure';

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const HOST_SEATS = [PAPIC_UPLOADS_CAMERA_INDEX, PAPIC_UPLOADS_CAMERA_INDEX + 1, PAPIC_HOST_CAMERA_LAST_INDEX];
/** What the record step charges: the same two calls, in the same order. */
const charge = (seat: number | null, kind: 'photo' | 'clip', ms: number | null, addedByHand?: boolean) =>
  papicCaptureCost(kind, ms, papicSeatCaptureSource(seat, addedByHand));

test('1 · host LIVE = the camera price; host HAND-ADDED = that price × the multiplier', () => {
  assert.ok(PAPIC_UPLOAD_MULTIPLIER > 1, 'premise: adding by hand costs more than shooting');
  for (const seat of HOST_SEATS) {
    for (const [kind, ms] of [['photo', null], ['clip', 2_000], ['clip', 9_000], ['clip', null]] as const) {
      const camera = papicCaptureCost(kind, ms, 'camera');
      assert.equal(charge(seat, kind, ms), camera, `a host's live ${kind} on seat ${seat} is not the camera price`);
      assert.equal(charge(seat, kind, ms, false), camera);
      assert.equal(charge(seat, kind, ms, true), camera * PAPIC_UPLOAD_MULTIPLIER, `a ${kind} added by hand on seat ${seat} is not × the multiplier`);
    }
    // The presign gate's floor follows the same split.
    assert.equal(papicClipCostFloor(papicSeatCaptureSource(seat)), papicClipCostFloor('camera'));
    assert.equal(papicClipCostFloor(papicSeatCaptureSource(seat, true)), papicClipCostFloor('upload'));
  }
});

test('2 · both seams ask the ONE split with the caller’s word; "added" never raises a non-host seat', () => {
  const record = code('app/papic/actions.ts');
  assert.match(
    record,
    /papicSeatCaptureSource\(typeof seat\.seat_index === 'number' \? seat\.seat_index : null, addedByHand === true\)/,
    'the record step no longer splits live from hand-added — every host shot is one price again',
  );
  const presign = code('app/api/upload/route.ts');
  assert.match(
    presign,
    /const captureSource = papicSeatCaptureSource\(seat\.seat_index as number \| null, body\.papicAdded === true\);/,
    'the presign gate prices a host’s live shot differently from the record step',
  );
  for (const src of [record, presign]) {
    assert.equal((src.match(/papicSeatCaptureSource\(/g) ?? []).length, 1, 'a second pricing call appeared at a seam');
    assert.doesNotMatch(src, /papicCaptureCost\([^)]*'upload'\)/, 'a seam prices an upload without asking the split');
  }
  // Off a host seat the word changes nothing — a paid or free camera can never be made dearer (or the split spoofed).
  for (const seat of [1, 100, 101, 102, 110, 200, 999, null]) {
    assert.equal(charge(seat, 'photo', null, true), papicCaptureCost('photo', null, 'camera'), `seat ${seat}`);
  }
});

test('3 · ONLY the Add-photos door says "added" — on the presign and on the record; no camera lane does', () => {
  const add = code('app/dashboard/[eventId]/studio/papic/_components/add-to-library.tsx');
  assert.match(add, /\{ file, contentType, papicSeatToken: token, papicAdded: true \}/, 'the Add-photos presign no longer says the file was added — its gate asks the camera price');
  assert.match(
    add,
    /recordSeatCapture\(tokenRef\.current \?\? '', ref, kind, posterRef, durationMs, undefined, undefined, undefined, true\)/,
    'the Add-photos record no longer says the file was added — an added photo is charged the camera price',
  );
  assert.match(code('lib/upload-send.ts'), /\.\.\.\(job\.papicAdded === true \? \{ papicAdded: true \} : \{\}\)/);
  // Every camera lane: the seat camera's lane on the one camera (its route — owner 2026-11-22, one camera), the old
  // seat queue's offline drain, the camera bridge (page + offline handler + sink).
  for (const lane of [
    'app/api/papic/seat-capture/route.ts',
    'app/papic/seat/[token]/_components/camera-bridge-panel.tsx',
    'lib/offline/service-handlers/papic-drain.ts',
    'lib/offline/service-handlers/camera-bridge-handler.ts',
    'lib/camera-bridge/papic-sink.ts',
  ]) {
    const src = code(lane);
    assert.doesNotMatch(src, /papicAdded/, `${lane} says its captures were added by hand — a live shot would cost × the multiplier`);
    // No recordSeatCapture call there reaches the ninth argument.
    for (const call of src.match(/recordSeatCapture\(\s*(?:[^()]|\([^()]*\))*\)/g) ?? []) {
      assert.ok(call.split(',').length <= 9 && !/,\s*true\s*,?\s*\)$/.test(call), `${lane}: ${call.slice(0, 80)}… declares "added by hand"`);
    }
  }
});

test('4 · the guest path is unchanged: a camera shot is the camera price, a phone upload the upload price', () => {
  const guest = code('app/api/papic/guest-capture/route.ts');
  assert.match(guest, /function isPhoneUpload\(body: Body\): boolean \{\s*return body\.source === 'phone';\s*\}/);
  assert.doesNotMatch(guest, /papicSeatCaptureSource|papicAdded/, 'the guest route was routed through the host split');
  assert.match(guest, /papicCaptureCost\([^)]*isPhoneUpload\(body\) \? 'upload' : 'camera'\)|isPhoneUpload\(body\) \? 'upload' : 'camera'/);
});
