/**
 * 🎟 THE GIFT'S TICKET PICTURE — the award kit's reward ticket (#7752, `ticket-svg.ts`), drawn for the ticket the gift
 * itself names (`GiftMomentView.ticket`, lib/gift-moment.ts). A badge reward's frame wears its tier's metal (owner 15 Nov,
 * "Award ticket frame metal matches the tier"), exactly as `RewardTicket` prints it. Imported only by the lazily loaded
 * popup, so the page's first load carries none of the ticket art.
 */
import { TICKET_SPECS, rimForTier, ticketDataUri } from '@/app/_components/award/ticket-svg';
import type { GiftMomentView } from '@/lib/gift-moment';
import type { GiftTicket } from './gift-moment';

export function giftTicketOf(view: Pick<GiftMomentView, 'ticket' | 'detail' | 'received'>): GiftTicket | null {
  const t = view.ticket;
  if (!t) return null;
  const base = TICKET_SPECS[t.kind];
  if (!base) return null;
  const spec = t.tier ? { ...base, rim: rimForTier(t.tier) } : base;
  return { src: ticketDataUri(t.kind, spec), label: view.detail ?? view.received };
}
