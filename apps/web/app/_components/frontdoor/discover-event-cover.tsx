/**
 * discover-event-cover.tsx — a Discover event card's cover: the event's LOOK,
 * the mark underneath it.
 *
 * Owner, 2026-10-03, on the cale-ice card: *"why is the cover like this? it
 * should have adjusted."* The card drew only the monogram. It now wears what
 * the event's dashboard card wears, read by the loader for public, listed
 * events only (`dressCards` in `lib/discover-events.ts`):
 *
 *   • `card.scene` — the couple's own MAIN BACKGROUND when their Event Hub
 *     draws one (ground `main`, a video's still); else
 *     `sceneCoverFor(resolveEventPoster(…))`: the hero photo → the
 *     Save-the-Date background → the theme's still, the same picture the
 *     home board's cards and the Overview band wear;
 *   • `card.paper` — no picture to wear (Classic, no hero; Classic never shows
 *     a photo): the dashboard's own paper invitation card, `<EventPoster>`
 *     from the same poster facts (owner 2026-10-03, ruling A, "Paper
 *     invitation card"). The cover is a 3:4 poster, as on the dashboard. When
 *     the couple chose a background colour or ombré, the card's paper IS that
 *     ground (`paper.ground`, the hub's own `--color-cream` / `--color-ink`),
 *     owner 2026-10-03: *"if they customized it … it should also adjust"*.
 *
 * 🔑 THE MARK IS ALWAYS DRAWN, UNDERNEATH. A wake (`quiet` — it never wears a
 * photo) and an event whose look could not be read show it exactly as before.
 * A picture that fails to load is an `alt=""` image, which draws nothing — so
 * the mark shows through with no `onError` and no client island of our own.
 *
 * 🗓 NAME ONLY, NO DATE (owner 2026-11-13): the cover prints the event's name
 * and never a date — no corner date plate, no date line on the poster. A
 * picture with no poster words gets no veil; a theme's still keeps the hub's
 * measured scrim (`--hub-scrim`), because that scrim is part of how the theme
 * looks.
 */
import type { CSSProperties } from 'react';

import type { DiscoverEventCard } from '@/lib/discover-events-core';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import { EventPoster, paperGroundStyle } from '../event-poster';

type CoverFacts = Pick<DiscoverEventCard, 'cover' | 'scene' | 'paper' | 'scenePoster'>;

/** Which cover the card wears: a picture (not a wake's), else the paper card, else the mark alone. */
function coverOf(card: CoverFacts) {
  const scene = card.scene && card.scene.kind !== 'quiet' ? card.scene : null;
  const paper = scene ? null : card.paper;
  return { scene, paper };
}

/**
 * 🔁 THE COVER ALREADY SAYS THE NAME (owner 2026-10-11, *"yes ad drop so it is not twice"*; approved again
 * with #7540 on 2026-11-13). True when the cover prints the event's names — the invitation on their photo,
 * or the paper card — so the card drops its title line under the cover. A bare picture or the mark alone
 * prints no name, and keeps the line.
 */
export function coverPrintsTheName(card: CoverFacts): boolean {
  const { scene, paper } = coverOf(card);
  return Boolean((scene && card.scenePoster) || paper);
}

/**
 * The couple's paper as the paper card's ground: the hub's own channels, the
 * poster's paper made transparent over them, and its ink following the hub's
 * legibility answer. Every value was built from parsed hexes (`guestLookFrom`).
 */

export function DiscoverEventCover({
  card,
}: {
  card: CoverFacts;
}) {
  const { scene, paper } = coverOf(card);
  return (
    <div
      className="fd-thumb fd-thumb-event"
      data-discover-cover={scene ? scene.ground : paper ? 'paper' : 'mark'}
      style={scene?.legibility ? (scene.legibility as CSSProperties) : undefined}
    >
      <span className="fd-mono-cover" aria-hidden="true">
        {card.cover}
      </span>
      {scene && card.scenePoster ? (
        /* 🖼 THE INVITATION ON THE PICTURE (owner 2026-11-12: *"the event icons are not similar?"*). The
           home board printed the couple's names and date on their photo while this card showed the bare
           photo. It now draws the SAME `<EventPoster>` from the same poster facts, so one event wears one
           cover on Home and on Discover. The poster brings its own measured legibility tones and scrim. */
        <div className="fd-paper fd-scene-poster">
          <EventPoster
            poster={card.scenePoster.poster}
            markText={card.scenePoster.markText}
            markSvgUri={card.scenePoster.markSvg ? bespokeSvgToDataUri(card.scenePoster.markSvg) : null}
            markSvg={card.scenePoster.markSvg}
            markPlays={card.scenePoster.markPlays}
            nameOnly
          />
        </div>
      ) : scene ? (
        <>
          {/* A presigned R2 URL or the theme's public still — a plain <img>:
              the signing host is not in the next/image allowlist. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.src} alt="" loading="lazy" decoding="async" className="fd-event-photo" />
          {scene.kind === 'theme' ? <span className="fd-event-scrim" aria-hidden="true" /> : null}
        </>
      ) : null}
      {paper ? (
        <div
          className="fd-paper"
          data-paper-ground={paper.ground ? 'own' : undefined}
          style={paper.ground ? paperGroundStyle(paper.ground) : undefined}
        >
          <EventPoster
            poster={paper.poster}
            markText={paper.markText}
            markSvgUri={paper.markSvg ? bespokeSvgToDataUri(paper.markSvg) : null}
            markSvg={paper.markSvg}
            markPlays={paper.markPlays}
            nameOnly
          />
        </div>
      ) : null}
    </div>
  );
}
