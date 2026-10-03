/**
 * discover-event-cover.tsx — a Discover event card's cover: the event's LOOK,
 * the mark underneath it.
 *
 * Owner, 2026-10-03, on the cale-ice card: *"why is the cover like this? it
 * should have adjusted."* The card drew only the monogram. It now wears
 * `card.scene` — `sceneCoverFor(resolveEventPoster(…))`, the same cover the
 * home board's cards and the Overview band wear (hero photo → Save-the-Date
 * background → the theme's still), resolved by the loader for public, listed
 * events only (`dressCards` in `lib/discover-events.ts`).
 *
 * 🔑 THE MARK IS ALWAYS DRAWN, UNDER THE PICTURE. An event that has chosen
 * nothing (`scene` null), and a wake (`quiet` — it never wears a photo), show
 * the mark exactly as before. And a picture that fails to load is an `alt=""`
 * image, which draws nothing — so the mark shows through with no client
 * island and no `onError`, keeping this a server component (no JS shipped).
 *
 * No words are printed ON the picture — the title sits below the cover and
 * the date plate is its own opaque chip — so no legibility veil is laid over
 * a photo. A theme's still keeps the hub's measured scrim (`--hub-scrim`),
 * because that scrim is part of how the theme looks.
 */
import type { CSSProperties } from 'react';

import type { DiscoverEventCard } from '@/lib/discover-events-core';

export function DiscoverEventCover({ card }: { card: Pick<DiscoverEventCard, 'cover' | 'datePlate' | 'scene'> }) {
  const scene = card.scene && card.scene.kind !== 'quiet' ? card.scene : null;
  return (
    <div
      className="fd-thumb fd-thumb-event"
      data-discover-cover={scene ? scene.ground : 'mark'}
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
      <span className="fd-date">{card.datePlate}</span>
    </div>
  );
}
