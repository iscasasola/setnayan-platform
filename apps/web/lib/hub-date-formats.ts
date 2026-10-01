/**
 * apps/web/lib/hub-date-formats.ts
 *
 * 🗓 FORMAT ▾ — HOW THE HERO WRITES ITS DATE AND ITS TIME (Maker core part 2,
 * `prototypes/maker_in_four_2026-09-30_fable.html` frame C; DECISION_LOG
 * "THE MAKER RE-PLAN IS CUT TO ITS CORE": *"tap any text to type + Wording ▾ +
 * Format ▾"*). One dropdown per fact, one pick, the words change at once:
 *
 *   Date  March 13, 2027 (the page's own, today) · 13 March 2027 ·
 *         Saturday, March 13, 2027 · Sat · Mar 13 · 03 · 13 · 2027 ·
 *         Ika-13 ng Marso, 2027
 *   Time  2:30 PM (today) · 14:30 · Two-thirty in the afternoon · Half past two
 *
 * Wording ▾ is WHAT to show, Format ▾ is HOW to write it, Style ▾ is how it
 * looks. The pick is PRESENTATION: it is stored on the hero's own canvas
 * (`HubElementStyle.format`, drafted like every part's look, free), never on
 * the event's date — the fact stays Details'. Absent = today's words, byte for
 * byte (`formatEventDate`, `formatBlockTimeRange`).
 *
 * 🔒 NO CLOCK, NO LOCALE, NO TIMEZONE. The date is the calendar day the couple
 * picked (`YYYY-MM-DD`), read from its parts; the time is the programme's
 * wall-clock, stored at UTC (`lib/schedule.ts` "naive event-local wall-clock at
 * UTC"), read with UTC getters — so a guest in another timezone, the server and
 * the Maker all write the same words. Month and day names are spelled here,
 * never by `toLocaleString`, so a server in another locale cannot change them.
 *
 * Pure; its only import is the keys' list (`hub-part-words.ts`). The masthead (a server component), the sanitizer
 * (`lib/element-style.ts`) and the Maker's Format ▾ all read it.
 */

import { HUB_DATE_FORMATS, HUB_TIME_FORMATS, isHubDateFormat, isHubTimeFormat } from './hub-part-words';

export { HUB_DATE_FORMATS, HUB_TIME_FORMATS, isHubDateFormat, isHubTimeFormat };
export type { HubDateFormat, HubTimeFormat } from './hub-part-words';
/** The page's own way — an ABSENCE, never stored. */
export const HUB_FORMAT_DEFAULT = 'default';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_TL = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The calendar day in `iso` (`YYYY-MM-DD…`), or null. */
export function hubCalendarDay(iso: string | null | undefined): { y: number; m: number; d: number; wd: number } | null {
  if (typeof iso !== 'string') return null;
  const hit = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!hit) return null;
  const y = Number(hit[1]);
  const m = Number(hit[2]);
  const d = Number(hit[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const at = new Date(Date.UTC(y, m - 1, d));
  if (at.getUTCMonth() !== m - 1) return null; // 2027-02-30
  return { y, m, d, wd: at.getUTCDay() };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The date in `format` — or null when the date cannot be read or the format is
 * the page's own (the caller then keeps `formatEventDate`, unchanged).
 */
export function formatHubDate(iso: string | null | undefined, format: unknown): string | null {
  if (!isHubDateFormat(format)) return null;
  const day = hubCalendarDay(iso);
  if (!day) return null;
  const { y, m, d, wd } = day;
  const month = MONTHS[m - 1]!;
  switch (format) {
    case 'dmy':
      return `${d} ${month} ${y}`;
    case 'weekday':
      return `${DAYS[wd]}, ${month} ${d}, ${y}`;
    case 'short':
      return `${DAYS[wd]!.slice(0, 3)} · ${month.slice(0, 3)} ${d}`;
    case 'numeric':
      return `${pad(m)} · ${pad(d)} · ${y}`;
    case 'tagalog':
      return `Ika-${d} ng ${MONTHS_TL[m - 1]}, ${y}`;
  }
}

/** Today's words for the date — `formatEventDate`'s, spelled here (en-US, long). */
export function hubDateDefaultWords(iso: string | null | undefined): string | null {
  const day = hubCalendarDay(iso);
  return day ? `${MONTHS[day.m - 1]} ${day.d}, ${day.y}` : null;
}

/* ── THE TIME ──────────────────────────────────────────────────────────── */

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];

/** 1–59 in words: "five", "fifteen", "thirty", "forty-five". */
function minuteWords(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  return n % 10 === 0 ? t : `${t}-${ONES[n % 10]}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hour12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);

/** The wall-clock hour and minute in `iso` (UTC getters — the stored wall-clock). */
export function hubWallClock(iso: string | null | undefined): { h: number; min: number } | null {
  if (typeof iso !== 'string' || !iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return { h: at.getUTCHours(), min: at.getUTCMinutes() };
}

function partOfDay(h: number): string {
  if (h < 5) return 'at night';
  if (h < 12) return 'in the morning';
  if (h < 18) return 'in the afternoon';
  return 'in the evening';
}

/**
 * The time in `format` — or null when it cannot be read or the format is the
 * page's own (the caller keeps `formatBlockTimeRange`, unchanged).
 *
 *   24h    14:30
 *   words  Two-thirty in the afternoon · Two o'clock in the afternoon ·
 *          Twelve noon · Midnight · Ten forty-five in the morning
 *   past   Half past two · Quarter past two · Quarter to three · Two o'clock ·
 *          Ten past two · Twenty to three
 */
export function formatHubTime(iso: string | null | undefined, format: unknown): string | null {
  if (!isHubTimeFormat(format)) return null;
  const clock = hubWallClock(iso);
  if (!clock) return null;
  const { h, min } = clock;
  if (format === '24h') return `${pad(h)}:${pad(min)}`;
  if (format === 'words') {
    if (min === 0 && h === 0) return 'Midnight';
    if (min === 0 && h === 12) return 'Twelve noon';
    const hw = ONES[hour12(h)]!;
    if (min === 0) return `${cap(hw)} o'clock ${partOfDay(h)}`;
    const mw = min < 10 ? `oh-${ONES[min]}` : minuteWords(min);
    // One word joins with a hyphen ("Two-thirty"); a compound stands apart ("Two forty-five").
    const joined = mw.includes('-') && !mw.startsWith('oh-') ? `${hw} ${mw}` : `${hw}-${mw}`;
    return `${cap(joined)} ${partOfDay(h)}`;
  }
  // past
  const here = hour12(h);
  const next = hour12(h + 1);
  if (min === 0) return h === 12 ? 'Twelve noon' : h === 0 ? 'Midnight' : `${cap(ONES[here]!)} o'clock`;
  if (min === 15) return `Quarter past ${ONES[here]}`;
  if (min === 30) return `Half past ${ONES[here]}`;
  if (min === 45) return `Quarter to ${ONES[next]}`;
  const words = (n: number) => (n % 5 === 0 ? minuteWords(n) : `${minuteWords(n)} minute${n === 1 ? '' : 's'}`);
  return min < 30 ? `${cap(words(min))} past ${ONES[here]}` : `${cap(words(60 - min))} to ${ONES[next]}`;
}

/** Today's words for the time — `formatBlockTimeRange`'s start, spelled here ("2:30 PM"). */
export function hubTimeDefaultWords(iso: string | null | undefined): string | null {
  const clock = hubWallClock(iso);
  if (!clock) return null;
  return `${hour12(clock.h)}:${pad(clock.min)} ${clock.h < 12 ? 'AM' : 'PM'}`;
}

/** Format ▾'s list for a date — every way, each written in the couple's own date. */
export function hubDateFormatChoices(iso: string | null | undefined): Array<{ key: string; label: string }> {
  const own = hubDateDefaultWords(iso);
  if (!own) return [];
  return [{ key: HUB_FORMAT_DEFAULT, label: own }, ...HUB_DATE_FORMATS.map((f) => ({ key: f, label: formatHubDate(iso, f)! }))];
}

/** Format ▾'s list for a time — every way, each written in the programme's own time. */
export function hubTimeFormatChoices(iso: string | null | undefined): Array<{ key: string; label: string }> {
  const own = hubTimeDefaultWords(iso);
  if (!own) return [];
  return [{ key: HUB_FORMAT_DEFAULT, label: own }, ...HUB_TIME_FORMATS.map((f) => ({ key: f, label: formatHubTime(iso, f)! }))];
}
