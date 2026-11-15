/**
 * lib/album-video-cost.ts — WHAT A VIDEO IMPORTED INTO A SUPPLIER'S EVENT ALBUM COSTS.
 *
 * Owner, verbatim (specs DECISION_LOG 2026-11-14 "FIVE OWNER ANSWERS IN ONE MESSAGE", (6), for #7610 step D):
 *   *"x3 of the video based on their seconds as compared to papic."*
 *
 * ⇒ an imported video costs THREE TIMES what Papic charges for the same seconds of video:
 *   · Papic's price for video is its length ladder, `papicSnippetCost` (lib/papic-cameras-pure.ts — the ONLY place the
 *     video weights are written). Up to a clip's length the import costs exactly what Papic charges a clip ADDED BY
 *     HAND: `papicCaptureCost('clip', ms, 'upload')`, the same ×`PAPIC_UPLOAD_MULTIPLIER`.
 *   · Papic's longest clip is the ladder's top band. A longer video is priced the way Papic would capture it — as
 *     back-to-back clips of that length, the last one charged for its own seconds — so every second is "compared to
 *     papic" and no rate is invented. (The ladder is split-proof — `papic-clip-cost.test.ts` — so this never undercuts
 *     shooting the same seconds in Papic.)
 *   · Seconds round UP (you pay for the second you are in), as `papicSnippetCost` already does.
 *   · An UNKNOWN length is not priced at all (null): the import is refused, because a video with no measured length
 *     has no ceiling — the "unknown costs the most" rule of `papicSnippetCost` has no "most" here.
 *
 * Not one number is written in this file; every weight is read from lib/papic-cameras-pure.ts.
 * 🔒 lib/album-video-cost.test.ts
 *
 * PURE: no I/O. Shared by the import form (the cost shown BEFORE the import) and the import route (the cost charged),
 * so the two cannot disagree.
 */
import { PAPIC_CLIP_COST_BANDS, PAPIC_UPLOAD_MULTIPLIER, papicSnippetCost } from './papic-cameras-pure';

/** Papic's longest clip, in milliseconds — the top band of its ladder. */
export const PAPIC_LONGEST_CLIP_MS = PAPIC_CLIP_COST_BANDS[PAPIC_CLIP_COST_BANDS.length - 1]!.maxSeconds * 1000;

/** Credits an imported video of `durationMs` spends, or null when its length is unknown (refuse the import). */
export function albumVideoCredits(durationMs: number | null | undefined): number | null {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return null;
  // Whole seconds first (rounded up), so a 10.2 s video is 11 s — the same rounding as the ladder.
  let leftMs = Math.ceil(durationMs / 1000) * 1000;
  let papic = 0;
  while (leftMs > 0) {
    const clip = Math.min(leftMs, PAPIC_LONGEST_CLIP_MS);
    papic += papicSnippetCost(clip);
    leftMs -= clip;
  }
  return papic * PAPIC_UPLOAD_MULTIPLIER;
}

/** The words the import button and the confirm say: "Import this video · 24 credits". */
export function albumVideoCostWords(credits: number): string {
  return `${credits.toLocaleString('en-PH')} ${credits === 1 ? 'credit' : 'credits'}`;
}
