/**
 * discover-six-parts.tsx — Discover's shelves 3 · 5 · 6 and the two "See all" views that open on `/` (owner 16 Nov,
 * DECISION_LOG "Discover in six parts"; drawing `prototypes/discover_six_parts_2026-11-16/`). Shelves 1 (People to
 * follow), 2 (Suppliers) and 4 (Event stories) are the shipped ones, re-ordered in `front-door-feed.tsx`.
 *
 * Every shelf says, in one line, when it could not load — never an empty shelf that reads as "nothing here".
 * Zero new server actions: "Save" on an inspiration photo is a LINK into the viewer's own Mood Board, where the
 * shipped picker saves it; it is drawn only when the viewer organises exactly one event (two → their events list;
 * none → no Save, Discover never creates an event).
 *
 * Not `server-only`: it only draws (its reads are `discover-six-parts-data.ts`), so the guards can render it.
 *
 * 🔒 app/_components/frontdoor/discover-in-six-parts.test.ts
 */
import Link from 'next/link';
import { ServiceCardView } from '@/app/_components/service-card-view';
import { EmptyShelf } from './empty-shelf';
import { StoryCard } from './front-door-feed';
import type {
  DiscoverInspirationPart,
  DiscoverInspirationPhoto,
  DiscoverServiceCard,
  Shelf,
} from './discover-six-parts-data';
import type { FrontDoorStory } from './data';
import {
  INSPIRATION_SEE_ALL_HREF,
  SERVICE_CARDS_SEE_ALL_HREF,
  STORIES_SEE_ALL_HREF,
  STORY_ORDERS,
  type StoryOrder,
} from '@/lib/discover-six-parts';

/** Where "Save" goes for this viewer — their one event's Mood Board, their events list, or nowhere. */
export function moodBoardSaveHref(studio: { eventId: string | null; count: number }): string | null {
  if (studio.eventId) return `/dashboard/${studio.eventId}/studio/mood-board`;
  if (studio.count > 1) return '/dashboard';
  return null;
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="fd-sechead-go" data-discover-see-all="">
      {label} →
    </Link>
  );
}

/* ── 3 · SERVICE CARDS ──────────────────────────────────────────────────────────────────────────────── */

export function ServiceCardsShelf({ shelf }: { shelf: Shelf<DiscoverServiceCard> }) {
  return (
    <section data-discover-part="service-cards">
      <h2 className="fd-sechead">
        <span>Service cards</span>
        {shelf.status === 'ok' && shelf.items.length > 0 ? (
          <SeeAll href={SERVICE_CARDS_SEE_ALL_HREF} label="See all" />
        ) : null}
      </h2>
      {shelf.status === 'unavailable' ? (
        <EmptyShelf line="Service cards couldn’t load just now — try again in a moment." />
      ) : shelf.items.length === 0 ? (
        <EmptyShelf line="No verified supplier has posted a service card yet." />
      ) : (
        <ul className="fd-grid" data-discover-service-cards="">
          {shelf.items.map(({ key, ...face }) => (
            <li key={key} className="min-w-0">
              <ServiceCardView {...face} detailsEnabled />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── 4 · EVENT STORIES — the shelf (the cards are the shipped `StoryCard`) ─────────────────────────────── */

export function EventStoriesShelf({ stories }: { stories: FrontDoorStory[] | null }) {
  const shown = (stories ?? []).filter((s) => s.kind === 'editorial').slice(0, 3);
  return (
    <section data-discover-part="event-stories">
      <h2 className="fd-sechead">
        <span>Event stories</span>
        {shown.length > 0 ? <SeeAll href={STORIES_SEE_ALL_HREF} label="See all" /> : null}
      </h2>
      {stories === null ? (
        <EmptyShelf line="Stories couldn’t load just now — try again in a moment." />
      ) : shown.length === 0 ? (
        <EmptyShelf
          line="The first event stories will land right here."
          tip="When a host decides to share their day after it happens, it joins this shelf — in their own words. Nothing appears without them saying yes."
        />
      ) : (
        <div className="fd-grid fd-grid-3">
          {shown.map((s) => (
            <StoryCard key={s.href} s={s} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── 5 · ARTICLES — a placeholder until the articles return ───────────────────────────────────────── */

export function ArticlesShelf() {
  return (
    <section data-discover-part="articles">
      <h2 className="fd-sechead">
        <span>Articles</span>
      </h2>
      <EmptyShelf line="Articles are coming soon." />
    </section>
  );
}

/* ── 6 · INSPIRATION ────────────────────────────────────────────────────────────────────────────────── */

function InspirationTile({ p, saveHref }: { p: DiscoverInspirationPhoto; saveHref: string | null }) {
  return (
    <figure className="fd-insp" data-inspiration-photo="">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.url} alt={p.part} loading="lazy" decoding="async" className="fd-insp-img" />
      <figcaption className="fd-insp-cap">
        <span className="fd-insp-part">{p.part}</span>
        {p.line ? <span className="fd-insp-line">{p.line}</span> : null}
        {p.shopHref ? (
          <Link href={p.shopHref} className="fd-insp-shop" data-inspiration-credit="">
            {p.shop}
          </Link>
        ) : (
          <span className="fd-insp-shop" data-inspiration-credit="">
            {p.shop}
          </span>
        )}
        {saveHref ? (
          <Link href={saveHref} className="fd-insp-save" data-inspiration-save="">
            Save to Mood Board
          </Link>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function InspirationShelf({
  shelf,
  saveHref,
}: {
  shelf: Shelf<DiscoverInspirationPhoto>;
  saveHref: string | null;
}) {
  return (
    <section data-discover-part="inspiration">
      <h2 className="fd-sechead">
        <span>Inspiration</span>
        {shelf.status === 'ok' && shelf.items.length > 0 ? (
          <SeeAll href={INSPIRATION_SEE_ALL_HREF} label="See all" />
        ) : null}
      </h2>
      {shelf.status === 'unavailable' ? (
        <EmptyShelf line="Inspiration couldn’t load just now — try again in a moment." />
      ) : shelf.items.length === 0 ? (
        <EmptyShelf line="Photos from verified suppliers’ shops will land right here." />
      ) : (
        <div className="fd-grid fd-grid-6">
          {shelf.items.map((p) => (
            <InspirationTile key={p.id} p={p} saveHref={saveHref} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── THE TWO "SEE ALL" VIEWS ON `/` ─────────────────────────────────────────────────────────────────── */

function BackToDiscover() {
  return (
    <p className="mb-3">
      <Link href="/" className="fd-go" data-discover-back="">
        ← Discover
      </Link>
    </p>
  );
}

/** A plain GET form — a dropdown and a Go button, no script, no server action. */
function PickForm({
  hidden,
  selects,
}: {
  hidden: Array<[string, string]>;
  selects: Array<{ name: string; label: string; value: string; options: Array<{ value: string; label: string }> }>;
}) {
  return (
    <form method="get" action="/" className="mb-4 flex flex-wrap items-end gap-2" data-discover-pick="">
      {hidden.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {selects.map((s) => (
        <label key={s.name} className="flex flex-col gap-1 text-xs text-ink/70">
          {s.label}
          <select name={s.name} defaultValue={s.value} className="rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink">
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="submit" className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink">
        Show
      </button>
    </form>
  );
}

export function EventStoriesView({
  stories,
  occasions,
  occasion,
  order,
}: {
  stories: Array<FrontDoorStory & { eventType: string | null; eventDate: string | null }> | null;
  occasions: Array<{ key: string; label: string }>;
  occasion: string | null;
  order: StoryOrder;
}) {
  const known = occasion && occasions.some((o) => o.key === occasion) ? occasion : null;
  const shown = (stories ?? [])
    .filter((s) => !known || s.eventType === known)
    .sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? ''));
  return (
    <div data-discover-view="stories">
      <BackToDiscover />
      <h2 className="fd-sechead">
        <span>Event stories</span>
      </h2>
      <PickForm
        hidden={[['stories', '1']]}
        selects={[
          {
            name: 'occasion',
            label: 'Event type',
            value: known ?? '',
            options: [{ value: '', label: 'All event types' }, ...occasions.map((o) => ({ value: o.key, label: o.label }))],
          },
          { name: 'order', label: 'Sort', value: order, options: STORY_ORDERS.map((o) => ({ value: o.value, label: o.label })) },
        ]}
      />
      {stories === null ? (
        <EmptyShelf line="Stories couldn’t load just now — try again in a moment." />
      ) : shown.length === 0 ? (
        <EmptyShelf line={known ? 'No story of this kind has been shared yet.' : 'No event story has been shared yet.'} />
      ) : (
        <div className="fd-grid fd-grid-3">
          {shown.map((s) => (
            <StoryCard key={s.href} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}

export function InspirationView({
  shelf,
  part,
  saveHref,
}: {
  shelf: Shelf<DiscoverInspirationPhoto> & { parts: DiscoverInspirationPart[] };
  part: string | null;
  saveHref: string | null;
}) {
  const known = part && shelf.parts.some((p) => p.key === part) ? part : null;
  return (
    <div data-discover-view="inspiration">
      <BackToDiscover />
      <h2 className="fd-sechead">
        <span>Inspiration</span>
      </h2>
      {shelf.parts.length > 0 ? (
        <PickForm
          hidden={[['inspiration', '1']]}
          selects={[
            {
              name: 'part',
              label: 'Parts',
              value: known ?? '',
              options: [{ value: '', label: 'All parts' }, ...shelf.parts.map((p) => ({ value: p.key, label: p.label }))],
            },
          ]}
        />
      ) : null}
      {shelf.status === 'unavailable' ? (
        <EmptyShelf line="Inspiration couldn’t load just now — try again in a moment." />
      ) : shelf.items.length === 0 ? (
        <EmptyShelf line={known ? 'No photo of this part yet.' : 'Photos from verified suppliers’ shops will land right here.'} />
      ) : (
        <div className="fd-grid fd-grid-6">
          {shelf.items.map((p) => (
            <InspirationTile key={p.id} p={p} saveHref={saveHref} />
          ))}
        </div>
      )}
    </div>
  );
}
