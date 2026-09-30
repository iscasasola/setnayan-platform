import { VENUE_ROLE_LABEL, type EventVenue } from '@/lib/event-venues';
import { calendarDay, dateInWords, monthName, weekdayName } from '@/lib/scene-style-text';

/**
 * THE DETAILS' OTHER TWO STYLES — B · Big date, two places and C · The card
 * (prototype `every_scene_three_styles_2026-09-29.html` §4). A · The plate is
 * `PublicEventDetails` itself.
 *
 * Same facts as the plate: the event's date and its places, already WITHHELD
 * by the page (`lib/venue-disclosure.ts`) — a place the couple keeps until the
 * reply stays kept here, because these styles only ever see what the plate
 * sees. No directions are added: the Venue map scene carries those, and a
 * directions search by name would hand out a withheld place one tap later.
 *
 * `dateIso` is the same `events.event_date` the plate's label is formatted
 * from; the card writes it in words FROM that date, never typed. With no
 * parseable date the styles print the plate's label as it is.
 */

type DetailsProps = {
  dateIso: string | null;
  dateLabel: string | null;
  places: readonly EventVenue[];
  /** A line under the places — the identified guest's own role and side. */
  footnote?: string | null;
};

function placeLabel(v: EventVenue, many: boolean): string {
  return many || v.role !== 'both' ? VENUE_ROLE_LABEL[v.role] : 'Where';
}

/** B · Big date, two places — the day as a number, the places side by side. */
export function DetailsBigDate({ dateIso, dateLabel, places, footnote = null }: DetailsProps) {
  const day = calendarDay(dateIso);
  const many = places.length > 1;
  return (
    <section className="space-y-4" data-scene-style="big-date">
      <p className="pahina-eyebrow">
        <span>The details</span>
      </p>
      {day ? (
        <div className="flex items-end gap-4">
          <p className="font-pahina text-[5rem] font-light leading-none tabular-nums text-ink">{day.day}</p>
          <div className="pb-2">
            <p className="font-pahina text-xl font-light leading-tight text-ink">
              {monthName(day.month)} {day.year}
            </p>
            <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">{weekdayName(day.weekday)}</p>
          </div>
        </div>
      ) : dateLabel ? (
        <p className="font-pahina text-2xl font-light leading-snug text-ink">{dateLabel}</p>
      ) : null}
      {places.length > 0 ? (
        <div className={`grid gap-4 border-t border-ink/12 pt-4 ${many ? 'grid-cols-2' : 'grid-cols-1 text-center'}`}>
          {places.map((v) => (
            <div key={v.role} data-venue-role={v.role} className="min-w-0">
              <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">{placeLabel(v, many)}</p>
              {v.name ? (
                <p className="mt-1 break-words font-pahina text-lg font-light leading-snug text-ink">{v.name}</p>
              ) : null}
              {v.address ? <p className="mt-1 break-words text-sm leading-relaxed text-ink/65">{v.address}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      {footnote ? <p className="text-sm text-ink/65">{footnote}</p> : null}
    </section>
  );
}

/** C · The card — centred, small caps, hairlines: the printed invitation's own grammar. */
export function DetailsCard({ dateIso, dateLabel, places, footnote = null }: DetailsProps) {
  const words = dateInWords(dateIso);
  const many = places.length > 1;
  return (
    <section className="space-y-4 text-center" data-scene-style="card">
      <p className="pahina-eyebrow justify-center">
        <span>The details</span>
      </p>
      <div className="mx-auto max-w-sm space-y-5 border-y border-ink/15 py-6">
        {words || dateLabel ? (
          <div className="space-y-1">
            <p className="font-sans text-xs uppercase tracking-[0.28em] text-gild">When</p>
            {words ? (
              <>
                <p className="font-pahina text-2xl font-light leading-snug text-ink">
                  {words.weekday}, {words.line}
                </p>
                <p className="font-sans text-sm uppercase tracking-[0.14em] text-ink/70">{words.year}</p>
              </>
            ) : (
              <p className="font-pahina text-2xl font-light leading-snug text-ink">{dateLabel}</p>
            )}
          </div>
        ) : null}
        {places.length > 0 && (words || dateLabel) ? (
          <p aria-hidden className="text-gild">✦</p>
        ) : null}
        {places.map((v) => (
          <div key={v.role} data-venue-role={v.role} className="space-y-1">
            <p className="font-sans text-xs uppercase tracking-[0.28em] text-gild">{placeLabel(v, many)}</p>
            {v.name ? <p className="font-pahina text-xl font-light leading-snug text-ink">{v.name}</p> : null}
            {v.address ? <p className="font-sans text-sm uppercase tracking-[0.1em] text-ink/65">{v.address}</p> : null}
          </div>
        ))}
      </div>
      {footnote ? <p className="text-sm text-ink/65">{footnote}</p> : null}
    </section>
  );
}
