import { DoorOpen, MapPin } from 'lucide-react';

import { tableLabelParts } from '@/lib/scene-style-text';
import { hubTabHref } from '../_lib/hub-tabs';

import { ArrivalGreeting } from './arrival-greeting';

/**
 * FIND YOUR SEAT'S OTHER TWO STYLES — B · The table number and C · The place
 * card (prototype `every_scene_three_styles_2026-09-29.html` §12). A · The map
 * is `YourSeatBlock` itself.
 *
 * Exactly A's props: the table label, the venue, the floor plan (drawn on the
 * server — `GuestSeatMap.plan`) and whether they have checked in. After
 * check-in every style trades its heading for the arrival greeting, as A does.
 * The plan is the same `SeatFloorPlan`; in "The table number" it waits behind a
 * tap (a native `<details>`, so it works before any script and holds no state).
 *
 * 🧭 THE PLAN IS THE VENUE FLOOR PLAN, READ-ONLY, WITH "YOU" (owner 2026-10-01,
 * DECISION_LOG "THE DAY GUEST PAGES — APPROVED, WITH ANSWERS"; prototype
 * the_day_guest_phone frame 2a) — the seat plan's own renderer
 * (`lib/seat-plan-preview-svg.ts`), never a second drawing of the room. It
 * replaced the entrance→table wayfinding map and its "follow the dotted path"
 * line, which described a path this plan does not draw.
 */

export type YourSeatProps = {
  tableLabel: string;
  venueName: string | null;
  /** The floor plan as SVG markup, the guest's table marked YOU (`seatPlanPreviewSvg`). */
  plan: string;
  arrived: boolean;
};

/**
 * The floor plan, read-only. `data-allow-zoom` hands pinch back to the browser
 * here (`app/_components/zoom-guard.tsx` keeps it off everywhere else), so the
 * caption's "Pinch to zoom" is true. Server markup: no client code.
 */
export function SeatFloorPlan({ plan, tableLabel }: { plan: string; tableLabel: string }) {
  return (
    <figure data-allow-zoom="" data-seat-floor-plan="" className="space-y-2">
      <div
        role="img"
        aria-label={`The floor plan — ${tableLabel} is marked You`}
        className="overflow-hidden rounded-xl border border-ink/10"
        dangerouslySetInnerHTML={{ __html: plan }}
      />
      <figcaption className="flex items-center justify-between gap-3 text-xs text-ink/60">
        <span>{tableLabel} · you</span>
        <span>Pinch to zoom</span>
      </figcaption>
    </figure>
  );
}

/** "It's on your ticket in Me" — the full ticket lives on Me (owner 2026-10-01, answer 3). */
export function OnYourTicket() {
  return (
    <a href={hubTabHref('me')} className="text-sm text-ink/60 underline-offset-4 hover:underline">
      It&rsquo;s on your ticket in Me
    </a>
  );
}

function Venue({ venueName }: { venueName: string | null }) {
  return venueName ? (
    <p className="inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
      <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      {venueName}
    </p>
  ) : null;
}

/** B · The table number — the number fills the screen; the map is one tap away. */
export function SeatTableNumber({ tableLabel, venueName, plan, arrived }: YourSeatProps) {
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
          <SeatFloorPlan plan={plan} tableLabel={tableLabel} />
        </div>
      </details>
    </section>
  );
}

/** C · The place card — your formal name and your table on a place card; the map beneath. */
export function SeatPlaceCard({
  tableLabel,
  venueName,
  plan,
  arrived,
  formalName = null,
  nameStyle,
}: YourSeatProps & {
  /** `placeCardName` — the formal name ("Mr. Manuel C. Casasola"); null draws the table alone. */
  formalName?: string | null;
  /** The hero's Names look, resolved on the server (`hubElementInlineStyle`). */
  nameStyle?: Record<string, string>;
}) {
  return (
    <section className="space-y-5" data-scene-style="place-card">
      {arrived ? (
        <div className="text-center">
          <ArrivalGreeting tableLabel={tableLabel} />
        </div>
      ) : null}
      <div className="mx-auto max-w-xs border border-ink/15 bg-paper-deep px-6 py-7 text-center shadow-sm">
        {/* 🪪 A place card is a name card (owner 2026-09-30): the guest's FORMAL
            name, in the hero's Names look — never a bare first name, which would
            be the casual greeting #6183 took off guest screens. */}
        {formalName ? (
          <>
            <p data-place-card-name="" className="font-pahina text-3xl font-light italic leading-tight text-ink" style={nameStyle}>
              {formalName}
            </p>
            <p aria-hidden className="my-3 text-gild">✦</p>
          </>
        ) : (
          <p aria-hidden className="mb-3 text-gild">✦</p>
        )}
        <p className="font-sans text-xs uppercase tracking-[0.28em] text-ink/60">Your table</p>
        <p className="mt-1 font-pahina text-4xl font-light leading-tight text-gild">{tableLabel}</p>
        <div className="mt-2">
          <Venue venueName={venueName} />
        </div>
      </div>
      <SeatFloorPlan plan={plan} tableLabel={tableLabel} />
    </section>
  );
}
