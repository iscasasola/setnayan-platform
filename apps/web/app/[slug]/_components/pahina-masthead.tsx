import type { ReactNode } from 'react';
import { formatEventDate } from '@/lib/events';

/**
 * PahinaMasthead — the typographic hero of the Pahina guest site
 * (design 2026-07-25 spec §3/§7 · wave A PR-2).
 *
 * ONE component for every hero call-site (anonymous banner, anonymous text,
 * guest media, guest text) so the two identity trees cannot drift — the same
 * reasoning as `resolveSiteBodyPlan`. The old treatment painted the names over
 * the photo behind a cream scrim; Pahina makes the masthead purely typographic
 * (stacked names, italic ampersand, gild date) and demotes the photo to a
 * COVER PLATE below (`mediaSlot`), so type never fights the picture.
 *
 * Personalization precedence unchanged: the monogram mount (HeroMonogram with
 * its animated-SKU logic) is passed in via `monogramSlot`, untouched.
 */

/** Split "Maria & Jose" / "Maria and Jose" into stacked lines. Falls back to a
 *  single line when no separator is found (solo-named events, debuts). */
export function splitCoupleNames(displayName: string): {
  first: string;
  second: string | null;
  joiner: string | null;
} {
  const amp = /\s*&\s*/.exec(displayName);
  if (amp) {
    const [first = '', ...rest] = displayName.split(/\s*&\s*/);
    return { first, second: rest.join(' & ') || null, joiner: '&' };
  }
  const and = /\s+and\s+/i.exec(displayName);
  if (and) {
    const first = displayName.slice(0, and.index);
    const second = displayName.slice(and.index + and[0].length);
    return { first, second: second || null, joiner: 'and' };
  }
  return { first: displayName, second: null, joiner: null };
}

export function PahinaMasthead({
  displayName,
  eventDate,
  venueName,
  eyebrow = 'You are invited',
  chapterNo = '01',
  badgeSlot,
  monogramSlot,
  mediaSlot,
  mediaCaption,
}: {
  displayName: string;
  eventDate: string | null;
  venueName?: string | null;
  /** Eyebrow text after the chapter №. */
  eyebrow?: string;
  chapterNo?: string;
  /** Day-of badge etc. — rendered above the eyebrow when present. */
  badgeSlot?: ReactNode;
  /** The couple's mark (HeroMonogram) — mounted between eyebrow and names. */
  monogramSlot?: ReactNode;
  /** The demoted hero photo/video — rendered BELOW the type as a cover plate. */
  mediaSlot?: ReactNode;
  /** Mono caption under the cover plate (e.g. venue line). */
  mediaCaption?: string | null;
}) {
  const names = splitCoupleNames(displayName);
  const dateLabel = formatEventDate(eventDate);

  return (
    <header className="text-center">
      {badgeSlot}
      <p className="pahina-eyebrow justify-center">
        <span aria-hidden>№ {chapterNo}</span>
        <span>{eyebrow}</span>
      </p>
      {monogramSlot ? <div className="mt-6 flex justify-center">{monogramSlot}</div> : null}

      {/* Stacked names — Fraunces display, italic gild joiner between lines. */}
      <h1 className="mt-6 font-pahina text-[2.9rem] font-light leading-[1.04] tracking-tight text-ink sm:text-6xl">
        <span className="block">{names.first}</span>
        {names.second ? (
          <>
            <span className="block font-pahina text-[0.42em] italic text-gild" aria-hidden>
              {names.joiner}
            </span>
            <span className="block">{names.second}</span>
          </>
        ) : null}
      </h1>

      <hr className="pahina-rule mx-auto mt-7 w-24" />

      {/* The gild date — oversized lining numerals; venue meta beneath. */}
      {dateLabel ? (
        <p className="mt-6 font-pahina text-[clamp(1.6rem,6vw,2.4rem)] font-light tracking-tight text-gild">
          {dateLabel}
        </p>
      ) : null}
      {venueName ? <p className="mt-2 text-base text-ink/70">{venueName}</p> : null}

      {/* Cover plate — the photo/video demoted below the type, framed like a
          printed plate with a mono caption. Only when media exists. */}
      {mediaSlot ? (
        <figure className="relative -mx-4 mt-8 sm:-mx-0">
          {/* ⚠ The `aspect-*` pair is LOAD-BEARING, not decoration. `mediaSlot`
              is always `HeroBackgroundMedia`, whose <img>/<video> is
              `absolute inset-0` — it was written for the OLD hero, a banner
              that held the names + date in flow and therefore had a height of
              its own. PR-2 demoted the media into this standalone box, which
              has no in-flow child at all, so it computed to zero content
              height: the couple's hero photo has not been visible on the plate
              since. A ratio restores the plate AND is what gives the parallax
              below a box to translate inside. Portrait on a phone (it reads as
              a cover), 3:2 from `sm` up so a 720px column doesn't become a
              900px-tall photo. */}
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-ink/10 sm:aspect-[3/2]">
            {/* Parallax layer (design §6 — "±6%, rAF-throttled transform on the
                media wrapper"). This div carries the transform; the media keeps
                filling it via its own `absolute inset-0` (an absolutely
                positioned box is a containing block for its abspos children).

                SAFETY IS THE FEATURE. The transform lives entirely in CSS,
                behind the SAME `.pahina-js` root flag as the scroll reveal, and
                the script writes only a custom property — never `transform`
                itself. So every path that drops the flag (no
                IntersectionObserver, reduced motion, the 2s self-heal, a script
                that throws) also drops the scale and the offset in the same
                frame, and this becomes an ordinary static `object-cover` photo.
                There is no state in which JS has moved the image and CSS cannot
                take it back. See pahina-motion.tsx + globals.css §6 for the
                scale/translate geometry that keeps the box always covered. */}
            <div data-pahina-parallax className="absolute inset-0">
              {mediaSlot}
            </div>
          </div>
          {mediaCaption ? (
            <figcaption className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/55">
              {mediaCaption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
    </header>
  );
}
