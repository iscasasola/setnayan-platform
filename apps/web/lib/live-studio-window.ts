
/**
 * apps/web/lib/live-studio-window.ts
 *
 * ⭐ THE BROADCAST UNLOCK — "ONE UNLOCK, FOR THE LIFE OF THE EVENT" (LS6,
 * owner-ruled 2026-09-02, retiring Wave 7's per-event-DAY model below).
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────────
 * ₱2,500 buys MULTI-CAMERA broadcasting for the event, once, forever — unlimited
 * streams, unlimited video-link uploads, no clock. Owner, verbatim: "unlock once
 * per event, unlimited streams, unlimited video link upload." This module is the
 * one place that decides whether an event may broadcast more than one camera, and
 * the decision is now exactly as complicated as the question: does it own
 * LIVE_STUDIO?
 *
 * ── WHAT IT DOES *NOT* GATE, AND WHY THAT IS THE WHOLE DESIGN ──────────────────
 * It does NOT gate going live. The live /pricing page promises "Single-camera
 * livestream" FREE, and the full-screen watermark stays retired (owner 2026-07-25).
 * A host who never buys does not lose their broadcast — they get exactly the free
 * tier: one camera, the "POWERED BY SETNAYAN" bar, guests still watching. What
 * buying unlocks is the MULTI-CAM capability, nothing else.
 *
 * ── 🚫 RETIRED HERE: THE PER-EVENT-DAY MODEL (Wave 7, 2026-07-25 → 2026-09-02) ──
 * The previous model sold ONE EVENT-DAY of multi-cam at a time, anchored on first
 * go-live and extendable by buying another day (`foldWindowEnd`'s "hotel nights"
 * stacking). That whole apparatus — the anchor, the fold, the never-interrupt
 * grace for a lapsing window, the founder/comp/internal/promo METERED-vs-UNMETERED
 * split that only existed to decide who got a clock — is gone, not hidden: nothing
 * in this file computes an expiry any more, because nothing expires. Ownership
 * (any route — order, bundle, grant, promo; all already folded into
 * `eventSkuActive`) is now the WHOLE test. See `git log` on this file for the
 * retired shape if you need the history.
 *
 * `panood_control_state.first_live_at` (migration 20270829098323) is unaffected by
 * this retirement — it is still stamped (lib/live-studio-window-server.ts →
 * `stampFirstLiveAt`) as an informational "when did this event first broadcast"
 * fact, and the legacy flag-off watermark model (lib/panood-watermark.ts) still
 * reads it for its own, unrelated 24-hour overlay clock. It simply no longer
 * anchors anything HERE.
 *
 * ── FAIL DIRECTION, CHOSEN DELIBERATELY ─────────────────────────────────────────
 * Entitlement unknown → NOT owned → single camera. Fail CLOSED: a database blip
 * must never give away a ₱2,500 multi-cam broadcast. There is no fail-OPEN branch
 * left to reason about — the old one existed only to protect an anchor read that
 * no longer exists.
 *
 * PURE: no clock, no I/O. The async reader lives in lib/live-studio-window-server.ts
 * (the repo's `*-server.ts` split), which takes a SupabaseClient as a parameter —
 * so this module stays runnable under `tsx --test`.
 */

/**
 * ⚠ THIS HALF IS DELIBERATELY IMPORT-FREE. Same posture as lib/panood-watermark.ts and
 * lib/live-studio-overlays.ts: the decision layer has ZERO runtime imports, so a `'use client'`
 * component (the controller's broadcast-window strip, which has to TICK to catch the 12-hour
 * YouTube-archive crossing below) can import it without dragging lib/entitlements.ts — and its
 * DB readers — into the browser bundle.
 *
 * The server readers live in lib/live-studio-window-server.ts, matching the repo's existing
 * `*-server.ts` split (coordinator-broadcasts-server, setnayan-ai-server).
 */

/**
 * ⚠ YOUTUBE ARCHIVES ONLY THE FIRST 12 HOURS OF A STREAM (verified 2026-07-25 ·
 * § 4f ③). YouTube does NOT cap stream DURATION — 24/7 is allowed — but a stream
 * that runs past 12 hours may leave NO REPLAY AT ALL. For an unrepeatable wedding
 * feeding the Alaala handover, silently losing the recording is the sharp edge,
 * sharper than any paywall. (The owner's recalled "6 hours" is not the limit.)
 *
 * This is a WARNING, never a cutoff. Setnayan does not carry the video — the host's
 * own encoder streams to the host's own YouTube — so there is nothing here to stop
 * even if stopping were the right answer, and it is not.
 *
 * UNRELATED TO THE LS6 RETIREMENT ABOVE — this is a per-STREAM technical limit
 * YouTube imposes, not a Setnayan billing window. It survives untouched.
 */
export const YOUTUBE_ARCHIVE_HOURS = 12;

/** Start warning about the archive limit this many hours in — two hours of runway. */
export const ARCHIVE_WARN_AT_HOURS = 10;

const MS_PER_HOUR = 3_600_000;

export type WindowReason =
  /** No paid unlock (and no grant). The free tier — one camera, always available. */
  | 'not-owned'
  /**
   * Owns LIVE_STUDIO through ANY route — a paid order, a bundle alias, a founder
   * seat, a comp grant, an internal account, or a live promo window. Every route is
   * already folded into `eventSkuActive`, so there is nothing left to branch on:
   * multi-cam is on, for the life of the event, no clock attached.
   */
  | 'owned';

export type WindowDecision = {
  /** May this event broadcast MORE THAN ONE camera right now? The one output. */
  multiCam: boolean;
  reason: WindowReason;
};

export type WindowInput = {
  /** Server-resolved LIVE_STUDIO entitlement (any route: order, bundle, grant, promo). */
  owned: boolean;
};

/**
 * THE decision — may this event broadcast multi-cam right now?
 *
 * Total and boring on purpose: `owned` is the whole test. See the module header
 * for what used to live here and why none of it survived LS6.
 */
export function decideBroadcastWindow(input: WindowInput): WindowDecision {
  return input.owned
    ? { multiCam: true, reason: 'owned' }
    : { multiCam: false, reason: 'not-owned' };
}

/* ══════════════════════════════════════════════════════════════════════════════
   THE 12-HOUR ARCHIVE GUARDRAIL (§ 4f ③) — a warning, never a cutoff.
   UNTOUCHED BY LS6: this is YouTube's own per-stream recording limit, unrelated to
   how Live Studio is billed.
   ══════════════════════════════════════════════════════════════════════════════ */

export type ArchiveGuard = {
  /** Whole hours this broadcast has been running. Null when nothing is on air. */
  hoursElapsed: number | null;
  /** Whole hours of recordable time left before the 12-hour archive cap. Clamped at 0. */
  hoursToCap: number | null;
  /** Approaching the cap — tell the host while they can still act on it. */
  warn: boolean;
  /** Past 12 hours: everything from here may not appear in the replay at all. */
  exceeded: boolean;
};

const NO_ARCHIVE_GUARD: ArchiveGuard = {
  hoursElapsed: null,
  hoursToCap: null,
  warn: false,
  exceeded: false,
};

function toDate(v: string | Date | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * How close is this broadcast to YouTube's 12-hour ARCHIVE limit?
 *
 * Measured from THIS broadcast's start, not from any purchase anchor: the cap is
 * per-stream, so a host who ended one broadcast and started another gets a fresh 12
 * hours — and telling them otherwise would push them to stop a stream they did not
 * need to stop.
 */
export function decideArchiveGuard(input: {
  /** When the CURRENT broadcast started (went_live_at ?? scheduled_start_at). */
  startedAt: string | Date | null;
  isLive: boolean;
  now: Date;
  capHours?: number;
  warnAtHours?: number;
}): ArchiveGuard {
  if (!input.isLive) return NO_ARCHIVE_GUARD;
  const startedAt = toDate(input.startedAt);
  if (!startedAt) return NO_ARCHIVE_GUARD;

  const capHours = input.capHours ?? YOUTUBE_ARCHIVE_HOURS;
  const warnAtHours = input.warnAtHours ?? ARCHIVE_WARN_AT_HOURS;

  const elapsedMs = input.now.getTime() - startedAt.getTime();
  // A start stamped in the future (clock skew between YouTube and us) is not a
  // 0-hour broadcast running backwards — it is "just started".
  const hoursElapsed = Math.max(0, Math.floor(elapsedMs / MS_PER_HOUR));

  return {
    hoursElapsed,
    hoursToCap: Math.max(0, capHours - hoursElapsed),
    warn: hoursElapsed >= warnAtHours,
    exceeded: hoursElapsed >= capHours,
  };
}
