import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmedDriveKeys,
  isDriveCopyConfirmed,
  isDriveDeferred,
  isEligibleForDrop,
  clipEligibleForDrop,
  clipWebCopyCustodyOk,
  resolveOriginalRef,
  DEFAULT_FULL_RES_RETENTION_DAYS,
  CLIP_WEB_DROP_GRACE_DAYS,
  CLIP_WEB_MIN_BYTES,
  type ClipDropCandidate,
  type DriveArtifactRow,
  type DropCandidate,
} from './papic-fullres-drop-core';
import { resolvePlayRef, resolveStillRef } from './papic-display-ref';
import type { R2HeadResult } from './r2';

// This is DESTRUCTIVE logic (it decides which R2 originals get deleted), so the
// guards get a dense test — a wrong `true` deletes a photo that shouldn't be.

const NOW = Date.parse('2026-07-11T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const OPTS = { retentionDays: DEFAULT_FULL_RES_RETENTION_DAYS, nowMs: NOW };

function row(over: Partial<DropCandidate> = {}): DropCandidate {
  return {
    r2_object_key: 'event-abc/papic/seat-1/photo.jpg',
    display_r2_key: 'r2://setnayan-media/derivatives/event-abc/…display.avif',
    captured_at: daysAgo(120),
    full_res_dropped_at: null,
    ...over,
  };
}

test('eligible: old photo, has web copy, not dropped, real key', () => {
  assert.equal(isEligibleForDrop(row(), OPTS), true);
});

test('NOT eligible: younger than the window', () => {
  assert.equal(isEligibleForDrop(row({ captured_at: daysAgo(30) }), OPTS), false);
  // exactly at the boundary is eligible (>=)
  assert.equal(isEligibleForDrop(row({ captured_at: daysAgo(90) }), OPTS), true);
});

test('NOT eligible: no web copy (would LOSE the photo)', () => {
  assert.equal(isEligibleForDrop(row({ display_r2_key: null }), OPTS), false);
});

test('NOT eligible: already dropped (idempotent)', () => {
  assert.equal(
    isEligibleForDrop(row({ full_res_dropped_at: daysAgo(1) }), OPTS),
    false,
  );
});

test('NOT eligible: a sample/ seed key is never touched', () => {
  assert.equal(
    isEligibleForDrop(row({ r2_object_key: 'sample/papic/maria-jose/01.jpg' }), OPTS),
    false,
  );
});

test('NOT eligible: unparseable captured_at', () => {
  assert.equal(isEligibleForDrop(row({ captured_at: 'not-a-date' }), OPTS), false);
});

// ── resolveOriginalRef ───────────────────────────────────────────────────────

test('raw key → media bucket', () => {
  assert.deepEqual(resolveOriginalRef('event-abc/papic/x.jpg'), {
    bucket: 'setnayan-media',
    key: 'event-abc/papic/x.jpg',
  });
});

test('r2:// ref → its own known bucket', () => {
  assert.deepEqual(resolveOriginalRef('r2://setnayan-media/a/b.jpg'), {
    bucket: 'setnayan-media',
    key: 'a/b.jpg',
  });
});

test('r2:// ref with an UNKNOWN bucket → null (never delete blindly)', () => {
  assert.equal(resolveOriginalRef('r2://some-other-bucket/a.jpg'), null);
  assert.equal(resolveOriginalRef('r2://'), null);
  assert.equal(resolveOriginalRef(''), null);
});

// ── Drive-aware defer guard (Build Brief ruling #4) ──────────────────────────
// The single most dangerous branch in this module: a wrong `false` here deletes
// the ONLY full-res copy of a wedding photo.

const KEY = 'event-abc/papic/seat-1/photo.jpg';

function art(over: Partial<DriveArtifactRow> = {}): DriveArtifactRow {
  return { r2_object_key: KEY, drive_file_id: 'drive-file-1', ...over };
}

test('confirmed: uploaded high-res copy (drive_file_id present)', () => {
  assert.equal(isDriveCopyConfirmed(art()), true);
  assert.equal(isDriveCopyConfirmed(art({ copied_high_res: true })), true);
  // photo_delivery_artifacts has no copied_high_res column — absent = the
  // original bytes were uploaded, so it counts as high-res.
  assert.equal(isDriveCopyConfirmed(art({ copied_high_res: undefined })), true);
});

test('NOT confirmed: queued / failed / retry-capped (no drive_file_id)', () => {
  assert.equal(isDriveCopyConfirmed(art({ drive_file_id: null })), false);
  assert.equal(isDriveCopyConfirmed(art({ drive_file_id: '' })), false);
});

test('NOT confirmed: a post-compression copy (copied_high_res=false)', () => {
  assert.equal(isDriveCopyConfirmed(art({ copied_high_res: false })), false);
});

test('NOT confirmed: keyless row', () => {
  assert.equal(isDriveCopyConfirmed(art({ r2_object_key: null })), false);
});

test('confirmedDriveKeys keeps only the confirmed rows', () => {
  const keys = confirmedDriveKeys([
    art(),
    art({ r2_object_key: 'b.jpg', drive_file_id: null }),
    art({ r2_object_key: 'c.jpg', copied_high_res: false }),
    art({ r2_object_key: 'd.jpg' }),
  ]);
  assert.deepEqual([...keys].sort(), [KEY, 'd.jpg'].sort());
});

test('DEFER: Drive connected but this photo is not copied yet', () => {
  const state = { kind: 'connected' as const, confirmedKeys: new Set<string>() };
  assert.equal(isDriveDeferred(KEY, state), true);
});

test('DROPPABLE: Drive connected and this photo IS confirmed', () => {
  const state = { kind: 'connected' as const, confirmedKeys: new Set([KEY]) };
  assert.equal(isDriveDeferred(KEY, state), false);
  // ...but a sibling key that isn't confirmed still defers.
  assert.equal(isDriveDeferred('other.jpg', state), true);
});

test('UNCHANGED: Drive never connected → guard is a no-op', () => {
  assert.equal(isDriveDeferred(KEY, { kind: 'not_connected' }), false);
});

test('DEFER: unreadable Drive state — a read failure never authorizes a delete', () => {
  assert.equal(isDriveDeferred(KEY, { kind: 'unknown', reason: 'oauth_grants:boom' }), true);
});

// ── CLIP drop (Papic storage PR-2) ───────────────────────────────────────────
// This is the MOST destructive branch: a wrong `true` deletes a motion clip and
// leaves only a poster still. Every guard gets a dense test.

const CLIP_RAW = 'r2://setnayan-media/papic/guest/g1/papic-100.mp4';
const CLIP_POSTER = 'r2://setnayan-media/papic/guest/g1/papic-100-poster.jpg';
const CLIP_WEB = 'r2://setnayan-media/papic/guest/g1/papic-200-web.mp4';

function clip(over: Partial<ClipDropCandidate> = {}): ClipDropCandidate {
  return {
    media_type: 'clip',
    r2_object_key: CLIP_RAW,
    poster_r2_key: CLIP_POSTER,
    display_r2_key: CLIP_POSTER, // display == poster for clips
    clip_web_r2_key: CLIP_WEB,
    clip_web_bytes: 512_000,
    captured_at: daysAgo(120),
    full_res_dropped_at: null,
    ...over,
  };
}

test('clip eligible: old clip, distinct web copy, real bytes, not dropped', () => {
  assert.equal(clipEligibleForDrop(clip(), OPTS), true);
});

test('clip NOT eligible: NULL clip_web_r2_key — keeps every un-backfilled clip safe', () => {
  assert.equal(clipEligibleForDrop(clip({ clip_web_r2_key: null }), OPTS), false);
  assert.equal(clipEligibleForDrop(clip({ clip_web_r2_key: '' }), OPTS), false);
  assert.equal(clipEligibleForDrop(clip({ clip_web_r2_key: '   ' }), OPTS), false);
});

test('clip NOT eligible: web key == poster / display / raw (the poster trap)', () => {
  // web copy masquerading as the poster still would let the drop delete a key a
  // play surface still points at.
  assert.equal(clipEligibleForDrop(clip({ clip_web_r2_key: CLIP_POSTER }), OPTS), false);
  assert.equal(
    clipEligibleForDrop(clip({ clip_web_r2_key: CLIP_POSTER, display_r2_key: CLIP_POSTER }), OPTS),
    false,
  );
  // web copy == the raw video → dropping the raw would delete the only playable copy.
  assert.equal(clipEligibleForDrop(clip({ clip_web_r2_key: CLIP_RAW }), OPTS), false);
});

test('clip NOT eligible: clip_web_bytes absent or below the floor', () => {
  assert.equal(clipEligibleForDrop(clip({ clip_web_bytes: null }), OPTS), false);
  assert.equal(clipEligibleForDrop(clip({ clip_web_bytes: 0 }), OPTS), false);
  assert.equal(clipEligibleForDrop(clip({ clip_web_bytes: CLIP_WEB_MIN_BYTES - 1 }), OPTS), false);
  // exactly at the floor is allowed
  assert.equal(clipEligibleForDrop(clip({ clip_web_bytes: CLIP_WEB_MIN_BYTES }), OPTS), true);
});

test('clip NOT eligible: not a clip (photos never take this path)', () => {
  assert.equal(clipEligibleForDrop(clip({ media_type: 'photo' }), OPTS), false);
  assert.equal(clipEligibleForDrop(clip({ media_type: null, photo_type: 'photo' }), OPTS), false);
});

test('clip NOT eligible: younger than the window / already dropped / sample seed', () => {
  assert.equal(clipEligibleForDrop(clip({ captured_at: daysAgo(30) }), OPTS), false);
  assert.equal(clipEligibleForDrop(clip({ full_res_dropped_at: daysAgo(1) }), OPTS), false);
  assert.equal(clipEligibleForDrop(clip({ r2_object_key: 'sample/papic/demo/clip.mp4' }), OPTS), false);
});

// ── clip web-copy OBJECT custody (HEAD) + fresh-grace ────────────────────────
// The last gate before an irreversible delete: never trust the DB key alone.

const GRACE_MS = CLIP_WEB_DROP_GRACE_DAYS * 86_400_000;
const CUSTODY_OPTS = { graceMs: GRACE_MS, nowMs: NOW };

function head(over: Partial<R2HeadResult> = {}): R2HeadResult {
  return {
    size: 512_000,
    contentType: 'video/mp4',
    // written well before the grace window → aged enough to drop.
    lastModified: new Date(NOW - (CLIP_WEB_DROP_GRACE_DAYS + 30) * 86_400_000),
    ...over,
  };
}

test('custody OK: aged, video, size matches persisted bytes', () => {
  assert.equal(clipWebCopyCustodyOk(head(), 512_000, CUSTODY_OPTS), true);
});

test('custody FAIL: HEAD returned null (missing / 403 / network) → never drop', () => {
  assert.equal(clipWebCopyCustodyOk(null, 512_000, CUSTODY_OPTS), false);
});

test('custody FAIL: within the fresh-grace window (a bad backfill must not drop instantly)', () => {
  const fresh = head({ lastModified: new Date(NOW - 1 * 86_400_000) }); // 1 day old
  assert.equal(clipWebCopyCustodyOk(fresh, 512_000, CUSTODY_OPTS), false);
  // exactly at the grace boundary is allowed (>=)
  const atBoundary = head({ lastModified: new Date(NOW - GRACE_MS) });
  assert.equal(clipWebCopyCustodyOk(atBoundary, 512_000, CUSTODY_OPTS), true);
});

test('custody FAIL: size mismatch (truncated / partial PUT) → never drop', () => {
  assert.equal(clipWebCopyCustodyOk(head({ size: 511_999 }), 512_000, CUSTODY_OPTS), false);
  assert.equal(clipWebCopyCustodyOk(head({ size: Number.NaN }), 512_000, CUSTODY_OPTS), false);
  // an absent/NaN persisted byte-count is also un-verifiable
  assert.equal(clipWebCopyCustodyOk(head(), Number.NaN, CUSTODY_OPTS), false);
});

test('custody FAIL: not a video (a poster image mis-stored as the web copy)', () => {
  assert.equal(clipWebCopyCustodyOk(head({ contentType: 'image/jpeg' }), 512_000, CUSTODY_OPTS), false);
  assert.equal(clipWebCopyCustodyOk(head({ contentType: null }), 512_000, CUSTODY_OPTS), false);
});

test('custody FAIL: no LastModified → cannot prove age → never drop', () => {
  assert.equal(clipWebCopyCustodyOk(head({ lastModified: null }), 512_000, CUSTODY_OPTS), false);
});

test('custody FAIL: HEAD size below the byte floor even if it matches', () => {
  assert.equal(
    clipWebCopyCustodyOk(head({ size: 512 }), 512, CUSTODY_OPTS),
    false,
  );
});

// ── the survivors invariant: drop the raw, keep poster + web copy ────────────
// The sweep DELETEs resolveOriginalRef(r2_object_key) and never the poster/web.
// Prove the delete target is a DISTINCT object from both survivors, and that
// after the stamp the play/still resolvers still return real bytes.

test('drop deletes ONLY the raw object — poster + web copy resolve to different objects', () => {
  const c = clip();
  const rawRef = resolveOriginalRef(c.r2_object_key!);
  const webRef = resolveOriginalRef(c.clip_web_r2_key!);
  const posterRef = resolveOriginalRef(c.poster_r2_key!);
  assert.ok(rawRef && webRef && posterRef);
  // The one object the sweep deletes is neither the web copy nor the poster.
  assert.notEqual(`${rawRef!.bucket}/${rawRef!.key}`, `${webRef!.bucket}/${webRef!.key}`);
  assert.notEqual(`${rawRef!.bucket}/${rawRef!.key}`, `${posterRef!.bucket}/${posterRef!.key}`);
});

test('after the drop stamp: resolvePlayRef → web copy, resolveStillRef → poster (survivors served)', () => {
  const dropped = {
    media_type: 'clip' as const,
    r2_object_key: CLIP_RAW,
    poster_r2_key: CLIP_POSTER,
    display_r2_key: CLIP_POSTER,
    clip_web_r2_key: CLIP_WEB,
    full_res_dropped_at: daysAgo(0), // the sweep just stamped it
  };
  // play resolves to the small web copy — NOT the now-deleted raw video.
  assert.equal(resolvePlayRef(dropped), CLIP_WEB);
  // the still resolves to the poster — untouched by the drop.
  assert.equal(resolveStillRef(dropped), CLIP_POSTER);
});
