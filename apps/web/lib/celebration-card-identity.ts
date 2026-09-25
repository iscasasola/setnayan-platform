/**
 * celebration-card-identity.ts — what a celebration already LOOKS like.
 *
 * Owner, on his own public profile (2026-09-23): *"the event cards look non
 * events"*. Measured rather than guessed, on his three real celebrations:
 *
 *   Indalecio & Claire   hero:NO  std_theme:botanical  accent:#9a244f
 *   Maria & Jose         hero:NO  std_theme:default    accent:#9b7e00
 *   Movie Night          hero:NO  std_theme:—          accent:—
 *
 * 🔑 **NONE has a hero image, so every card fell to the monogram branch — and
 * every `monogram_color` is the same default.** Three different celebrations
 * rendered as three identical discs. The identity was not missing; the page
 * never asked for it. `EVENT_FIELDS` selected the hero and the monogram columns
 * and nothing else.
 *
 * So this module reads the identity a couple ALREADY chose and hands the card a
 * typeface and a colour. It invents nothing.
 *
 * ── 🔒 WHY ONE COLUMN ──────────────────────────────────────────────────────
 * This feeds a PUBLIC page, so every column has to pay for itself. `std_theme`
 * is already `anon=S` in `supabase/security/exposure-surface.baseline.txt`.
 *
 * 🔑 IT EARNS ITS PLACE BECAUSE THE COVER CANNOT TELL HIS TWO WEDDINGS APART.
 * `eventCardTreatment()` needs ZERO new columns and gives his three events three
 * distinct washes — but measured, two of them land on hues 204 and 214, ten
 * degrees from each other. Both read blue, side by side, and those two are the
 * ones that must be distinguishable. Two blue covers in different Save-the-Date
 * fonts read as two celebrations; in one font they read as a rendering bug.
 *
 * ⛔ THREE TEMPTING COLUMNS ARE DELIBERATELY ABSENT, and checking is what
 * caught them — all three are `anon=-`, i.e. NOT publicly readable:
 *   • `invite_theme`         ('capiz' on his wedding)
 *   • `moodboard_theme_name` ('Cale-Ice' — a name the couple chose privately)
 *   • `story_cover_kind` / `story_cover_ref`
 * Two of them would have looked perfect on the card. "It renders nicely" is not
 * a reason to publish a private field.
 *
 * ⚠ `story_cover_*` is ALSO empty everywhere: all 12 events in prod have
 * `story_cover_kind = NULL`, and the column's own comment says "nothing reads it
 * yet". It is a future art source, not a present one — noted so the next reader
 * does not re-investigate it.
 */

import { resolveStdTheme, STD_THEMES, type StdThemeId } from './std-themes';
import { resolveHero } from './event-hero';

/** The subset of an event this card needs. All fields are anon-readable. */
export type CelebrationIdentityInput = {
  landing_page_hero_image_url?: string | null;
  std_theme?: string | null;
};

export type CelebrationIdentity = {
  /** The hero image, when the couple uploaded one — it outranks everything. */
  heroUrl: string | null;
  /** The event's own typeface, via its STD theme. Always a real class. */
  themeId: StdThemeId;
  fontCls: string;
  /**
   * TRUE when the couple actually chose something. FALSE means "this event has
   * no identity yet" — a real state (his "Movie Night"), which the card must
   * render as deliberate rather than as broken.
   */
  hasOwnIdentity: boolean;
};

/** The theme's font utility class, via the shipped table — never re-typed. */
function fontClassFor(themeId: StdThemeId): string {
  return STD_THEMES.find((t) => t.id === themeId)?.fontCls ?? 'font-display';
}

/**
 * The celebration's own look.
 *
 * ⚠ NO COLOUR IS RESOLVED HERE, AND THAT IS THE POINT. An earlier cut read
 * `std_film_accent_hex` / `site_button_color` / `monogram_color` and painted an
 * accent edge. `lib/event-card-art.ts` already derives a stable wash and crop
 * from the `event_id`, proved for all 360 hues against both a white and a black
 * photo — so an edge of my own would have been a SECOND answer to a question
 * already answered, and it cost three columns on a public read to be wrong in.
 * The cover carries colour; this carries the typeface.
 */
export function resolveCelebrationIdentity(
  event: CelebrationIdentityInput,
): CelebrationIdentity {
  // THE ONE HERO (`lib/event-hero.ts`).
  const heroUrl = resolveHero(event).photoRef;
  const themeId = resolveStdTheme(event.std_theme);

  // A theme is "chosen" only when the row actually said so — `resolveStdTheme`
  // answers 'default' for null, so the resolved id cannot distinguish them.
  const themeWasChosen =
    typeof event.std_theme === 'string' && event.std_theme.trim().length > 0;

  return {
    heroUrl,
    themeId,
    fontCls: fontClassFor(themeId),
    hasOwnIdentity: Boolean(heroUrl) || themeWasChosen,
  };
}
