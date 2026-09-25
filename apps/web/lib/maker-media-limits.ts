import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Event Hub Maker — media limits (Phase 4, DECISION_LOG 2026-09-25).
 *
 * Two independent numbers, both owner-set, neither derived from the other:
 *
 *   • MAKER_MAX_CLIP_SECONDS (15) — a clip over this is REFUSED before any
 *     upload starts, with a plain sentence, no trimmer. "yes. if they sent
 *     more than 15 seconds... we detect it first then tell them to upload a
 *     video less than 15 seconds" — the SAME-DAY "add a trimmer" row was
 *     explicitly superseded by this one; do not resurrect the trimmer.
 *
 *   • MAKER_EVENT_MEDIA_BYTES_CAP (100 MB) — the couple's OWN uploads
 *     (photos, short clips, a Pro background song) share one allowance per
 *     event, counted AFTER compression, kept ≥10 years: "that means they can
 *     only upload a total of 100MB compressed files." Guest/Papic media is
 *     separate (credits) and never counts here.
 *
 * Pure, framework-free — no DOM/React import, so this is loadable from a
 * server action, a route handler, or a client component alike. The one piece
 * that DOES touch the DOM (`makeMakerVideoDurationValidator`) still lives
 * here rather than in a component file, because it is behaviour, not markup —
 * and every consumer of `<FileUpload validateFile={…}>` wants the exact same
 * function, not a re-derivation of the 15s rule per call site.
 */

/** A clip longer than this is refused before any network call. */
export const MAKER_MAX_CLIP_SECONDS = 15;

/**
 * The sentence the couple sees. Exact wording is the owner's, verbatim
 * (DECISION_LOG 2026-09-25) — do not paraphrase it, callers rely on the exact
 * string for their own copy/tests.
 */
export const MAKER_CLIP_TOO_LONG_MESSAGE = 'Please pick a video under 15 seconds.';

/** The couple's own upload allowance per event, counted AFTER compression. */
export const MAKER_EVENT_MEDIA_BYTES_CAP = 100 * 1024 * 1024; // 100 MB

/**
 * Container-rounding tolerance — a real 15.0s clip's metadata can round up by
 * a few tenths. Matches the tolerance the showcase video validator already
 * uses (`showcase-media-fields.tsx`) so the two 15/30s cousins behave the
 * same way for the same reason.
 */
const DURATION_TOLERANCE_S = 0.9;

/**
 * Read a local video File's duration via a metadata-only `<video>` element.
 * Resolves `null` when the duration can't be read (unsupported codec, or the
 * probe times out) — the caller must FAIL OPEN on `null`, because the 15s
 * rule's backstop is `maxVideoDurationS` on the compress pass
 * (`lib/video-compress.ts`), which trims regardless of whether the browser
 * could read the container.
 */
function probeClipDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    let url: string | null = null;
    const done = (d: number | null) => {
      if (settled) return;
      settled = true;
      if (url) URL.revokeObjectURL(url);
      resolve(d);
    };
    try {
      url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => {
        const d = video.duration;
        done(Number.isFinite(d) && d > 0 ? d : null);
      };
      video.onerror = () => done(null);
      video.src = url;
      // Never hang the picker on a stuck decode.
      setTimeout(() => done(null), 8000);
    } catch {
      done(null);
    }
  });
}

/**
 * Build the `<FileUpload validateFile={…}>` hook for a Maker video field:
 * refuses a clip over `MAKER_MAX_CLIP_SECONDS` with the exact owner sentence,
 * BEFORE any compression or network call. `report`, when given, receives the
 * measured length (or `null`) for a caller that wants to label the picker —
 * always cleared first, so a replacement clip whose duration can't be read
 * never inherits the previous clip's number.
 *
 * Fails OPEN on an unreadable duration, by contract with every other
 * `validateFile` in this codebase (`FileUploadProps.validateFile`'s own
 * docblock): the friendly gate lives here, the real backstop is
 * `maxVideoDurationS` passed to `compressVideoForWeb`.
 */
export function makeMakerVideoDurationValidator(
  report?: (seconds: number | null) => void,
): (file: File) => Promise<string | null> {
  return async (file: File) => {
    report?.(null);
    const seconds = await probeClipDurationSeconds(file);
    report?.(seconds);
    if (seconds !== null && seconds > MAKER_MAX_CLIP_SECONDS + DURATION_TOLERANCE_S) {
      return MAKER_CLIP_TOO_LONG_MESSAGE;
    }
    return null;
  };
}

/**
 * Pure meter state for the 100 MB allowance — no rendering, so it is testable
 * without a DOM and reusable by any surface that wants to show the number
 * (the Maker inspector today; a dashboard summary tomorrow).
 */
export type MakerMediaMeterState = {
  usedBytes: number;
  capBytes: number;
  /** 0–100, clamped — never negative, never over 100 even if usage exceeds the cap. */
  pct: number;
  remainingBytes: number;
  /** True once the couple has used the whole allowance (or somehow gone over it). */
  isFull: boolean;
  /** True in the last 10% of the allowance — the meter's "getting close" state. */
  isNear: boolean;
};

export function makerMediaMeterState(
  usedBytes: number,
  capBytes: number = MAKER_EVENT_MEDIA_BYTES_CAP,
): MakerMediaMeterState {
  const used = Number.isFinite(usedBytes) && usedBytes > 0 ? usedBytes : 0;
  const cap = Number.isFinite(capBytes) && capBytes > 0 ? capBytes : MAKER_EVENT_MEDIA_BYTES_CAP;
  const rawPct = (used / cap) * 100;
  const pct = Math.max(0, Math.min(100, rawPct));
  return {
    usedBytes: used,
    capBytes: cap,
    pct,
    remainingBytes: Math.max(0, cap - used),
    isFull: used >= cap,
    isNear: pct >= 90,
  };
}

/** `"12.4 MB of 100 MB used"` — the one label every meter surface shows. */
export function formatMakerMediaMeterLabel(state: MakerMediaMeterState): string {
  return `${formatMB(state.usedBytes)} of ${formatMB(state.capBytes)} used`;
}

/**
 * Read the event's current meter value. Works on either the host's own
 * session client (`events.couple_media_bytes` is `authenticated`-readable —
 * see the column's migration) or an admin client. Returns 0 on any read
 * failure or a missing row — a meter that cannot read its own number should
 * show empty, never crash the page that mounts it.
 */
export async function readCoupleMediaBytes(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number> {
  try {
    const { data } = await supabase
      .from('events')
      .select('couple_media_bytes')
      .eq('event_id', eventId)
      .maybeSingle();
    const value = (data as { couple_media_bytes?: number | null } | null)?.couple_media_bytes;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  // One decimal below 10 MB (small clips/photos are legible at that precision),
  // whole numbers above it — matches `bytesToHuman` house style in file-upload.tsx.
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}
