// ============================================================================
// THE POST EVENT BAR'S TWO NEW DOORS — Film and Suppliers — and where they land.
// ============================================================================
//
// Owner, 2026-09-25 (DECISION_LOG "POST EVENT — OWNER ANSWERS TO FABLE'S FIVE"),
// answer 1 = yes: the Post Event Event Bar is Recap · Film · Suppliers · Gallery ·
// Me, and an EMPTY SLOT IS NOT DRAWN (the rest widen). "Suppliers", never
// "Vendors" (owner 2026-09-27).
//
// ── WHY THIS FILE EXISTS — the same reason `gallery-anchor.ts` does ──────────
// Two things must agree about each door, and they live in different files:
//
//   1. `editorial-content.tsx` — WHERE the landing is on the page (the film's
//      open-up, the first team scene's anchor id).
//   2. `site-body.tsx`         — WHETHER the slot is drawn at all.
//
// If (2) draws Film while (1) drew no film, a guest taps it and nothing opens —
// the dead tab the whole bar exists to prevent. Both halves read THE SAME pure
// function here, so the answer is derived once, not typed twice.
//
// Pure + client-safe, no imports from `./data` beyond types.

import type { EditorialOrderKey } from './editorial-order';

/** The id the first team scene carries — where the bar's Suppliers slot lands. */
export const POST_EVENT_SUPPLIERS_ANCHOR = 'post-event-suppliers';

/** The team blocks, in the order a guest meets them. `team` sits in the article, above the run. */
export type PostEventTeamKey = 'team' | Extract<EditorialOrderKey, 'fromVendors' | 'vendorsWeLoved'>;

/** Primitive facts only (numbers, booleans) — the caller cannot hand a half-read story. */
export type PostEventBarInput = {
  /** `draft_json.sections`. A block shows unless its key is explicitly `false`. */
  sections?: Partial<Record<string, boolean>> | null;
  /** A Live Studio replay the page may show (`watchFilmEmbedUrl` resolved). */
  broadcast: boolean;
  /** The couple's own attached films. */
  films: number;
  /** The supplier credits the article's team block draws. */
  teamVendors: number;
  vendorMedia: number;
  vendorsWeLoved: number;
};

/**
 * Is the film scene on the page? The SAME gate the run's `watchFilm` node uses:
 * the broadcast answers to the couple's switch; their own films are theirs and
 * show whenever they exist (owner 2026-09-02 — they must not depend on an unlock).
 */
export function postEventFilmDrawn(input: PostEventBarInput): boolean {
  const isOn = (k: string) => input.sections?.[k] !== false;
  return (isOn('watchFilm') && input.broadcast) || input.films > 0;
}

/**
 * Which team block carries the Suppliers anchor — the FIRST one drawn, in the
 * order the guest reads: the article's team first (it sits above the run), then
 * the couple's own saved order for the other two. Null → the slot is not drawn.
 */
export function postEventSuppliersAnchorKey(
  input: PostEventBarInput,
  order: readonly EditorialOrderKey[],
): PostEventTeamKey | null {
  const isOn = (k: string) => input.sections?.[k] !== false;
  if (isOn('team') && input.teamVendors > 0) return 'team';
  for (const key of order) {
    if (key === 'fromVendors' && isOn('fromVendors') && input.vendorMedia > 0) return 'fromVendors';
    if (key === 'vendorsWeLoved' && isOn('vendorsWeLoved') && input.vendorsWeLoved > 0) return 'vendorsWeLoved';
  }
  return null;
}
