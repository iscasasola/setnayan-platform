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
import { CountdownWidget } from './countdown';
import { OurStory } from './our-story';
import { SaveTheDateFilm, type StdFilmContent } from './save-the-date-film';

function deriveMonogram(name: string): string {
  const parts = name
    .split(/\s*[&+]\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0]!.charAt(0)} & ${parts[1]!.charAt(0)}`.toUpperCase();
  return (name.trim().charAt(0) || '✦').toUpperCase();
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}.${String(d.getFullYear()).slice(-2)}`;
}

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
}: Props) {
  const location = [venueName, venueAddress].filter(Boolean).join(', ') || null;
  const gcalUrl = googleCalendarUrl({ title: displayName, dateIso, location });
  const ics = buildWeddingIcs({
    title: displayName,
    dateIso,
    location,
    uid: `wedding-${publicId}@setnayan.com`,
  });

  // PR4 P1 — the auto-playing scrubbable film (flag-gated). Reuses the same
  // event data; the couple's builder (P4) later supplies split venues + media.
  if (film) {
    const content: StdFilmContent = {
      monogram: deriveMonogram(displayName),
      names: displayName,
      dateBig: shortDate(dateIso),
      dateLabel: dateIso ? formatEventDate(dateIso) : null,
      venueName,
      venueCity: venueAddress,
      storyTeaser:
        typeof loveStory === 'string' && loveStory.trim()
          ? loveStory.length > 120
            ? loveStory.slice(0, 118).trimEnd() + '…'
            : loveStory.trim()
          : null,
      websiteUrl: null,
      gcalUrl,
      icsHref: ics ? icsDataHref(ics) : null,
      icsFilename: `${displayName.replace(/[^\w-]+/g, '-')}-save-the-date.ics`,
      musicUrl: null,
    };
    return (
      <section className="py-2">
        <SaveTheDateFilm content={content} />
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
