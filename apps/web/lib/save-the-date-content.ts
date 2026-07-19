/**
 * resolveStdFilmContent — the Save-the-Date film's auto-fill resolver
 * (build plan P2 · 0024_Save_the_Date_Build_Plan_2026-06-17.md).
 *
 * Assembles a StdFilmContent from the couple's EXISTING data, no new schema:
 *   monogram (their explicit override or derived from the names) · names ·
 *   the finalized date · the ceremony + reception venues · a love-story teaser ·
 *   the couple's site music as the film's soundtrack ·
 *   their curated photos as the closing gallery beat ·
 *   the wedding calendar links.
 *
 * The ceremony + reception venues are auto-filled UPSTREAM from the couple's
 * FINALIZED vendor bookings (lib/std-venues · resolveStdFinalizedVenues),
 * falling back to the manual override / event venue — the caller resolves them
 * and passes the names in. Every field is optional at the edges — a missing one
 * just drops its beat.
 *
 * Pure + isomorphic: the server page resolves the presigned media URLs (music,
 * photos) and passes them in; this only shapes them — so it's unit-testable and
 * safe to import from the client film component.
 */
import { formatEventDate } from '@/lib/events';
import {
  googleCalendarUrl,
  buildSaveTheDateIcs,
  icsDataHref,
} from '@/lib/calendar-links';

/** The shape the SaveTheDateFilm renders. The single source of truth lives here
 *  (the component imports the type) so the resolver and the view never drift. */
export type StdFilmContent = {
  monogram: string;
  /** Sanitized SVG markup of the couple's actual monogram mark (uploaded /
   *  Cipher / bespoke). When present the film renders it in the monogram + close
   *  beats instead of the text initials. null → the text-initials fallback. */
  monogramSvg?: string | null;
  names: string;
  /** Compact date for the big card (e.g. "06.12.27"); null when no date yet. */
  dateBig: string | null;
  /** Long-form date label (e.g. "June 12, 2027"); null when no date yet. */
  dateLabel: string | null;
  /** Ceremony venue name — auto-filled from the finalized ceremony booking
   *  (event_vendors). null → the ceremony beat is skipped. */
  ceremonyVenue?: string | null;
  /** Reception venue name — finalized reception booking ?? manual ?? event.
   *  null → the reception beat is skipped. */
  receptionVenue?: string | null;
  /** Reception city/area subtitle; null → name only. */
  receptionCity?: string | null;
  storyTeaser?: string | null;
  websiteUrl?: string | null;
  gcalUrl?: string | null;
  icsHref?: string | null;
  icsFilename: string;
  /** Presigned soundtrack URL (the couple's site music); null → silent film. */
  musicUrl?: string | null;
  /**
   * Presigned URL of the couple's uploaded closing VIDEO — plays as a locked
   * real-time island beat (plays to the end with sound) in place of the photo
   * gallery. null → no video beat (the gallery beat shows instead). On the live
   * page this is set ONLY when the video is NSFW-approved (stdVideoIsLive).
   */
  videoUrl?: string | null;
  /** Poster still of the closing video — for the blurred letterbox fill behind
   *  the contained clip on the full-screen video beat (iOS-safe, no 2nd video). */
  videoPosterUrl?: string | null;
  /** Presigned photo URLs for the closing gallery beat; empty → no gallery beat. */
  gallery?: string[];
  /** Formatted invitation-launch date for the close beat; null → no reminder line. */
  launchLabel?: string | null;
};

export type ResolveStdFilmInput = {
  displayName: string;
  /** The couple's explicit monogram text (resolveMonogram().text); else derived. */
  monogramText?: string | null;
  /** Sanitized SVG of the couple's monogram mark (uploaded_svg ?? custom_svg). */
  monogramSvg?: string | null;
  dateIso: string | null;
  /** When the full invitation goes live (events.std_invitation_launch_date). */
  launchDateIso?: string | null;
  /** Ceremony venue name — caller resolves from the finalized ceremony booking. */
  ceremonyVenue?: string | null;
  /** Reception venue name — caller resolves: finalized reception booking ?? manual ?? event. */
  receptionVenue?: string | null;
  /** Reception city/area — caller resolves: manual override ?? event.venue_address. */
  receptionCity?: string | null;
  /** Raw events.love_story (unknown shape) — teaser extracted + truncated. */
  loveStory?: unknown;
  /** "See details" target; null → the button hides (P4 builder can set it). */
  websiteUrl?: string | null;
  publicId: string;
  /** Presigned soundtrack URL (the couple's site music) — resolved server-side. */
  musicUrl?: string | null;
  /** Presigned URL of the couple's NSFW-approved closing video — resolved server-side. */
  videoUrl?: string | null;
  /** Poster still of that video — resolved server-side; blurred letterbox fill. */
  videoPosterUrl?: string | null;
  /** Presigned photo URLs for the closing gallery — resolved server-side. */
  galleryUrls?: string[];
};

const MONO_SPLIT = /\s*[&+]\s*|\s+and\s+/i;
const MAX_GALLERY = 6;

/**
 * The default invitation-launch date — 3 months before the wedding (owner
 * 2026-06-19: "the invitation is automatic 3 months before the wedding date").
 * Returns null when there's no wedding date. A manually-set
 * events.std_invitation_launch_date overrides this (resolved by the caller:
 * `std_invitation_launch_date ?? defaultInvitationLaunchIso(event_date)`).
 */
export function defaultInvitationLaunchIso(weddingIso: string | null | undefined): string | null {
  if (!weddingIso) return null;
  const d = new Date(weddingIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

/** Two-initial monogram from a couple's display name, e.g. "Maria & Jose" → "M & J". */
export function deriveMonogram(name: string): string {
  const parts = name
    .split(MONO_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)} & ${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return (name.trim().charAt(0) || '✦').toUpperCase();
}

/** Compact "MM.DD.YY" for the date card; null on a missing/invalid date. */
export function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}.${String(d.getFullYear()).slice(-2)}`;
}

/** A one-line love-story teaser (≤120 chars, ellipsized); null when absent. */
function storyTeaserOf(loveStory: unknown): string | null {
  if (typeof loveStory !== 'string') return null;
  const s = loveStory.trim();
  if (!s) return null;
  return s.length > 120 ? s.slice(0, 118).trimEnd() + '…' : s;
}

export function resolveStdFilmContent(input: ResolveStdFilmInput): StdFilmContent {
  const monogram = (
    input.monogramText?.trim() || deriveMonogram(input.displayName)
  ).slice(0, 12);
  // Calendar location = the reception (where the celebration is); else the
  // ceremony venue. (Both auto-filled from the finalized bookings upstream.)
  const location =
    [input.receptionVenue, input.receptionCity].filter(Boolean).join(', ') ||
    input.ceremonyVenue ||
    null;
  const gcalUrl = googleCalendarUrl({
    title: input.displayName,
    dateIso: input.dateIso,
    location,
  });
  const ics = buildSaveTheDateIcs({
    coupleName: input.displayName,
    weddingDateIso: input.dateIso,
    launchDateIso: input.launchDateIso,
    location,
    publicId: input.publicId,
  });
  return {
    monogram,
    monogramSvg:
      typeof input.monogramSvg === 'string' && input.monogramSvg.trim()
        ? input.monogramSvg
        : null,
    names: input.displayName,
    dateBig: shortDate(input.dateIso),
    dateLabel: input.dateIso ? formatEventDate(input.dateIso) : null,
    ceremonyVenue: input.ceremonyVenue?.trim() || null,
    receptionVenue: input.receptionVenue?.trim() || null,
    receptionCity: input.receptionCity?.trim() || null,
    storyTeaser: storyTeaserOf(input.loveStory),
    websiteUrl: input.websiteUrl ?? null,
    gcalUrl,
    icsHref: ics ? icsDataHref(ics) : null,
    icsFilename: `${input.displayName.replace(/[^\w-]+/g, '-')}-save-the-date.ics`,
    musicUrl: input.musicUrl ?? null,
    videoUrl: input.videoUrl ?? null,
    videoPosterUrl: input.videoPosterUrl ?? null,
    gallery: (input.galleryUrls ?? [])
      .filter((u): u is string => typeof u === 'string' && u.length > 0)
      .slice(0, MAX_GALLERY),
    launchLabel: input.launchDateIso ? formatEventDate(input.launchDateIso) : null,
  };
}
