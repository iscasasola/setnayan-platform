'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { landedOnTheFirstPage } from '@/lib/reveal-stages';
import { STD_FILM_EXIT_EVENT } from './save-the-date-film';
import { StageAutoplay } from './stage-autoplay';
import {
  STD_FILM_SEEN_ATTR,
  exitCountsAsSeen,
  filmLiftAtLanding,
  markStdFilmSeen,
  stdFilmSeen,
  stdFilmSeenBootScript,
  stdFilmSeenKey,
} from '@/lib/std-film-seen';

/** This phone's storage, or null where the browser refuses it (private mode, blocked site data). */
function phoneStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

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
 *
 * ── A GUEST COMING BACK TO A SECTION LANDS ON IT, NOT ON THE FILM (2026-09-29) ─
 * "Back to the invitation" on Find your seat returns to `/slug#site-details`
 * (`find-seat/_lib/back-to-the-invitation.ts`) — the Details scene they left.
 * On every other stage that hash already stands the opening down
 * (`landedOnTheFirstPage`, lib/reveal-stages.ts); on the Save the Date the film
 * still started over from its first beat, a whole film between the guest and
 * the seat line they had just used. The SAME rule now decides the film: a
 * landing that is not the first page (a `#section`, a restored scroll) starts
 * with the film lifted — by the same `STD_FILM_EXIT_EVENT` "See our page"
 * sends, so the veil retires with it and "Watch our film again" is there. A
 * bare address is the front door and plays the film exactly as before.
 */
/**
 * Does this landing start with the film lifted? Only off the first page (the
 * Event Hub's one rule, `landedOnTheFirstPage`), and never in the Maker's
 * canvas, where the film is a slide. Pure, so the decision is executed by
 * `find-seat/back-lands-on-the-invitation.test.ts`, not just read.
 */
export function filmLiftedOnLanding(
  landing: { hash: string; scrollY: number; viewportHeight: number },
  asSlide: boolean,
): boolean {
  return !asSlide && !landedOnTheFirstPage(landing);
}

export function StdFilmHandoff({
  film,
  children,
  marker = null,
  asSlide = false,
  autoplay = false,
  seenKey = null,
  closing = null,
}: {
  /**
   * 🎞 ONCE PER PHONE (owner 2026-10-11) — the event's own id. With it, a phone
   * that has already left the film (by "See our page" or by the film's end)
   * gets the page straight away on its next visits, and "Watch our film again"
   * brings the film back (`lib/std-film-seen.ts` has what "once per phone"
   * is). Null — the Maker's canvas, or no id — remembers nothing.
   */
  seenKey?: string | null;
  /**
   * 🃏 THE FILM'S CLOSING CARD, AS THE TOP OF THE PAGE (owner 2026-10-11, on an
   * event with no date: under the film the page was nearly empty). The Save the
   * Date's own still view — its words, the names, "Full invitation to follow" —
   * drawn in place above the page, so after the film (or instead of it on later
   * visits) the guest is on that card. Null where the page under the film has
   * its own scenes.
   */
  closing?: React.ReactNode;
  /** The full-screen film. Rendered until the visitor asks to leave it. */
  film: React.ReactNode;
  /** The browsable site, which was always beneath it. */
  children: React.ReactNode;
  /** 🧭 The Maker canvas's hidden handle for the film — stamped IMMEDIATELY
   *  before the film so the navigator's film tile finds the film, not the page
   *  column. Null everywhere but the canvas. */
  marker?: React.ReactNode;
  /** 🖼 The Maker's canvas: the film is the stage's FIRST SLIDE, in the page's
   *  flow above the rest — no takeover, no way out to offer, nothing to hand
   *  over. The whole-stage experience is "Preview the whole stage". */
  asSlide?: boolean;
  /** 🎬 AUTO — when the film reaches its close, the stage carries on to the next
   *  scenes in their order (`lib/stage-autoplay.ts`). Guests and the preview tab. */
  autoplay?: boolean;
}) {
  const [showFilm, setShowFilm] = useState(true);
  const storageKey = asSlide ? null : stdFilmSeenKey(seenKey);
  /** The exit about to be heard is the page's own lift at landing — not the guest leaving the film. */
  const liftedAtLanding = useRef(false);

  useEffect(() => {
    const onExit = () => {
      setShowFilm(false);
      // 🎞 The guest's own press, or the film's own end: this phone has seen it.
      if (exitCountsAsSeen({ asSlide, liftedAtLanding: liftedAtLanding.current })) markStdFilmSeen(phoneStorage(), storageKey);
      liftedAtLanding.current = false;
    };
    window.addEventListener(STD_FILM_EXIT_EVENT, onExit);
    // ⬅ Landed part-way down → the film starts lifted (docblock above). Never
    // in the Maker's canvas, where the film is a slide and nothing is lifted.
    // 🎞 …and so does a phone that has already seen it (owner 2026-10-11).
    const lift = filmLiftAtLanding({
      asSlide,
      landedDownThePage: filmLiftedOnLanding(
        { hash: window.location.hash, scrollY: window.scrollY, viewportHeight: window.innerHeight },
        asSlide,
      ),
      seen: stdFilmSeen(phoneStorage(), storageKey),
    });
    if (lift) {
      liftedAtLanding.current = true;
      window.dispatchEvent(new CustomEvent(STD_FILM_EXIT_EVENT));
    }
    return () => window.removeEventListener(STD_FILM_EXIT_EVENT, onExit);
    // Read once, at landing — a later hash change is the guest moving around
    // the page, not arriving at it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (asSlide) {
    return (
      <>
        {marker}
        {film}
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      </>
    );
  }

  return (
    <>
      {autoplay ? <StageAutoplay /> : null}
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
      {/* 🃏 The closing card as the top of the page (see `closing`) — the same column, above the page. */}
      {closing ? (
        <div data-std-closing="" className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
          {closing}
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>

      {/* 🎞 A phone that remembers the film is not shown it while the page's script loads: the mark is set before
          paint, and the film — still in the server's HTML — is not drawn (`stdFilmSeenBootScript`). */}
      {storageKey ? (
        <>
          <style>{`[${STD_FILM_SEEN_ATTR}] [data-std-film-wrap]{display:none}`}</style>
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: one inline line, before paint; the key is JSON-quoted */}
          <script dangerouslySetInnerHTML={{ __html: stdFilmSeenBootScript(storageKey) }} />
        </>
      ) : null}
      {showFilm ? (
        <div data-std-film-wrap="">
          {marker}
          {film}
        </div>
      ) : (
        // The way back. Quiet on purpose — the film has already played, and a
        // loud control here would compete with the couple's own page.
        <div className="mx-auto mt-2 flex w-full max-w-3xl justify-center px-4 pb-2">
          <button
            type="button"
            onClick={() => {
              // Asked for by hand: the "seen" mark must not hide the film this time.
              document.documentElement.removeAttribute(STD_FILM_SEEN_ATTR);
              setShowFilm(true);
              window.dispatchEvent(new CustomEvent(STD_FILM_RETURN_EVENT));
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-xs font-medium text-ink/70 transition-colors hover:border-ink/30 hover:text-ink"
          >
            <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Watch our film again
          </button>
        </div>
      )}
    </>
  );
}
