/**
 * front-door-discover.tsx — Discover's new shelves (DECISION_LOG 2026-09-29:
 * "PUBLIC EVENTS CAN BE DISCOVERED", "DISCOVER IS THE DOOR TO THE WHOLE
 * SETNAYAN UNIVERSE", "DISCOVER — UNPARKED", "DISCOVER BUILD — TWO LAST
 * ANSWERS"). Ported from `prototypes/discover_upcoming_2026-09-29.html`
 * frames 1A/1B; the card is the page's own `.fd-item` grammar with a date
 * plate, a host line and exactly one action. Its cover wears the event's look
 * (`DiscoverEventCover`, 2026-10-03), the mark when it has chosen none.
 *
 *   1 · Upcoming from people you follow   (signed in only)
 *   2 · Upcoming on Setnayan               (everyone, signed out included)
 *   … Shops (existing) …
 *   4 · People to follow
 *
 * ─── THREE STATES PER SHELF, THREE DIFFERENT SENTENCES ────────────────────
 * ok + cards · ok + none (a written invitation saying what the shelf is FOR,
 * never "you have none") · unavailable ("couldn't load" in the heading and in
 * the card — the page's own CountText rule: an unknown is not a nought).
 *
 * The event card itself is `discover-event-card.tsx` (two doors on one card,
 * never nested); its cover is `discover-event-cover.tsx`.
 */
import Link from 'next/link';

import type { DiscoverEventCard } from '@/lib/discover-events-core';
import type { DiscoverData, PersonToFollowCard } from '@/lib/discover-events';
import { shopInitials } from '@/lib/shop-initials';
import { formatCount } from '@/lib/format-number';
import { DiscoverFollowButton } from './discover-follow-button';
import { DiscoverEventCard as EventCard } from './discover-event-card';

/** The id the "Find people to follow" invitation scrolls to. Always rendered. */
export const PEOPLE_TO_FOLLOW_ID = 'people-to-follow';

function Unknown() {
  return <span className="fd-unknown">couldn&rsquo;t load</span>;
}

function EventGrid({ items }: { items: DiscoverEventCard[] }) {
  return (
    <div className="fd-grid fd-up">
      {items.map((c) => (
        <EventCard key={c.key} card={c} />
      ))}
    </div>
  );
}

function Invite({
  title,
  body,
  href,
  go,
}: {
  title: string;
  body: string;
  href: string;
  go: string;
}) {
  return (
    <div className="fd-grid">
      <div className="fd-invite fd-invite-full">
        <h3>{title}</h3>
        <p>{body}</p>
        <Link href={href} className="fd-go">
          {go} &rarr;
        </Link>
      </div>
    </div>
  );
}

/** Shelves 1 and 2 — the two event layers. Rendered above the shops. */
export function DiscoverEventShelves({ discover }: { discover: DiscoverData }) {
  const { people, world, viewerRegionLabel } = discover;
  const worldOrder = viewerRegionLabel
    ? `soonest first · ${viewerRegionLabel} first`
    : 'soonest first';

  return (
    <>
      {/* ═ 1 · YOUR PEOPLE — signed in only; a stranger follows nobody ═ */}
      {people ? (
        <section aria-labelledby="discover-people" data-discover-shelf="people">
          <h2 className="fd-sechead" id="discover-people">
            <span className="fd-badge" aria-hidden="true">
              ◷
            </span>
            <span>Upcoming from people you follow</span>
            <span className="fd-meta">
              {people.status === 'unavailable' ? <Unknown /> : 'soonest first'}
            </span>
          </h2>
          {people.status === 'unavailable' ? (
            <Invite
              title="We couldn’t check who you follow just now."
              body="This does not mean nothing is coming up. Try again in a moment — the shelf shows public events from people you follow or are connected to, soonest first."
              href="/"
              go="Try again"
            />
          ) : people.items.length === 0 ? (
            <Invite
              title="Public events from your people land here."
              body="Follow the people and groups whose events you’d turn up for. When one of them announces a public event — a birthday, a concert, a grand opening — it appears on this shelf, soonest first, with one button to ask to join."
              href={`#${PEOPLE_TO_FOLLOW_ID}`}
              go="Find people to follow"
            />
          ) : (
            <EventGrid items={people.items} />
          )}
        </section>
      ) : null}

      {/* ═ 2 · THE REST OF THE WORLD — everyone, signed out included ═ */}
      <section aria-labelledby="discover-world" data-discover-shelf="world">
        <h2 className="fd-sechead" id="discover-world">
          <span className="fd-badge" aria-hidden="true">
            ◷
          </span>
          <span>{people ? 'More upcoming on Setnayan' : 'Upcoming on Setnayan'}</span>
          <span className="fd-meta">
            {world.status === 'unavailable' ? <Unknown /> : worldOrder}
          </span>
          <span className="fd-rule">public events only · the host approves who joins</span>
        </h2>
        {world.status === 'unavailable' ? (
          <Invite
            title="We couldn’t load upcoming events just now."
            body="This does not mean nothing is coming up. Try again in a moment — this shelf shows every public event on Setnayan, soonest first."
            href="/"
            go="Try again"
          />
        ) : world.items.length === 0 ? (
          <Invite
            title="Public events will appear here."
            body="When a host makes an event public — a birthday, a concert, a grand opening — it shows here for everyone, soonest first. Anyone can ask to join; the host approves who gets in."
            href="/dashboard/create-event"
            go="Create an event"
          />
        ) : (
          <EventGrid items={world.items} />
        )}
      </section>
    </>
  );
}

function PersonCard({ p, signedIn }: { p: PersonToFollowCard; signedIn: boolean }) {
  return (
    <div className="fd-item fd-person" data-discover-card>
      <div className="fd-imeta">
        <span className="fd-ava fd-ava-lg" aria-hidden="true">
          {p.photoUrl ? (
            // A plain <img>: a resolved photo can be a presigned URL whose
            // signature changes per render (the shop-logo rule on this page).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt="" loading="lazy" />
          ) : (
            shopInitials(p.name, 2, '·')
          )}
        </span>
        <div className="fd-itxt">
          <p className="fd-ttl">
            <Link href={`/u/${p.slug}`} className="fd-stretch">
              {p.name}
            </Link>
          </p>
          <p className="fd-by">
            <span className="fd-mono">{formatCount(p.followers)}</span>{' '}
            {p.followers === 1 ? 'follower' : 'followers'}
          </p>
          {signedIn && p.publicId ? (
            <div className="fd-act">
              <DiscoverFollowButton publicId={p.publicId} name={p.name} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Shelf 4 — People to follow. Rendered after the shops. */
export function PeopleToFollowShelf({ discover }: { discover: DiscoverData }) {
  const { peopleToFollow, signedIn } = discover;
  return (
    <section
      id={PEOPLE_TO_FOLLOW_ID}
      aria-labelledby="discover-people-to-follow"
      data-discover-shelf="people-to-follow"
    >
      <h2 className="fd-sechead" id="discover-people-to-follow">
        <span>People to follow</span>
        <span className="fd-meta">
          {peopleToFollow.status === 'unavailable' ? <Unknown /> : 'public profiles, most followed first'}
        </span>
      </h2>
      {peopleToFollow.status === 'unavailable' ? (
        <Invite
          title="We couldn’t load people to follow just now."
          body="This does not mean there is nobody here. Try again in a moment."
          href="/"
          go="Try again"
        />
      ) : peopleToFollow.items.length === 0 ? (
        <Invite
          title="People with public profiles will appear here."
          body="Anyone can turn on a public profile. Follow them and their public events show at the top of Discover."
          href="/dashboard/people"
          go="Find someone you know"
        />
      ) : (
        <div className="fd-grid">
          {peopleToFollow.items.map((p) => (
            <PersonCard key={p.key} p={p} signedIn={signedIn} />
          ))}
        </div>
      )}
    </section>
  );
}
