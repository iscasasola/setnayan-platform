/**
 * THE SMALL, PURE READINGS THE SCENE STYLES MAKE OF DATA A SCENE ALREADY HOLDS.
 *
 * Every function here derives a shape from the couple's own words or dates —
 * it never invents a word. "The quote" leads with the couple's first sentence;
 * "The list" makes a row of each paragraph they typed; "The card" writes the
 * date in words from the same date the plate prints in figures.
 * (lib/scene-styles-invitation-day.ts is the catalogue these serve.)
 */

/**
 * The couple's text split into its first sentence and the rest.
 *
 * A sentence ends at `.`, `!` or `?` (optionally closed by a quote mark)
 * followed by whitespace. Text with no such break is ALL lead and no rest —
 * the style then draws one line, never an empty rule.
 */
export function splitFirstSentence(text: string | null | undefined): { lead: string; rest: string } {
  const t = (text ?? '').trim();
  if (!t) return { lead: '', rest: '' };
  const m = /^([\s\S]+?[.!?]["'”’)]?)\s+([\s\S]+)$/.exec(t);
  if (!m) return { lead: t, rest: '' };
  return { lead: m[1]!.trim(), rest: m[2]!.trim() };
}

/** Each non-empty line of the couple's text, trimmed — "The list" draws one row each. */
export function paragraphsOf(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Does this row say "don't"? Read from the words, never a setting: a row that
 * begins "No", "Not", "Please don't" or "Don't" is marked ✕ in "The list".
 */
export function isADont(line: string): boolean {
  return /^(no|not|don['’]t|do not|please (don['’]t|do not|no))\b/i.test(line.trim());
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** The calendar day of an `events.event_date` (`YYYY-MM-DD…`), or null. Never shifted by a zone. */
export function calendarDay(iso: string | null | undefined): { year: number; month: number; day: number; weekday: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return { year: y, month: m, day: d, weekday: date.getUTCDay() };
}

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? '';
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday] ?? '';
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORDINAL_ONES = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth'];
const ORDINAL_TENS = ['', '', 'twentieth', 'thirtieth'];

/** 1–99 in words: 21 → "twenty-one". */
function under100(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t]!;
}

/** A day of the month in words: 18 → "eighteenth", 21 → "twenty-first". */
export function dayOrdinalInWords(day: number): string {
  if (!Number.isInteger(day) || day < 1 || day > 31) return '';
  if (day < 20) return ORDINAL_ONES[day]!;
  const t = Math.floor(day / 10);
  const o = day % 10;
  return o ? `${TENS[t]}-${ORDINAL_ONES[o]}` : ORDINAL_TENS[t]!;
}

/** A year in words, the way an invitation writes it: 2026 → "two thousand twenty-six". */
export function yearInWords(year: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return String(year);
  const thousands = Math.floor(year / 1000);
  const hundreds = Math.floor((year % 1000) / 100);
  const rest = year % 100;
  const parts = [`${ONES[thousands]} thousand`];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) parts.push(under100(rest));
  return parts.join(' ');
}

/**
 * The date in words, written FROM the date — never typed:
 * `2026-12-18` → { weekday: "Friday", line: "the eighteenth of December", year: "two thousand twenty-six" }.
 */
export function dateInWords(iso: string | null | undefined): { weekday: string; line: string; year: string } | null {
  const d = calendarDay(iso);
  if (!d) return null;
  return {
    weekday: weekdayName(d.weekday),
    line: `the ${dayOrdinalInWords(d.day)} of ${monthName(d.month)}`,
    year: yearInWords(d.year),
  };
}

/**
 * The month of the date as calendar weeks, Monday first. Each cell is a day
 * number or null (a blank before the 1st / after the last). The countdown's
 * "The calendar" marks `day`.
 */
export function monthWeeks(iso: string | null | undefined): { year: number; month: number; day: number; weeks: (number | null)[][] } | null {
  const d = calendarDay(iso);
  if (!d) return null;
  const firstWeekday = new Date(Date.UTC(d.year, d.month - 1, 1)).getUTCDay();
  const lead = (firstWeekday + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(d.year, d.month, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year: d.year, month: d.month, day: d.day, weeks };
}

/**
 * A table label as "The table number" draws it. "Table 7" → { eyebrow: "Table", big: "7" };
 * a named table ("Sampaguita") is all big, no eyebrow — the label is never rewritten.
 */
export function tableLabelParts(label: string): { eyebrow: string | null; big: string } {
  const t = label.trim();
  const m = /^(table)\s+(.+)$/i.exec(t);
  if (m) return { eyebrow: m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1).toLowerCase(), big: m[2]!.trim() };
  return { eyebrow: null, big: t };
}
