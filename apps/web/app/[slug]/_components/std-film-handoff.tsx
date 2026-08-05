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
 * ── EVERY EVENT, NOT ONLY OPEN-BROWSE ONES (changed 2026-08-05) ─────────────
 * site-body used to wrap with this only when `plan.openBrowse` was true. On the
 * one real wedding site that flag is FALSE, so the takeover above was not a
 * historical footnote — it was the live experience, and the exit could not
 * reach it. A guest could not RSVP at all.
 *
 * The gate conflated two questions: "may this visitor browse the new open
 * site?" (what `openBrowse` decides) and "may this visitor LEAVE a full-screen
 * takeover?" (never a flag's business). This is now mounted unconditionally.
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
          the page beneath.

          THE COLUMN HAS TO BE PUT BACK HERE (2026-08-05). The whole
          Save-the-Date phase runs `fullBleed`, and the shell's fullBleed branch
          returns a bare `<main>` with no padded column — correct for a film
          that plays edge to edge. But once the real site started rendering
          UNDERNEATH that film for every event, the site inherited the film's
          no-column treatment: every card, heading and paragraph ran into both
          edges of the phone, and the rounded cards looked broken at the sides.
          It is live on both real couples' pages right now, because a wedding
          more than ~90 days out is in exactly this phase.

          The class string is the one `invitation-shell.tsx` uses for every
          other page, so the site below the film is laid out identically to the
          site after it. Wrapping HERE rather than at the call site means any
          future thing mounted beneath the film gets it too.

          ⚠ Do NOT "fix" this by turning `fullBleed` off — that would put the
          Setnayan header and footer back over a paid full-screen film. */}
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>

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
