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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { newClientCaptureId, readClientCaptureId } from './papic-client-capture-id';
import { drainGuestCaptureWith, type PapicGuestQueuePayload } from './offline/service-handlers/papic-drain';

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

test('the guest camera sends the id on BOTH live posts and on EVERY queue write', () => {
  const src = read('app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx');
  assert.equal((src.match(/form\.append\(CLIENT_CAPTURE_ID_FIELD, clientCaptureId\)/g) ?? []).length, 2, 'a live POST lost the id');
  const enqueues = src.split('enqueuePapicGuestCapture({').slice(1).map((s) => s.slice(0, s.indexOf('})')));
  assert.equal(enqueues.length, 4, 'the camera’s queue writes moved — re-point this guard');
  enqueues.forEach((e, i) => assert.match(e, /\bclientCaptureId,/, `queue write ${i + 1} drops the id`));
});

test('the drain puts the SAME queued id back on the wire', async () => {
  const id = newClientCaptureId();
  let sent: string | null = null;
  const payload: PapicGuestQueuePayload = {
    mode: 'guest',
    media_type: 'photo',
    content_type: 'image/jpeg',
    filename: 'papic.jpg',
    bytes: new Blob([new Uint8Array([1, 2, 3])]),
    captured_at_ms: Date.now(),
    client_capture_id: id,
  };
  const r = await drainGuestCaptureWith(async (form) => {
    sent = String(form.get('client_capture_id'));
    return { ok: true, status: 200, body: { status: 'ok' } };
  }, payload);
  assert.equal(r.ok, true);
  assert.equal(sent, id);
});

test('the route names the object by the id, answers a repeat early, and hands the id to the one booking call', () => {
  const src = read('app', 'api', 'papic', 'guest-capture', 'route.ts');
  assert.match(src, /const stamp = clientCaptureId \?\? String\(Date\.now\(\)\);/, 'a retry leaves a second R2 object');
  const early = src.indexOf(".eq('client_capture_id', clientCaptureId)");
  const upload = src.indexOf('await r2Upload({\n      bucket: R2_BUCKETS.media,\n      key,');
  const book = src.indexOf("admin.rpc('papic_record_guest_capture_and_spend'");
  assert.ok(early > -1 && upload > -1 && book > -1, 'a landmark moved — re-point this guard');
  assert.ok(early < upload && early < book, 'a repeat is not answered before the upload and the booking');
  // 🔁 The booking and the row are one transaction (20271276810836), and the
  // function books NOTHING for a shutter that already landed — so there is no
  // pool to put back on `duplicate` any more, and the route must not try.
  const call = src.slice(book, src.indexOf('});', book));
  assert.match(call, /p_client_capture_id: clientCaptureId/, 'the booking call lost the shutter id — a retry would book twice');
  assert.doesNotMatch(src, /releaseCaptureCredits/, 'a refund is back — it would give back a spend that committed with its row');
});
