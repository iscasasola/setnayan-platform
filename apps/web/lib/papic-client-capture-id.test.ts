/**
 * 🔁 ONE SHUTTER, ONE ROW, ONE SPEND — event-day L1·2. The id is only worth
 * anything if the SAME value reaches the server on every path a shot can take:
 * the live POST, the offline queue, and the drain that replays it. These read
 * the three sources and the route.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • the drain stops re-sending the queued id                 → test 3 red;
 *   • the route names the R2 object by Date.now() again        → test 4 red;
 *   • the route stops putting back the pool on `duplicate`     → test 4 red.
 *
 * 📮 2026-10-23 — SAVE FIRST, SEND LATER. There is no live POST and no
 * multipart drain any more: the shutter hands the shot (and its id) to the
 * page's uploader, and every piece, record and attach carries that id
 * (lib/papic-upload/lanes.ts). The object key is bound to it
 * (lib/papic-upload/tiers.ts captureTierKey). These tests hold the same
 * property on the new path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { newClientCaptureId, readClientCaptureId } from './papic-client-capture-id';
import { CLIENT_CAPTURE_ID_FIELD } from './papic-client-capture-id';
import { attachBody, recordBody, signBody } from './papic-upload/lanes';
import { captureTierKey } from './papic-upload/tiers';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

test('an id is minted fresh per shutter and read back only when well formed', () => {
  const a = newClientCaptureId();
  const b = newClientCaptureId();
  assert.notEqual(a, b);
  assert.equal(readClientCaptureId(a), a);
  assert.equal(readClientCaptureId(` ${a.toUpperCase()} `), a);
  for (const bad of [null, undefined, '', 'abc', 42, `${a}x`, "'; drop table x; --"]) {
    assert.equal(readClientCaptureId(bad), null, `accepted ${String(bad)}`);
  }
});

test('the guest camera hands ONE fresh id per shutter to the uploader — photo and clip', () => {
  const src = read('app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx');
  const saves = src.split('await saveShot({').slice(1).map((x) => x.slice(0, x.indexOf('});')));
  assert.equal(saves.length, 2, 'the camera’s hand-offs moved — re-point this guard');
  saves.forEach((e, i) => assert.match(e, /\bid: (?:meta\.)?clientCaptureId,/, `hand-off ${i + 1} drops the id`));
  assert.equal((src.match(/const clientCaptureId = newClientCaptureId\(\);/g) ?? []).length, 2);
});

test('every call a queued shot makes carries the SAME id', () => {
  const id = newClientCaptureId();
  const shot = {
    id,
    lane: 'guest' as const,
    eventId: 'e',
    media: 'photo' as const,
    capturedAtMs: 1,
    queuedAtMs: 1,
    prepared: true,
    tiers: { thumb: { contentType: 'image/webp', size: 10, uploaded: true } },
    settled: {},
    wantFull: null,
    attempts: 0,
    nextAttemptAtMs: 0,
  };
  for (const body of [signBody(shot, 'thumb'), recordBody(shot), attachBody(shot, ['display'])]) {
    assert.equal(body[CLIENT_CAPTURE_ID_FIELD], id);
  }
  // …and the object key is named by it, so a replayed piece overwrites one object.
  const key = captureTierKey({ lane: 'guest', ownerId: 'g', clientCaptureId: id, tier: 'thumb', contentType: 'image/webp' });
  assert.ok(key?.includes(id));
});

test('the route answers a repeat early, and hands the id to the one booking call', () => {
  const src = read('app', 'api', 'papic', 'guest-capture', 'route.ts');
  const early = src.indexOf(".eq('client_capture_id', clientCaptureId)");
  const repeat = src.indexOf('if (prior?.capture_id) {');
  const book = src.indexOf("admin.rpc('papic_record_guest_capture_and_spend'");
  assert.ok(early > -1 && repeat > -1 && book > -1, 'a landmark moved — re-point this guard');
  assert.ok(repeat < book, 'a repeat is not answered before the booking');
  // 🔁 The booking and the row are one transaction (20271276810836), and the
  // function books NOTHING for a shutter that already landed — so there is no
  // pool to put back on `duplicate` any more, and the route must not try.
  const call = src.slice(book, src.indexOf('});', book));
  assert.match(call, /p_client_capture_id: clientCaptureId/, 'the booking call lost the shutter id — a retry would book twice');
  assert.doesNotMatch(src, /releaseCaptureCredits/, 'a refund is back — it would give back a spend that committed with its row');
  assert.match(src, /signCaptureTierPut\(admin, \{[\s\S]*?clientCaptureId,/, 'a signed key is not bound to the shutter');
});
