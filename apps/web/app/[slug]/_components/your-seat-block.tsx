import { ArrivalGreeting } from './arrival-greeting';
import { OnYourTicket, SeatFloorPlan, SeatPlaceCard, SeatTableNumber } from './your-seat-styles';

type Props = {
  tableLabel: string;
  venueName: string | null;
  /** The venue floor plan, read-only, the guest's table marked YOU — SVG markup
   *  drawn on the server by the seat plan's own renderer (`GuestSeatMap.plan`). */
  plan: string;
  /** True once this guest has scanned in at the door (a guest_checkins row).
   *  Flips the neutral "here's your table" header to a warm arrival bloom. */
  arrived: boolean;
  /** 🎨 `map` (this, the default) · `table-number` · `place-card` — `your-seat-styles.tsx`. */
  sceneStyle?: string | null;
  /** 🪪 The Place card's name — `placeCardName` ("Mr. Manuel C. Casasola"), null = none. */
  formalName?: string | null;
  /** 🪪 …drawn in the hero's Names look (`hubElementInlineStyle`), resolved on the server. */
  nameStyle?: Record<string, string>;
};

/**
 * "Your table" block — the guest's table + the venue floor plan with YOU, on
 * the day's Welcome (owner 2026-10-01, prototype the_day_guest_phone frame 2a:
 * "Your table · Table 7 · it's on your ticket in Me", then the plan). Rendered
 * only when the guest has a table and seats may be seen (the loader asks
 * `guestsMaySeeSeatsFor`) — so before the day this page has no table and no
 * plan at all. The plan is the seat plan's own renderer, drawn on the server.
 */
export function YourSeatBlock({
  tableLabel,
  venueName,
  plan,
  arrived,
  sceneStyle = null,
  formalName = null,
  nameStyle,
}: Props) {
  const same = { tableLabel, venueName, plan, arrived };
  if (sceneStyle === 'table-number') return <SeatTableNumber {...same} />;
  if (sceneStyle === 'place-card') return <SeatPlaceCard {...same} formalName={formalName} nameStyle={nameStyle} />;
  // Pahina (design 2026-07-25 §11a): the guest-personal layer is STARRED, not
  // numbered — a gild ✦ marks "this belongs to you". (Editorial chapters used
  // to keep their own №; owner 2026-09-25 "drop the numbers" removed those, so
  // the star is the only numeral-shaped mark left.) Rendered as a recessed
  // plate with the printed inner hairline; the arrival bloom warms it with
  // gild instead of champagne-gold.
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
          <ArrivalGreeting tableLabel={tableLabel} />
        </header>
      ) : (
        <header data-your-table="" className="space-y-1.5 text-center">
          <p className="pahina-eyebrow justify-center">
            <span aria-hidden>✦</span>
            <span>Your table</span>
          </p>
          <h2 className="font-pahina text-4xl font-light leading-tight tracking-tight text-gild sm:text-5xl">{tableLabel}</h2>
          <OnYourTicket />
        </header>
      )}
      {/* The venue is the Welcome's own, under the walking order (one place per
          fact on the page) — not repeated here. */}
      <div className="mt-5">
        <SeatFloorPlan plan={plan} tableLabel={tableLabel} />
      </div>
    </section>
  );
}
