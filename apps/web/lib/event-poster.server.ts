import 'server-only';

import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { resolveHubLook } from '@/app/[slug]/_lib/hub-look';
import { posterFor, type EventPosterFacts } from '@/lib/event-poster';

/**
 * THE ONE POSTER RESOLVER — an event's hero, as a 3:4 poster.
 *
 * Owner, 2026-09-24 (relayed by the Redesign Controller): *"hero widget applies
 * to save the date, invitation, on the day and the thumbnail poster."* ONE
 * hero, edited once. So the poster is never its own composition: it is read
 * from the SAME inputs the Event Hub's hero (`PahinaMasthead` in
 * `app/[slug]/_components/site-body.tsx`) reads —
 *
 *   • the invitation card's words — `eventWordsFor` → `invitationCard`
 *     (solemn ⇒ no card ⇒ the quiet masthead);
 *   • the theme — `resolveHubLook` → `resolveInviteTheme`, the one place a
 *     theme is decided for the door, the hub pages and now the poster;
 *   • the monogram — `monogram_text` / `monogram_color` (the accent) and the
 *     couple's mark, which the caller draws with `resolveEventMonogramSvg`;
 *   • the hero photo — `landing_page_hero_image_url`, presigned and narrowed by
 *     the caller (the loaders' `heroPhotoUrl` source) — it wins when set.
 *
 * Every future caller — the home board today, the Event Hub Controller's poster
 * preview and the stages later — calls THIS, so they cannot disagree.
 *
 * ⚠ WHAT THE POSTER DOES NOT (YET) READ, and would therefore disagree with:
 *   • the hero VIDEO (`landing_page_hero_video_r2_key`) — the hub plays it as
 *     the banner; a poster has no frame to show, so a video-only couple gets
 *     their invitation card here;
 *   • the Save-the-Date's own columns — `std_background` (a Pro theme's ground
 *     photo, which the hub paints behind the card via `resolveHubLook().photo`),
 *     `std_media`, `std_theme`, `std_reveal_template`, `std_film_accent_hex`,
 *     `std_film_venue_name` / `_city` / `_ceremony_name`. Where those are set,
 *     the Save the Date and the poster can differ in photo, accent and place.
 *
 * `null` when the event's words cannot be resolved: a caller then keeps its
 * previous cover rather than guessing — a wake must never be handed a
 * celebration poster because a read failed.
 */
export type PosterEvent = {
  event_id: string;
  display_name: string;
  event_date: string | null;
  venue_name: string | null;
  event_type: string;
  monogram_text: string | null;
  monogram_color: string | null;
  /** The couple's SAVED invite theme (`events.invite_theme`), ungated. */
  invite_theme: string | null;
};

export async function resolveEventPoster(
  event: PosterEvent,
  /** The presigned, `renderableImageSrc`-narrowed own hero photo, or null. */
  heroSrc: string | null,
): Promise<EventPosterFacts | null> {
  const [words, look] = await Promise.all([
    eventWordsFor(event.event_type).catch(() => null),
    resolveHubLook({
      event_id: event.event_id,
      display_name: event.display_name,
      invite_theme: event.invite_theme,
      monogram_text: event.monogram_text,
      monogram_color: event.monogram_color,
      event_type: event.event_type,
    }).catch(() => null),
  ]);
  if (!words) return null;
  return posterFor({
    displayName: event.display_name,
    eventDate: event.event_date,
    venueName: event.venue_name,
    words,
    // A look that could not be resolved is House — decoration, never a word.
    theme: look?.theme ?? 'house',
    accent: event.monogram_color,
    heroSrc,
  });
}
