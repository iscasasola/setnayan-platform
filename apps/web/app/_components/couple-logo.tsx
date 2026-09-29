'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { LayeredLogoPlayer } from '@/app/_components/layered-logo-player';
import { coupleLogoPlayKey, coupleLogoPlays, logoArrivals, logoPhaseOnMount } from '@/lib/couple-logo-plays';

/**
 * ▶ THE COUPLE'S LOGO ON A SCREEN — playing when it moves, still when it does not.
 *
 * Owner 2026-09-29, pointing at their mark drawn as a still image on the RSVP
 * card: *"can we also animate this?"* → *"all logos should animate if animation
 * is active"*. So every screen that shows the couple's logo hands it here with
 * the still it drew before, and this picks:
 *
 *   · the logo moves (`logoHasMotion` — a layer with an In or a Drift) AND the
 *     animation is on for the event (`plays`: owned, not switched to "Use Static
 *     Image" — `logoPlaysFor` / HeroMonogram's `animatedMonogram`) → it plays
 *     through THE one player, `LayeredLogoPlayer` (the Maker's ▶ Play and every
 *     guest surface), never a new mechanism;
 *   · otherwise → `still`, byte-for-byte what the surface drew before.
 *
 * ♿ `prefers-reduced-motion: reduce` → the still, from the first paint (the
 * still is in the server HTML and only `motion-safe:` hides it).
 * 👁 OFFSCREEN WAITS. It starts when it scrolls into view (IntersectionObserver),
 * so a page of many cards mounts no animation it is not showing — the Maker and
 * the home board stay light.
 * 1️⃣ PLAYS ONCE. Its entrance plays on arrival; a re-render never replays it
 * (the player keys on the markup), and a REMOUNT in the same place — a step
 * change, a door re-rendering — shows it already arrived (`settled`: no
 * entrance, its Drift kept). The memory is per `place` + logo, for the life of
 * the page (`coupleLogoPlayKey`).
 */

type Phase = 'pending' | 'play' | 'still';

export function CoupleLogo({
  svg,
  plays,
  place,
  still,
  className,
  style,
}: {
  /** The sanitised mark (`resolveEventMonogramSvg` / `heroMarkSvg`), or null. */
  svg: string | null | undefined;
  /** The animation is on for this event (owned + not switched off). */
  plays: boolean;
  /** Which surface this is — the plays-once memory is kept per place. */
  place: string;
  /** What this surface draws when the logo does not play — its own still. */
  still: ReactNode;
  /** The playing logo's box — REPLACES the default (an inline-flex that fills
   *  the slot), so a surface can put it exactly where its still sat. */
  className?: string;
  /** An exact box, for a slot sized in px (a door's seal). */
  style?: CSSProperties;
}) {
  if (!coupleLogoPlays(svg, plays)) return <>{still}</>;
  return <PlayingLogo svg={svg as string} place={place} still={still} className={className} style={style} />;
}

function PlayingLogo({
  svg,
  place,
  still,
  className,
  style,
}: {
  svg: string;
  place: string;
  still: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const key = coupleLogoPlayKey(place, svg);
  const [phase, setPhase] = useState<Phase>('pending');
  /* Decided once, at mount: had this place already shown this logo arriving? */
  const [settled] = useState(() => logoArrivals.arrived(key));

  useEffect(() => {
    const el = box.current;
    const first = logoPhaseOnMount({
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      canObserve: Boolean(el) && typeof IntersectionObserver !== 'undefined',
    });
    const start = () => {
      logoArrivals.arrive(key);
      setPhase('play');
    };
    if (first === 'still') {
      setPhase('still');
      return;
    }
    if (first === 'play' || !el) {
      start();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [key]);

  return (
    <span
      ref={box}
      aria-hidden
      data-couple-logo={phase}
      className={className ?? 'inline-flex h-full w-full items-center justify-center'}
      style={style}
    >
      {phase === 'play' ? (
        <LayeredLogoPlayer svg={svg} settled={settled} onRefused={() => setPhase('still')} className="h-full w-full" />
      ) : (
        /* Until it plays: the still, kept in the HTML (no JavaScript, reduced
           motion, a refused tree), and hidden only while motion is allowed so
           the entrance never starts from a finished logo. */
        <span className={phase === 'pending' ? 'contents motion-safe:invisible' : 'contents'}>{still}</span>
      )}
    </span>
  );
}
