/**
 * lib/quote-doors.ts — the SHAPE of what the quote's offer and bundle doors are handed (read by
 * `lib/quote-doors.server.ts`, drawn by `ProposalMaker`). Types only, so the client can import it.
 */
import type { LockNeed } from '@/app/_components/lock/locked-feature';
import type { Offer } from '@/lib/offers';

export type QuoteOffersDoor = { kind: 'locked'; need: LockNeed } | { kind: 'unread' } | { kind: 'read'; offers: Offer[]; today: string };
export type QuoteBundlesDoor =
  | { kind: 'off' }
  | { kind: 'locked'; need: LockNeed }
  | { kind: 'unread' }
  | { kind: 'read'; bundles: { id: string; name: string }[] };
export type QuoteDoors = { offers: QuoteOffersDoor; bundles: QuoteBundlesDoor };
