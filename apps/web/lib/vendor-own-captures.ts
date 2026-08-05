/**
 * WHAT A VENDOR SHOT — their own Papic captures, for their own eyes.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 * A booked vendor can shoot photos and clips on the day. Everything they shoot
 * lands in the COUPLE'S gallery — and the vendor could never look back at it.
 * Not one screen anywhere read their own rows. They pressed the shutter and the
 * pictures vanished into someone else's album.
 *
 * The permission was already there: `vendor_papic_captures_vendor_read` has
 * shipped since the capture lane was built. Only the screen was missing, which
 * is why this is a reader and a page, not a migration.
 *
 * ── WHAT A VENDOR MAY SEE, AND WHAT THEY MAY NOT ────────────────────────────
 * Their OWN captures, on events they were booked for. That is the RLS policy's
 * boundary and this module does not widen it — the filters below are
 * defence-in-depth on top, never a substitute:
 *
 *   · `nsfw_checked` — an unscreened frame is not shown to anyone, including
 *     the person who took it. The screen runs in the background after upload,
 *     so a just-taken photo is briefly absent rather than briefly unscreened.
 *   · `hidden_at` — the couple can take a picture down. When they do it leaves
 *     the vendor's view too. The couple's event, the couple's call.
 *
 * 🪤 A CLIP TILES ON ITS POSTER, NEVER ITS VIDEO. `poster_r2_key` is a still
 * frame; `r2_object_key` for a clip is an mp4, and rendering that into a grid
 * would autoplay a wall of video on a phone at a wedding.
 */

export type VendorCapture = {
  captureId: string;
  eventId: string;
  /** The key to render in a grid — a photo's own key, or a clip's poster. */
  tileKey: string;
  /** The full-size object. Same as tileKey for a photo; the mp4 for a clip. */
  sourceKey: string;
  mediaType: 'photo' | 'clip';
  clipDurationMs: number | null;
  capturedAt: string | null;
};

type Row = {
  capture_id: string;
  event_id: string;
  r2_object_key: string | null;
  poster_r2_key: string | null;
  media_type: string | null;
  clip_duration_ms: number | null;
  captured_at: string | null;
  hidden_at: string | null;
  nsfw_checked: boolean | null;
};

/**
 * Shape raw rows into what the grid needs, dropping anything not fit to show.
 *
 * Pure, so the visibility rules can be tested without a database — the rules
 * are the point of this module and they should not need one.
 */
export function visibleVendorCaptures(rows: ReadonlyArray<Row>): VendorCapture[] {
  const out: VendorCapture[] = [];
  for (const r of rows) {
    if (r.hidden_at) continue;
    if (r.nsfw_checked !== true) continue;

    const isClip = r.media_type === 'clip';
    // A clip with no poster cannot be tiled — showing the mp4 instead would
    // autoplay video in a grid. Skip it rather than degrade into that.
    const tileKey = isClip ? r.poster_r2_key : r.r2_object_key;
    if (!tileKey || !r.r2_object_key) continue;

    out.push({
      captureId: r.capture_id,
      eventId: r.event_id,
      tileKey,
      sourceKey: r.r2_object_key,
      mediaType: isClip ? 'clip' : 'photo',
      clipDurationMs: isClip ? r.clip_duration_ms : null,
      capturedAt: r.captured_at,
    });
  }
  return out;
}

/** "0:07" for a clip, null for a photo. */
export function clipLengthLabel(capture: VendorCapture): string | null {
  if (capture.mediaType !== 'clip' || !capture.clipDurationMs) return null;
  const totalSeconds = Math.round(capture.clipDurationMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** The one-line summary above the grid. Counts what is SHOWN, never the raw rows. */
export function captureSummary(captures: ReadonlyArray<VendorCapture>): string {
  if (captures.length === 0) return 'Nothing yet.';
  const photos = captures.filter((c) => c.mediaType === 'photo').length;
  const clips = captures.length - photos;
  const parts: string[] = [];
  if (photos > 0) parts.push(`${photos} photo${photos === 1 ? '' : 's'}`);
  if (clips > 0) parts.push(`${clips} clip${clips === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
