import { DoorOpen, MapPin } from 'lucide-react';

import { WayfindingMap } from '@/app/_components/wayfinding-map';
import type { EventTableRow } from '@/lib/seating';
import type { EntrancePos } from '@/lib/indoor-blueprint';
import { tableLabelParts } from '@/lib/scene-style-text';

import { ArrivalGreeting } from './arrival-greeting';

/**
 * FIND YOUR SEAT'S OTHER TWO STYLES — B · The table number and C · The place
 * card (prototype `every_scene_three_styles_2026-09-29.html` §12). A · The map
 * is `YourSeatBlock` itself.
 *
 * Exactly A's props: the table label, the venue, the published plan's tables
 * and entrance, the guest's first name and whether they have checked in. After
 * check-in every style trades its heading for the arrival greeting, as A does.
 * The map is the same `WayfindingMap`; in "The table number" it waits behind a
 * tap (a native `<details>`, so it works before any script and holds no state).
 * The walk line is A's own sentence — no route is described that the plan
 * does not draw.
 */

export type YourSeatProps = {
  tableLabel: string;
  venueName: string | null;
  tables: EventTableRow[];
  entrance: EntrancePos;
  targetTableId: string;
  arrived: boolean;
};

const WALK = 'Walk in from the entrance and follow the dotted path to your table.';
const WALK_ARRIVED = 'Follow the dotted path to your table — see you there.';

function Venue({ venueName }: { venueName: string | null }) {
  return venueName ? (
    <p className="inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
      <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      {venueName}
    </p>
  ) : null;
}

/** B · The table number — the number fills the screen; the map is one tap away. */
export function SeatTableNumber({ tableLabel, venueName, tables, entrance, targetTableId, arrived }: YourSeatProps) {
  const { eyebrow, big } = tableLabelParts(tableLabel);
  return (
    <section className="space-y-4 text-center" data-scene-style="table-number">
      {arrived ? (
        <ArrivalGreeting tableLabel={tableLabel} />
      ) : (
        <p className="pahina-eyebrow justify-center">
          <span aria-hidden>✦</span>
          <span>Your seat</span>
        </p>
      )}
      <div>
        {eyebrow ? <p className="font-sans text-xs uppercase tracking-[0.28em] text-gild">{eyebrow}</p> : null}
        <p className="break-words font-pahina text-[6rem] font-light leading-none text-ink">{big}</p>
      </div>
      <Venue venueName={venueName} />
      <details className="group border-t border-ink/12 pt-3">
        <summary className="mx-auto flex min-h-[44px] w-fit cursor-pointer list-none items-center gap-2 text-sm text-ink/70 hover:text-ink">
          <DoorOpen aria-hidden className="h-4 w-4 text-gild" strokeWidth={1.5} />
          <span className="group-open:hidden">Tap to see the map</span>
          <span className="hidden group-open:inline">Hide the map</span>
        </summary>
        <div className="mt-3">
          <WayfindingMap tables={tables} entrance={entrance} targetTableId={targetTableId} />
          <p className="mt-3 text-sm text-ink/65">{arrived ? WALK_ARRIVED : WALK}</p>
        </div>
      </details>
    </section>
  );
}

/** C · The place card — your table on a place card; the map beneath. */
export function SeatPlaceCard({ tableLabel, venueName, tables, entrance, targetTableId, arrived }: YourSeatProps) {
  return (
    <section className="space-y-5" data-scene-style="place-card">
      {arrived ? (
        <div className="text-center">
          <ArrivalGreeting tableLabel={tableLabel} />
        </div>
      ) : null}
      <div className="mx-auto max-w-xs border border-ink/15 bg-paper-deep px-6 py-7 text-center shadow-sm">
        {/* 🎩 No first name (owner, DECISION_LOG 2026-09-30: no casual greetings on
            a guest's screen — `ArrivalGreeting`). The card is the table's. */}
        <p aria-hidden className="mb-3 text-gild">✦</p>
        <p className="font-sans text-xs uppercase tracking-[0.28em] text-ink/60">Your table</p>
        <p className="mt-1 font-pahina text-4xl font-light leading-tight text-gild">{tableLabel}</p>
        <div className="mt-2">
          <Venue venueName={venueName} />
        </div>
      </div>
      <WayfindingMap tables={tables} entrance={entrance} targetTableId={targetTableId} />
      <p className="flex items-center justify-center gap-2 text-center text-sm text-ink/65">
        <DoorOpen aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={1.5} />
        {arrived ? WALK_ARRIVED : WALK}
      </p>
    </section>
  );
}
