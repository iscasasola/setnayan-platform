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

/* ── BILLING: what an ACCOUNT is storing right now ──────────────────────────
 *
 * Owner-locked 2026-08-08: preservation storage is **₱500/year per 10 GB block**,
 * charged on ACTUAL stored bytes, **accumulating across every event on the
 * account** — "this will accumulate all the data they collect on their account."
 * The customer is shown a **PERCENTAGE, never a GB figure**, and always gets a
 * **5 GB buffer** on top of what they paid for so nothing hard-stops.
 *
 * Everything here is PURE, matching the module above: the caller supplies rows,
 * this computes. No I/O, so the money math is exhaustively unit-testable.
 */

/** One purchasable block. */
export const STORAGE_BLOCK_GB = 10;
/** Always granted on top of the paid allowance, so a couple never hits a wall. */
export const STORAGE_BUFFER_GB = 5;
/** ₱ per block per year (owner 2026-08-08). Cost to us is ~₱104 → ~79% margin. */
export const STORAGE_BLOCK_PHP = 500;

export type StoredBytes = {
  /** Bytes we can PROVE we are storing for this row. */
  bytes: number;
  /**
   * True when part of this row's storage is real but unmeasured, so `bytes` is a
   * FLOOR rather than a total. Today that means exactly one thing: a clip whose
   * raw video is still held. Clips never get `orig_bytes` — the derivative writer
   * deliberately omits it because a clip's "original" is a video, not the poster
   * still it derives from — so the largest objects on the platform are invisible
   * to this sum.
   */
  unmeasured: boolean;
};

/**
 * What are we storing for ONE capture right now?
 *
 * 🚨 AN UNMEASURED BYTE MUST NEVER LOOK LIKE ZERO. This returns a flag rather than
 * silently summing what it happens to know, because the failure mode is invisible
 * and expensive in both directions: bill from an undercount and the clip-heavy
 * events — the ones that actually cost the most — are the ones charged least;
 * show it to a customer as a percentage and the bar reads reassuringly low while
 * the real usage is far higher. Callers must decide what to do about
 * `unmeasured`; they cannot accidentally ignore it.
 */
export function storedBytes(row: StoredRow): StoredBytes {
  // The compressed copies are kept indefinitely — they are always part of the bill.
  let bytes = webCopyBytes(row) + pos(row.clip_web_bytes);
  let unmeasured = false;

  // The full-res original counts only while we still hold it. Once
  // `full_res_dropped_at` is set it has been REPLACED by the compressed copy
  // above, and billing for it would charge for bytes that no longer exist.
  if (!row.full_res_dropped_at) {
    if (row.is_clip) {
      // A clip's raw video is still on R2 and is typically the largest object in
      // the event — but nothing records its size. Flag it; do not guess.
      unmeasured = true;
    } else {
      bytes += pos(row.orig_bytes);
    }
  }

  return { bytes, unmeasured };
}

export type AccountStorageSummary = {
  /** Rows considered, across every event on the account. */
  captures: number;
  /** Provable stored bytes — a FLOOR when `unmeasuredCaptures > 0`. */
  storedBytes: number;
  storedGb: number;
  /** Captures holding real storage we cannot size (clip raws still held). */
  unmeasuredCaptures: number;
  /** Blocks this usage requires, minimum one. */
  blocksNeeded: number;
  /** ₱/year at the locked block price. */
  annualPhp: number;
};

/**
 * Roll every capture on an ACCOUNT into one figure.
 *
 * ⚠ ACCOUNT, NOT EVENT. The rest of this codebase scopes storage per event
 * (`aggregateEventStorage` above, `/admin/papic-storage`) because captures belong
 * to events. The plan bills a PERSON, whose wedding, christenings and birthdays
 * accumulate over years — so the caller must gather rows across every event the
 * account owns and pass them here together. Summing per event and adding up the
 * BLOCKS instead would over-charge: three 4 GB events are 12 GB (2 blocks), not
 * three separate 1-block bills.
 */
export function aggregateAccountStorage(rows: StoredRow[]): AccountStorageSummary {
  let total = 0;
  let unmeasured = 0;
  for (const row of rows) {
    const r = storedBytes(row);
    total += r.bytes;
    if (r.unmeasured) unmeasured += 1;
  }
  const gb = total / BYTES_PER_GB;
  const blocks = blocksNeeded(total);
  return {
    captures: rows.length,
    storedBytes: total,
    storedGb: gb,
    unmeasuredCaptures: unmeasured,
    blocksNeeded: blocks,
    annualPhp: blocks * STORAGE_BLOCK_PHP,
  };
}

/** Blocks required to cover `bytes`, minimum 1 (an account on the plan always holds one). */
export function blocksNeeded(bytes: number): number {
  const gb = Math.max(0, bytes) / BYTES_PER_GB;
  return Math.max(1, Math.ceil(gb / STORAGE_BLOCK_GB));
}

/** Paid allowance in GB for `blocks`, excluding the buffer. */
export function allowanceGb(blocks: number): number {
  return Math.max(1, Math.floor(blocks)) * STORAGE_BLOCK_GB;
}

/** Paid allowance PLUS the always-granted buffer — the point where a hard stop applies. */
export function hardCapGb(blocks: number): number {
  return allowanceGb(blocks) + STORAGE_BUFFER_GB;
}

export type StorageMeter = {
  /** 0–100+ against the PAID allowance. Deliberately allowed to exceed 100 — that is the buffer. */
  percentUsed: number;
  /** Still inside allowance + buffer? False means genuinely out of room. */
  withinBuffer: boolean;
  /** Eating into the free buffer (past 100% of paid, still under the cap). */
  inBuffer: boolean;
  /** True when the figure is a floor because some storage could not be sized. */
  approximate: boolean;
};

/**
 * The customer-facing meter.
 *
 * 🗣 PERCENTAGE ONLY — the owner is explicit that a GB number is never shown
 * ("we do not have to say the Gb size. we will only show percentage"). That is
 * also the safer design while clip raws are unmeasured: a percentage against a
 * known allowance degrades more gracefully than a GB total that is quietly a
 * floor. It is NOT a licence to ship a wrong number — `approximate` is surfaced
 * so the UI can say so rather than imply precision it does not have.
 */
export function storageMeter(bytes: number, blocks: number, unmeasured = 0): StorageMeter {
  const gb = Math.max(0, bytes) / BYTES_PER_GB;
  const allowance = allowanceGb(blocks);
  const cap = hardCapGb(blocks);
  const pct = (gb / allowance) * 100;
  return {
    // Round to a whole number: a meter reading "62.4%" invites a precision
    // argument about a figure that is a floor.
    percentUsed: Math.round(pct),
    withinBuffer: gb <= cap,
    inBuffer: gb > allowance && gb <= cap,
    approximate: unmeasured > 0,
  };
}
