'use client';
/**
 * 🎁 ONE GIFT, AS THE APPROVED BOX SHOWS IT — the popup (`gift-moment.tsx`) with the reward ticket the gift names
 * (`giftTicketOf`). Loaded lazily by `gift-moments.tsx`, which hands it the badge background (`stage`) and the drop-in
 * (`arrive`), so the ticket art is fetched only when a gift is about to show.
 */
import GiftMoment, { type GiftMomentProps } from './gift-moment';
import { giftTicketOf } from './gift-ticket';

export default function GiftMomentShown(props: Omit<GiftMomentProps, 'ticket'>) {
  return <GiftMoment {...props} ticket={giftTicketOf(props.view)} />;
}
