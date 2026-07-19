/**
 * Creator tier bands (Creator Economy P3 · owner-decided 2026-07-16).
 *
 * A PURE rendering of the ONE public metric — "inquiries driven" (the raw count
 * of chapter-attributed inquiries a vendor actually UNLOCKED, produced by
 * lib/inquiry-attribution.ts#fetchInquiriesDrivenForCreators with its two locked
 * guards). It is NEVER a second metric: the band is just a familiar-word label
 * over the number already shown next to it, so the chip only appears where the
 * raw count already renders (both hide at 0).
 *
 * Council simplest-approach verdict §2 (item 1): the tier ladder returns ONLY as
 * a rendering of the existing "inquiries driven" integer, owner-gated — never a
 * separate stored/computed metric. This module is that rendering and nothing
 * more: no DB read, no server-only import, deterministic.
 *
 * Bands (owner ladder, Creator_Economy_Discount_Collab_Build_Plan_2026-07-16 §
 * "Creator tiers" — placeholders, retune later):
 *   0        → no tier (Storyteller badge only — don't label every new creator)
 *   1–9      → Nano
 *   10–49    → Micro
 *   50–149   → Macro
 *   150+     → Mega
 */

export type CreatorTier = 'nano' | 'micro' | 'macro' | 'mega';

/**
 * The band for a raw "inquiries driven" count. Returns null at 0 (and for any
 * negative/NaN input) so the caller renders NO tier chip — a zero-influence
 * storyteller looks like any other storyteller (build plan § "Storyteller =
 * identity"; the deal is never attached to the identity).
 */
export function tierForInquiriesDriven(n: number): CreatorTier | null {
  if (!Number.isFinite(n) || n < 1) return null;
  if (n < 10) return 'nano';
  if (n < 50) return 'micro';
  if (n < 150) return 'macro';
  return 'mega';
}

/** Human label for a band. */
export const CREATOR_TIER_LABEL: Record<CreatorTier, string> = {
  nano: 'Nano',
  micro: 'Micro',
  macro: 'Macro',
  mega: 'Mega',
};
