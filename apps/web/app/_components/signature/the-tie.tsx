'use client';

import { deviceStore, tieFromList, tiePlays } from '@/lib/signature-moments';
import { useMoment } from './use-moment';

export type TieSide = { name: string; sub?: string | null };

/**
 * ① THE TIE (motion standard § 9; prototype Part I "The Tie") — a gold thread draws between the couple's card and the
 * supplier's, and a wine seal lands where they meet. Booking confirmed; ONCE PER BOOKING on this device — after that
 * the seal just sits there, still. Reduced motion: thread and seal shown at once.
 *
 * 🤝 WHERE IT MEETS CELEBRATE: The Tie takes "booking confirmed" from Celebrate (§ 9) — Celebrate's booking hook should
 * render THIS part and nothing of its own; Celebrate keeps payments and badges.
 */
export function TheTie({ bookingId, couple, supplier, word = 'Booked' }: { bookingId: string; couple: TieSide; supplier: TieSide; word?: string }) {
  const play = useMoment(() => (tiePlays(deviceStore('local'), bookingId) ? true : null));
  return <TieStage play={play === true} couple={couple} supplier={supplier} word={word} />;
}

/**
 * The couple's Booked list: ties the ONE booking this device has not yet seen booked (`tieFromList`), and draws nothing
 * when there is no news — the list below it is unchanged.
 */
export function TheTieForList({ eventId, couple, bookings }: { eventId: string; couple: TieSide; bookings: readonly { id: string; name: string; sub?: string | null }[] }) {
  const id = useMoment(() => tieFromList(deviceStore('local'), eventId, bookings.map((b) => b.id)));
  const booking = id ? bookings.find((b) => b.id === id) : null;
  if (!booking) return null;
  return <TieStage play couple={couple} supplier={{ name: booking.name, sub: booking.sub }} word="Booked" />;
}

export function TieStage({ play, couple, supplier, word }: { play: boolean; couple: TieSide; supplier: TieSide; word: string }) {
  return (
    <div className="sn-sig sn-sig-stage sn-sig-tie" data-sig="tie" data-sig-play={play ? '' : undefined} role="img" aria-label={`${word}: ${couple.name} and ${supplier.name}`}>
      <div className="sn-sig-tie-who" data-side="couple" aria-hidden>
        {couple.name}
        {couple.sub ? <small>{couple.sub}</small> : null}
      </div>
      <div className="sn-sig-tie-who" data-side="supplier" aria-hidden>
        {supplier.name}
        {supplier.sub ? <small>{supplier.sub}</small> : null}
      </div>
      <i className="sn-sig-tie-thread" aria-hidden />
      <i className="sn-sig-tie-ring" aria-hidden />
      <span className="sn-sig-tie-seal" aria-hidden>✓</span>
      <div className="sn-sig-tie-word" aria-hidden>{word}</div>
    </div>
  );
}
