/**
 * SEC-6 — the Save-the-Date video gate, round three.
 *
 * Three rounds, one defect, three costumes:
 *
 *   • round one moved the verdict into a host-unwritable column and bound it to
 *     two R2 keys + fingerprints. The PRIVILEGE half held; the BINDING half fell
 *     to a decoy — the fingerprint described a real R2 object while the browser
 *     resolved the identical string to a foreign origin.
 *   • round two SEALED the classified bytes into an un-writable prefix and served
 *     only those. IDENTITY was fixed: the served object could no longer change.
 *   • round three is PROVENANCE, which neither earlier round touched. The screen
 *     classifies the POSTER — a JPEG the client uploads as an independent object
 *     with no derivation proof — and then approved the MP4 beside it. "Dirty
 *     video + clean unrelated poster" produced an approval that was bound,
 *     sealed, and completely wrong. Identity without provenance is a notarised
 *     signature on a blank page.
 *
 * This file is the regression suite for all three. Its centrepiece is
 * `stdVideoServeRefs` — the pure function that decides WHICH objects a guest may
 * be handed — and the rule it encodes:
 *
 *     An artifact may be served only if THAT ARTIFACT'S OWN BYTES were examined
 *     by an examiner competent to judge them. Anything else may only REJECT.
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
 *   • `COMPETENT_EXAMINERS.video` → add 'nsfwjs-image': the round-three cases go
 *     green while every round-one and round-two case still passes, which is
 *     precisely how round two shipped broken.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPETENT_EXAMINERS,
  NO_STD_NSFW_VERDICT,
  examinationAuthorises,
  resolveStdMedia,
  resolveStdNsfwVerdict,
  stdNsfwDisplayStatus,
  stdVerdictMatchesContent,
  stdVideoAwaitsReview,
  stdVideoIsLive,
  stdVideoNeedsGrandfatherHeal,
  stdVideoNeedsScreen,
  stdVideoServeRefs,
  verdictBindsMedia,
  verdictIsGrandfathered,
  verdictSealedRefs,
  type StdExaminer,
  type StdExamination,
  type StdMedia,
  type StdNsfwVerdict,
} from './std-media';
import { pathPrefixIsAcceptable, R2_SEALED_SEGMENT } from './r2-client-ref';

const EVENT = '00000000-0000-4000-8000-00000000e001';
const OTHER_EVENT = '00000000-0000-4000-8000-00000000e002';

const VIDEO = `r2://setnayan-media/events/${EVENT}/std-video/016d9fc1-clip.mp4`;
const POSTER = `r2://setnayan-media/events/${EVENT}/std-video-poster/3fc03b1b-poster.jpg`;
const SEALED_VIDEO = `r2://setnayan-media/events/${EVENT}/${R2_SEALED_SEGMENT}/a1b2/video-etagv-1048576`;
const SEALED_POSTER = `r2://setnayan-media/events/${EVENT}/${R2_SEALED_SEGMENT}/c3d4/poster-etagp-40960`;
const FP_VIDEO = 'etagv:1048576';
const FP_POSTER = 'etagp:40960';
const AT = '2026-07-26T00:00:00.000Z';

function videoMedia(over: Partial<StdMedia> = {}): StdMedia {
  return { type: 'video', videoKey: VIDEO, posterKey: POSTER, fit: 'fill', ...over };
}

function examined(ref: string, fingerprint: string, by: StdExaminer): StdExamination {
  return { ref, fingerprint, digest: null, by, at: AT };
}

/** The frozen CANDIDATE pair the screen produces before anyone examines it. */
const SEALED_PAIR = {
  videoRef: SEALED_VIDEO,
  videoFingerprint: FP_VIDEO,
  posterRef: SEALED_POSTER,
  posterFingerprint: FP_POSTER,
};

/**
 * A fully authorised verdict: sealed, poster examined by the classifier, video
 * examined by a human. The ONLY shape that may serve — every negative below is
 * exactly one mutation away from it.
 */
function approvedVerdict(over: Partial<StdNsfwVerdict> = {}): StdNsfwVerdict {
  return {
    status: 'approved',
    videoKey: VIDEO,
    posterKey: POSTER,
    videoFingerprint: FP_VIDEO,
    posterFingerprint: FP_POSTER,
    sealed: SEALED_PAIR,
    video: examined(SEALED_VIDEO, FP_VIDEO, 'human-review'),
    poster: examined(SEALED_POSTER, FP_POSTER, 'nsfwjs-image'),
    grandfathered: null,
    screenedAt: AT,
    attemptedAt: AT,
    ...over,
  };
}

/** Exactly what the automatic screen is now allowed to write on a clean poster. */
function inReviewVerdict(over: Partial<StdNsfwVerdict> = {}): StdNsfwVerdict {
  return approvedVerdict({ status: 'in_review', video: null, screenedAt: null, ...over });
}

/** The cale-ice carry-over, as the screen completes it. */
function grandfatheredVerdict(over: Partial<StdNsfwVerdict> = {}): StdNsfwVerdict {
  return approvedVerdict({
    video: examined(SEALED_VIDEO, FP_VIDEO, 'legacy-poster-screen'),
    grandfathered: { reason: 'pre-SEC-6 poster-only screen', at: AT },
    ...over,
  });
}

// ── 0. The positive control ─────────────────────────────────────────────────
// If this ever fails, every refusal below is meaningless.

test('POSITIVE CONTROL: a real approved+sealed+examined pair serves, and serves the SEAL', () => {
  const refs = stdVideoServeRefs(videoMedia(), approvedVerdict(), EVENT);
  assert.ok(refs, 'the legitimate case must serve, or the negatives prove nothing');
  assert.equal(refs.videoRef, SEALED_VIDEO);
  assert.equal(refs.posterRef, SEALED_POSTER);
  assert.notEqual(refs.videoRef, VIDEO, 'the guest must never be handed the couple’s own key');
  assert.equal(stdVideoIsLive(videoMedia(), approvedVerdict(), EVENT), true);
  assert.equal(stdNsfwDisplayStatus(videoMedia(), approvedVerdict(), EVENT), 'approved');
});

// ── R3. PROVENANCE — the round-three defect, and the shape of its fix ───────

test('R3 THE BYPASS: a clean poster does NOT authorise the video beside it', () => {
  // The literal attack: upload a dirty video, upload a clean UNRELATED JPEG as
  // its "poster". The classifier reads the JPEG, finds nothing, and — for two
  // rounds — published the MP4. There is now no value the poster screen can
  // write that authorises a video: its examiner is not competent for one.
  const posterOnly = approvedVerdict({
    video: examined(SEALED_VIDEO, FP_VIDEO, 'nsfwjs-image'),
  });
  assert.equal(
    stdVideoServeRefs(videoMedia(), posterOnly, EVENT),
    null,
    'an image classifier authorised a video — round three is not in force',
  );
  assert.equal(stdVideoIsLive(videoMedia(), posterOnly, EVENT), false);
  // POSITIVE TWIN — the same verdict with a competent examiner serves, so the
  // refusal above is about COMPETENCE and not about a malformed shape.
  assert.ok(stdVideoServeRefs(videoMedia(), approvedVerdict(), EVENT));
});

test('R3 the competence table says what it must, in both directions', () => {
  assert.equal(COMPETENT_EXAMINERS.video.has('nsfwjs-image'), false);
  assert.equal(COMPETENT_EXAMINERS.video.has('human-review'), true);
  // The poster IS itself served, and the classifier downloads exactly those
  // bytes, so for the poster the examined and the served object are one object.
  assert.equal(COMPETENT_EXAMINERS.poster.has('nsfwjs-image'), true);
  assert.equal(COMPETENT_EXAMINERS.poster.has('human-review'), true);
  // The cutover carry-over is NOT general competence for anything.
  assert.equal(COMPETENT_EXAMINERS.video.has('legacy-poster-screen'), false);
  assert.equal(COMPETENT_EXAMINERS.poster.has('legacy-poster-screen'), false);
});

test('R3 an artifact with NO examination is not "trusted less" — it cannot be served at all', () => {
  assert.equal(stdVideoServeRefs(videoMedia(), approvedVerdict({ video: null }), EVENT), null);
  assert.equal(stdVideoServeRefs(videoMedia(), approvedVerdict({ poster: null }), EVENT), null);
  assert.equal(
    stdVideoServeRefs(videoMedia(), approvedVerdict({ video: null, poster: null }), EVENT),
    null,
  );
});

test('R3 a clean poster parks the row at in_review, and nothing automatic can move it', () => {
  const v = inReviewVerdict();
  assert.equal(stdVideoServeRefs(videoMedia(), v, EVENT), null, 'in_review served a video');
  assert.equal(stdVideoIsLive(videoMedia(), v, EVENT), false);
  assert.equal(stdNsfwDisplayStatus(videoMedia(), v, EVENT), 'in_review');
  assert.equal(stdVideoAwaitsReview(v, EVENT), true);
  // Re-running the classifier would reach the same conclusion, so the screen
  // stands down and the row waits for a person.
  assert.equal(stdVideoNeedsScreen(videoMedia(), v, EVENT), false);
});

test('R3 an `approved` STATUS with no video examination is still just in_review', () => {
  // Defence against a partial write, a hand-edit or a future writer bug: the
  // status field is not the authority, the examinations are.
  const lying = approvedVerdict({ video: null });
  assert.equal(stdVideoServeRefs(videoMedia(), lying, EVENT), null);
  assert.equal(stdNsfwDisplayStatus(videoMedia(), lying, EVENT), 'in_review');
});

test('R3 examinationAuthorises rejects a malformed examination in every field', () => {
  assert.equal(examinationAuthorises(null, 'video', EVENT), false);
  assert.equal(
    examinationAuthorises(examined(VIDEO, FP_VIDEO, 'human-review'), 'video', EVENT),
    false,
    'an examination naming the couple’s MUTABLE upload key authorised a serve',
  );
  assert.equal(
    examinationAuthorises(examined(SEALED_VIDEO, '', 'human-review'), 'video', EVENT),
    false,
  );
  assert.equal(
    examinationAuthorises(examined(SEALED_VIDEO, FP_VIDEO, 'human-review'), 'video', OTHER_EVENT),
    false,
    'a seal minted for another event authorised this one',
  );
  // POSITIVE TWIN.
  assert.equal(
    examinationAuthorises(examined(SEALED_VIDEO, FP_VIDEO, 'human-review'), 'video', EVENT),
    true,
  );
});

test('R3 an unrecognised examiner resolves to NO examination, not an unknown-but-trusted one', () => {
  const v = resolveStdNsfwVerdict({
    status: 'approved',
    videoKey: VIDEO,
    posterKey: POSTER,
    sealed: SEALED_PAIR,
    video: { ref: SEALED_VIDEO, fingerprint: FP_VIDEO, by: 'vibes', at: AT },
    poster: { ref: SEALED_POSTER, fingerprint: FP_POSTER, by: 'nsfwjs-image', at: AT },
  });
  assert.equal(v.video, null);
  assert.equal(stdVideoServeRefs(videoMedia(), v, EVENT), null);
});

test('R3 a PRE-round-three verdict (servedVideoKey shape, no examiner) does not survive the upgrade', () => {
  // The old shape carried ONE status over two bare key strings and named nobody.
  // It must read as "never examined" rather than as a weaker approval.
  const legacyShape = resolveStdNsfwVerdict({
    status: 'approved',
    videoKey: VIDEO,
    posterKey: POSTER,
    videoFingerprint: FP_VIDEO,
    posterFingerprint: FP_POSTER,
    servedVideoKey: SEALED_VIDEO,
    servedPosterKey: SEALED_POSTER,
    screenedAt: AT,
  });
  assert.equal(legacyShape.video, null);
  assert.equal(legacyShape.poster, null);
  assert.equal(legacyShape.sealed, null);
  assert.equal(stdVideoServeRefs(videoMedia(), legacyShape, EVENT), null);
});

// ── GF. The one deliberate exception, and its fence ─────────────────────────

test('GF the carried-across row serves — a real couple’s live page did not go dark', () => {
  const refs = stdVideoServeRefs(videoMedia(), grandfatheredVerdict(), EVENT);
  assert.ok(refs, 'the cutover took a live public page down');
  assert.equal(refs.videoRef, SEALED_VIDEO, 'even grandfathered, the guest gets the SEAL');
  assert.equal(stdNsfwDisplayStatus(videoMedia(), grandfatheredVerdict(), EVENT), 'approved');
});

test('GF the legacy examiner authorises NOTHING without the service-role marker', () => {
  // THE FENCE. Same examination, marker removed → refused. If this ever passes,
  // `legacy-poster-screen` has become a general-purpose approval.
  const unmarked = grandfatheredVerdict({ grandfathered: null });
  assert.equal(
    stdVideoServeRefs(videoMedia(), unmarked, EVENT),
    null,
    'a legacy examination authorised a video on an UNMARKED row',
  );
  assert.equal(examinationAuthorises(unmarked.video, 'video', EVENT), false);
  // …and the unlock is opt-in: the default argument must never grant it.
  assert.equal(
    examinationAuthorises(unmarked.video, 'video', EVENT, { grandfathered: true }),
    true,
  );
});

test('GF the marker does not relax the POSTER, the seal prefix, or the binding', () => {
  // The exception is one role wide and no wider.
  assert.equal(
    stdVideoServeRefs(
      videoMedia(),
      grandfatheredVerdict({ poster: examined(SEALED_POSTER, FP_POSTER, 'legacy-poster-screen') }),
      EVENT,
    ),
    null,
    'the marker leaked into the poster role',
  );
  assert.equal(
    stdVideoServeRefs(
      videoMedia(),
      grandfatheredVerdict({ video: examined(VIDEO, FP_VIDEO, 'legacy-poster-screen') }),
      EVENT,
    ),
    null,
    'a grandfathered row served the couple’s MUTABLE upload key',
  );
  assert.equal(
    stdVideoServeRefs(
      videoMedia({ videoKey: `r2://setnayan-media/events/${EVENT}/std-video/swapped.mp4` }),
      grandfatheredVerdict(),
      EVENT,
    ),
    null,
    'a grandfathered approval survived a media swap',
  );
});

test('GF a grandfathered row stays VISIBLE to the operator, and heals itself first', () => {
  assert.equal(verdictIsGrandfathered(grandfatheredVerdict()), true);
  assert.equal(verdictIsGrandfathered(approvedVerdict()), false);

  // Exactly as the migration leaves it: marked and bound, but unsealed and
  // unexamined — so it does NOT serve, and it asks for one screen pass.
  const asMigrated = grandfatheredVerdict({
    videoFingerprint: null,
    posterFingerprint: null,
    sealed: null,
    video: null,
    poster: null,
    screenedAt: null,
    attemptedAt: null,
  });
  assert.equal(stdVideoServeRefs(videoMedia(), asMigrated, EVENT), null);
  assert.equal(stdVideoNeedsGrandfatherHeal(videoMedia(), asMigrated, EVENT), true);
  // Once it is serving the heal stops — this must not become a loop on a public
  // page that renders on every guest visit.
  assert.equal(stdVideoNeedsGrandfatherHeal(videoMedia(), grandfatheredVerdict(), EVENT), false);
  // …and it never fires for an ordinary row, marked or not.
  assert.equal(stdVideoNeedsGrandfatherHeal(videoMedia(), NO_STD_NSFW_VERDICT, EVENT), false);
  assert.equal(stdVideoNeedsGrandfatherHeal(videoMedia(), inReviewVerdict(), EVENT), false);
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
  const forged = approvedVerdict({
    videoKey: decoy,
    video: examined(decoy, FP_VIDEO, 'human-review'),
  });
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

test('D5 the store-what-was-stored allowance cannot launder a ref: the reader never consults it', () => {
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

test('D7/D10 an approved verdict with NO examined seal serves nothing', () => {
  // The round-two shift. Round one approved the couple's mutable upload key; a
  // re-PUT with the presigned URL they still hold then changed the bytes behind
  // an already-emitted URL. Without an examined seal there is nothing to serve,
  // so there is no window to race.
  assert.equal(stdVideoServeRefs(videoMedia(), approvedVerdict({ video: null }), EVENT), null);
  assert.equal(stdVideoServeRefs(videoMedia(), approvedVerdict({ poster: null }), EVENT), null);
});

test('D7 the examined object must live under THIS event’s reserved prefix', () => {
  for (const bad of [
    VIDEO, // the couple's own (mutable) upload key
    `r2://setnayan-media/events/${OTHER_EVENT}/${R2_SEALED_SEGMENT}/x/video-1`,
    `r2://setnayan-media/events/${EVENT}/std-video/pretending.mp4`,
    'http:evil.example/sealed.mp4',
    `r2://setnayan-media/events/${EVENT}/${R2_SEALED_SEGMENT}/`,
  ]) {
    assert.equal(
      stdVideoServeRefs(
        videoMedia(),
        approvedVerdict({ video: examined(bad, FP_VIDEO, 'human-review') }),
        EVENT,
      ),
      null,
      `${bad} was accepted as a seal`,
    );
  }
});

test('D7 one object may not serve as BOTH the sealed video and the sealed poster', () => {
  assert.equal(
    stdVideoServeRefs(
      videoMedia(),
      approvedVerdict({ poster: examined(SEALED_VIDEO, FP_VIDEO, 'nsfwjs-image') }),
      EVENT,
    ),
    null,
  );
  // …and the same rule one layer down, on the sealed candidate pair itself.
  assert.equal(
    resolveStdNsfwVerdict({ status: 'approved', sealed: { ...SEALED_PAIR, posterRef: SEALED_VIDEO } })
      .sealed,
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
        video: examined(
          `r2://setnayan-media/events/${OTHER_EVENT}/${R2_SEALED_SEGMENT}/x/video-1`,
          FP_VIDEO,
          'human-review',
        ),
      }),
      EVENT,
    ),
    null,
  );
});

// ── D14. Fail-closed must not also mean invisible ───────────────────────────

test('D14 an approved-but-unsealed verdict reads as pending and is re-screened', () => {
  const unsealed = approvedVerdict({
    sealed: null,
    video: null,
    poster: null,
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
  const t0 = Date.parse(AT);
  const pending = approvedVerdict({
    status: 'pending',
    sealed: null,
    video: null,
    poster: null,
    attemptedAt: AT,
  });
  assert.equal(stdVideoNeedsScreen(videoMedia(), pending, EVENT, t0 + 60_000), false);
  assert.equal(stdVideoNeedsScreen(videoMedia(), pending, EVENT, t0 + 11 * 60_000), true);
});

test('D14 an admin-prepared seal is not undone by the automatic screen', () => {
  // `sealStdVideoForReview` freezes bytes with NO examination so a human can
  // watch them. If the heal re-ran it would overwrite that preparation — and on
  // a false-positive rejection it would simply re-reject, forever.
  const prepared = inReviewVerdict({ poster: null });
  assert.equal(stdVideoNeedsScreen(videoMedia(), prepared, EVENT), false);
});

test('D14 the UNBOUND path is throttled too (the re-screen loop)', () => {
  // Round two throttled only BOUND verdicts, leaving the path an attacker
  // controls — PATCH std_media with a new poster, reload, repeat — with no floor
  // at all. 15s is invisible to a person and ruinous to a loop.
  const t0 = Date.parse(AT);
  const unbound = approvedVerdict({
    videoKey: `r2://setnayan-media/events/${EVENT}/std-video/different.mp4`,
    attemptedAt: AT,
  });
  assert.equal(verdictBindsMedia(videoMedia(), unbound), false);
  assert.equal(stdVideoNeedsScreen(videoMedia(), unbound, EVENT, t0 + 1_000), false);
  assert.equal(stdVideoNeedsScreen(videoMedia(), unbound, EVENT, t0 + 30_000), true);
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
    // Sealed but examined by nobody — the round-three shape that must not serve.
    { status: 'approved', videoKey: VIDEO, posterKey: POSTER, sealed: SEALED_PAIR },
  ]) {
    const v = resolveStdNsfwVerdict(raw);
    assert.equal(stdVideoServeRefs(videoMedia(), v, EVENT), null, `${JSON.stringify(raw)} served`);
  }
});

test('resolveStdNsfwVerdict coerces an unknown status to pending and keeps the parts typed', () => {
  const v = resolveStdNsfwVerdict({
    status: 'totally-fine',
    sealed: SEALED_PAIR,
    video: { ref: SEALED_VIDEO, fingerprint: FP_VIDEO, by: 'human-review', at: AT, digest: 'ab' },
    poster: { ref: SEALED_POSTER, fingerprint: '   ', by: 'nsfwjs-image', at: AT },
    grandfathered: { reason: '   ', at: AT },
  });
  assert.equal(v.status, 'pending');
  assert.deepEqual(v.sealed, SEALED_PAIR);
  assert.equal(v.video?.digest, 'ab');
  assert.equal(v.poster, null, 'a blank fingerprint is not a weaker examination, it is none');
  assert.equal(v.grandfathered, null, 'a half-marker is not a marker');
  // …and `in_review` must actually be recognised, not coerced away.
  assert.equal(resolveStdNsfwVerdict({ status: 'in_review' }).status, 'in_review');
});

test('verdictSealedRefs enumerates every object a verdict owns (takedown + erasure)', () => {
  assert.deepEqual(verdictSealedRefs(approvedVerdict()).sort(), [SEALED_POSTER, SEALED_VIDEO].sort());
  assert.deepEqual(verdictSealedRefs(NO_STD_NSFW_VERDICT), []);
  // An examination naming an object the sealed pair does not must still be owned,
  // or a re-seal strands the old copy in a public bucket forever.
  const stale = `r2://setnayan-media/events/${EVENT}/${R2_SEALED_SEGMENT}/e5f6/video-old`;
  assert.equal(
    verdictSealedRefs(approvedVerdict({ video: examined(stale, FP_VIDEO, 'human-review') })).includes(
      stale,
    ),
    true,
  );
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
  // …not even the grandfathered row. A rejection outranks the carry-over.
  assert.equal(
    stdVideoServeRefs(videoMedia(), grandfatheredVerdict({ status: 'rejected' }), EVENT),
    null,
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
