/**
 * supplier-march — who among a couple's booked suppliers sees the Wedding March, read-only, in their event Hub
 * (owner, tracker 2026-10-23: YES — "the band and the coordinator (suppliers booked in those categories) see the
 * Wedding March read-only in their event Hub, the same data the couple's march uses").
 *
 * The band cues the processional to it; the coordinator lines the entourage up by it. Before this, `march_walks` RLS
 * admitted only the couple and their moderators, so the Song Desk read "Processional" with no line-up behind it.
 *
 * Pure: the console reads the march only for a booking this says yes to.
 */
import { isCoordinatorTrade } from '@/lib/coordinator-trade';
import { isMusicToolCategory } from '@/lib/songs';
import type { MarchSection } from '@/lib/march-drag';

/** A booking in a music category (band · DJ · singer · choir · strings …) or the coordinator trade. */
export function supplierSeesMarch(bookedCategories: readonly string[]): boolean {
  return isMusicToolCategory(bookedCategories) || isCoordinatorTrade(bookedCategories);
}

/** Walks in the march — every row of every section. */
export function marchWalkCount(sections: readonly MarchSection[]): number {
  return sections.reduce((n, s) => n + s.rows.length, 0);
}
