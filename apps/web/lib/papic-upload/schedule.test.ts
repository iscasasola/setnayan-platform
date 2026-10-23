/**
 * The save-first uploader's rules — order, back-off, answers and the chip.
 *
 * Owner relay 2026-10-23: "as realtime as possible" — every shot's small first
 * piece goes before anybody's display copy, and every display copy before any
 * original. And a failure never reads like success or like nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  backoffMs,
  BACKOFF_CAP_MS,
  chipLabel,
  chipState,
  classifyAnswer,
  currentPhase,
  jobKey,
  nextJobs,
  type QueuedShot,
} from './schedule';
import {
  captureTierKey,
  contentTypeAllowed,
  finalKeyFor,
  phaseOf,
  stagingKeyFor,
  sniffMatches,
  TIER_RULES,
} from './tiers';

const CCID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function photo(n: number, over: Partial<QueuedShot> = {}): QueuedShot {
  return {
    id: CCID(n),
    lane: 'guest',
    eventId: 'ev-1',
    media: 'photo',
    capturedAtMs: 1000 + n,
    queuedAtMs: 1000 + n,
    prepared: true,
    tiers: {
      thumb: { contentType: 'image/webp', size: 30_000, uploaded: false },
      tile: { contentType: 'image/webp', size: 80_000, uploaded: false },
      display: { contentType: 'image/webp', size: 300_000, uploaded: false },
      original: { contentType: 'image/jpeg', size: 1_500_000, uploaded: false },
    },
    settled: {},
    wantFull: null,
    attempts: 0,
    nextAttemptAtMs: 0,
    ...over,
  };
}

const run = (shots: QueuedShot[], slots = 2, inFlight: string[] = [], fullAllowed = true) =>
  nextJobs(shots, { nowMs: 10_000, slots, inFlight: new Set(inFlight), fullAllowed });

test('every thumbnail goes before any display copy', () => {
  const shots = [photo(1), photo(2), photo(3)];
  const jobs = run(shots, 3);
  assert.deepEqual(
    jobs.map(jobKey),
    [CCID(1), CCID(2), CCID(3)].map((id) => `put:${id}:thumb`),
  );
});

test('a recorded shot moves to its display copy only after the queue has no thumbnail left to start', () => {
  const a = photo(1, {
    tiers: { ...photo(1).tiers, thumb: { contentType: 'image/webp', size: 1, uploaded: true } },
    settled: { record: true },
    wantFull: true,
  });
  const b = photo(2);
  const jobs = run([a, b], 2);
  // b's thumbnail first, then a's display-phase pieces fill the spare slot.
  assert.equal(jobKey(jobs[0]!), `put:${CCID(2)}:thumb`);
  assert.equal(jobs[1]!.kind, 'put');
  assert.ok(['tile', 'display'].includes((jobs[1] as { tier: string }).tier));
});

test('the original waits while ANY earlier phase is pending, and while not on Wi-Fi', () => {
  const done = photo(1, {
    tiers: {
      thumb: { contentType: 'image/webp', size: 1, uploaded: true },
      tile: { contentType: 'image/webp', size: 1, uploaded: true },
      display: { contentType: 'image/webp', size: 1, uploaded: true },
      original: { contentType: 'image/jpeg', size: 1, uploaded: false },
    },
    settled: { record: true, display: true },
    wantFull: true,
  });
  assert.deepEqual(run([done, photo(2)], 4).map(jobKey), [`put:${CCID(2)}:thumb`]);
  assert.deepEqual(run([done], 4, [], false), [], 'cellular: the original waits for Wi-Fi');
  assert.deepEqual(run([done], 4).map(jobKey), [`put:${CCID(1)}:original`]);
});

test('an event that does not keep full-res never uploads the original', () => {
  const s = photo(1, { settled: { record: true, display: true }, wantFull: false });
  assert.equal(currentPhase(s), null, 'finished without the original');
});

test('the record call waits for every PUT of its phase, and is made once', () => {
  const up = photo(1, {
    tiers: { ...photo(1).tiers, thumb: { contentType: 'image/webp', size: 1, uploaded: true } },
  });
  assert.deepEqual(run([up]).map(jobKey), [`settle:${CCID(1)}:record`]);
  assert.deepEqual(run([up], 2, [`settle:${CCID(1)}:record`]), [], 'never twice at once');
});

test('a shot in back-off or held for credits does not block the others', () => {
  const backingOff = photo(1, { nextAttemptAtMs: 99_999 });
  const held = photo(2, { hold: 'credits' });
  assert.deepEqual(run([backingOff, held, photo(3)]).map(jobKey), [`put:${CCID(3)}:thumb`]);
});

test('a clip without a web copy carries its raw with the record; with one, the raw is the original', () => {
  assert.equal(phaseOf('clip_raw', { hasClipWeb: false }), 'record');
  assert.equal(phaseOf('clip_raw', { hasClipWeb: true }), 'full');
  assert.equal(phaseOf('poster', { hasClipWeb: true }), 'record');
});

test('back-off grows, jitters, and is capped', () => {
  assert.ok(backoffMs(0, 0) >= 500 && backoffMs(0, 1) <= 1500);
  assert.ok(backoffMs(3, 0.5) === 8000);
  assert.equal(backoffMs(30, 1), BACKOFF_CAP_MS);
});

test('answers: signal trouble retries, credits wait, refusals stop, missing objects re-upload', () => {
  assert.deepEqual(classifyAnswer(200, { status: 'ok' }), { verdict: 'ok' });
  assert.equal(classifyAnswer(503, null).verdict, 'retry');
  assert.equal(classifyAnswer(429, null).verdict, 'retry');
  assert.equal(classifyAnswer(408, { error: 'timeout' }).verdict, 'retry');
  assert.equal(classifyAnswer(409, { status: 'camera_points_exhausted' }).verdict, 'credits');
  assert.equal(classifyAnswer(409, { status: 'quota_exhausted' }).verdict, 'credits');
  // 🔒 A closed window / put-away KEEPS the shot (review 2026-10-23, blocker 1).
  assert.equal(classifyAnswer(403, { error: 'guest_capture_closed' }).verdict, 'kept');
  assert.equal(classifyAnswer(409, { status: 'event_put_away' }).verdict, 'kept');
  assert.equal(classifyAnswer(403, { error: 'event_over' }).verdict, 'kept');
  // Only the two the old drain dropped still drop.
  assert.equal(classifyAnswer(403, { status: 'blocked' }).verdict, 'drop');
  assert.equal(classifyAnswer(403, { status: 'terms_required' }).verdict, 'drop');
  assert.equal(classifyAnswer(409, { error: 'other_owner' }).verdict, 'context');
  assert.equal(classifyAnswer(409, { error: 'other_event' }).verdict, 'context');
  assert.deepEqual(classifyAnswer(409, { error: 'object_missing', missing: ['thumb'] }), {
    verdict: 'reupload',
    tiers: ['thumb'],
    error: 'object_missing',
  });
  assert.equal(classifyAnswer(409, { error: 'full_not_wanted' }).verdict, 'no_full');
});

test('the chip never says "All saved" while anything waits', () => {
  const waiting = [photo(1)];
  assert.equal(chipLabel(chipState({ shots: waiting, online: false, doneThisVisit: 4, refused: null })), 'Offline · 1 waiting');
  assert.equal(chipLabel(chipState({ shots: waiting, online: true, doneThisVisit: 4, refused: null })), 'Sending 5 of 5');
  assert.equal(chipLabel(chipState({ shots: [], online: true, doneThisVisit: 5, refused: null })), 'All saved');
  assert.equal(chipLabel(chipState({ shots: [], online: true, doneThisVisit: 0, refused: null })), null);
  assert.equal(
    chipLabel(chipState({ shots: [photo(1, { hold: 'credits' })], online: true, doneThisVisit: 0, refused: null })),
    'Credits ran out · 1 not sent',
  );
  assert.equal(
    chipLabel(chipState({ shots: [], online: true, doneThisVisit: 3, refused: { count: 2, reason: 'guest_capture_closed' } })),
    'Couldn’t save 2',
  );
});

test('a key is bound to one capture and one tier, in the folder its cleanup scope owns', () => {
  const k = captureTierKey({
    lane: 'guest',
    ownerId: 'g-1',
    clientCaptureId: CCID(7),
    tier: 'thumb',
    contentType: 'image/webp',
  });
  assert.equal(k, `papic/guest/g-1/cap-${CCID(7)}-thumb.webp`);
  const v = captureTierKey({
    lane: 'vendor',
    ownerId: 'v-1',
    eventId: 'e-1',
    clientCaptureId: CCID(7),
    tier: 'clip_raw',
    contentType: 'video/webm;codecs=vp9,opus',
  });
  assert.equal(v, `papic/vendor-v-1/event-e-1/cap-${CCID(7)}-clip_raw.webm`);
  // The phone PUTs to `incoming/`; the row only ever points at the final key.
  assert.equal(stagingKeyFor(k!), `papic/guest/g-1/incoming/cap-${CCID(7)}-thumb.webp`);
  assert.equal(finalKeyFor(stagingKeyFor(v!)!), v);
  assert.equal(finalKeyFor(k!), null, 'a final key is not a staging key');
  // Refusals: a path-ish owner, a non-uuid capture id, a video type on a still tier.
  assert.equal(captureTierKey({ lane: 'guest', ownerId: '../x', clientCaptureId: CCID(1), tier: 'thumb', contentType: 'image/jpeg' }), null);
  assert.equal(captureTierKey({ lane: 'guest', ownerId: 'g', clientCaptureId: 'abc', tier: 'thumb', contentType: 'image/jpeg' }), null);
  assert.equal(contentTypeAllowed('thumb', 'video/mp4'), false);
  assert.equal(captureTierKey({ lane: 'vendor', ownerId: 'v', clientCaptureId: CCID(1), tier: 'thumb', contentType: 'image/jpeg' }), null, 'vendor needs its event');
});

test('magic bytes must agree with the signed type', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
  const mp4 = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypmp42'), 0, 0, 0, 0]);
  const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.ok(sniffMatches(jpeg, 'image/jpeg'));
  assert.ok(sniffMatches(webp, 'image/webp'));
  assert.ok(sniffMatches(mp4, 'video/mp4'));
  assert.ok(sniffMatches(webm, 'video/webm;codecs=vp8'));
  assert.ok(!sniffMatches(jpeg, 'image/webp'));
  assert.ok(!sniffMatches(webm, 'video/mp4'));
  assert.ok(!sniffMatches(new Uint8Array([0x3c, 0x68, 0x74, 0x6d]), 'image/jpeg'), 'html is not a photo');
});

test('caps are ordered: a thumbnail can never be signed as large as a display copy', () => {
  assert.ok(TIER_RULES.thumb.maxBytes < TIER_RULES.display.maxBytes);
  assert.ok(TIER_RULES.display.maxBytes < TIER_RULES.original.maxBytes);
  assert.ok(TIER_RULES.clip_web.maxBytes < TIER_RULES.clip_raw.maxBytes);
});

test('a photo with no thumbnail records with its original (the server makes the copies)', () => {
  assert.equal(phaseOf('original', { hasClipWeb: false, hasThumb: false }), 'record');
  assert.equal(phaseOf('original', { hasClipWeb: false, hasThumb: true }), 'full');
  const bare = photo(1, { tiers: { original: { contentType: 'image/jpeg', size: 9, uploaded: false } } });
  assert.deepEqual(run([bare]).map(jobKey), [`put:${CCID(1)}:original`]);
});
