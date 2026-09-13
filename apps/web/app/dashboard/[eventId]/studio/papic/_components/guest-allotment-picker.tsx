'use client';

/**
 * FINDING ONE GUEST AMONG TWO HUNDRED.
 *
 * The allotment picker rendered every guest, in first-name order, inside a
 * ~288px scroll box. That is fine for a dozen and unusable for a real Filipino
 * guest list: the owner's own words, 2026-08-31 — *"there might be over 200
 * guests, and we should not list them all. or let the user search a guest from
 * the list and show what they have?"*
 *
 * Two changes, both small, neither of which touches the allotment MODEL (that
 * ships already — `papic_guest_spend_ceilings`, one row per named guest, with
 * `splitTheRest` dividing the remainder):
 *
 *   1. A search box filters the list by name.
 *   2. GUESTS THE COUPLE HAS ALREADY NAMED SORT FIRST, always. Their choices are
 *      the thing they came back to check or change, and alphabetical order buried
 *      them at whatever letter they happened to start with. This holds while
 *      searching too, so a query that matches both a named and an un-named guest
 *      shows the named one first.
 *
 * ⚖ IT IS A FILTER, NOT A FETCH. Every guest is already loaded and rendered by
 * the server component; this only decides which rows are visible. So a guest who
 * does not match the query is hidden, never unloaded, and clearing the box
 * restores the full list with no round trip. Nothing here can change what a
 * guest is allotted — each row is still its own `<form>` posting the same
 * `setGuestAllotment` server action, so the control keeps working exactly as it
 * did, including without JavaScript.
 */

import { useMemo, useState } from 'react';

import { SubmitButton } from '@/app/_components/submit-button';
import { orderAllotmentPickerRows } from '@/lib/papic-guest-allotments';

export type AllotmentPickerGuest = {
  guestId: string;
  name: string;
  /** Sponsor tier, or 'guest'. Shown as a chip; drives the suggested number. */
  role: string;
  /** The saved allotment, or null when this guest has never been named. */
  saved: number | null;
  /** The opening number to show when nothing is saved. */
  suggested: number;
};

type Props = {
  eventId: string;
  guests: readonly AllotmentPickerGuest[];
  /** The `setGuestAllotment` server action, passed down from the server component. */
  action: (formData: FormData) => void | Promise<void>;
};

export function GuestAllotmentPicker({ eventId, guests, action }: Props) {
  const [query, setQuery] = useState('');

  // The ordering rule is pure and lives in lib/papic-guest-allotments.ts, beside
  // the split arithmetic it belongs with — so it can be unit-tested, which a
  // rule buried in a client component cannot be.
  const ordered = useMemo(() => orderAllotmentPickerRows(guests, query), [guests, query]);

  const namedCount = useMemo(() => guests.filter((g) => g.saved != null).length, [guests]);
  const searching = query.trim().length > 0;

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor="allotment-search">
        Search guests by name
      </label>
      <input
        id="allotment-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${guests.length} guests…`}
        className="w-full rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
      />

      <p aria-live="polite" className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink/45">
        {searching
          ? `${ordered.length} of ${guests.length}`
          : namedCount > 0
            ? `${namedCount} named · ${guests.length} guests`
            : `${guests.length} guests`}
      </p>

      {ordered.length === 0 ? (
        <p className="px-2 py-3 text-xs text-ink/55">
          Nobody on your guest list matches “{query.trim()}”.
        </p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {ordered.map((g) => (
            <li key={g.guestId}>
              <form
                action={action}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink/[0.03]"
              >
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="guest_id" value={g.guestId} />
                <span className="flex-1 truncate text-sm text-ink">
                  {g.name}
                  {g.role !== 'guest' ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                      {g.role}
                    </span>
                  ) : null}
                </span>
                <input
                  type="number"
                  name="allotment"
                  min={0}
                  step={1}
                  defaultValue={g.saved ?? ''}
                  placeholder={String(g.suggested)}
                  aria-label={`Credits for ${g.name}`}
                  className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                />
                <SubmitButton className="rounded-lg bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-ink/10">
                  Save
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
