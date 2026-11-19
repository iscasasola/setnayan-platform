/**
 * glide.ts — GLIDE'S TWO FACTS (MOTION_STANDARD_2026-11-18 § 4 #12): where a rail stands (which edge fades), and
 * whether a scroll that just stopped has met an end (the nudge). Pure, so the guard can hold them.
 */
import { MOTION_TABLE, QUICK_MS, TAP_MS } from './motion-table';

export type GlideAt = 'none' | 'start' | 'mid' | 'end';

/** Where a scroller stands: `none` = nothing to scroll (no fade at all); `start` / `end` = resting on that edge (only
 *  the OTHER edge fades); `mid` = both. A pixel of slack, so a fractional scroll position still counts as the end. */
export function glideAt(pos: number, size: number, view: number): GlideAt {
  const max = size - view;
  if (max <= 1) return 'none';
  const p = Math.abs(pos);
  if (p <= 1) return 'start';
  if (p >= max - 1) return 'end';
  return 'mid';
}

/** The nudge at an end: the content goes `px` over (Tap, Settle) and comes back (Quick, Spring) — never a loop. */
export const GLIDE_NUDGE = { px: MOTION_TABLE.glideNudgePx, outMs: TAP_MS, backMs: QUICK_MS } as const;

/** A scroll that stopped at an end only nudges when it ARRIVED there moving — never a rail that was already resting
 *  on its edge, and never when nothing scrolls. */
export function nudgeOnArrive(was: GlideAt, now: GlideAt): -1 | 0 | 1 {
  if (was === now || now === 'none' || now === 'mid' || was === 'none') return 0;
  return now === 'end' ? -1 : 1;
}
