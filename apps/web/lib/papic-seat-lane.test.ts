/**
 * 📷 ONE CAMERA — a seat's lane (owner 2026-11-22: "we only have one camera interface and that should be it").
 *
 * A seat camera now sends through the shared uploader to app/api/papic/seat-capture, which records through
 * `recordSeatCapture`. These pin the joins that decide money and whether a shot survives:
 *   · every refusal `recordSeatCapture` can give maps to an uploader verdict that KEEPS the shot (credits / kept /
 *     retry) — never to 'ok' (a photograph that did not land) and never to 'drop' (a shot erased from the phone);
 *   · a seat sends only what `recordSeatCapture` records (the original; a clip's poster + raw), so the uploader's
 *     first step for a seat carries exactly those;
 *   · the face vectors and the location that reach the record step are the shapes the seat's matcher and the
 *     RA 10173 gate take.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyAnswer, tiersInPhase, type QueuedShot } from '@/lib/papic-upload/schedule';
import { captureTierKey } from '@/lib/papic-upload/tiers';
import { RECORD_TYPES, SEAT_TIERS, faceVectorsOf, geoOf, seatRefusal } from '@/lib/papic-seat-lane';

const WEB = join(__dirname, '..');

/** Every `{ ok: false, error: '…' }` `recordSeatCapture` can return, read from its source (not typed here). */
function recordSeatCaptureRefusals(): string[] {
  const src = readFileSync(join(WEB, 'app/papic/actions.ts'), 'utf8');
  const start = src.indexOf('export async function recordSeatCapture(');
  const end = src.indexOf('\nexport async function ', start + 10);
  const body = src.slice(start, end);
  const codes = new Set<string>();
  for (const m of body.matchAll(/error: '([a-z_]+)'/g)) codes.add(m[1]!);
  // The record RPC's own mapping uses a conditional for the outage code.
  if (/'unavailable' : 'record_failed'/.test(body)) {
    codes.add('unavailable');
    codes.add('record_failed');
  }
  return [...codes];
}

test('every recordSeatCapture refusal KEEPS the shot — none reads as landed, none erases it', () => {
  const codes = recordSeatCaptureRefusals();
  assert.ok(codes.length >= 15, `read ${codes.length} refusal codes — the scan is no longer finding recordSeatCapture's`);
  for (const code of codes) {
    const r = seatRefusal(code);
    assert.ok(r.status >= 400, `${code} answered ${r.status} — a refusal must never be a 2xx`);
    const v = classifyAnswer(r.status, { error: r.error });
    assert.notEqual(v.verdict, 'ok', `${code} would read as a photograph that landed`);
    assert.notEqual(v.verdict, 'drop', `${code} would erase the shot from the phone`);
  }
});

test('the money refusals land where the camera says so', () => {
  for (const code of ['camera_points_exhausted', 'camera_photo_cap', 'camera_video_cap']) {
    assert.equal(classifyAnswer(402, { error: seatRefusal(code).error }).verdict, 'credits', `${code} is not a credits refusal`);
  }
  for (const code of ['capture_not_started', 'capture_window_closed', 'awaiting_payment', 'event_put_away', 'uploads_closed', 'revoked']) {
    const r = seatRefusal(code);
    assert.equal(classifyAnswer(r.status, { error: r.error }).verdict, 'kept', `${code} is not kept on the phone`);
  }
  for (const code of ['too_fast', 'record_failed', 'unavailable', 'lookup_failed', 'something_new']) {
    const r = seatRefusal(code);
    assert.equal(classifyAnswer(r.status, { error: r.error }).verdict, 'retry', `${code} is not retried`);
  }
});

test('a seat sends exactly what recordSeatCapture records, all in the first step', () => {
  assert.deepEqual([...SEAT_TIERS.photo], ['original']);
  assert.deepEqual([...SEAT_TIERS.clip], ['poster', 'clip_raw']);
  const base = { lane: 'seat', eventId: 'e', settled: {}, prepared: true } as const;
  const photo = { ...base, media: 'photo', tiers: { original: { contentType: 'image/jpeg', size: 9, uploaded: false } } } as unknown as QueuedShot;
  assert.deepEqual(tiersInPhase(photo, 'record'), ['original'], 'a seat photo would wait for a copy the phone never makes');
  const clip = {
    ...base,
    media: 'clip',
    tiers: {
      poster: { contentType: 'image/jpeg', size: 9, uploaded: false },
      clip_raw: { contentType: 'video/mp4', size: 9, uploaded: false },
    },
  } as unknown as QueuedShot;
  assert.deepEqual([...tiersInPhase(clip, 'record')].sort(), ['clip_raw', 'poster']);
  // The record step can find every type the sign step accepts.
  for (const tier of [...SEAT_TIERS.photo, ...SEAT_TIERS.clip]) {
    assert.ok((RECORD_TYPES[tier] ?? []).length > 0, `${tier} has no type the record step looks for`);
  }
});

test('a seat key lives in the folder recordSeatCapture accepts (papicSeatCapturePolicy)', () => {
  const key = captureTierKey({
    lane: 'seat',
    ownerId: '11111111-1111-4111-8111-111111111111',
    eventId: '22222222-2222-4222-8222-222222222222',
    clientCaptureId: '33333333-3333-4333-8333-333333333333',
    tier: 'original',
    contentType: 'image/jpeg',
  });
  assert.equal(
    key,
    'papic/event-22222222-2222-4222-8222-222222222222/seat-11111111-1111-4111-8111-111111111111/cap-33333333-3333-4333-8333-333333333333-original.jpg',
  );
  assert.equal(
    captureTierKey({ lane: 'seat', ownerId: 'x', eventId: null, clientCaptureId: '33333333-3333-4333-8333-333333333333', tier: 'original', contentType: 'image/jpeg' }),
    null,
    'a seat key without its event',
  );
});

test('face vectors and location reach the record step only in the shapes their gates take', () => {
  const v = Array.from({ length: 128 }, (_, i) => i / 128);
  assert.deepEqual(faceVectorsOf([v, v.slice(1), 'x', [Number.NaN, ...v.slice(1)]]), [v]);
  assert.equal(faceVectorsOf(Array.from({ length: 80 }, () => v)).length, 50, 'no ceiling on faces per photo');
  assert.deepEqual(geoOf({ lat: 14.5, lon: 121, accuracyM: 30 }), { lat: 14.5, lon: 121, accuracyM: 30 });
  assert.deepEqual(geoOf({ unavailable: true }), { unavailable: true });
  assert.deepEqual(geoOf({ lat: 'a', lon: 1 }), { unavailable: true });
  assert.equal(geoOf(undefined), undefined);
});
