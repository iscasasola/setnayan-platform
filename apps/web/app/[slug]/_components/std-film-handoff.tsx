'use client';

import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { STD_FILM_EXIT_EVENT } from './save-the-date-film';

/**
 * The return trip. Dispatched when the visitor asks for the film back, so the
 * veil — which retires with the film — can return with it. Exported here
 * because this component owns the round trip; the film only knows how to leave.
 */
export const STD_FILM_RETURN_EVENT = 'std:film-return';

/**
 * StdFilmHandoff — the Save-the-Date film stops being a wall.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────
 * More than STD_THRESHOLD_DAYS (90) out, `phasedBody` renders the film INSTEAD
 * of the site. The film is `fixed inset-0 z-[50]`; the menu bar is `z-30`. So
 * on a wedding that is months away — which is nearly every newly-created one —
 * a visitor gets the film and nothing else. There is no way through, and the
 * menu they are supposed to browse with is underneath it, invisible.
 *
 * Owner, 2026-08-03: *"we want them to navigate around right away"*.
 *
 * ── WHY A LIFT AND NOT A LINK ───────────────────────────────────────────────
 * The film is a PAID product (the cinematic openings SKU). Navigating away
 * would spend the couple's purchase and leave no way back. Instead the film is
 * lifted in place and a quiet "Watch our film" returns it — nothing bought is
 * lost, and the visitor is never trapped.
 *
 * ── WHY AN EVENT AND NOT A CALLBACK ─────────────────────────────────────────
 * The film is mounted by SERVER components (SaveTheDateView ← site-body), so a
 * function cannot cross the boundary. Both halves import STD_FILM_EXIT_EVENT
 * from the film module so the name cannot drift. This mirrors the shipped
 * `papic:out-of-shots` pattern.
 *
 * ── OPEN BROWSE ONLY ────────────────────────────────────────────────────────
 * site-body only wraps with this when `plan.openBrowse` is true. With open
 * browse off the film keeps its takeover exactly as today — this component is
 * never mounted, so the flag-off path is byte-identical.
 */
export function StdFilmHandoff({
  film,
  children,
}: {
  /** The full-screen film. Rendered until the visitor asks to leave it. */
  film: React.ReactNode;
  /** The browsable site, which was always beneath it. */
  children: React.ReactNode;
}) {
  const [showFilm, setShowFilm] = useState(true);

  useEffect(() => {
    const onExit = () => setShowFilm(false);
    window.addEventListener(STD_FILM_EXIT_EVENT, onExit);
    return () => window.removeEventListener(STD_FILM_EXIT_EVENT, onExit);
  }, []);

  return (
    <>
      {/* The site is always in the tree. Only its visibility changes, so
          leaving the film costs no fetch and returning costs no re-render of
          the page beneath. */}
      {children}

      {showFilm ? (
        film
      ) : (
        // The way back. Quiet on purpose — the film has already played, and a
        // loud control here would compete with the couple's own page.
        <div className="mx-auto mt-2 flex w-full max-w-3xl justify-center px-4 pb-2">
          <button
            type="button"
            onClick={() => {
              setShowFilm(true);
              window.dispatchEvent(new CustomEvent(STD_FILM_RETURN_EVENT));
            }}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-xs font-medium text-ink/65 transition-colors hover:border-ink/30 hover:text-ink"
          >
            <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Watch our film again
          </button>
        </div>
      )}
    </>
  );
}
