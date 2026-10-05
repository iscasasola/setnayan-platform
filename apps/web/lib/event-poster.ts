/**
 * lib/event-poster.ts — WHICH POSTER AN EVENT'S CARD WEARS, and its words.
 *
 * Owner-approved 2026-09-24 (DECISION_LOG, "the template is good"): each home
 * Planning card's cover is a 3:4 POSTER that **follows the hero the couple
 * built** — "invitation card in their theme; hero photo wins; a wake keeps its
 * quiet masthead" — in the public-profile poster language
 * (`build-sessions/prototypes/public_profile_icecasa_FABLE3_2026-09-23.html`).
 * Names and date are printed ONCE, by the poster.
 *
 * 🔑 CALL `resolveEventPoster` (`lib/event-poster.server.ts`), NOT THIS. That
 * is the ONE resolver that reads an event's hero the way the Event Hub does
 * (owner: "hero widget applies to save the date, invitation, on the day and
 * the thumbnail poster"); `event-poster.test.ts` fails a second caller of
 * `posterFor`. This file is its pure half, so the order is testable.
 *
 * Pure: every fact is handed in by the caller, already resolved by the
 * resolvers that own it —
 *   • the words (`EventWords` → `invitationCard`, the hub's own card; a
 *     solemn event gets `null` there, and so gets the quiet poster here);
 *   • the theme (`resolveHubLook` → `resolveInviteTheme`, the ONE place a
 *     theme is decided, so the card can never wear a theme the door does not);
 *   • the accent (`events.monogram_color`, the couple's colour);
 *   • the hero (`renderableImageSrc` of the presigned own hero).
 *
 * ─── THE ORDER, and why each step is where it is ────────────────────────────
 *   1. SOLEMN → `quiet`. A wake never celebrates (the-wake-never-celebrates);
 *      its masthead is typographic and still, whatever else is set.
 *   2. HERO PHOTO → `photo` (ground `hero`). The couple's own picture wins.
 *   3. THE SAVE-THE-DATE BACKGROUND → `photo` (ground `background`). A Pro
 *      theme is painted on the couple's reveal background (`std_background`,
 *      owner 2026-09-10); `resolveHubLook().photo` hands it over already gated
 *      — null for House and for a lapsed unlock — so the card can never wear a
 *      background the Event Hub would not.
 *   4. A THEME WITH ITS OWN ART → `theme`: the invitation card in their theme,
 *      printed over the theme's still (`resolveThemeGround().poster` — owner
 *      2026-09-24: *"the image can be used for the invitations, tickets, and
 *      poster"*).
 *   5. NOTHING CHOSEN → `invitation`: the hub's invitation card itself —
 *      eyebrow, their mark in a circle, the names, the invitation line.
 *
 * 🔑 2–4 ARE READABLE BY MEASUREMENT, NOT BY TASTE (owner 2026-09-25: text
 * adapts to every background). Their ink and veil come from `hubLegibility`,
 * the Event Hub's one rule: over the theme's still it is the theme's own ink
 * over its measured scrim; over a photo nobody has sampled it is the ink that
 * clears AA over BOTH a black and a white pixel — any photo at all. Before
 * 2026-09-29 a photo card laid a fixed dark gradient that faded out below the
 * names on a phone-width card, and a Pro event with a background and a theme
 * but no hero photo drew plain white paper ("did not adjust to the event
 * cover") — the background never reached this file.
 *
 * (`deep` / `moon` are retired from the order — 2026-09-26, below — and kept
 * only as drawable kinds.)
 */
import { invitationCard } from '@/app/[slug]/_lib/invitation-card';
import type { EventWords } from '@/app/[slug]/_lib/event-words';
import { splitCoupleNames } from '@/app/[slug]/_components/pahina-masthead';
import { relativeLuminance } from '@/lib/booth-studio';
import { hubLegibility, hubLegibilityVars } from '@/lib/hub-legibility';
import { INVITE_THEMES, type InviteTheme, type InviteThemeId } from '@/lib/invite-themes';

export type PosterKind = 'quiet' | 'photo' | 'theme' | 'deep' | 'moon' | 'invitation';

/** Which cover a `photo` / `theme` poster is wearing — the hub's own ground. */
export type PosterGround = 'hero' | 'background' | 'theme';

/**
 * The pixel extremes a photo nobody has sampled can put under the words. Ink
 * that clears AA over both, once veiled, clears it over any photo — the same
 * worst case `sceneGroundSamples` measures an unknown ground against.
 */
export const ANY_PHOTO_SAMPLES = ['#000000', '#ffffff'] as const;

export type EventPosterFacts = {
  kind: PosterKind;
  /** The validated accent hex, or null. Never an unchecked column value. */
  accent: string | null;
  /** Deep only: draw the Capiz panes — the invite opens through the capiz door
   *  (Vintage, Cinderella, Regency since the ten themes, 2026-09-25). */
  capiz: boolean;
  /** True when the art is dark enough that chips and the strip go dark glass. */
  dark: boolean;
  names: { first: string; second: string | null };
  /** "Saturday" — null when undated. */
  weekday: string | null;
  /** "12 December 2026" — null when undated (the poster prints "Date to be set"). */
  date: string | null;
  /** Invitation only — the hub card's eyebrow and line. */
  eyebrow: string | null;
  line: string | null;
  /** Quiet only — the one place line a wake's masthead carries. */
  venue: string | null;
  /** Photo / theme only — the image the card wears. */
  photoSrc: string | null;
  /** Photo / theme only — where `photoSrc` came from. */
  ground: PosterGround | null;
  /**
   * Photo / theme only — `hubLegibilityVars` of the Event Hub's legibility rule
   * for this ground: `--hub-ink`, `--hub-heading`, `--hub-accent-text`,
   * `--hub-scrim`. Hex / rgba built from parsed values only.
   */
  legibility: Record<string, string> | null;
};

/** WCAG AA for body text — the line between "type on the colour" and "a moon". */
export const WHITE_TYPE_MIN_CONTRAST = 4.5;

/** A plain #rgb / #rrggbb, lower-cased and expanded — anything else is no accent. */
export function safeAccent(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : null;
}

/** The WCAG contrast of white type on `hex`. */
export function whiteContrastOn(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}

/**
 * The poster's two date lines, read off the calendar DAY (never an instant —
 * the day the couple picked survives any server timezone): "Saturday" and
 * "12 December 2026". Null for an undated event.
 */
export function posterDate(eventDate: string | null): { weekday: string; date: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
  };
}

export function posterFor(input: {
  displayName: string;
  eventDate: string | null;
  venueName: string | null;
  words: Pick<EventWords, 'solemn' | 'twoPeople' | 'eventWord'>;
  theme: InviteThemeId;
  accent: unknown;
  heroSrc: string | null;
  /** `resolveHubLook().photo` — the Save-the-Date background, already Pro-gated. */
  backgroundSrc?: string | null;
  /** `resolveThemeGround(theme).poster` — the theme's still, or null (Classic). */
  themeStillSrc?: string | null;
  /**
   * 🎨 The theme's colours as the Mood Board dresses them (`themeColours`,
   * `lib/theme-colours.ts`, owner 2026-10-05) — the poster's veil and ink are
   * measured on these. Absent = the theme's own (no board). Handed in, not
   * imported, so the resolver stays out of this module's client importers.
   */
  colours?: InviteTheme['palette'];
}): EventPosterFacts {
  const card = invitationCard({ words: input.words, firstStartAt: null });
  const split = splitCoupleNames(input.displayName, input.words.twoPeople);
  const when = posterDate(input.eventDate);
  const accent = safeAccent(input.accent);
  const base = {
    accent,
    capiz: false,
    names: { first: split.first, second: split.second },
    weekday: when?.weekday ?? null,
    date: when?.date ?? null,
    eyebrow: null,
    line: null,
    venue: null,
    photoSrc: null,
    ground: null,
    legibility: null,
  };

  if (card === null) {
    return { ...base, kind: 'quiet', dark: false, venue: input.venueName?.trim() || null };
  }
  const own = INVITE_THEMES[input.theme] ?? INVITE_THEMES.house;
  const theme = input.colours ? { ...own, palette: input.colours } : own;
  const photo = input.heroSrc
    ? { src: input.heroSrc, ground: 'hero' as const }
    : input.backgroundSrc
      ? { src: input.backgroundSrc, ground: 'background' as const }
      : null;
  if (photo) {
    const legible = hubLegibility(theme, { kind: 'media', samples: ANY_PHOTO_SAMPLES });
    return {
      ...base,
      kind: 'photo',
      dark: legible.tone === 'light',
      photoSrc: photo.src,
      ground: photo.ground,
      legibility: hubLegibilityVars(legible),
    };
  }
  if (theme.media && input.themeStillSrc) {
    const legible = hubLegibility(theme, { kind: 'theme' });
    return {
      ...base,
      kind: 'theme',
      dark: legible.tone === 'light',
      eyebrow: card.eyebrow,
      line: card.line,
      photoSrc: input.themeStillSrc,
      ground: 'theme',
      legibility: hubLegibilityVars(legible),
    };
  }
  // 🃏 THE COVER IS THE EVENT HUB HERO — The Card, on Classic, by default (owner
  // 2026-09-26: *"is it using the template provided on the event hub? our
  // default is the classic remember?"*; the cover follows the couple's hero).
  // The couple's colour tints the mark only; it no longer swaps the layout for
  // the 09-24 `deep` / `moon` sheets, which made every coloured event's card the
  // same stamp and matched no hero the Event Hub draws.
  return { ...base, kind: 'invitation', dark: false, eyebrow: card.eyebrow, line: card.line };
}

/**
 * THE COVER A SCENE BAND WEARS — the same poster, read for a photo band.
 *
 * Owner, 2026-09-29, on the event Overview's "THE WEDDING DAY" tile, whose top
 * band showed the generic `/event-types/wedding.webp` under a random per-event
 * colour grade: *"this needs to adapt to the background of the event hub"*. A
 * band (`EventScene` — the Overview's focal tile, the home board's glass cards)
 * has no room for the poster's words, so it wears only the poster's GROUND,
 * decided by the one resolver (`resolveEventPoster`), never a second order:
 *
 *   • `photo` / `theme` → that picture (hero photo → Save-the-Date background →
 *     the theme's still), under the Event Hub's own legibility veil
 *     (`legibility`, i.e. `hubLegibilityVars`);
 *   • `quiet` → a still, colourless band. A wake never wears a photo or a
 *     colour grade here, exactly as its poster keeps its quiet masthead;
 *   • `invitation` (nothing chosen) → `null`: the caller's stock event-type
 *     photo is the LAST fallback, only when the event has nothing of its own;
 *   • no poster at all (its words could not be read) → `null`: the caller
 *     keeps the cover it already had rather than guessing.
 */
export type SceneCover =
  | { kind: 'quiet' }
  | {
      kind: 'photo' | 'theme';
      src: string;
      ground: PosterGround;
      /** `hubLegibilityVars` for this ground — `--hub-scrim` tints the band. */
      legibility: Record<string, string> | null;
    };

export function sceneCoverFor(poster: EventPosterFacts | null | undefined): SceneCover | null {
  if (!poster) return null;
  if (poster.kind === 'quiet') return { kind: 'quiet' };
  if ((poster.kind === 'photo' || poster.kind === 'theme') && poster.photoSrc && poster.ground) {
    return { kind: poster.kind, src: poster.photoSrc, ground: poster.ground, legibility: poster.legibility };
  }
  return null;
}
