import { DoorOpen, MapPin } from 'lucide-react';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import { ArrivalGreeting } from './arrival-greeting';
import type { EventTableRow } from '@/lib/seating';
import type { EntrancePos } from '@/lib/indoor-blueprint';

type Props = {
  tableLabel: string;
  venueName: string | null;
  tables: EventTableRow[];
  entrance: EntrancePos;
  targetTableId: string;
  /** Guest's first name — drives the personal arrival greeting on check-in. */
  firstName: string;
  /** True once this guest has scanned in at the door (a guest_checkins row).
   *  Flips the neutral "here's your table" header to a warm arrival bloom. */
  arrived: boolean;
};

/**
 * "Your seat" block — surfaces the guest's table + the entrance→table
 * wayfinding map INLINE on the couple's event website, so an identified guest
 * sees where they sit (and how to get there) without tapping through to the
 * dedicated /[slug]/find-my-table page. Rendered only when the guest has an
 * assigned table AND the couple owns the paid Indoor Blueprint SKU (gated in
 * the page body). Reuses the same WayfindingMap + tables/entrance find-my-table
 * uses; inherits the couple's mood-board palette from InvitationShell.
 */
export function YourSeatBlock({
  tableLabel,
  venueName,
  tables,
  entrance,
  targetTableId,
  firstName,
  arrived,
}: Props) {
  // Pahina (design 2026-07-25 §11a): the guest-personal layer is STARRED, not
  // numbered — a gild ✦ marks "this belongs to you" while editorial chapters
  // keep their №. Rendered as a recessed plate with the printed inner hairline;
  // the arrival bloom warms it with gild instead of champagne-gold.
  return (
    <section
      className={`pahina-plate sm:p-6 ${
        arrived ? 'border-gild/40 bg-gradient-to-br from-paper-deep to-gild/10' : ''
      }`}
    >
      {/* Day-of arrival: once the guest has checked in at the door, the header
          blooms into a warm personal greeting instead of the neutral seat copy.
          Before check-in it's the normal seat pass. */}
      {arrived ? (
        <header className="text-center">
          <ArrivalGreeting firstName={firstName} tableLabel={tableLabel} />
          {venueName ? (
            <p className="mt-1.5 inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {venueName}
            </p>
          ) : null}
        </header>
      ) : (
        <header className="space-y-1.5 text-center">
          <p className="pahina-eyebrow justify-center">
            <span aria-hidden>✦</span>
            <span>Your seat</span>
          </p>
          <h2 className="font-pahina text-2xl font-light italic leading-tight tracking-tight text-ink sm:text-3xl">
            You&rsquo;re at <span className="text-gild">{tableLabel}</span>
          </h2>
          {venueName ? (
            <p className="inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {venueName}
            </p>
          ) : null}
        </header>
      )}
      <div className="mt-5">
        <WayfindingMap tables={tables} entrance={entrance} targetTableId={targetTableId} />
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-ink/65">
        <DoorOpen aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.5} />
        {arrived
          ? 'Follow the dotted path to your table — see you there.'
          : 'Walk in from the entrance and follow the dotted path to your table.'}
      </p>
    </section>
  );
}
