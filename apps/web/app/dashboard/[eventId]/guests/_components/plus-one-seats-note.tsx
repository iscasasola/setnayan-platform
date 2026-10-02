'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { BringerSeat } from '@/lib/extra-seats';
import { formatCount } from '@/lib/format-number';
import { DeleteGuestButton } from './guest-delete';

/**
 * THE HOST'S VIEW OF A GUEST'S EXTRA SEATS — prototype
 * `rsvp_plus_ones_2026-09-29.html`, frame G.
 *
 * Owner, verbatim, 2026-09-29: *"adding +1-4 should be a host decision. and
 * their QR auto adapts to it?"* The number is the host's (the +0…+4 picker,
 * `PlusOneChipEditor`); the guest only names who fills the seats.
 *
 *   · `PlusOneSeatsSummary` — "+3 (2 named)": the number the host gave and how
 *     many of those seats already have a person in them;
 *   · `PlusOneOverNote` — when the host lowers the number BELOW the named seats
 *     (allowed since 2026-09-29 — the number is never refused, and a named
 *     person is never removed by it): the quiet warning "3 named · 1 allowed"
 *     with a Delete beside each name. Delete IS the host's own delete-a-guest
 *     (`DeleteGuestButton` → the one warning → `useGuestRemoval`, with Undo —
 *     owner 2026-10-03) — no second delete, no new action.
 *
 * Seats are numbered by SEAT everywhere (+1…+N): an unnamed one is "+2 · TBA".
 */

type SeatsIndex = {
  byBringer: Readonly<Record<string, readonly BringerSeat[]>>;
  /** An UNNAMED seat's own label ("+2 · TBA"), by its guest id. */
  placeholderLabel: Readonly<Record<string, string>>;
};

const EMPTY: readonly BringerSeat[] = [];
const BringerSeatsContext = createContext<SeatsIndex>({ byBringer: {}, placeholderLabel: {} });

/** Provided ONCE by the roster, from the FULL guest list (`bringerSeatsFrom`). */
export function BringerSeatsProvider({
  seats,
  children,
}: {
  seats: Readonly<Record<string, readonly BringerSeat[]>>;
  children: ReactNode;
}) {
  const value = useMemo<SeatsIndex>(() => {
    const placeholderLabel: Record<string, string> = {};
    for (const list of Object.values(seats)) for (const s of list) if (!s.named) placeholderLabel[s.guest_id] = s.label;
    return { byBringer: seats, placeholderLabel };
  }, [seats]);
  return <BringerSeatsContext.Provider value={value}>{children}</BringerSeatsContext.Provider>;
}

/** This guest's extra seats, oldest first ([] when none). */
export function useBringerSeats(guestId: string): readonly BringerSeat[] {
  return useContext(BringerSeatsContext).byBringer[guestId] ?? EMPTY;
}

/** "+2 · TBA" when this row IS an unnamed seat, else null (draw the name). */
export function usePlaceholderLabel(guestId: string): string | null {
  return useContext(BringerSeatsContext).placeholderLabel[guestId] ?? null;
}

export function PlusOneSeatsSummary({ count, seats }: { count: number; seats: readonly BringerSeat[] }) {
  const named = seats.filter((s) => s.named).length;
  if (count === 0 && named === 0) return null;
  return (
    <span data-plus-one-summary>
      +{formatCount(count)}
      {named > 0 ? ` (${formatCount(named)} named)` : ''}
    </span>
  );
}

export function PlusOneOverNote({
  eventId,
  guestName,
  count,
  seats,
  className = '',
}: {
  eventId: string;
  guestName: string;
  count: number;
  seats: readonly BringerSeat[];
  className?: string;
}) {
  const named = seats.filter((s) => s.named);
  if (named.length <= count) return null;
  const first = guestName.trim().split(/\s+/)[0] || 'This guest';
  return (
    <div
      role="status"
      data-plus-one-over
      className={`mt-1.5 space-y-1 border-l-2 border-[var(--sn-gold-700)] pl-2.5 text-xs text-ink/75 ${className}`}
    >
      <p>
        <b className="font-semibold text-ink">
          {formatCount(named.length)} named · {formatCount(count)} allowed.
        </b>{' '}
        {first} named more people than their seats. Delete one, or allow more seats.
      </p>
      <ul className="space-y-0.5">
        {named.map((s) => (
          <li key={s.guest_id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-ink">{s.label}</span>
            <DeleteGuestButton eventId={eventId} guestId={s.guest_id} guestName={s.label} />
          </li>
        ))}
      </ul>
    </div>
  );
}
