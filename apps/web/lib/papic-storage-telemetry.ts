/**
 * Papic storage telemetry — pure aggregation over the byte-accounting columns
 * (orig_bytes / display_bytes / thumb_bytes, migration 20270718100867).
 *
 * Turns raw per-capture sizes into the two numbers the pricing councils flagged
 * as UNMEASURED and asked to lock from real data before hard-coding:
 *   1. the real web-copy / original RATIO (the modelled "~8%"), measured over
 *      stills only (clips have no orig_bytes — their original is a video, not the
 *      poster we derive from);
 *   2. the per-event forever-hosted WEB-COPY size, for the soft 40 GB/event
 *      ceiling (provisional + admin-dialable — this measures whether it ever binds).
 *
 * No I/O — exhaustively unit-testable. The caller supplies rows; this computes.
 */

/** Decimal GB (10^9), matching cloud-storage (R2) per-GB billing. */
export const BYTES_PER_GB = 1_000_000_000;

/** Provisional per-event web-copy soft ceiling (owner 2026-07-11, admin-dialable). */
export const DEFAULT_WEB_COPY_CEILING_GB = 40;

export type StorageRow = {
  /** Full-res original size. NULL for clips (video ≠ the poster we derive) + pre-telemetry rows. */
  orig_bytes?: number | null;
  /** Display web-copy derivative (long-edge 1280 JPEG) size — the forever-hosted copy. */
  display_bytes?: number | null;
  /** Thumb derivative (long-edge 320 JPEG) size. */
  thumb_bytes?: number | null;
};

function pos(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/** The forever-hosted web copy of one capture = display + thumb derivatives (bytes). */
export function webCopyBytes(row: StorageRow): number {
  return pos(row.display_bytes) + pos(row.thumb_bytes);
}

/**
 * Web-copy / original ratio for ONE still (the real "~8%"). Returns null when the
 * original size is unknown (a clip, or a pre-telemetry row) — those must not enter
 * the ratio, or the poster-vs-video mismatch corrupts it.
 */
export function webCopyRatio(row: StorageRow): number | null {
  const orig = pos(row.orig_bytes);
  if (orig <= 0) return null;
  return webCopyBytes(row) / orig;
}

export type EventStorageSummary = {
  /** Total captures considered. */
  captures: number;
  /** Captures with a measured original (stills) — the ratio denominator population. */
  measuredStills: number;
  /** Sum of original bytes over measured stills. */
  measuredOrigBytes: number;
  /** Aggregate web-copy/original ratio over measured stills (the real "~8%"), or null. */
  webCopyRatio: number | null;
  /** Forever-hosted web-copy total across ALL captures (stills + clip posters). */
  totalWebCopyBytes: number;
  totalWebCopyGb: number;
  /** Does the event exceed the soft web-copy ceiling? (drives the Drive-only-beyond switch.) */
  overWebCopyCeiling: boolean;
  ceilingGb: number;
};

/**
 * Aggregate a whole event's captures. The ratio is measured over stills only; the
 * ceiling check is over the total web copy we permanently host (what the 40 GB
 * governor actually bounds).
 */
export function aggregateEventStorage(
  rows: StorageRow[],
  opts: { webCopyCeilingGb?: number } = {},
): EventStorageSummary {
  const ceilingGb = opts.webCopyCeilingGb ?? DEFAULT_WEB_COPY_CEILING_GB;
  let measuredStills = 0;
  let measuredOrigBytes = 0;
  let measuredStillWeb = 0;
  let totalWeb = 0;

  for (const row of rows) {
    const web = webCopyBytes(row);
    totalWeb += web;
    const orig = pos(row.orig_bytes);
    if (orig > 0) {
      measuredStills += 1;
      measuredOrigBytes += orig;
      measuredStillWeb += web;
    }
  }

  const totalWebGb = totalWeb / BYTES_PER_GB;
  return {
    captures: rows.length,
    measuredStills,
    measuredOrigBytes,
    webCopyRatio: measuredOrigBytes > 0 ? measuredStillWeb / measuredOrigBytes : null,
    totalWebCopyBytes: totalWeb,
    totalWebCopyGb: totalWebGb,
    overWebCopyCeiling: totalWebGb > ceilingGb,
    ceilingGb,
  };
}
