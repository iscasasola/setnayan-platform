/**
 * A SEAT CAMERA MAY RECORD ONLY ITS OWN FILE (2026-09-10).
 *
 * `recordSeatCapture` takes the key as an ARGUMENT and writes the row through
 * the SERVICE ROLE (the recording RPC), so no policy sees it — and the
 * full-resolution sweep later deletes whatever `r2_object_key` names. The rule
 * is `papicSeatCapturePolicy`; it is proved here by calling it. The one thing a
 * pure test cannot do is prove the server action still CALLS it before the RPC,
 * so that ordering is pinned below on comment-stripped code — a wiring pin,
 * named as such, not the rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { papicSeatCapturePolicy, parseClientRef } from './r2-client-ref';
import { stripComments } from './strip-comments';

const E = 'ea000000-0000-4000-8000-000000000001';
const S = '5ea00000-0000-4000-8000-000000000001';

test('the seat branch’s own key (raw, poster, web copy) is accepted', () => {
  const p = papicSeatCapturePolicy(E, S, 3);
  for (const k of ['u-papic-1.jpg', 'u-papic-2.mp4', 'u-papic-2-poster.jpg', 'u-papic-2-web.mp4']) {
    assert.ok(parseClientRef(`r2://setnayan-media/papic/event-${E}/seat-${S}/${k}`, p), k);
  }
});

test('another event, another seat, a private bucket or a stranger’s file is refused', () => {
  const p = papicSeatCapturePolicy(E, S, 3);
  for (const ref of [
    `r2://setnayan-media/papic/event-ea000000-0000-4000-8000-000000000002/seat-${S}/a.jpg`,
    `r2://setnayan-media/papic/event-${E}/seat-5ea00000-0000-4000-8000-000000000002/a.jpg`,
    `r2://setnayan-vendor-verification/papic/event-${E}/seat-${S}/a.jpg`,
    'r2://setnayan-vendor-verification/vendors/victim/government_id/gov.png',
    'r2://setnayan-media/vendors/victim/logo/logo.png',
    `papic/event-${E}/seat-${S}/a.jpg`,
    `r2://setnayan-media/papic/event-${E}/seat-${S}/../../vendors/v/logo.png`,
  ]) {
    assert.equal(parseClientRef(ref, p), null, ref);
  }
});

test('the dark-launched Camera Bridge shape is accepted ONLY for this seat’s own index', () => {
  assert.ok(parseClientRef('r2://setnayan-media/papic/seat-3/uuid-a.jpg', papicSeatCapturePolicy(E, S, 3)));
  assert.equal(parseClientRef('r2://setnayan-media/papic/seat-4/uuid-a.jpg', papicSeatCapturePolicy(E, S, 3)), null);
  assert.equal(parseClientRef('r2://setnayan-media/papic/seat-3/uuid-a.jpg', papicSeatCapturePolicy(E, S, null)), null);
});

test('WIRING: recordSeatCapture refuses a foreign key BEFORE the service-role RPC writes it', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const src = stripComments(readFileSync(resolve(HERE, '../app/papic/actions.ts'), 'utf8'));
  const check = src.indexOf('!parseClientRef(cleanKey, seatPolicy)');
  const posterCheck = src.indexOf('!parseClientRef(cleanPoster, seatPolicy)');
  const rpc = src.indexOf("writer.rpc(\n      'papic_record_seat_capture'");
  assert.ok(check > 0 && posterCheck > 0, 'recordSeatCapture no longer holds the raw AND poster keys to the seat');
  assert.ok(rpc > 0, 'the recording RPC call moved — re-point this pin');
  assert.ok(check < rpc && posterCheck < rpc, 'the key check runs after the row is already written');
  assert.ok(
    src.includes('!parseClientRef(cleanClipWeb, papicSeatCapturePolicy('),
    'persistSeatClipWebCopy no longer holds the web copy to the seat',
  );
});
