import type { EventWords } from '@/app/[slug]/_lib/event-words';
import { posterFor, type EventPosterFacts } from '@/lib/event-poster';
import type { InviteThemeId } from '@/lib/invite-themes';
import { themeColours } from '@/lib/theme-colours';

/**
 * event-poster-given.ts — THE ONE POSTER RULE, with its two reads handed in.
 *
 * `resolveEventPoster` (`lib/event-poster.server.ts`) reads the event type's
 * words and the hub's look, then composes the poster. The composing is here, so
 * a caller that already HOLDS those two answers — the Discover card, which is
 * drawn from remembered public rows — asks the same rule without a read, a
 * cookie or a session. `resolveEventPoster` calls this; there is one copy.
 *
 * Nothing in this file's import graph can reach a session
 * (`lib/home-reads-remember-nobody.test.ts`).
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
  /**
   * `events.std_background`, raw. REQUIRED (not optional) on purpose: a caller
   * that forgets it silently draws a Pro event's card as plain paper — the
   * 2026-09-29 owner report. `null` is an honest "none / not read".
   */
  std_background: unknown;
  /**
   * 🎨 `events.role_palette`, raw — REQUIRED for the same reason: the poster's
   * veil and ink follow the Mood Board (owner 2026-10-05, "THE MOOD BOARD
   * PALETTE IS THE PRIORITY"), and a caller that forgets it would silently draw
   * the theme's own colours. `null` = no board / not read.
   */
  role_palette: unknown;
};

/** What the poster takes from the hub's look: the gated theme and the gated own photo. */
export type PosterLook = { theme: InviteThemeId; photo: string | null };

export function eventPosterGiven(
  event: PosterEvent,
  /** The presigned, `renderableImageSrc`-narrowed own hero photo, or null. */
  heroSrc: string | null,
  given: {
    /** The event type's words; `null` = they could not be resolved. */
    words: EventWords | null;
    /** The hub's look; `null` = it could not be resolved. */
    look: PosterLook | null;
    /** `posterThemeStill` (`lib/event-poster.server.ts`) — the theme's public still. */
    themeStill: (theme: InviteThemeId) => string | null;
  },
): EventPosterFacts | null {
  if (!given.words) return null;
  // A look that could not be resolved is House — decoration, never a word.
  const theme = given.look?.theme ?? 'house';
  return posterFor({
    displayName: event.display_name,
    eventDate: event.event_date,
    venueName: event.venue_name,
    words: given.words,
    theme,
    accent: event.monogram_color,
    heroSrc,
    backgroundSrc: given.look?.photo ?? null,
    themeStillSrc: given.themeStill(theme),
    colours: themeColours(theme, event.role_palette).colours,
  });
}
