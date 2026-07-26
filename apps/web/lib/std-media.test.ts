/**
 * SEC-6 — the Save-the-Date video gate, round two.
 *
 * Round one moved the verdict into a host-unwritable column and bound it to two
 * R2 keys + their content fingerprints. An adversary could not move the
 * PRIVILEGE half, and broke the BINDING half in one line: the fingerprint was
 * computed against a DIFFERENT RESOURCE than the one the browser fetched, so a
 * real `approved` verdict for a decoy object shipped arbitrary unscreened video.
 *
 * This file is the regression suite for that. Its centrepiece is
 * `stdVideoServeRefs` — the pure function that decides WHICH objects a guest may
 * be handed — and the rule it encodes:
 *
 *     the only thing that can be served is a SEALED object,
 *     and a sealed object is one the screen wrote after classifying its bytes.
 *
 * ── HOW THESE TESTS AVOID BEING VACUOUS ─────────────────────────────────────
 * Every negative case has a POSITIVE TWIN built from the same builders with one
 * field changed, so a test can only pass by discriminating. `approvedVerdict()`
 * and `videoMedia()` produce a genuinely servable pair; each attack mutates
 * exactly one thing and asserts the refusal. Degenerate the gate to `return
 * true` and the twins fail; to `return false` and the positives fail.
 *
 * NEUTRALISATION (re-run before trusting this file — counts are in the PR body):
 *   • `resolveStdMedia` → drop the parseClientRef checks, accept any string:
 *     the decoy / foreign-bucket / cross-event / role-swap cases go green.
 *   • `stdVideoServeRefs` → return the SOURCE keys instead of the sealed ones:
 *     the sealing cases go green while the privilege cases still pass, which is
 *     precisely how round one shipped broken.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NO_STD_NSFW_VERDICT,
  resolveStdMedia,
  resolveStdNsfwVerdict,
  stdNsfwDisplayStatus,
  stdVerdictMatchesContent,
  stdVideoIsLive,
  stdVideoNeedsScreen,
  stdVideoServeRefs,
  verdictBindsMedia,
  type StdMedia,
  type StdNsfwVerdict,
} from './std-media';
import { pathPrefixIsAcceptable, R2_SEALED_SEGMENT } from './r2-client-ref';

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';
const OTHER_EVENT = '947e7bab-893d-454d-b4c5-0a6e23f36009';

const VIDEO = `r2://setnayan-media/events/${EVENT}/std-video/016d9fc1-clip.mp4`;
const POSTER = `r2://setnayan-media/events/${EVENT}/std-video-poster/3fc03b1b-poster.jpg`;
const SEALED_VIDEO = `r2://setnayan-media/events/${EVENT}/${R2_SEALED_SEGMENT}/a1b2/video-etagv-1048576`;
const SEALED_POSTER = `r2://setnayan-media/events/${EVENT}/${R2_SEALED_SEGMENT}/c3d4/poster-etagp-40960`;
const FP_VIDEO = 'etagv:1048576';
const FP_POSTER = 'etagp:40960';

function videoMedia(over: Partial<StdMedia> = {}): StdMedia {
  return { type: 'video', videoKey: VIDEO, posterKey: POSTER, fit: 'fill', ...over };
}

function approvedVerdict(over: Partial<StdNsfwVerdict> = {}): StdNsfwVerdict {
  return {
    status: 'approved',
    videoKey: VIDEO,
    posterKey: POSTER,
    videoFingerprint: FP_VIDEO,
    posterFingerprint: FP_POSTER,
    servedVideoKey: SEALED_VIDEO,
    servedPosterKey: SEALED_POSTER,
    screenedAt: '2026-07-26T00:00:00.000Z',
    attemptedAt: '2026-07-26T00:00:00.000Z',
    ...over,
  };
}

// ── 0. The positive control ─────────────────────────────────────────────────
// If this ever fails, every refusal below is meaningless.

test('POSITIVE CONTROL: a real approved+sealed pair serves, and serves the SEAL', () => {
  const refs = stdVideoServeRefs(videoMedia(), approvedVerdict(), EVENT);
  assert.ok(refs, 'the legitimate case must serve, or the negatives prove nothing');
  assert.equal(refs.videoRef, SEALED_VIDEO);
  assert.equal(refs.posterRef, SEALED_POSTER);
  assert.notEqual(refs.videoRef, VIDEO, 'the guest must never be handed the couple’s own key');
  assert.equal(stdVideoIsLive(videoMedia(), approvedVerdict(), EVENT), true);
  assert.equal(stdNsfwDisplayStatus(videoMedia(), approvedVerdict(), EVENT), 'approved');
});

// ── D1. THE DECOY ATTACK — the exact bypass the adversary shipped ───────────

test('D1 DECOY ATTACK: a URL-shaped R2 key is not a video, so it cannot be screened or served', () => {
  // The adversary's steps 1–4, verbatim in shape: POST /api/upload with
  // pathPrefix "http://evil.example/v" minted a REAL object at the key below
  // ("//" collapsed to "/"), which the old verify side HEADed successfully as
  // setnayan-media/<that key> and the old serve side returned verbatim into
  // <video src>, where the browser resolved it to http://evil.example/….
  const decoy = 'http:/evil.example/v/016d9fc1-clip.mp4';
  const media = resolveStdMedia(
    { type: 'video', videoKey: decoy, posterKey: POSTER },
    EVENT,
  );
  assert.equal(media.type, 'gallery', 'the decoy must not resolve to a video at all');

  // …and even handed a genuine `approved` verdict naming that decoy — which the
  // old code would happily have produced — nothing is servable.
  const forged = approvedVerdict({ videoKey: decoy, servedVideoKey: decoy });
  assert.equal(stdVideoServeRefs(media, forged, EVENT), null);
  assert.equal(stdVideoIsLive(media, forged, EVENT), false);
});

test('D1 DECOY ATTACK: the shorter single-segment variant is refused too', () => {
  // `http:evil.example/x.mp4` needs no slash-collapse trick — it is ONE path
  // segment, so sanitizePathPrefix passed it through untouched, and
  // new URL(s, 'https://www.setnayan.com/slug') still resolves it off-origin.
  for (const decoy of [
    'http:evil.example/x.mp4',
    'https:/evil.example/x.mp4',
    '//evil.example/x.mp4',
    'data:video/mp4;base64,AAAA',
    'blob:https://www.setnayan.com/1234',
    '/absolute/path.mp4',
    `events/${EVENT}/std-video/bare-key-no-scheme.mp4`,
  ]) {
    assert.equal(
      resolveStdMedia({ type: 'video', videoKey: decoy, posterKey: POSTER }, EVENT).type,
      'gallery',
      `${decoy} resolved to a video`,
    );
  }
});

test('D1/D3 the decoy is no longer even mintable: /api/upload refuses a URL-shaped prefix', () => {
  // sanitizePathPrefix("http://evil.example/v") → "http:/evil.example/v"
  assert.equal(pathPrefixIsAcceptable('http:/evil.example/v'), false);
  assert.equal(pathPrefixIsAcceptable('http:evil.example'), false);
  assert.equal(pathPrefixIsAcceptable(`events/${EVENT}/std-video`), true);
});

// ── D1b. The other downgrade mouth: an r2:// ref with an unknown bucket ─────

test('D1b an r2:// ref naming an unknown bucket is refused, not downgraded to a URL', () => {
  const bogus = `r2://setnayan-bogus/events/${EVENT}/std-video/x.mp4`;
  assert.equal(
    resolveStdMedia({ type: 'video', videoKey: bogus, posterKey: POSTER }, EVENT).type,
    'gallery',
  );
});

test('D1b a PRIVATE bucket cannot stand in for the media bucket', () => {
  for (const b of [
    'setnayan-thread-files',
    'setnayan-vendor-contracts',
    'setnayan-vendor-verification',
    'setnayan-samples',
  ]) {
    const ref = `r2://${b}/events/${EVENT}/std-video/x.mp4`;
    assert.equal(
      resolveStdMedia({ type: 'video', videoKey: ref, posterKey: POSTER }, EVENT).type,
      'gallery',
      `${b} was accepted`,
    );
  }
});

// ── D2. resolveStdMedia imposes a format, and the format is the tenancy ─────

test('D2 resolveStdMedia accepts ONLY this event’s own std-video upload', () => {
  assert.equal(
    resolveStdMedia({ type: 'video', videoKey: VIDEO, posterKey: POSTER }, EVENT).type,
    'video',
  );
  // Traversal, control characters, over-long keys — all handled by parseClientRef.
  for (const bad of [
    `r2://setnayan-media/events/${EVENT}/std-video/../../other/x.mp4`,
    `r2://setnayan-media/events/${EVENT}/std-video/`,
    `r2://setnayan-media/events/${EVENT}/std-video/x .mp4`,
    `r2://setnayan-media/events/${EVENT}-suffix/std-video/x.mp4`,
    'r2://setnayan-media/',
    'r2://',
    '',
  ]) {
    assert.equal(
      resolveStdMedia({ type: 'video', videoKey: bad, posterKey: POSTER }, EVENT).type,
      'gallery',
      `${JSON.stringify(bad)} was accepted`,
    );
  }
});

test('D2 a missing eventId resolves to gallery rather than to an unscoped video', () => {
  assert.equal(
    resolveStdMedia({ type: 'video', videoKey: VIDEO, posterKey: POSTER }, '').type,
    'gallery',
  );
});

test('D2 role confusion: a poster ref may not be the videoKey, nor a video ref the poster', () => {
  assert.equal(
    resolveStdMedia({ type: 'video', videoKey: POSTER, posterKey: POSTER }, EVENT).type,
    'gallery',
    'a poster object was accepted as the video',
  );
  // A video ref in the poster slot is dropped (poster → null), which then fails
  // the gate because a video with no poster was never screenable.
  const m = resolveStdMedia({ type: 'video', videoKey: VIDEO, posterKey: VIDEO }, EVENT);
  assert.equal(m.posterKey, null);
  assert.equal(stdVideoServeRefs(m, approvedVerdict({ posterKey: VIDEO }), EVENT), null);
});

test('D2 resolveStdMedia DROPS a client-supplied nsfw key (unrepresentable, not ignored)', () => {
  const m = resolveStdMedia(
    { type: 'video', videoKey: VIDEO, posterKey: POSTER, nsfw: 'approved' },
    EVENT,
  ) as Record<string, unknown>;
  assert.equal('nsfw' in m, false);
});

// ── D4 / D5. A PostgREST-seeded ref never becomes servable ──────────────────

test('D4 a hostile ref PATCHed straight into std_media is inert on every read path', () => {
  // The write action is NOT on the attack path: std_media is host-writable by
  // design, so the attacker skips saveAllStdContent entirely. Every reader must
  // therefore refuse on its own. Here is that row, read three ways.
  const row = { type: 'video', videoKey: 'http:evil.example/x.mp4', posterKey: POSTER };
  const media = resolveStdMedia(row, EVENT);
  assert.equal(media.type, 'gallery');
  assert.equal(
    stdVideoNeedsScreen(media, NO_STD_NSFW_VERDICT, EVENT),
    false,
    'the screen must not run on it',
  );
  assert.equal(stdNsfwDisplayStatus(media, approvedVerdict(), EVENT), 'pending');
  assert.equal(stdVideoServeRefs(media, approvedVerdict(), EVENT), null);
});

test('D5 the grandfather clause cannot launder a ref: the reader never consults it', () => {
  // On main the write action accepts a ref that equals what is ALREADY stored.
  // Even if that lets a hostile ref be re-persisted, the read path applies the
  // format rule to whatever it finds — being previously stored buys nothing.
  const stored = { type: 'video', videoKey: 'http:evil.example/x.mp4', posterKey: POSTER };
  assert.equal(resolveStdMedia(stored, EVENT).type, 'gallery');
});

// ── D6. The classifier's blind spot, narrowed to what CAN be enforced ───────

test('D6 the poster must be this event’s own std-video-poster object', () => {
  // We cannot prove the poster came from the video (see the PR body) — but it
  // can be pinned to this event's poster prefix, which removes "any clean JPEG
  // from anywhere", cross-event posters, and poster/background confusion.
  for (const bad of [
    `r2://setnayan-media/events/${OTHER_EVENT}/std-video-poster/x.jpg`,
    `r2://setnayan-media/events/${EVENT}/std-background/x.jpg`,
    'r2://setnayan-media/vendors/v1/logo/x.jpg',
    'https://evil.example/cat.jpg',
  ]) {
    const m = resolveStdMedia({ type: 'video', videoKey: VIDEO, posterKey: bad }, EVENT);
    assert.equal(m.posterKey, null, `${bad} was accepted as a poster`);
    assert.equal(stdVideoServeRefs(m, approvedVerdict({ posterKey: bad }), EVENT), null);
  }
});

// ── D7 / D8 / D9 / D10. Check-then-serve, TTL, ISR, presigned-PUT replay ────

test('D7/D10 an approved verdict with NO seal serves nothing', () => {
  // This is the whole round-two shift. Round one approved the couple's mutable
  // upload key; a re-PUT with the presigned URL they still hold then changed the
  // bytes behind an already-emitted URL. Without a seal there is nothing to
  // serve, so there is no window to race.
  assert.equal(
    stdVideoServeRefs(videoMedia(), approvedVerdict({ servedVideoKey: null }), EVENT),
    null,
  );
  assert.equal(
    stdVideoServeRefs(videoMedia(), approvedVerdict({ servedPosterKey: null }), EVENT),
    null,
  );
});

test('D7 the seal must live under THIS event’s reserved prefix', () => {
  for (const bad of [
    VIDEO, // the couple's own (mutable) upload key
    `r2://setnayan-media/events/${OTHER_EVENT}/${R2_SEALED_SEGMENT}/x/video-1`,
    `r2://setnayan-media/events/${EVENT}/std-video/pretending.mp4`,
    'http:evil.example/sealed.mp4',
    `r2://setnayan-media/events/${EVENT}/${R2_SEALED_SEGMENT}/`,
  ]) {
    assert.equal(
      stdVideoServeRefs(videoMedia(), approvedVerdict({ servedVideoKey: bad }), EVENT),
      null,
      `${bad} was accepted as a seal`,
    );
  }
});

test('D7 one object may not serve as BOTH the sealed video and the sealed poster', () => {
  assert.equal(
    stdVideoServeRefs(videoMedia(), approvedVerdict({ servedPosterKey: SEALED_VIDEO }), EVENT),
    null,
  );
});

test('D8/D9 a live fingerprint mismatch on the SEALED object refuses the serve', () => {
  const refs = stdVideoServeRefs(videoMedia(), approvedVerdict(), EVENT);
  assert.ok(refs);
  assert.equal(stdVerdictMatchesContent(refs, { video: FP_VIDEO, poster: FP_POSTER }), true);
  assert.equal(stdVerdictMatchesContent(refs, { video: 'other:1', poster: FP_POSTER }), false);
  assert.equal(stdVerdictMatchesContent(refs, { video: FP_VIDEO, poster: 'other:1' }), false);
  assert.equal(stdVerdictMatchesContent(refs, { video: null, poster: FP_POSTER }), false);
  assert.equal(stdVerdictMatchesContent(refs, { video: FP_VIDEO, poster: null }), false);
  assert.equal(stdVerdictMatchesContent(refs, { video: null, poster: null }), false);
});

// ── D12. Cross-tenant media adoption ────────────────────────────────────────

test('D12 a host cannot point their own row at another couple’s objects', () => {
  const foreign = `r2://setnayan-media/events/${OTHER_EVENT}/std-video/theirs.mp4`;
  const foreignPoster = `r2://setnayan-media/events/${OTHER_EVENT}/std-video-poster/theirs.jpg`;
  assert.equal(
    resolveStdMedia({ type: 'video', videoKey: foreign, posterKey: foreignPoster }, EVENT).type,
    'gallery',
  );
  // …and the same row IS a video for its rightful owner, so the refusal above is
  // about tenancy, not about the ref being malformed.
  assert.equal(
    resolveStdMedia({ type: 'video', videoKey: foreign, posterKey: foreignPoster }, OTHER_EVENT)
      .type,
    'video',
  );
});

test('D12 a seal minted for another event is refused', () => {
  assert.equal(
    stdVideoServeRefs(
      videoMedia(),
      approvedVerdict({
        servedVideoKey: `r2://setnayan-media/events/${OTHER_EVENT}/${R2_SEALED_SEGMENT}/x/video-1`,
      }),
      EVENT,
    ),
    null,
  );
});

// ── D14. Fail-closed must not also mean invisible ───────────────────────────

test('D14 an approved-but-unsealed verdict reads as pending and is re-screened', () => {
  const unsealed = approvedVerdict({
    servedVideoKey: null,
    servedPosterKey: null,
    attemptedAt: null,
  });
  assert.equal(stdNsfwDisplayStatus(videoMedia(), unsealed, EVENT), 'pending');
  assert.equal(stdVideoNeedsScreen(videoMedia(), unsealed, EVENT), true);
});

test('D14 a decided verdict is NOT re-screened (the throttle still works)', () => {
  assert.equal(stdVideoNeedsScreen(videoMedia(), approvedVerdict(), EVENT), false);
  assert.equal(
    stdVideoNeedsScreen(videoMedia(), approvedVerdict({ status: 'rejected' }), EVENT),
    false,
  );
  // Pending + a recent attempt → throttled; pending + an old attempt → retried.
  const t0 = Date.parse('2026-07-26T00:00:00.000Z');
  const pending = approvedVerdict({
    status: 'pending',
    servedVideoKey: null,
    servedPosterKey: null,
    attemptedAt: '2026-07-26T00:00:00.000Z',
  });
  assert.equal(stdVideoNeedsScreen(videoMedia(), pending, EVENT, t0 + 60_000), false);
  assert.equal(stdVideoNeedsScreen(videoMedia(), pending, EVENT, t0 + 11 * 60_000), true);
});

// ── D15. The fit-mode poster goes through the same gate ─────────────────────

test('D15 the poster served in fit mode is the SEALED poster, not the couple’s', () => {
  const refs = stdVideoServeRefs(videoMedia({ fit: 'fit' }), approvedVerdict(), EVENT);
  assert.ok(refs);
  assert.equal(refs.posterRef, SEALED_POSTER);
  assert.notEqual(refs.posterRef, POSTER);
});

// ── The privilege half — kept from round one, must not regress ──────────────

test('a forged verdict object is fail-closed in every shape', () => {
  for (const raw of [
    null,
    undefined,
    0,
    '',
    'approved',
    [],
    { status: 'yes' },
    { status: 'approved' },
    { status: 'approved', videoKey: VIDEO },
    { status: 'approved', videoKey: VIDEO, posterKey: POSTER },
    { status: 'approved', videoKey: VIDEO, posterKey: POSTER, videoFingerprint: FP_VIDEO },
  ]) {
    const v = resolveStdNsfwVerdict(raw);
    assert.equal(stdVideoServeRefs(videoMedia(), v, EVENT), null, `${JSON.stringify(raw)} served`);
  }
});

test('resolveStdNsfwVerdict coerces an unknown status to pending and keeps the seals typed', () => {
  const v = resolveStdNsfwVerdict({
    status: 'totally-fine',
    servedVideoKey: SEALED_VIDEO,
    servedPosterKey: '   ',
  });
  assert.equal(v.status, 'pending');
  assert.equal(v.servedVideoKey, SEALED_VIDEO);
  assert.equal(v.servedPosterKey, null);
});

test('a verdict naming other media does not bind', () => {
  const other = `r2://setnayan-media/events/${EVENT}/std-video/replaced.mp4`;
  assert.equal(verdictBindsMedia(videoMedia(), approvedVerdict()), true);
  assert.equal(verdictBindsMedia(videoMedia({ videoKey: other }), approvedVerdict()), false);
  assert.equal(stdVideoServeRefs(videoMedia({ videoKey: other }), approvedVerdict(), EVENT), null);
});

test('gallery media never serves, whatever the verdict says', () => {
  const gallery: StdMedia = { type: 'gallery' };
  assert.equal(stdVideoServeRefs(gallery, approvedVerdict(), EVENT), null);
  assert.equal(verdictBindsMedia(gallery, approvedVerdict()), false);
  assert.equal(stdVideoNeedsScreen(gallery, NO_STD_NSFW_VERDICT, EVENT), false);
});

test('a rejected verdict never serves', () => {
  assert.equal(
    stdVideoServeRefs(videoMedia(), approvedVerdict({ status: 'rejected' }), EVENT),
    null,
  );
  assert.equal(
    stdNsfwDisplayStatus(videoMedia(), approvedVerdict({ status: 'rejected' }), EVENT),
    'rejected',
  );
});

test('a fit-only edit preserves the binding (no needless re-screen)', () => {
  assert.equal(stdVideoIsLive(videoMedia({ fit: 'fit' }), approvedVerdict(), EVENT), true);
  assert.equal(stdVideoNeedsScreen(videoMedia({ fit: 'fit' }), approvedVerdict(), EVENT), false);
});

test('a genuine re-upload invalidates and re-screens', () => {
  const next = videoMedia({
    videoKey: `r2://setnayan-media/events/${EVENT}/std-video/second-take.mp4`,
  });
  assert.equal(stdVideoServeRefs(next, approvedVerdict(), EVENT), null);
  assert.equal(stdVideoNeedsScreen(next, approvedVerdict(), EVENT), true);
});

// ── The reserved-prefix guard that makes "immutable" true ───────────────────

test('D3 the sealed segment is unreachable from /api/upload, for every branch', () => {
  assert.equal(pathPrefixIsAcceptable(`events/${EVENT}/${R2_SEALED_SEGMENT}`), false);
  assert.equal(pathPrefixIsAcceptable(`events/${EVENT}/${R2_SEALED_SEGMENT}/a1b2`), false);
  assert.equal(pathPrefixIsAcceptable(R2_SEALED_SEGMENT), false);
  assert.equal(pathPrefixIsAcceptable(`papic/${R2_SEALED_SEGMENT}/x`), false);
  assert.equal(pathPrefixIsAcceptable(''), false);
  // …while every prefix the product actually uses still passes.
  for (const ok of [
    `events/${EVENT}/std-video`,
    `events/${EVENT}/std-video-poster`,
    `events/${EVENT}/std-background`,
    `events/${EVENT}/guest-selfies/g1`,
    'vendors/v1/logo',
    'patiktok/clips/e1',
    `papic/event-${EVENT}/seat-1`,
    'editorial-vendor',
  ]) {
    assert.equal(pathPrefixIsAcceptable(ok), true, `${ok} was refused`);
  }
});
