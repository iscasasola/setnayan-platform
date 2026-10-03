import type { CSSProperties } from 'react';
import type { EventPosterFacts } from '@/lib/event-poster';
import s from './event-poster.module.css';
import { CoupleLogo } from './couple-logo';
import { coupleLogoPlays } from '@/lib/couple-logo-plays';

/**
 * THE EVENT POSTER — a collection card's `cover`, 3:4, filling the card.
 *
 * Owner-approved 2026-09-24 ("the template is good"). Which treatment an event
 * wears, and every word on it, is decided by `posterFor` (`lib/event-poster.ts`)
 * from the resolvers that own each fact; this component only draws the
 * treatments. The drawing is `event-poster.module.css`, in `cqw`, so one poster
 * reads the same at every column count.
 *
 * ─── IT IS ART, SO IT IS HIDDEN FROM ASSISTIVE TECH ─────────────────────────
 * The names and the date are printed ONCE, here, and the card no longer
 * repeats them in a body. So the words a screen reader needs travel on the
 * card's link as its accessible name (`CollectionCard`'s `ariaLabel`), and this
 * whole layer is `aria-hidden` — otherwise the link would be announced as
 * "Maria, and, Jose, Saturday, 12 December 2026, Maria & Jose…".
 *
 * Server-safe: no `'use client'`, no hooks, no function props — strings in,
 * markup out.
 */
export function EventPoster({
  poster,
  markText,
  markSvgUri = null,
  markSvg = null,
  markPlays = false,
}: {
  poster: EventPosterFacts;
  /** The couple's monogram text, from `resolveMonogram` ("M & J"). */
  markText: string;
  /** Their uploaded / bespoke mark as an inert `data:` URI, when they have one. */
  markSvgUri?: string | null;
  /** The same mark as markup, for when it PLAYS (`markPlays`) — owner
   *  2026-09-29, "all logos should animate if animation is active". */
  markSvg?: string | null;
  /** The logo moves and the animation is on (`logoPlaysFor`). */
  markPlays?: boolean;
}) {
  const { names } = poster;
  const style = poster.accent ? ({ '--a': poster.accent } as CSSProperties) : undefined;

  if (poster.kind === 'quiet') {
    return (
      <div aria-hidden className={`${s.poster} ${s.quietGround}`}>
        <div className={s.bill}>
          <i className={s.orn} />
          <h2 className={s.ttl}>{[names.first, names.second].filter(Boolean).join(' & ')}</h2>
          <i className={s.rule} />
          <PosterWhen weekday={poster.weekday} date={poster.date} />
          {poster.venue ? <p className={s.venue}>{poster.venue}</p> : null}
          <i className={s.orn} />
        </div>
      </div>
    );
  }

  // 🖼 The photo and theme covers read in the Event Hub's legibility tones
  // (`hubLegibilityVars`, decided in `posterFor`) — never a fixed white on a
  // guessed dark gradient.
  const legible = poster.legibility ? (poster.legibility as CSSProperties) : undefined;

  if (poster.kind === 'photo') {
    return (
      <div aria-hidden className={`${s.poster} ${s.photoGround}`} style={legible} data-poster-ground={poster.ground ?? undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- presigned hero / reveal background, narrowed by the resolver that signed it */}
        <img src={poster.photoSrc ?? ''} alt="" className={s.photo} draggable={false} />
        <div className={s.over}>
          <PosterNames names={names} amp="&" />
          <PosterWhen weekday={poster.weekday} date={poster.date} />
        </div>
      </div>
    );
  }

  if (poster.kind === 'theme') {
    // The hub's invitation card, in their theme: the theme's still under its
    // measured scrim, the card's words in the theme's own inks.
    return (
      <div aria-hidden className={`${s.poster} ${s.themeGround}`} style={legible} data-poster-ground="theme">
        {/* eslint-disable-next-line @next/next/no-img-element -- the theme's public still (resolveThemeGround) */}
        <img src={poster.photoSrc ?? ''} alt="" className={s.photo} draggable={false} />
        <i className={s.themeScrim} />
        <InvitationPaper poster={poster} markText={markText} markSvgUri={markSvgUri} markSvg={markSvg} markPlays={markPlays} />
      </div>
    );
  }

  if (poster.kind === 'deep') {
    return (
      <div aria-hidden className={`${s.poster} ${s.deepGround}`} style={style}>
        {poster.capiz ? <i className={s.capiz} /> : null}
        <i className={s.veil} />
        <i className={s.frame} />
        {markSvgUri ? (
          <CoupleLogo
            svg={markSvg}
            plays={coupleLogoPlays(markSvg, markPlays)}
            place="event-poster"
            className={s.markImg}
            still={
              // eslint-disable-next-line @next/next/no-img-element -- inert data: URI, gated by resolveEventMonogramSvg
              <img src={markSvgUri} alt="" className={s.markImg} draggable={false} />
            }
          />
        ) : (
          <div className={s.mono}>{markText}</div>
        )}
        <div className={s.deepTxt}>
          <PosterNames names={names} amp="&" />
          <i className={s.rule} />
          <PosterWhen weekday={poster.weekday} date={poster.date} />
        </div>
      </div>
    );
  }

  if (poster.kind === 'moon') {
    return (
      <div aria-hidden className={`${s.poster} ${s.moonGround}`} style={style}>
        <i className={s.frame} />
        <div className={s.moon}>
          <div>
            <PosterNames names={names} amp="&" />
            <i className={s.rule} />
            <PosterWhen weekday={poster.weekday} date={poster.date} />
          </div>
        </div>
        <i className={s.thread} />
      </div>
    );
  }

  // invitation — the hub's own card
  return (
    <div aria-hidden className={`${s.poster} ${s.invGround}`}>
      <InvitationPaper poster={poster} markText={markText} markSvgUri={markSvgUri} markSvg={markSvg} markPlays={markPlays} />
    </div>
  );
}

/** The hub's invitation card — eyebrow, their mark in a circle, the names, the line, the date. */
function InvitationPaper({
  poster,
  markText,
  markSvgUri,
  markSvg,
  markPlays,
}: {
  poster: EventPosterFacts;
  markText: string;
  markSvgUri: string | null;
  markSvg: string | null;
  markPlays: boolean;
}) {
  return (
    <div className={s.paper}>
      {poster.eyebrow ? <p className={s.eb}>{poster.eyebrow}</p> : null}
      <div className={s.circ}>
        {markSvgUri ? (
          <CoupleLogo
            svg={markSvg}
            plays={coupleLogoPlays(markSvg, markPlays)}
            place="event-poster"
            className="block h-[80%] w-[80%]"
            still={
              // eslint-disable-next-line @next/next/no-img-element -- inert data: URI, gated by resolveEventMonogramSvg
              <img src={markSvgUri} alt="" draggable={false} />
            }
          />
        ) : (
          markText
        )}
      </div>
      <PosterNames names={poster.names} amp="and" />
      {poster.line ? <p className={s.ln}>{poster.line}</p> : null}
      {poster.date ? <p className={s.dt}>{poster.date}</p> : <p className={`${s.dt} ${s.tbd}`}>Date to be set</p>}
    </div>
  );
}

/** The names, stacked, with the joiner between them — or one line. */
function PosterNames({
  names,
  amp,
}: {
  names: EventPosterFacts['names'];
  amp: string;
}) {
  return (
    <h2 className={`${s.names} ${names.second === null ? s.one : ''}`}>
      <span className={s.nm}>{names.first}</span>
      {names.second !== null ? (
        <>
          <span className={s.amp}>{amp}</span>
          <span className={s.nm}>{names.second}</span>
        </>
      ) : null}
    </h2>
  );
}

/** The weekday over the date — or "Date to be set", a real state. */
function PosterWhen({ weekday, date }: { weekday: string | null; date: string | null }) {
  if (!date) return <p className={`${s.dt} ${s.tbd}`}>Date to be set</p>;
  return (
    <>
      <p className={s.wd}>{weekday}</p>
      <p className={s.dt}>{date}</p>
    </>
  );
}
