import { InfoTip } from '@/app/_components/info-tip';
import type { EventYouRun } from '@/lib/events-you-run';
import { EVENTS_YOU_RUN_LEDE, EVENTS_YOU_RUN_TIP } from '@/lib/events-you-run-words';
import { EventsYouRunRows } from './events-you-run-rows';
import { TodayEyebrow } from './supplier-today-first-screen';

/**
 * 🗂 The Events tab's body (owner "approved", 2026-10-28; prototype `coordinator_door_2026-10-28` frame B) — drawn by
 * the page with its read and by `/dev/supplier-lab?s=coord-events` with fixtures, so the lab shows what ships.
 *
 * The heading carries the ⓘ (house rule: details inside the ⓘ) with the owner-approved words — *"An event leaves this
 * list when its hosts turn your access off, or after the event."* Upcoming first; the ones whose day has passed but
 * whose window is still open sit under "After the event", last.
 */
export function EventsYouRunScreen({ events, measured }: { events: readonly EventYouRun[]; measured: boolean }) {
  const upcoming = events.filter((e) => e.rank !== 2);
  const after = events.filter((e) => e.rank === 2);
  return (
    <section data-events-you-run-screen="" aria-labelledby="events-you-run-title">
      <InfoTip
        label="Events you run"
        labelAs="h1"
        labelId="events-you-run-title"
        labelClassName="font-serif text-[24px] italic leading-tight text-ink"
        align="start"
      >
        {EVENTS_YOU_RUN_TIP}
      </InfoTip>
      <p className="mt-0.5 text-[13px] text-ink/60">{EVENTS_YOU_RUN_LEDE}</p>
      {events.length === 0 ? (
        <p className="mt-4 text-[15px] text-ink/70" data-events-you-run-empty={measured ? 'none' : 'unread'}>
          {measured ? 'No events to run right now.' : 'Couldn’t load your events. Try again in a moment.'}
        </p>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <>
              <TodayEyebrow>Upcoming</TodayEyebrow>
              <EventsYouRunRows events={upcoming} where="events" />
            </>
          ) : null}
          {after.length > 0 ? (
            <>
              <TodayEyebrow>After the event</TodayEyebrow>
              <EventsYouRunRows events={after} where="events" />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
