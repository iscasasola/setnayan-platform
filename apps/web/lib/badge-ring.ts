/**
 * lib/badge-ring.ts — 🏅 EVERY SHOP BADGE SITS IN A PROGRESS RING (THE ONE BUILD §10 #32, owner 8 Nov: *"a progress bar
 * for all the badges… like a ring"*; Build 2 lane B2-B). Pure — the Shop badge row draws it with the shipped
 * `ProgressRing` (`app/_components/progress-ring.tsx`); tested in `lib/badge-ring.test.ts`.
 *
 *   HOW FULL  a ladder fills toward its NEXT tier — (n − step) / (next − step), the rung the tile already measured
 *             (`ladderOf(...).pct`); at the top rung it is full. An earned one-off is full; not yet is empty. Rating is
 *             average / 5. An unread badge is an EMPTY ring — never a guessed one.
 *   COLOUR    by what the badge is about (v118 `RINGC`): bookings green · reputation pink · being found blue · the rest
 *             gold. The track is the same colour, faint.
 */
import type { BadgeTile } from './shop-badge-row';

export type RingGroup = 'bookings' | 'reputation' | 'found' | 'other';

/** v118's ring colours (`RINGC`) — gold for the rest is the house accent. */
export const RING_COLOUR: Readonly<Record<RingGroup, string>> = {
  bookings: '#3f9a5a',
  reputation: '#b5508f',
  found: '#4a7bd0',
  other: 'rgb(var(--sn-accent))',
};

/** Which group each tile belongs to, by its tracker key. Anything not listed is "other" (gold). */
const GROUP: Readonly<Record<string, RingGroup>> = {
  // bookings — couples booking you, and booking you again
  milestone: 'bookings',
  'reward:first_booking': 'bookings',
  'reward:booked_loop': 'bookings',
  'reward:first_loop': 'bookings',
  'reward:first_pick': 'bookings',
  'reward:first_first_pick': 'bookings',
  // reputation — what couples say
  rating: 'reputation',
  'reward:reviews': 'reputation',
  'reward:first_review': 'reputation',
  'reward:first_five_star': 'reputation',
  'reward:award': 'reputation',
  // being found — what puts you in front of couples
  verified: 'found',
  'reward:inspiration': 'found',
  'reward:service_cards': 'found',
  'reward:branches': 'found',
};

/** The tile's group: its tracker kind for the tracker's own rows (milestone · rating · verified · award), else its key. */
export function ringGroup(tile: Pick<BadgeTile, 'key' | 'row'>): RingGroup {
  const kind = tile.row.kind;
  if (kind === 'milestone' || kind === 'rating' || kind === 'verified') return GROUP[kind]!;
  if (kind === 'award') return 'reputation';
  return GROUP[tile.key] ?? 'other';
}

/** How full the ring is, 0–100. Pure. */
export function ringPct(tile: Pick<BadgeTile, 'on' | 'ladder' | 'row' | 'num' | 'sub'>): number {
  if (tile.row.state === 'unread') return 0;
  if (tile.ladder) return tile.ladder.pct;
  if (tile.row.kind === 'rating') {
    const avg = Number(tile.num);
    return tile.on && Number.isFinite(avg) ? Math.max(0, Math.min(100, Math.round((avg / 5) * 100))) : 0;
  }
  return tile.on ? 100 : 0;
}

/** The ring's draw-in delay for the i-th tile (v118 `ringsIn`: 120 ms + 90 ms each, capped at the 7th). */
export const RING_MS = 1100;
export const RING_EASE = 'cubic-bezier(.33,1,.68,1)';
export function ringDelay(i: number): number {
  return 120 + Math.min(Math.max(0, i), 6) * 90;
}
