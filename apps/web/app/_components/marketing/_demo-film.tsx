'use client';

/**
 * A product's own film — the 12-second silent loop recorded from its live demo
 * scenes (`public/add-ons/demo/<slug>.mp4`, see that folder's README). Shared.
 *
 * ─── WHY ONE COMPONENT ───────────────────────────────────────────────────
 * `/papic` (`_papic-film.tsx`) and `/pa3d` (`PartFilm` in `_pa3d-parts.tsx`)
 * each carried this exact element, differing only in the slug and the width.
 * Both wrap it now, so the lesson below is written once.
 *
 * ─── AUTOPLAY IS A POLICY, NOT A GUARANTEE ───────────────────────────────
 * A bare `<video autoPlay muted loop playsInline>` is correct until a browser
 * refuses the autoplay — and then it is a still frame with NO CONTROL ON IT,
 * dead on the one piece of motion the section has. Measured in a real browser:
 * the element loaded (`readyState` 4) and stayed `paused`, and `play()` by hand
 * started it immediately. The file is fine; the policy is the variable.
 *
 * So `play()`'s promise — which REJECTS when the policy refuses — is caught,
 * and a refusal hands the viewer the browser's own controls. The film is
 * ambient and silent by design, a demonstration rather than something anyone
 * came to watch, so controls stay hidden while it plays.
 */

import { useEffect, useRef, useState } from 'react';

/** The three widths that ship. A lookup, not a template string: Tailwind
 *  scans source text, so `w-[${n}px]` compiles to nothing. */
const SIZE = {
  /** `/papic`'s hero film. */
  hero: 'w-[150px] sm:w-[180px] rounded-2xl',
  /** `/pa3d`'s three parts, side by side. */
  part: 'w-[124px] sm:w-[136px] rounded-xl',
  /** A spotlight's picture column. */
  spotlight: 'w-[150px] sm:w-[180px] rounded-2xl',
} as const;

export function DemoFilm({
  slug,
  title,
  size = 'hero',
  ariaLabel,
}: {
  /** Slug under `public/add-ons/demo/` — the .mp4 and .jpg share it. */
  slug: string;
  /** Read out as the film's label: "<title>, running in the app". */
  title: string;
  size?: keyof typeof SIZE;
  /** A page's own label, when the default sentence is not the right one —
   *  `/papic` has always read "The Papic camera, running". */
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsControls, setNeedsControls] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let cancelled = false;
    void v
      .play()
      .then(() => {
        if (!cancelled) setNeedsControls(false);
      })
      .catch(() => {
        if (!cancelled) setNeedsControls(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* The clip is a 9:19 phone recording (460×972), so the frame is its own
     ratio — nothing is cropped or letterboxed and it reads as what it is: the
     app, running on a phone. */
  return (
    <div
      className={`aspect-[460/972] flex-none overflow-hidden border border-[var(--m-line)] ${SIZE[size]}`}
    >
      <video
        ref={ref}
        src={`/add-ons/demo/${slug}.mp4`}
        poster={`/add-ons/demo/${slug}.jpg`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls={needsControls}
        aria-label={ariaLabel ?? `${title}, running in the app`}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
