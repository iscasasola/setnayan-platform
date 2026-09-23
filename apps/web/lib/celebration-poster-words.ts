/**
 * celebration-poster-words.ts — the WORDS a celebration poster prints.
 *
 * `celebration-poster.ts` decides which of four sheets a celebration prints.
 * This decides what is set on it: the names, the monogram, the two date lines
 * and the corner sash. Both exist because the approved prototype
 * (`build-sessions/prototypes/public_profile_icecasa_FABLE3_2026-09-23.html`)
 * hand-typed every one of those strings — `Maria` / `&` / `Jose`, `I&C`,
 * `Saturday`, `12 December 2026`, `Up next` — for three events the designer
 * already knew. Real rows are not so tidy.
 *
 * ── 🪤 THE ONE THAT IS LIVE IN PRODUCTION RIGHT NOW ─────────────────────────
 * Measured 2026-09-23, not imagined:
 *
 *     display_name                           event_date   event_date_precision
 *     Song Desk Test Night (SONGDESK TEST)   2026-08-01   year
 *
 * **A real, complete-looking date sitting under a precision that says nobody
 * knows the day.** A poster that formats `event_date` and prints the weekday
 * would announce *"Saturday · 1 August 2026"* about a celebration scheduled to
 * the year. The column is not wrong and the renderer would not be buggy; the
 * two together would state something no one ever said.
 *
 * 🔑 THE PRECISION IS PART OF THE DATE, NEVER A DISPLAY OPTION. So the weekday
 * line exists ONLY at day precision, and four other prod rows — dateless
 * weddings with precision `year` — print no date block at all rather than a
 * placeholder. `formatEventDateWithPrecision` already carries this rule for the
 * rest of the product; the poster needs the parts separately (the weekday and
 * the date are two lines in the composition), so it reduces the same inputs
 * rather than re-deciding them.
 *
 * ⛔ AND A CELEBRATION WITH NO DATE IS NEVER "UP NEXT". Four of his weddings
 * have `event_date = NULL`, and `splitComingUpAndPast` deliberately files a
 * dateless celebration under *coming up* and sorts it last. If the sash were
 * simply "first card in the list", an undated wedding would be crowned **Up
 * next** on a page where nothing else is scheduled — the label would be
 * manufactured by the sort order rather than read from the event.
 */

import type { EventDatePrecision } from './events';
import { deriveMonogram, splitInitials } from './monogram';

/* ───────────────────────────── names ───────────────────────────── */

/**
 * The mark drawn large behind a coloured sheet's type.
 *
 * ⚠ TWO SHAPES, BECAUSE ONE OF THEM MUST NOT BE CUT IN HALF. A derived
 * monogram is two initials with an italic ampersand set between them — the
 * prototype's `I&C`. An AUTHORED one is a string the couple typed, and
 * slicing it at the first character to insert an ampersand would render
 * `M♥J` as `M & ♥J`. `null` when neither name offers a letter.
 */
export type PosterMonogram =
  | { kind: 'initials'; left: string; right: string }
  | { kind: 'authored'; text: string }
  | null;

export type PosterWords =
  /** Two people: set on their own lines with the ampersand between them. */
  | { kind: 'pair'; left: string; right: string; monogram: PosterMonogram; step: TitleStep }
  /** Everything else: a title, stacked as a playbill sets one. */
  | { kind: 'title'; lines: string[]; step: TitleStep };

/**
 * How large a stacked title may be set. A playbill's title is the largest
 * thing on the sheet — but "Movie Night" and "Song Desk Test Night (SONGDESK
 * TEST)" cannot be set at the same size, and a title that overflows its frame
 * looks like a rendering fault rather than a poster.
 */
export type TitleStep = 'xl' | 'lg' | 'md' | 'sm';

/** At most this many stacked lines: beyond three it stops reading as a title. */
const MAX_TITLE_LINES = 3;

function stepForLongestLine(longest: number): TitleStep {
  if (longest <= 7) return 'xl';
  if (longest <= 11) return 'lg';
  if (longest <= 16) return 'md';
  return 'sm';
}

/**
 * Balance words into at most three lines.
 *
 * Two or three words take one line each — that is the prototype's "Movie /
 * Night" and it is why a two-word title is not left on one line. Longer titles
 * are balanced by character count so no line towers over the others.
 */
function stackTitle(title: string): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= MAX_TITLE_LINES) return words;

  const total = words.join(' ').length;
  const target = total / MAX_TITLE_LINES;
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const remaining = MAX_TITLE_LINES - lines.length;
    const candidate = current ? `${current} ${word}` : word;
    // Start a new line once this one has met its share — unless doing so would
    // leave fewer words than lines still to fill.
    if (current && candidate.length > target && remaining > 1) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  // Never exceed the cap: fold any overflow back onto the last line.
  if (lines.length > MAX_TITLE_LINES) {
    const tail = lines.slice(MAX_TITLE_LINES - 1).join(' ');
    return [...lines.slice(0, MAX_TITLE_LINES - 1), tail];
  }
  return lines;
}

/**
 * What this celebration's poster is called.
 *
 * `monogramText` is the couple's OWN monogram when they typed one — it wins
 * over anything derived, because a derived monogram is a guess about their
 * names and theirs is a decision. (Measured 2026-09-23: `monogram_text` is
 * NULL on all 12 prod events, so today every monogram is derived. The branch
 * exists for the first couple who fills it in, not for a hypothetical.)
 *
 * ⛔ AND `monogram_uploaded_svg` IS DELIBERATELY NOT READ HERE, although one
 * event has one. On the coloured sheets the monogram is drawn at 34cqw in
 * WHITE; an uploaded SVG carries its own colours, so a dark mark authored for
 * the couple's own pale website would land on wine and disappear. A mark whose
 * ink we cannot see is not a mark we can place.
 *
 * ⚠ A TITLE CONTAINING ONE `&` WILL BE SET AS A PAIR. "Rock & Roll Night"
 * would stack as two names. This is deliberate rather than unnoticed: the
 * alternative is guessing from `event_type`, which is wrong for a wedding
 * whose couple genuinely named it something else, and the cost here is only
 * that two words stack instead of three. Nothing downstream reads `kind` as a
 * fact about people.
 */
export function posterWords(
  displayName: string | null | undefined,
  monogramText?: string | null,
): PosterWords {
  const name = (displayName ?? '').trim();
  if (!name) return { kind: 'title', lines: ['Celebration'], step: 'lg' };

  const authored = (monogramText ?? '').trim();
  const parts = name.split('&');
  if (parts.length === 2) {
    const left = parts[0]!.trim();
    const right = parts[1]!.trim();
    if (left && right) {
      /*
        ⛔ THE MARK IS THE EVENT'S OWN, NOT ONE THIS MODULE INVENTS. Owner,
        2026-09-23, on where the poster comes from: ***"we have the first
        widget as the hero widget. this is where the logo, names, and other
        information can be found."***

        🔴 AN EARLIER CUT OF THIS FILE HAND-ROLLED THE INITIALS — a regex for
        the first letter of each side — while `deriveMonogram` had been
        shipping that answer to the dashboard chip, the landing hero and the
        QR-centre overlay all along, and `splitInitials` had been pulling the
        pair out of it. Two derivations of one fact is how they come to
        disagree, and mine was the worse one: it kept "(SONGDESK TEST)" that
        `deriveMonogram` strips, and it split only on "&" where the shipped one
        also handles "and", "+", "/" and a hyphen.
      */
      const [a, b] = splitInitials(deriveMonogram(name));
      return {
        kind: 'pair',
        left,
        right,
        monogram: authored
          ? { kind: 'authored', text: authored }
          : a && b
            ? { kind: 'initials', left: a, right: b }
            : null,
        // A pair is set in the title slot on the letterpress sheet, so it needs
        // the same size step a title does — measured on the LONGER name, which
        // is the one that decides whether the composition fits.
        step: stepForLongestLine(Math.max(left.length, right.length)),
      };
    }
  }

  const lines = stackTitle(name);
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return { kind: 'title', lines, step: stepForLongestLine(longest) };
}

/* ───────────────────────────── the date ───────────────────────────── */

export type PosterDate = {
  /** "Saturday" — ONLY at day precision. `null` otherwise. */
  weekday: string | null;
  /** "12 December 2026" · "December 2026" · "2026" · `null` when undated. */
  date: string | null;
};

/**
 * The poster's two date lines, reduced from the day AND its precision.
 *
 * Day-month-year, not month-day-year: the poster is a printed object and this
 * is how one is set. The rest of the page keeps `formatEventDate`'s US order —
 * the difference is typographic, in one composition, and does not change which
 * day is named.
 */
export function posterDate(
  iso: string | null | undefined,
  precision: EventDatePrecision | null | undefined,
  locale = 'en-GB',
): PosterDate {
  if (!iso) return { weekday: null, date: null };
  const [yearStr, monthStr, dayStr] = iso.slice(0, 10).split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return { weekday: null, date: null };

  // A LOCAL date built from the parts, so the day the couple picked survives
  // whatever timezone the reader is in — the same construction `formatEventDate`
  // uses, for the same reason.
  const d = new Date(year, month - 1, day);

  if (precision === 'year') {
    return { weekday: null, date: String(year) };
  }
  if (precision === 'month') {
    return {
      weekday: null,
      date: d.toLocaleDateString(locale, { year: 'numeric', month: 'long' }),
    };
  }
  // Day precision — and a NULL precision is treated as a full day, matching the
  // column's own default and the rest of the product.
  return {
    weekday: d.toLocaleDateString(locale, { weekday: 'long' }),
    date: d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

/* ───────────────────────────── the sash ───────────────────────────── */

/**
 * The status sash — the one mark the house adds to a couple's poster.
 *
 * `index` is the position within the **coming up** list, which
 * `splitComingUpAndPast` has already sorted soonest-first.
 *
 * ⛔ AN UNDATED CELEBRATION GETS NO SASH. It cannot be "up next" — nothing is
 * next when nothing is scheduled — and "coming soon" would be a promise about
 * a date that does not exist. Silence is the honest mark, and the poster is
 * composed so the sash's absence reads as a plain sheet rather than a gap.
 */
export function sashLabel(
  section: 'coming-up' | 'past',
  index: number,
  hasDate: boolean,
): string | null {
  if (section === 'past') return null;
  if (!hasDate) return null;
  return index === 0 ? 'Up next' : 'Coming soon';
}
