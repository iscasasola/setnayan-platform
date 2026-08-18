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

// 🔑 DERIVE THE RATIO, NEVER RE-TYPE IT. A photo costs 1 point and a ten-second
// clip costs 8 (owner-locked 2026-07-29, raised from 7). That currency already
// governs every capture path, and `papic-copy-guardrails.test.ts` fails CI if a
// surface re-grows a literal — so preservation reads the same constants rather
// than keeping a second copy that can drift. A second copy of a ratio is how the
// day-of console and the floor console came to disagree about who counts as
// booked.
import {
  PAPIC_POINTS_PER_PHOTO,
  PAPIC_PRESERVATION_UNITS_PER_CLIP,
} from './papic-cameras-pure';

/** Decimal GB (10^9), matching cloud-storage (R2) per-GB billing. */
export const BYTES_PER_GB = 1_000_000_000;

/** Provisional per-event web-copy soft ceiling (owner 2026-07-11, admin-dialable). */
export const DEFAULT_WEB_COPY_CEILING_GB = 40;

export type StorageRow = {
  /** Full-res original size. NULL for clips (video ≠ the poster we derive) + pre-telemetry rows. */
  orig_bytes?: number | null;
  /** Display web-copy derivative (long-edge 1280 JPEG) size — the forever-hosted copy. */
  display_bytes?: number | null;
  /** Thumb derivative (long-edge 320) size. */
  thumb_bytes?: number | null;
  /**
   * Tile derivative (long-edge 640) size — the copy a grid WALL renders, added
   * 2026-08-13. NULL on rows captured before it existed, and on rows that have
   * not been backfilled; `pos()` treats that as 0, which is right: an
   * unmeasured byte is not a stored byte we can claim to know about.
   */
  tile_bytes?: number | null;
};

/**
 * A row as the BILLING path needs it — what are we storing for this capture RIGHT
 * NOW, as opposed to what it cost us over its lifetime.
 *
 * 🔑 THE DISTINCTION THIS TYPE EXISTS FOR. Everything above measures INGEST: how big
 * the original was when it arrived, so the councils could check the modelled ~8%
 * web-copy ratio. A bill is a different question — after the retention window we
 * REPLACE the original with its compressed copy, so a couple whose gallery is 0.4 GB
 * would be invoiced for the 4.4 GB they once uploaded. Same columns, opposite
 * meaning; that is exactly the "two values that look alike" shape this project keeps
 * paying for, so the billing view gets its own type and its own function.
 */
export type StoredRow = StorageRow & {
  /** Set once the full-res original has been replaced by its compressed copy. */
  full_res_dropped_at?: string | null;
  /** A clip's small playable web copy — kept forever, and the ONLY accurate clip byte figure. */
  clip_web_bytes?: number | null;
  /** True for a clip (its `orig_bytes` is structurally NULL — see storedBytes). */
  is_clip?: boolean | null;
};

function pos(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * The forever-hosted web copy of one capture = every derivative we keep.
 *
 * ⚠ `tile_bytes` JOINED THIS SUM ON 2026-08-13, and leaving it out would have
 * quietly under-reported every figure on the storage readout — the per-event
 * total, the web-copy ceiling check, and the ~8% ratio the pricing councils
 * asked to lock from real data. A third derivative that nothing counts is
 * storage we pay for and cannot see.
 */
export function webCopyBytes(row: StorageRow): number {
  return pos(row.display_bytes) + pos(row.tile_bytes) + pos(row.thumb_bytes);
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

/* ── PRESERVATION: what an ACCOUNT is keeping at FULL RESOLUTION ────────────
 *
 * 🔒 OWNER-LOCKED 2026-08-10. **₱500/year buys 3,000 photos OR 150 videos, or any
 * combination — a video counts as 20 photos.** The year runs from the day they
 * buy. There is no free allowance to set, and no gigabyte anywhere.
 *
 * ## WHAT IS SOLD IS RESOLUTION, NOT SPACE
 *
 * Owner, verbatim: *"we will preserve it compressed so they still keep it. we
 * just allow them to preserve it"* and *"if they pay nothing, we still keep their
 * photos for 5 years. but compressed. they pay that additional to keep it in high
 * res."*
 *
 * ⚠ THE FIVE YEARS IN THAT QUOTE IS SUPERSEDED — kept because it is a quote,
 * dated because a reader would otherwise act on it. On **2026-08-18** the owner
 * said *"we keep it for life"*. Everything else in the sentence still holds.
 *
 * So the FREE tier is the compressed copy of everything, kept **for life** —
 * no end date, no paid tier, and nothing deleted at any point. The PAID tier is
 * exactly the originals, at full resolution. That is why there is
 * no "how many photos are free" number: the question only made sense while this
 * was thought of as a drive.
 *
 * ## WHY COUNTING IS SAFER THAN MEASURING, NOT MERELY FRIENDLIER
 *
 * The byte model this replaces needed an `unmeasured` flag because **a clip's raw
 * video has no recorded size** — the derivative writer deliberately omits
 * `orig_bytes` for clips, since a clip's "original" is a video, not the poster
 * still it derives from. Those are the LARGEST objects on the platform, so the
 * clip-heavy events cost the most and would have been billed the least, while the
 * customer's meter read reassuringly low. Wrong in both directions, nothing
 * erroring.
 *
 * **Counting removes that hazard at the root.** A clip is one row; it is worth 20
 * units whether or not anyone recorded how many bytes it is. Nothing is invisible,
 * so nothing needs a flag.
 *
 * ⚠ The byte helpers ABOVE are untouched and still correct — they answer a
 * different question (how much are we actually holding, for our own cost
 * telemetry at /admin/papic-storage). Do not wire them into anything a customer
 * reads.
 *
 * Everything here is PURE: the caller supplies rows, this computes.
 */

/**
 * One purchasable year of full-resolution preservation, **in Papic points**.
 *
 * 🔒 OWNER-LOCKED 2026-08-10: *"let's just use the papic credits as the count so
 * it will be consistent"* · *"5000 pts for 500/year"*. So ₱500 preserves **5,000
 * photos, or 625 videos, or any mix** — one unit, and it is the unit the couple
 * already buys their shots in. "The pool you bought is the pool you keep" stops
 * being a slogan and becomes literally the same number.
 */
export const PRESERVATION_BLOCK_POINTS = 5_000;

/** ₱ per block per year (owner 2026-08-10). ~₱125/yr to us ⇒ ~75% margin. */
export const PRESERVATION_BLOCK_PHP = 500;

/**
 * How much of the paid allowance does ONE capture consume right now?
 *
 * 🔑 **ZERO once the original has been replaced.** A capture whose
 * `full_res_dropped_at` is set is living as its compressed copy, and the
 * compressed copy is FREE — charging for it would bill a couple for the tier they
 * did not buy. This is the count-model twin of the byte model's rule that a
 * replaced original is not billed.
 */
export function preservationUnits(row: StoredRow): number {
  if (row.full_res_dropped_at) return 0;
  // 🔒 STORAGE IS BILLED FLAT, EVEN THOUGH CAPTURE IS NOW BILLED BY LENGTH
  // (owner 2026-08-11). Not an oversight and not laziness: a StoredRow carries
  // `is_clip` and NO duration, so the length of a kept video is not readable
  // here at all. Given a choice between billing every stored video at the
  // cheapest band and billing it at the ceiling, the ceiling is the only honest
  // one — the cheap band would under-charge ₱500-a-year storage on every video
  // longer than three seconds.
  //
  // Named constant rather than `papicCaptureCost('clip')` with the duration
  // left off. That call returns the same number today, but it would make a
  // PRICING DECISION about a different product something a reader has to infer
  // from a default argument — and the next person to make that default cheaper
  // would silently reprice preservation without ever opening this file.
  return row.is_clip ? PAPIC_PRESERVATION_UNITS_PER_CLIP : PAPIC_POINTS_PER_PHOTO;
}

export type AccountPreservation = {
  /** Rows considered, across every event on the account. */
  captures: number;
  /** Captures whose ORIGINAL we are still holding (the ones that cost). */
  originalsHeld: number;
  /** Photo-units those originals consume (a clip = CLIP_UNITS). */
  pointsHeld: number;
  /** Blocks this usage requires, minimum one. */
  blocksNeeded: number;
  /** ₱/year at the locked block price. */
  annualPhp: number;
};

/**
 * Roll every capture on an ACCOUNT into one figure.
 *
 * ⚠ ACCOUNT, NOT EVENT. Captures belong to events, but the plan is bought by a
 * PERSON whose wedding, christenings and birthdays accumulate over years — so the
 * caller must gather rows across every event the account owns and pass them
 * together. Summing per event and adding the BLOCKS would over-charge: three
 * 1,200-unit events are 3,600 units (2 blocks), not three separate 1-block bills.
 */
export function aggregateAccountPreservation(rows: StoredRow[]): AccountPreservation {
  let units = 0;
  let held = 0;
  for (const row of rows) {
    const u = preservationUnits(row);
    if (u > 0) held += 1;
    units += u;
  }
  const blocks = blocksNeeded(units);
  return {
    captures: rows.length,
    originalsHeld: held,
    pointsHeld: units,
    blocksNeeded: blocks,
    annualPhp: blocks * PRESERVATION_BLOCK_PHP,
  };
}

/** Blocks required to cover `units`, minimum 1 (an account on the plan holds one). */
export function blocksNeeded(units: number): number {
  return Math.max(1, Math.ceil(Math.max(0, units) / PRESERVATION_BLOCK_POINTS));
}

/** Paid allowance in photo-units for `blocks`. */
export function allowancePoints(blocks: number): number {
  return Math.max(1, Math.floor(blocks)) * PRESERVATION_BLOCK_POINTS;
}

export type PreservationMeter = {
  /** 0–100+ against the paid allowance. May exceed 100 — that means they need another block. */
  percentUsed: number;
  /** Still inside what they paid for? */
  withinAllowance: boolean;
};

/**
 * The customer-facing meter.
 *
 * 🗣 PERCENTAGE ONLY — no gigabytes, and no raw unit count either. Owner
 * 2026-08-08: *"we do not have to say the Gb size. we will only show
 * percentage"*, and 2026-08-10: *"do not price by drive. price by number of
 * photos and videos."* The percentage is now of a COUNT, so it is a figure we can
 * actually stand behind: nothing about it is a floor or an estimate.
 */
export function preservationMeter(pointsHeld: number, blocks: number): PreservationMeter {
  const allowance = allowancePoints(blocks);
  const used = Math.max(0, pointsHeld);
  return {
    percentUsed: Math.round((used / allowance) * 100),
    withinAllowance: used <= allowance,
  };
}
