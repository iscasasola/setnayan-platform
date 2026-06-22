import { DoorOpen, MapPin } from 'lucide-react';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import type { EventTableRow } from '@/lib/seating';
import type { EntrancePos } from '@/lib/indoor-blueprint';

type Props = {
  tableLabel: string;
  venueName: string | null;
  tables: EventTableRow[];
  entrance: EntrancePos;
  targetTableId: string;
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
export function YourSeatBlock({ tableLabel, venueName, tables, entrance, targetTableId }: Props) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6">
      <header className="space-y-1.5 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Your seat
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          You&rsquo;re at <span className="text-emerald-700">{tableLabel}</span>
        </h2>
        {venueName ? (
          <p className="inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {venueName}
          </p>
        ) : null}
      </header>
      <div className="mt-5">
        <WayfindingMap tables={tables} entrance={entrance} targetTableId={targetTableId} />
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-ink/65">
        <DoorOpen aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
        Walk in from the entrance and follow the dotted path to your table.
      </p>
    </section>
  );
}
