/**
 * Event Hub Maker media limits (Phase 4, DECISION_LOG 2026-09-25) — the two
 * owner-set numbers plus the pure meter arithmetic, unit-testable with no DOM.
 *
 * `makeMakerVideoDurationValidator`'s actual >15s rejection needs a real
 * `<video>` element's `loadedmetadata` event, which this Node suite (`tsx
 * --test`, no jsdom) cannot fire — so what IS tested here is the contract
 * that matters most under that constraint: it FAILS OPEN (never refuses) when
 * duration can't be read, exactly as its docblock promises, which is provable
 * in Node because `URL.createObjectURL`/`document` are absent here too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAKER_CLIP_TOO_LONG_MESSAGE,
  MAKER_EVENT_MEDIA_BYTES_CAP,
  MAKER_MAX_CLIP_SECONDS,
  formatMakerMediaMeterLabel,
  makeMakerVideoDurationValidator,
  makerMediaMeterState,
} from './maker-media-limits';

test('the two owner-set numbers are exactly what DECISION_LOG 2026-09-25 says', () => {
  assert.equal(MAKER_MAX_CLIP_SECONDS, 15);
  assert.equal(MAKER_EVENT_MEDIA_BYTES_CAP, 100 * 1024 * 1024);
  // The exact owner sentence — "no trimmer" supersedes the same-day trimmer
  // row, so this string is what a couple actually reads. Do not paraphrase it.
  assert.equal(MAKER_CLIP_TOO_LONG_MESSAGE, 'Please pick a video under 15 seconds.');
});

test('the duration validator fails OPEN when the browser cannot read the clip', async () => {
  const validate = makeMakerVideoDurationValidator();
  // A fake File — no real video decode is possible in this DOM-less suite, so
  // `probeClipDurationSeconds` resolves null and the validator must not refuse.
  const fakeFile = { name: 'clip.mov' } as unknown as File;
  const result = await validate(fakeFile);
  assert.equal(result, null, 'an unreadable duration must never block the upload');
});

test('the validator reports null (not a stale number) when it cannot measure', async () => {
  const seen: Array<number | null> = [];
  const validate = makeMakerVideoDurationValidator((s) => seen.push(s));
  await validate({ name: 'clip.mov' } as unknown as File);
  // CLEAR FIRST, then the (unreadable) measurement — both pushes are null here,
  // but the ORDER matters: a caller must never see a stale previous number.
  assert.deepEqual(seen, [null, null]);
});

test('meter: 0 bytes used', () => {
  const s = makerMediaMeterState(0);
  assert.equal(s.pct, 0);
  assert.equal(s.isFull, false);
  assert.equal(s.isNear, false);
  assert.equal(s.remainingBytes, MAKER_EVENT_MEDIA_BYTES_CAP);
});

test('meter: exactly at the cap is full, not merely near', () => {
  const s = makerMediaMeterState(MAKER_EVENT_MEDIA_BYTES_CAP);
  assert.equal(s.pct, 100);
  assert.equal(s.isFull, true);
  assert.equal(s.remainingBytes, 0);
});

test('meter: over the cap clamps pct to 100 and remaining to 0, never negative', () => {
  const s = makerMediaMeterState(MAKER_EVENT_MEDIA_BYTES_CAP * 1.4);
  assert.equal(s.pct, 100);
  assert.equal(s.isFull, true);
  assert.equal(s.remainingBytes, 0);
});

test('meter: the "getting close" state fires at 90%, not before', () => {
  const justUnder = makerMediaMeterState(MAKER_EVENT_MEDIA_BYTES_CAP * 0.89);
  const atNinety = makerMediaMeterState(MAKER_EVENT_MEDIA_BYTES_CAP * 0.9);
  assert.equal(justUnder.isNear, false);
  assert.equal(atNinety.isNear, true);
});

test('meter: a negative or non-finite reading degrades to zero, never NaN/negative', () => {
  const s1 = makerMediaMeterState(-500);
  const s2 = makerMediaMeterState(Number.NaN);
  assert.equal(s1.usedBytes, 0);
  assert.equal(s2.usedBytes, 0);
});

test('the label reads one decimal below 10 MB, whole numbers above it', () => {
  const small = makerMediaMeterState(2.4 * 1024 * 1024, 100 * 1024 * 1024);
  assert.equal(formatMakerMediaMeterLabel(small), '2.4 MB of 100 MB used');
  const large = makerMediaMeterState(12.4 * 1024 * 1024, 100 * 1024 * 1024);
  assert.equal(formatMakerMediaMeterLabel(large), '12 MB of 100 MB used');
});
