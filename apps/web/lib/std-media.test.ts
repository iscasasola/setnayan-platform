/**
 * SEC-6 — the BINDING half of the Save-the-Date NSFW gate.
 *
 * tests/db/std-media-nsfw-verdict.db.test.ts proves the host cannot WRITE the
 * verdict. That alone would not be a fix: a verdict that survives a change to
 * the media it judged is the actual defect, and the tempting "preserve the old
 * verdict on UPDATE" trigger makes it permanent. These tests pin the rule that
 * replaces that trigger — a verdict authorises exactly the bytes it judged, and
 * anything unresolvable denies.
 *
 * Pure functions only: no DB, no R2, no server context.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_STD_NSFW_VERDICT,
  STD_SCREEN_RETRY_MS,
  resolveStdMedia,
  resolveStdNsfwVerdict,
  stdNsfwDisplayStatus,
  stdVerdictMatchesContent,
  stdVideoIsLive,
  stdVideoNeedsScreen,
  verdictBindsMedia,
  type StdMedia,
  type StdNsfwVerdict,
} from './std-media';

const VIDEO = 'r2://setnayan-media/events/e1/std-video/clean.mp4';
const POSTER = 'r2://setnayan-media/events/e1/std-video-poster/poster.jpg';
const VIDEO_FP = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:1048576';
const POSTER_FP = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:81920';

const media = (over: Partial<StdMedia> = {}): StdMedia => ({
  type: 'video',
  videoKey: VIDEO,
  posterKey: POSTER,
  fit: 'fill',
  ...over,
});

const approved = (over: Partial<StdNsfwVerdict> = {}): StdNsfwVerdict => ({
  status: 'approved',
  videoKey: VIDEO,
  posterKey: POSTER,
  videoFingerprint: VIDEO_FP,
  posterFingerprint: POSTER_FP,
  screenedAt: '2026-07-26T00:00:00.000Z',
  attemptedAt: '2026-07-26T00:00:00.000Z',
  ...over,
});

const liveBytes = { video: VIDEO_FP, poster: POSTER_FP };

// ── 1. The forged verdict is not merely ignored — it is unrepresentable ─────

test('resolveStdMedia DROPS a client-supplied nsfw key', () => {
  // The exploit payload, verbatim: a PostgREST PATCH of the host-writable blob.
  const parsed = resolveStdMedia({
    type: 'video',
    videoKey: VIDEO,
    posterKey: POSTER,
    nsfw: 'approved',
  });
  assert.equal(
    (parsed as Record<string, unknown>).nsfw,
    undefined,
    'the forged verdict survived parsing — something downstream could still read it',
  );
  // …and the media itself is preserved, so the couple's choice still works.
  assert.equal(parsed.type, 'video');
  assert.equal(parsed.videoKey, VIDEO);
  assert.equal(parsed.posterKey, POSTER);
});

test('a forged in-blob verdict cannot make a video live', () => {
  const forged = resolveStdMedia({ type: 'video', videoKey: VIDEO, posterKey: POSTER, nsfw: 'approved' });
  assert.equal(stdVideoIsLive(forged, NO_STD_NSFW_VERDICT), false);
});

// ── 2. Fail closed on anything unresolvable ─────────────────────────────────

test('resolveStdNsfwVerdict fails CLOSED on absent / junk input', () => {
  for (const raw of [null, undefined, 0, '', 'approved', [], { status: 'yes' }, { nope: 1 }]) {
    const v = resolveStdNsfwVerdict(raw);
    assert.notEqual(v.status, 'approved', `junk input resolved to approved: ${JSON.stringify(raw)}`);
    assert.equal(stdVideoIsLive(media(), v), false);
  }
});

test('an approved verdict with NO fingerprints is not live', () => {
  // Nothing downstream could re-verify the bytes, so it must not be trusted.
  assert.equal(stdVideoIsLive(media(), approved({ videoFingerprint: null })), false);
  assert.equal(stdVideoIsLive(media(), approved({ posterFingerprint: null })), false);
});

test('gallery media is never live, whatever the verdict says', () => {
  assert.equal(stdVideoIsLive({ type: 'gallery' }, approved()), false);
});

test('a video with no poster is never live — nothing was screenable', () => {
  assert.equal(stdVideoIsLive(media({ posterKey: null }), approved({ posterKey: null })), false);
});

// ── 3. THE BINDING — a swap invalidates, it does not inherit ────────────────

test('swapping the VIDEO key invalidates the approval', () => {
  const swapped = media({ videoKey: 'r2://setnayan-media/events/e1/std-video/dirty.mp4' });
  assert.equal(verdictBindsMedia(swapped, approved()), false);
  assert.equal(
    stdVideoIsLive(swapped, approved()),
    false,
    'the previous approval carried over to a different video — this is the pinned-verdict bug',
  );
});

test('swapping the POSTER key invalidates the approval', () => {
  // The poster is the screening proxy AND it renders publicly in "fit" mode, so
  // an unscreened poster is its own exposure.
  const swapped = media({ posterKey: 'r2://setnayan-media/events/e1/std-video-poster/other.jpg' });
  assert.equal(stdVideoIsLive(swapped, approved()), false);
});

test('a verdict for someone else’s media never binds', () => {
  const other = approved({
    videoKey: 'r2://setnayan-media/events/e2/std-video/theirs.mp4',
    posterKey: 'r2://setnayan-media/events/e2/std-video-poster/theirs.jpg',
  });
  assert.equal(stdVideoIsLive(media(), other), false);
});

test('the happy path still works — a bound, approved, fingerprinted verdict is live', () => {
  assert.equal(verdictBindsMedia(media(), approved()), true);
  assert.equal(stdVideoIsLive(media(), approved()), true);
  assert.equal(stdVerdictMatchesContent(approved(), liveBytes), true);
});

test('rejected and pending never go live even when perfectly bound', () => {
  assert.equal(stdVideoIsLive(media(), approved({ status: 'rejected' })), false);
  assert.equal(stdVideoIsLive(media(), approved({ status: 'pending' })), false);
});

// ── 4. Content identity — the same key with different bytes ─────────────────

test('re-PUTting different BYTES to the same key breaks the content check', () => {
  // The attack key identity alone cannot see: /api/upload's presigned PUT is
  // valid for 5 minutes and the screen lands in seconds, so the host can swap
  // the object under an approved key without changing anything in the row.
  assert.equal(
    stdVerdictMatchesContent(approved(), { video: 'cccccccc:2097152', poster: POSTER_FP }),
    false,
    'a swapped video body still matched its verdict',
  );
  assert.equal(
    stdVerdictMatchesContent(approved(), { video: VIDEO_FP, poster: 'dddddddd:4096' }),
    false,
    'a swapped poster body still matched its verdict',
  );
});

test('an unreadable object is a MISMATCH, never a pass', () => {
  // r2ContentFingerprint returns null for a missing object, a 403, a HEAD with
  // no ETag, an unknown bucket, R2 unconfigured — every one of those must deny.
  assert.equal(stdVerdictMatchesContent(approved(), { video: null, poster: POSTER_FP }), false);
  assert.equal(stdVerdictMatchesContent(approved(), { video: VIDEO_FP, poster: null }), false);
  assert.equal(stdVerdictMatchesContent(approved(), { video: null, poster: null }), false);
});

test('a verdict that stored no fingerprints can never match live content', () => {
  const noFp = approved({ videoFingerprint: null, posterFingerprint: null });
  assert.equal(stdVerdictMatchesContent(noFp, liveBytes), false);
});

// ── 5. What the couple is told ──────────────────────────────────────────────

test('an unbound verdict reads as "pending" to the couple, not as its old status', () => {
  const swapped = media({ videoKey: 'r2://setnayan-media/events/e1/std-video/new.mp4' });
  assert.equal(stdNsfwDisplayStatus(swapped, approved()), 'pending');
  assert.equal(stdNsfwDisplayStatus(swapped, approved({ status: 'rejected' })), 'pending');
  assert.equal(stdNsfwDisplayStatus(media(), approved()), 'approved');
  assert.equal(stdNsfwDisplayStatus(media(), approved({ status: 'rejected' })), 'rejected');
});

// ── 6. The heal predicate ───────────────────────────────────────────────────

test('a never-screened video needs a screen; a decided one does not', () => {
  assert.equal(stdVideoNeedsScreen(media(), NO_STD_NSFW_VERDICT), true);
  assert.equal(stdVideoNeedsScreen(media(), approved()), false);
  assert.equal(stdVideoNeedsScreen(media(), approved({ status: 'rejected' })), false);
});

test('swapped media needs a screen again even though a decision exists', () => {
  const swapped = media({ videoKey: 'r2://setnayan-media/events/e1/std-video/new.mp4' });
  assert.equal(stdVideoNeedsScreen(swapped, approved()), true);
});

test('a recent failed attempt is throttled; an old one is retried', () => {
  const now = Date.parse('2026-07-26T12:00:00.000Z');
  const recent = approved({
    status: 'pending',
    videoFingerprint: null,
    posterFingerprint: null,
    screenedAt: null,
    attemptedAt: new Date(now - 60_000).toISOString(),
  });
  assert.equal(stdVideoNeedsScreen(media(), recent, now), false, 'the model would reload on every render');

  const stale = approved({
    status: 'pending',
    videoFingerprint: null,
    posterFingerprint: null,
    screenedAt: null,
    attemptedAt: new Date(now - STD_SCREEN_RETRY_MS - 1000).toISOString(),
  });
  assert.equal(stdVideoNeedsScreen(media(), stale, now), true, 'a dropped screen would never heal');
});

test('media that cannot be screened is never queued for screening', () => {
  assert.equal(stdVideoNeedsScreen({ type: 'gallery' }, NO_STD_NSFW_VERDICT), false);
  assert.equal(stdVideoNeedsScreen(media({ posterKey: null }), NO_STD_NSFW_VERDICT), false);
});
