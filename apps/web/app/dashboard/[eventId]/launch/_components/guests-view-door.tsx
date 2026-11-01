import { Armchair, Footprints } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { GUESTS_VIEW_LABEL, guestsViewHref, type GuestsMakerView } from '@/lib/guests-views';

/**
 * 🗂 R4 · THE MAKER'S SEAT PLAN AND WEDDING MARCH ITEMS ARE DOORS NOW (owner 2026-10-27/28, DECISION_LOG "GUESTS = LIST
 * · MAP · SEATS · MARCH"). The makers moved WHOLE to Guests › Seats and Guests › March; the Maker no longer draws a
 * second copy of either. Their address (`?tool=details&item=seating|march`) lands in Guests (the launch page's first
 * step); a pick of either still inside the Maker (All items, a print's "Open Seat plan") draws THIS — where it lives,
 * and one door there.
 */
export function GuestsViewDoor({ eventId, view }: { eventId: string; view: GuestsMakerView }) {
  const what = view === 'seats' ? 'Your seat plan' : 'Your march';
  return (
    <div data-guests-view-door={view} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="text-[15px] text-ink/75">
        {what} lives in Guests › {GUESTS_VIEW_LABEL[view]} now.
      </p>
      <ActionButton
        tone="brand"
        icon={view === 'seats' ? Armchair : Footprints}
        label={`Open Guests › ${GUESTS_VIEW_LABEL[view]}`}
        href={guestsViewHref(eventId, view)}
      />
    </div>
  );
}
