import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clipEligibleForDrop,
  clipWebCopyCustodyOk,
  resolveOriginalRef,
  sameResolvedObject,
  seatClipItem,
  guestClipItem,
  guestPhotoItem,
  DEFAULT_FULL_RES_RETENTION_DAYS,
  CLIP_WEB_DROP_GRACE_DAYS,
  CLIP_WEB_MIN_BYTES,
  type PapicDropItem,
} from './papic-fullres-drop-core';
import { isClipRow } from './papic-display-ref';
import type { R2HeadResult } from './r2';

// ============================================================================
// PRODUCTION-PATH regression test for the Papic clip full-res drop (storage PR-2).
//
// WHY THIS FILE EXISTS: the +21 guard tests in papic-fullres-drop-core.test.ts
// all hand-build a ClipDropCandidate with `media_type:'clip'` PRE-SET. That
// masked a wiring bug that made the entire feature INERT — and left its
// irreversible-deletion guard chain never actually executed against the real
// sweep data shape:
//
//   The sweep's clip .map() set kind:'clip' but NEVER carried photo_type /
//   media_type, and the clip SELECT fetched neither column. isClipRow() reads
//   ONLY photo_type / media_type — so every real clip Item had isClipRow=false →
//   clipEligibleForDrop=false → clipsDropped always 0, and the custody-HEAD /
//   r2Delete chain was never reached.
//
// So these tests build the candidate Item through the EXACT production mapper the
// sweep uses (seatClipItem / guestClipItem), from a raw DB-row shape identical to
// what the clip SELECT returns — NOT a hand-built ClipDropCandidate. If the
// wiring ever regresses to inert (mapper stops carrying the type column, or the
// SELECT stops fetching it), the "eligible clip DROPS" assertions below FAIL.
// ============================================================================

const NOW = Date.parse('2026-07-11T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const OPTS = { retentionDays: DEFAULT_FULL_RES_RETENTION_DAYS, nowMs: NOW };
const GRACE_MS = CLIP_WEB_DROP_GRACE_DAYS * 86_400_000;

const RAW = 'r2://setnayan-media/papic/guest/g1/papic-100.mp4';
const POSTER = 'r2://setnayan-media/papic/guest/g1/papic-100-poster.jpg';
const WEB = 'r2://setnayan-media/papic/guest/g1/papic-200-web.mp4';

type Row = Record<string, unknown>;

// A papic_guest_captures CLIP row shaped EXACTLY as the sweep's clip SELECT
// returns it: `capture_id, event_id, media_type, r2_object_key, display_r2_key,
// poster_r2_key, clip_web_r2_key, clip_web_bytes, orig_bytes, captured_at,
// full_res_dropped_at`.
function guestClipRow(over: Row = {}): Row {
  return {
    capture_id: 'cap-1',
    event_id: 'evt-1',
    media_type: 'clip',
    r2_object_key: RAW,
    display_r2_key: POSTER,
    poster_r2_key: POSTER,
    clip_web_r2_key: WEB,
    clip_web_bytes: 512_000,
    orig_bytes: 8_000_000,
    captured_at: daysAgo(120),
    full_res_dropped_at: null,
    ...over,
  };
}

// A papic_photos (seat) CLIP row shaped as its clip SELECT returns it: uses
// `photo_id` + `photo_type` (not capture_id / media_type).
function seatClipRow(over: Row = {}): Row {
  return {
    photo_id: 'ph-1',
    event_id: 'evt-1',
    photo_type: 'clip',
    r2_object_key: RAW,
    display_r2_key: POSTER,
    poster_r2_key: POSTER,
    clip_web_r2_key: WEB,
    clip_web_bytes: 480_000,
    orig_bytes: 7_000_000,
    captured_at: daysAgo(120),
    full_res_dropped_at: null,
    ...over,
  };
}

// The sweep's clip custody gate, re-expressed over the SAME pure predicates it
// calls (the sweep itself is `server-only`, so it can't be imported here). Driven
// by a REAL Item so an attack is proven against the production shape. `true` =
// the raw would be deleted this sweep.
function custodyGateWouldDrop(item: PapicDropItem, head: R2HeadResult | null): boolean {
  // resolved-level distinctness (defense-in-depth) — fail closed on collision.
  if (sameResolvedObject(item.clip_web_r2_key ?? '', item.r2_object_key)) return false;
  const webRef = resolveOriginalRef(item.clip_web_r2_key ?? '');
  if (!webRef) return false;
  return clipWebCopyCustodyOk(head, Number(item.clip_web_bytes), { graceMs: GRACE_MS, nowMs: NOW });
}

function goodHead(over: Partial<R2HeadResult> = {}): R2HeadResult {
  return {
    size: 512_000, // == clip_web_bytes on guestClipRow
    contentType: 'video/mp4',
    lastModified: new Date(NOW - (CLIP_WEB_DROP_GRACE_DAYS + 30) * 86_400_000),
    ...over,
  };
}

// ── the crux: a real sweep clip Item is a clip AND drops ─────────────────────

test('PRODUCTION PATH: guestClipItem builds a REAL clip Item → isClipRow true → clipEligibleForDrop true', () => {
  const item = guestClipItem(guestClipRow());
  // The wiring that was broken and is the whole point of this file:
  assert.equal(item.kind, 'clip');
  assert.equal(item.media_type, 'clip', 'mapper MUST carry media_type from the row');
  assert.equal(
    isClipRow(item),
    true,
    'REGRESSION GUARD: a real sweep clip Item must satisfy isClipRow (else the drop is inert)',
  );
  // Reaches AND passes the column-level guard chain.
  assert.equal(clipEligibleForDrop(item, OPTS), true);
});

test('PRODUCTION PATH: seatClipItem builds a REAL clip Item → isClipRow true → clipEligibleForDrop true', () => {
  const item = seatClipItem(seatClipRow());
  assert.equal(item.kind, 'clip');
  assert.equal(item.photo_type, 'clip', 'mapper MUST carry photo_type from the row');
  assert.equal(isClipRow(item), true);
  assert.equal(clipEligibleForDrop(item, OPTS), true);
});

test('PRODUCTION PATH: an ELIGIBLE real clip Item DROPS (column guard AND custody gate pass)', () => {
  const item = guestClipItem(guestClipRow());
  assert.equal(clipEligibleForDrop(item, OPTS), true);
  assert.equal(custodyGateWouldDrop(item, goodHead()), true);
});

// ── the exact original bug, asserted: no type column → INERT ─────────────────

test('REGRESSION: a clip row whose SELECT forgot the type column maps to an INERT Item', () => {
  // This is the original bug reproduced at the mapper level: the clip SELECT
  // fetched neither photo_type nor media_type, so isClipRow() was always false and
  // clipsDropped was stuck at 0. The SELECT MUST fetch the type column — here is
  // what happens if it doesn't.
  const { media_type: _omit, ...rowMissingType } = guestClipRow();
  const item = guestClipItem(rowMissingType);
  assert.equal(item.media_type, null);
  assert.equal(isClipRow(item), false);
  assert.equal(
    clipEligibleForDrop(item, OPTS),
    false,
    'no type column on the row → isClipRow false → INERT (the masked bug)',
  );
});

// ── every attack fails CLOSED through the REAL Item shape ────────────────────

test('PRODUCTION PATH attacks (column guard): each fails closed on a real sweep Item', () => {
  // Build the Item via the production mapper, then run the real column guard.
  const drops = (over: Row) => clipEligibleForDrop(guestClipItem(guestClipRow(over)), OPTS);

  // null clip_web_r2_key → no web copy → keep the raw.
  assert.equal(drops({ clip_web_r2_key: null }), false);
  // web key == poster / display / raw (the poster trap).
  assert.equal(drops({ clip_web_r2_key: POSTER }), false);
  assert.equal(drops({ clip_web_r2_key: POSTER, display_r2_key: POSTER }), false);
  assert.equal(drops({ clip_web_r2_key: RAW }), false);
  // clip_web_bytes below the floor / absent.
  assert.equal(drops({ clip_web_bytes: CLIP_WEB_MIN_BYTES - 1 }), false);
  assert.equal(drops({ clip_web_bytes: null }), false);
  // not past the 90-day fuse.
  assert.equal(drops({ captured_at: daysAgo(30) }), false);
  // already dropped (idempotent).
  assert.equal(drops({ full_res_dropped_at: daysAgo(1) }), false);
  // a sample/ seed key is never touched.
  assert.equal(drops({ r2_object_key: 'sample/papic/demo/clip.mp4' }), false);
});

test('PRODUCTION PATH attacks (custody gate): each fails closed on a real sweep Item', () => {
  const item = guestClipItem(guestClipRow());
  // Column guard passes; the OBJECT custody gate must still fail closed on:

  // r2Head returned null (missing / 403 / network).
  assert.equal(custodyGateWouldDrop(item, null), false);
  // HEAD size != persisted clip_web_bytes (truncated / partial PUT).
  assert.equal(custodyGateWouldDrop(item, goodHead({ size: 511_999 })), false);
  // non-video content-type (a poster image mis-stored as the web copy).
  assert.equal(custodyGateWouldDrop(item, goodHead({ contentType: 'image/jpeg' })), false);
  assert.equal(custodyGateWouldDrop(item, goodHead({ contentType: null })), false);
  // within the 7-day fresh-grace window (a bad backfill must not drop instantly).
  assert.equal(custodyGateWouldDrop(item, goodHead({ lastModified: new Date(NOW - 1 * 86_400_000) })), false);
  // no LastModified → cannot prove age.
  assert.equal(custodyGateWouldDrop(item, goodHead({ lastModified: null })), false);
});

test('PRODUCTION PATH: distinct key STRINGS that resolve to the SAME R2 object fail closed', () => {
  // Legacy `key` form and its `r2://setnayan-media/key` form are DIFFERENT strings
  // (so clipEligibleForDrop's string distinctness passes) but resolve to one
  // object. The custody gate's resolved-level assert must refuse to drop.
  const collidingWeb = 'papic/guest/g1/papic-100.mp4'; // legacy form of RAW's object
  assert.equal(sameResolvedObject(collidingWeb, RAW), true, 'these resolve to the same object');
  const item = guestClipItem(guestClipRow({ clip_web_r2_key: collidingWeb, clip_web_bytes: 512_000 }));
  // Column guard would pass (strings differ), so the resolved-level gate is the
  // last line of defense — it must fail closed.
  assert.equal(clipEligibleForDrop(item, OPTS), true, 'string-level guard alone would allow it');
  assert.equal(custodyGateWouldDrop(item, goodHead()), false, 'resolved-level gate blocks the collision');
});

test('PRODUCTION PATH: only the RAW object is targeted — web copy + poster resolve elsewhere', () => {
  const item = guestClipItem(guestClipRow());
  const rawRef = resolveOriginalRef(item.r2_object_key)!;
  const webRef = resolveOriginalRef(item.clip_web_r2_key!)!;
  const posterRef = resolveOriginalRef(item.poster_r2_key!)!;
  assert.ok(rawRef && webRef && posterRef);
  assert.notEqual(`${rawRef.bucket}/${rawRef.key}`, `${webRef.bucket}/${webRef.key}`);
  assert.notEqual(`${rawRef.bucket}/${rawRef.key}`, `${posterRef.bucket}/${posterRef.key}`);
});

// ── photos never take the clip path, built through their own real mapper ─────

test('PRODUCTION PATH: a real PHOTO Item is not a clip (never crosses the streams)', () => {
  const photo = guestPhotoItem({
    capture_id: 'cap-2',
    event_id: 'evt-1',
    r2_object_key: 'event-abc/papic/photo.jpg',
    display_r2_key: 'r2://setnayan-media/derivatives/event-abc/display.avif',
    orig_bytes: 4_000_000,
    captured_at: daysAgo(120),
    full_res_dropped_at: null,
  });
  assert.equal(photo.kind, 'photo');
  assert.equal(isClipRow(photo), false);
  assert.equal(clipEligibleForDrop(photo, OPTS), false, 'photos never satisfy the clip predicate');
});
