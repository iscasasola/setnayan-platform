'use client';

import { TheTieForList } from '@/app/_components/signature/the-tie';
import { useEventCoverWords } from '../../_components/home-loading-cover';

/**
 * 🕯 THE TIE on the couple's Booked list (motion standard § 9 ①): the couple learns a supplier said yes when they next
 * open Suppliers, so the thread is tied HERE — once per booking on this device, for the first booking it has not seen
 * booked. No news → nothing is drawn. The couple's names and date are the layout's own read (`useEventCoverWords`).
 */
export function BookedTie({ eventId, bookings }: { eventId: string; bookings: readonly { id: string; name: string; sub: string | null }[] }) {
  const cover = useEventCoverWords();
  if (!cover || bookings.length === 0) return null;
  return (
    <div className="mb-3" data-booked-tie="">
      <TheTieForList eventId={eventId} couple={{ name: cover.words.name, sub: cover.words.shortDate ?? null }} bookings={bookings} />
    </div>
  );
}
