/**
 * Save the Date view — the FIRST lifecycle phase of the wedding website
 * (Wedding_Website_Lifecycle_Spec · 4-path model 2026-06-14).
 *
 * Shown when a wedding is far enough out that it's an announcement, not yet
 * an invitation (getLifecyclePhase → 'save_the_date', > STD_THRESHOLD_DAYS
 * before the date). Deliberately minimal — it asks NOTHING of the guest:
 * monogram/name + date (the hero renders above this), a countdown, and a
 * one-tap "add to calendar". The full RSVP invitation arrives later.
 *
 * Rendered as a dedicated body branch in app/[slug]/page.tsx for both the
 * anonymous (PublicLanding) and signed-in guest (InvitationSite) paths.
 */

import { formatEventDate } from '@/lib/events';
import {
  googleCalendarUrl,
  buildWeddingIcs,
  icsDataHref,
} from '@/lib/calendar-links';
import { resolveStdFilmContent } from '@/lib/save-the-date-content';
import { resolveStdTheme } from '@/lib/std-themes';
import { CountdownWidget } from './countdown';
import { OurStory } from './our-story';
import { SaveTheDateFilm } from './save-the-date-film';
import { StdBackgroundLayer } from './std-background-layer';
import type { StdBackground } from '@/lib/std-backgrounds';

type Props = {
  displayName: string;
  dateIso: string | null;
  venueName: string | null;
  venueAddress: string | null;
  publicId: string;
  // Couple's love story (events.love_story) — shown here as a one-line teaser
  // (the full story lives on the RSVP + Event paths). Absent → nothing renders.
  loveStory?: unknown;
  /**
   * When true, render the couple's name + date here. The anonymous path has
   * no hero for text-only events, so it asks the STD view to carry it. The
   * signed-in path always renders the monogram hero above, so it passes false.
   */
  showTextHero: boolean;
  /** When true, render the auto-playing scrubbable "film" instead of the static section (PR4 P1, flag-gated). */
  film?: boolean;
  /** Couple's explicit monogram text (resolveMonogram().text) — film only (P2). */
  monogramText?: string | null;
  /** Presigned soundtrack URL (the couple's site music) — film only (P2). */
  musicUrl?: string | null;
  /** Presigned photo URLs for the film's closing gallery beat — film only (P2). */
  galleryUrls?: string[];
  /** When the full invitation goes live (events.std_invitation_launch_date) — film only (P3). */
  launchDateIso?: string | null;
  /** Visual theme for the film (lib/std-themes · 2026-06-18). Defaults to 'moodboard'. */
  themeId?: string | null;
  /** Step-1 background (events.std_background, resolved) — film only (2026-06-19). */
  background?: StdBackground;
  /** Resolved background image URL for kind realistic/upload (presigned). */
  backgroundImageUrl?: string | null;
};

export function SaveTheDateView({
  displayName,
  dateIso,
  venueName,
  venueAddress,
  publicId,
  loveStory,
  showTextHero,
  film = false,
  monogramText,
  musicUrl,
  galleryUrls,
  launchDateIso,
  themeId,
  background,
  backgroundImageUrl,
}: Props) {
  const location = [venueName, venueAddress].filter(Boolean).join(', ') || null;
  const gcalUrl = googleCalendarUrl({ title: displayName, dateIso, location });
  const ics = buildWeddingIcs({
    title: displayName,
    dateIso,
    location,
    uid: `wedding-${publicId}@setnayan.com`,
  });

  // PR4 P1/P2 — the auto-playing scrubbable film (flag-gated). The resolver
  // (lib/save-the-date-content) auto-fills from the couple's existing data:
  // their monogram, names, date, venue, love story, the site music as the
  // soundtrack, and curated photos as the closing gallery. The builder (P4)
  // later supplies split venues, the Pakanta song, and video.
  if (film) {
    const content = resolveStdFilmContent({
      displayName,
      monogramText,
      dateIso,
      launchDateIso,
      venueName,
      venueAddress,
      loveStory,
      publicId,
      musicUrl,
      galleryUrls,
    });
    return (
      <section className="py-2">
        {background ? (
          <StdBackgroundLayer background={background} imageUrl={backgroundImageUrl ?? null} fixed />
        ) : null}
        <SaveTheDateFilm
          content={content}
          themeId={resolveStdTheme(themeId)}
          transparent={Boolean(background)}
        />
      </section>
    );
  }

  return (
    <section className="space-y-8 text-center">
      {showTextHero ? (
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Save the date
          </p>
          <h1 className="font-display text-5xl font-medium italic tracking-tight sm:text-6xl">
            {displayName}
          </h1>
          {dateIso ? (
            <p className="text-base text-ink/60">
              {[formatEventDate(dateIso), venueName].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Save the date
        </p>
      )}

      {dateIso ? <CountdownWidget targetIso={dateIso} /> : null}

      {gcalUrl || ics ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {gcalUrl ? (
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-3 text-sm font-semibold text-cream shadow-lg transition hover:bg-mulberry-600"
            >
              Add to Google Calendar
            </a>
          ) : null}
          {ics ? (
            <a
              href={icsDataHref(ics)}
              download={`${displayName.replace(/[^\w-]+/g, '-')}-save-the-date.ics`}
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/75 shadow-sm transition hover:border-terracotta hover:text-terracotta"
            >
              Apple / Outlook (.ics)
            </a>
          ) : null}
        </div>
      ) : null}

      <OurStory loveStory={loveStory} variant="teaser" />

      <p className="mx-auto max-w-prose text-sm text-ink/60">
        Full invitation to follow. We can&rsquo;t wait to celebrate with you.
      </p>
    </section>
  );
}
