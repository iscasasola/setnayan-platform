import { QrCode } from 'lucide-react';

/**
 * 🎟 THE TICKET WHILE ITS PICTURE IS STILL BEING DRAWN (owner 2026-10-05, live
 * on maria-and-jose: the ticket sat blank white for seconds). The ticket's own
 * shape — a cream card, a band at the top, the guest's name, a QR mark — so the
 * box reads as "their ticket, on its way", never as an empty white rectangle.
 * It stays UNDER the picture once it arrives (the opaque ticket covers it), so
 * the fade-in never passes through an empty box; only the pulse stops.
 *
 * ONE placeholder, two places: the guest card's thumbnail (`thumb`) and the
 * Maker's Guest's ticket scene (`stage`). Absolutely placed — the caller's box
 * holds the 3:4 shape.
 */
export function TicketPlaceholder({
  name,
  waiting,
  size = 'thumb',
}: {
  /** The guest's name; null when it is not known yet (the shape and the QR mark still hold the box). */
  name: string | null;
  waiting: boolean;
  size?: 'thumb' | 'stage';
}) {
  const stage = size === 'stage';
  return (
    <span
      aria-hidden
      className={`absolute inset-0 flex flex-col items-center overflow-hidden bg-cream ring-1 ring-ink/10 ${
        stage ? 'rounded-md shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)]' : 'rounded-lg shadow-[0_6px_18px_-10px_rgba(30,26,18,.45)]'
      }`}
      data-guest-ticket-waiting={waiting ? '' : undefined}
    >
      <span className="block h-[18%] w-full bg-ink/[0.06]" />
      {name ? (
        <span className={`line-clamp-2 text-center font-display leading-tight text-ink/70 ${stage ? 'mt-6 px-4 text-[20px]' : 'mt-2 px-1.5 text-[11px]'}`}>
          {name}
        </span>
      ) : null}
      <QrCode className={`mt-auto text-ink/25 ${stage ? 'mb-10 h-20 w-20' : 'mb-3 h-7 w-7'}${waiting ? ' animate-pulse' : ''}`} strokeWidth={1.5} />
    </span>
  );
}
