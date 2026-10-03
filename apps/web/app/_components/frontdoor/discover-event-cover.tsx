/**
 * discover-event-cover.tsx — a Discover event card's cover: the event's LOOK,
 * the mark underneath it.
 *
 * Owner, 2026-10-03, on the cale-ice card: *"why is the cover like this? it
 * should have adjusted."* The card drew only the monogram. It now wears what
 * the event's dashboard card wears, read by the loader for public, listed
 * events only (`dressCards` in `lib/discover-events.ts`):
 *
 *   • `card.scene` — `sceneCoverFor(resolveEventPoster(…))`: the hero photo →
 *     the Save-the-Date background → the theme's still, the same picture the
 *     home board's cards and the Overview band wear;
 *   • `card.paper` — no picture to wear (Classic, no hero; Classic never shows
 *     a photo): the dashboard's own paper invitation card, `<EventPoster>`
 *     from the same poster facts (owner 2026-10-03, ruling A, "Paper
 *     invitation card"). The cover is a 3:4 poster, as on the dashboard.
 *
 * 🔑 THE MARK IS ALWAYS DRAWN, UNDERNEATH. A wake (`quiet` — it never wears a
 * photo) and an event whose look could not be read show it exactly as before.
 * A picture that fails to load is an `alt=""` image, which draws nothing — so
 * the mark shows through with no `onError` and no client island of our own.
 *
 * No words are printed ON a photo here — the title sits below the cover and
 * the date plate is its own opaque chip — so a photo gets no veil. A theme's
 * still keeps the hub's measured scrim (`--hub-scrim`), because that scrim is
 * part of how the theme looks.
 */
import type { CSSProperties } from 'react';

import type { DiscoverEventCard } from '@/lib/discover-events-core';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import { EventPoster } from '../event-poster';

export function DiscoverEventCover({
  card,
}: {
  card: Pick<DiscoverEventCard, 'cover' | 'datePlate' | 'scene' | 'paper'>;
}) {
  const scene = card.scene && card.scene.kind !== 'quiet' ? card.scene : null;
  const paper = scene ? null : card.paper;
  return (
    <div
      className="fd-thumb fd-thumb-event"
      data-discover-cover={scene ? scene.ground : paper ? 'paper' : 'mark'}
      style={scene?.legibility ? (scene.legibility as CSSProperties) : undefined}
    >
      <span className="fd-mono-cover" aria-hidden="true">
        {card.cover}
      </span>
      {scene ? (
        <>
          {/* A presigned R2 URL or the theme's public still — a plain <img>:
              the signing host is not in the next/image allowlist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.src} alt="" loading="lazy" decoding="async" className="fd-event-photo" />
          {scene.kind === 'theme' ? <span className="fd-event-scrim" aria-hidden="true" /> : null}
        </>
      ) : null}
      {paper ? (
        <div className="fd-paper">
          <EventPoster
            poster={paper.poster}
            markText={paper.markText}
            markSvgUri={paper.markSvg ? bespokeSvgToDataUri(paper.markSvg) : null}
            markSvg={paper.markSvg}
            markPlays={paper.markPlays}
          />
        </div>
      ) : null}
      <span className="fd-date">{card.datePlate}</span>
    </div>
  );
}
