/**
 * claim-access-asks.ts — the shape of a supplier waiting to be let in, and the
 * one sentence the approval card says (owner 2026-10-20). Pure, so the client
 * card and the server read share it; the read is `claim-access-asks.server.ts`.
 */

import { formatCount } from '@/lib/format-number';

export type ClaimAccessAsk = {
  requestId: string;
  /** The shop's name — or, before they have one, the name the couple gave them. */
  name: string;
  /** "Coordinator", "Photographer"… — the couple's own category for the record. */
  categoryLabel: string;
  /** The coordinator trade: Approve gives them the same access as the couple. */
  coordinator: boolean;
  createdAt: string;
};

/** What Approve gives — a coordinator the couple's own access, anyone else their category's. */
export function claimAskLine(ask: Pick<ClaimAccessAsk, 'coordinator' | 'categoryLabel'>): string {
  return ask.coordinator
    ? 'Approve to give them the same access as you.'
    : `Approve to give them what a booked ${ask.categoryLabel.toLowerCase()} sees.`;
}

/** The doorway's one line for N waiting asks. */
export function claimAsksDoorwayTitle(asks: ReadonlyArray<Pick<ClaimAccessAsk, 'name'>>): string | null {
  if (asks.length === 0) return null;
  if (asks.length === 1) return `${asks[0]!.name} joined from your link`;
  return `${formatCount(asks.length)} suppliers joined from your link`;
}
