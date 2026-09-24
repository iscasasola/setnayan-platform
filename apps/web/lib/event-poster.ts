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
 *   2. HERO PHOTO → `photo`. The couple's own picture wins when set.
 *   3. AN ACCENT THAT CARRIES WHITE TYPE → `deep`: the words sit straight on
 *      their colour (FABLE3: "Wine carries white at 7.7"). Capiz panes fill the
 *      upper sheet only when the invite wears the Capiz theme.
 *   4. AN ACCENT THAT CANNOT CARRY TYPE → `moon`: "Gold cannot carry text, so
 *      the art makes room: a white moon … holds every word."
 *   5. NOTHING CHOSEN → `invitation`: the hub's invitation card itself —
 *      eyebrow, their mark in a circle, the names, the invitation line.
 *
 * 🔑 3 vs 4 IS A CONTRAST MEASUREMENT, NOT A TASTE. The accent is
 * host-writable and can be any colour; white type on a pale one is unreadable.
 * The WCAG ratio against white decides, at the AA line (4.5).
 */
import { invitationCard } from '@/app/[slug]/_lib/invitation-card';
import type { EventWords } from '@/app/[slug]/_lib/event-words';
import { splitCoupleNames } from '@/app/[slug]/_components/pahina-masthead';
import { relativeLuminance } from '@/lib/booth-studio';
import type { InviteThemeId } from '@/lib/invite-themes';

export type PosterKind = 'quiet' | 'photo' | 'deep' | 'moon' | 'invitation';

export type EventPosterFacts = {
  kind: PosterKind;
  /** The validated accent hex, or null. Never an unchecked column value. */
  accent: string | null;
  /** Deep only: draw the Capiz panes (the invite wears Capiz). */
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
  photoSrc: string | null;
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
  };

  if (card === null) {
    return { ...base, kind: 'quiet', dark: false, venue: input.venueName?.trim() || null };
  }
  if (input.heroSrc) {
    return { ...base, kind: 'photo', dark: true, photoSrc: input.heroSrc };
  }
  if (accent && whiteContrastOn(accent) >= WHITE_TYPE_MIN_CONTRAST) {
    return { ...base, kind: 'deep', dark: true, capiz: input.theme === 'capiz' };
  }
  if (accent) {
    return { ...base, kind: 'moon', dark: false };
  }
  return { ...base, kind: 'invitation', dark: false, eyebrow: card.eyebrow, line: card.line };
}
