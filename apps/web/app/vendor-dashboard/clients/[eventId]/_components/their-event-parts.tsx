import { formatCount } from '@/lib/format-number';
import { GROUP_NOT_YOURS, groupDriftWords } from '@/lib/their-event';
import type { BookingGroupRead } from '@/lib/their-event.server';

/**
 * 🚪 Two parts of "Their event" that had no page of their own (owner 2026-11-21): NUMBERS (headcount and packs, from
 * the brief, with the booking group's live count beside the booked count — a drift is said, never re-priced) and
 * GUESTS (the booking's ONE group, from `supplier_booking_group`). A refused read (`group === null`) is said, never an
 * empty group. Drawn by `their-event/[part]/page.tsx` and the lab.
 */
type Pax = { invited: number; attending: number; maybe: number; pending: number; declined: number };

export function NumbersPart({ pax, group }: { pax: Pax; group: BookingGroupRead }) {
  const drift = group?.status === 'ok' ? groupDriftWords(group.guests.length, group.booked) : null;
  return (
      <div className="space-y-3 p-4" data-their-event-numbers="">
        <h1 className="text-lg font-semibold text-ink">Numbers</h1>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-ink/60">Invited</dt><dd className="text-[17px] text-ink">{formatCount(pax.invited)}</dd></div>
          <div><dt className="text-ink/60">Coming</dt><dd className="text-[17px] text-ink">{formatCount(pax.attending)}</dd></div>
          <div><dt className="text-ink/60">Maybe</dt><dd className="text-[17px] text-ink">{formatCount(pax.maybe)}</dd></div>
          <div><dt className="text-ink/60">No reply</dt><dd className="text-[17px] text-ink">{formatCount(pax.pending)}</dd></div>
        </dl>
        {group === null ? (
          <p className="text-sm text-terracotta-700" data-group-refused="">We couldn’t load your group’s count. Reload to try again.</p>
        ) : group.status === 'ok' ? (
          <p className="text-sm text-ink" data-group-count="">
            {group.label}: {formatCount(group.guests.length)} in your group{drift ? ` · ${drift}` : ''}
          </p>
        ) : null}
      </div>
  );
}

export function GuestsPart({ group }: { group: BookingGroupRead }) {
  return (
      <div className="p-4" data-their-event-guests="">
        <h1 className="text-lg font-semibold text-ink">Guests · one group · view only</h1>
        {group === null ? (
          <p className="mt-2 text-sm text-terracotta-700" data-group-refused="">We couldn’t load your group. Reload to try again.</p>
        ) : group.status === 'not_your_client' ? (
          <p className="mt-2 text-sm text-ink/70" data-group-not-yours="">{GROUP_NOT_YOURS}</p>
        ) : group.status !== 'ok' ? (
          <p className="mt-2 text-sm text-ink/70">The hosts have not filled your group yet.</p>
        ) : (
          <>
            <p className="mt-1 text-[15px] text-ink">{group.label}</p>
            <p className="text-[13px] text-ink/60">{formatCount(group.guests.length)} guests in this group</p>
            <ul className="mt-2">
              {group.guests.map((g, i) => (
                <li key={`${g.name}-${i}`} className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-2 first:border-t-0">
                  <span className="min-w-0">
                    <span className="block text-[15px] text-ink">{g.name || 'A guest'}</span>
                    {g.diet ? <span className="block truncate text-[13px] text-ink/60">{g.diet}</span> : null}
                  </span>
                  <span className="shrink-0 text-[13px] text-ink/60">{g.rsvp === 'attending' ? 'Coming' : g.rsvp === 'declined' ? 'Not coming' : 'No reply'}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-ink/60">You see this group only. The hosts fill it. The other guests are not shown.</p>
          </>
        )}
      </div>
  );
}
