/**
 * 👻 THE BOARD'S EXAMPLES — the user dashboard's empty shelves, each drawn as its OWN card with sample rows, greyed
 * under an "Example" chip (owner 2026-11-09, DECISION_LOG 🧱👻 ×2: *"on build 5, we also fillup the empty look by
 * supplying placeholders of how they would look like but greyed out of a user dashboard…"*; approved prototype
 * `prototypes/empty_looks_user_event_2026-11-10/`, frames "User · Planning shelf" · "User · Now happening · Ended ·
 * Told" · "User · Worth planning").
 *
 * 🔁 NOTHING HERE IS NEW ART. Each Example is the shelf's shipped card — `CollectionCard` with `EventPoster` on
 * Planning (the collection template), `CollectionCard` with `EventScene` on the other shelves, `YearMomentsList` on
 * Worth planning — fed `lib/empty-look-samples.ts`, inside the one shared `ExamplePreview`. The shelf's own words and
 * door above it stay exactly as shipped.
 *
 * 🔑 THE CALLER DECIDES WHEN. The board mounts an Example only on a shelf that is empty AFTER a read that answered
 * (`userEventsReadRefused` is false for every membership the board reads). `fetchUserEvents` degrades to `[]` on a
 * refused read, and an Example beside a board that could not be read would dress a failure as a fresh start.
 */
import { ExamplePreview } from '@/app/_components/states/empty-state';
import { CollectionCard, CollectionGrid } from '@/app/_components/collection-card';
import { EventPoster } from '@/app/_components/event-poster';
import type { EventPosterFacts } from '@/lib/event-poster';
import { SAMPLE_MOMENTS, SAMPLE_PLANNING, SAMPLE_SHELF, type SampleBoardEvent } from '@/lib/empty-look-samples';
import { EventScene } from './event-scene';
import { YearMomentsList, type YearMomentView } from './year-moments-list';

function samplePoster(e: SampleBoardEvent): EventPosterFacts {
  const [first, second] = e.name.split(' & ');
  return {
    kind: 'photo',
    accent: null,
    capiz: false,
    dark: true,
    names: { first: first ?? e.name, second: second ?? null },
    weekday: e.weekday,
    date: e.date,
    eyebrow: null,
    line: null,
    venue: null,
    photoSrc: e.photo,
    ground: 'hero',
    legibility: null,
  };
}

/** Planning — two poster cards, the collection template itself (prototype `posterWedding` · `posterDebut`). */
export function PlanningExample() {
  return (
    <ExamplePreview className="mt-3">
      <CollectionGrid layout="poster">
        {SAMPLE_PLANNING.map((e, i) => (
          <CollectionCard
            key={e.id}
            href={null}
            layout="poster"
            coverTone="dark"
            index={i}
            cover={<EventPoster poster={samplePoster(e)} markText={e.name.slice(0, 1)} />}
            kicker={[e.badge]}
            title={e.name}
            meta={e.meta}
            progress={{ pct: e.pct, remainder: e.remainder ?? '', srLabel: 'planned' }}
          />
        ))}
      </CollectionGrid>
    </ExamplePreview>
  );
}

/** Now happening · Ended (Untold) · Told — one glass card each, the shelf's own card (prototype frame 2). */
export function ShelfExample({ shelf }: { shelf: 'now' | 'ended' | 'told' }) {
  const e = SAMPLE_SHELF[shelf];
  const finished = shelf !== 'now';
  return (
    <ExamplePreview className="mt-3">
      <CollectionGrid>
        <CollectionCard
          href={null}
          muted={finished}
          cover={<EventScene eventId={e.id} eventType={e.type} photoSrc={e.photo} muted={finished} />}
          kicker={[e.badge]}
          title={e.name}
          place={e.place}
          meta={e.meta}
          progress={{ remainder: finished ? 'Kept for good' : 'Happening today' }}
        />
      </CollectionGrid>
    </ExamplePreview>
  );
}

/** Worth planning — the strip's own list with two days that come around (prototype "Mama’s 60th" · "Our 10th"). */
export function WorthPlanningExample() {
  const moments: YearMomentView[] = SAMPLE_MOMENTS.map((m, i) => ({
    key: `sample-moment-${i}`,
    isWedding: false,
    label: m.label,
    dateLabel: m.dateLabel,
    countdownLabel: m.countdownLabel,
    isMilestone: i === 0,
    eventId: null,
  }));
  return (
    <ExamplePreview className="mt-3">
      <YearMomentsList moments={moments} initial={moments.length} />
    </ExamplePreview>
  );
}
