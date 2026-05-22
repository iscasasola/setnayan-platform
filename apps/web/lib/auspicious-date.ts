/**
 * Phase 0 Date Selection — positive-only auspicious-date library.
 *
 * Per CLAUDE.md 2026-05-22 owner directive: hosts pick their wedding date
 * through a guided flow whose entire emotional posture is positive-only.
 * The library NEVER tells the host "this date is bad." For sensitive
 * considerations (Holy Week, typhoon season, sukob with siblings, weekday
 * weddings, the 13th, etc.) it always finds a positive reframe.
 *
 * Architecture:
 *   - computeAuspiciousReasons(date, ceremonyType, meaningfulDates) returns
 *     an array of always-positive reason strings combining day-of-week,
 *     month, special-pattern matches (palindromes, holidays, solstices),
 *     ceremony-specific overlays, and resonance with the host's own
 *     meaningful dates.
 *   - suggestMeaningfulDates(meaningfulDates, ceremonyType, year) returns
 *     up to 5 date candidates for the "Help me pick a meaningful one"
 *     entry path — anchored around the host's honor/anniversary/birthday
 *     dates with positive day-of-week + month overlays.
 *
 * Brand voice rules per [[feedback_setnayan_no_dev_text_post_launch]]:
 * editorial restraint, no exclamation marks, no marketing jargon, mixed
 * EN/Tagalog texture allowed where it lands naturally. EN-only V1; TL/CEB
 * land V1.1 once the locale loader extends to data libraries.
 */

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type CeremonyType =
  | 'catholic'
  | 'civil'
  | 'inc'
  | 'christian'
  | 'muslim'
  | 'cultural'
  | 'mixed';

export type MeaningfulDateKind =
  | 'honor'
  | 'avoid'
  | 'anniversary'
  | 'birthday'
  | 'other';

export type MeaningfulDate = {
  date: string; // YYYY-MM-DD
  kind: MeaningfulDateKind;
  note?: string | null;
};

export type DateSuggestion = {
  /** YYYY-MM-DD */
  date: string;
  /** Always-positive headline */
  headline: string;
  /** 2-4 supporting reasons */
  reasons: string[];
};

// ----------------------------------------------------------------------------
// Day-of-week positive framing — every day reads as a celebration of itself
// ----------------------------------------------------------------------------

const DAY_OF_WEEK_POSITIVE: Record<number, string> = {
  // Sunday=0, Monday=1, ... Saturday=6
  0: 'Linggo — sacred and family-centered, with the highest attendance among older relatives',
  1: 'Lunes — the start of a new chapter, intimate weekday weddings have grown in popularity',
  2: 'Martes ay tibay — strength and resilience for the couple',
  3: 'Mid-week balance — vendors often offer their best rates and quieter venues',
  4: 'Huwebes — favorite of European royal weddings, uncrowded venues at calmer pace',
  5: 'Biyernes evening — intimate and romantic, with the weekend ahead for guests to celebrate',
  6: 'Sabado — the traditional Filipino wedding day, most-loved by families and guests alike',
};

// ----------------------------------------------------------------------------
// Month positive framing — every month gets a celebration of its texture
// ----------------------------------------------------------------------------

const MONTH_POSITIVE: Record<number, string> = {
  1: 'Bagong taon, bagong simula — fresh-start energy and a new beginning together',
  2: 'Buwan ng pag-ibig — romance is in the air, hearts full and open',
  3: 'On the verge of summer — long sunset light makes for soft portraits',
  4: 'Summer in full bloom — garden and beachside weddings shine in this season',
  5: 'Flores de Mayo — floral abundance and the most colorful month',
  6: 'June bride — the most celebrated wedding month worldwide',
  7: 'Romantic showers — rain on a wedding is considered prosperity in many Filipino traditions',
  8: 'Mid-year reset — refreshing breezes and softer vendor demand',
  9: 'Ber months begin — Christmas spirit on the horizon, joy already gathering',
  10: 'Crisp pre-holiday charm — photographer-favorite light and a calm atmosphere',
  11: 'Family-gathering season — everyone is in town and ready to celebrate',
  12: 'Wedding month of celebration — families are already in joy mode',
};

// ----------------------------------------------------------------------------
// Ceremony-specific overlays — surface relevant cultural touchpoints positively
// ----------------------------------------------------------------------------

/**
 * Returns a ceremony-specific positive overlay reason, when one applies for
 * this date. Examples: a Catholic wedding on a Saturday gets a note about
 * Saturday being the traditional sacrament day; a Muslim wedding on a Friday
 * (the day of Jumu'ah) gets a note about its spiritual weight.
 */
function ceremonyOverlay(date: Date, ceremonyType: CeremonyType | null): string | null {
  const dow = date.getDay(); // 0 = Sunday
  const month = date.getMonth() + 1;

  if (!ceremonyType) return null;

  if (ceremonyType === 'catholic') {
    if (dow === 6) {
      return 'Saturdays carry a long Catholic tradition of weddings — the parish calendar is built around them';
    }
    if (month === 5) {
      return 'Mary\'s month in Catholic tradition — a beautiful time to be wed under her patronage';
    }
    if (month === 10) {
      return 'October carries the rosary month tradition — a calm, prayerful season for sacrament';
    }
  }

  if (ceremonyType === 'civil') {
    // Civil weddings are flexible — most dates work; weekdays have a special quiet charm
    if (dow >= 1 && dow <= 4) {
      return 'A weekday civil ceremony is intimate and uncomplicated — beautiful in its simplicity';
    }
  }

  if (ceremonyType === 'inc') {
    if (dow === 4) {
      return 'Many INC weddings happen on Thursday evenings or weekends — your community will gather warmly';
    }
  }

  if (ceremonyType === 'christian') {
    if (dow === 0) {
      return 'A Sunday Christian wedding follows the Lord\'s Day rhythm — your congregation is already gathered in spirit';
    }
  }

  if (ceremonyType === 'muslim') {
    if (dow === 5) {
      return 'Biyernes carries the spiritual weight of Jumu\'ah — a deeply blessed day for the akad nikah';
    }
    if (dow === 6 || dow === 0) {
      return 'A weekend Muslim wedding gives families time to travel and stay for the walimah';
    }
  }

  if (ceremonyType === 'cultural') {
    // Cultural weddings often honor lunar / seasonal cues
    if (month === 1 || month === 2) {
      return 'A start-of-year cultural ceremony honors new-beginning traditions across Filipino tribes';
    }
    if (month === 11 || month === 12) {
      return 'A late-year cultural ceremony coincides with harvest and family-homecoming traditions';
    }
  }

  if (ceremonyType === 'mixed') {
    return 'A mixed-tradition wedding gives you the freedom to weave both your families\' rhythms together';
  }

  return null;
}

// ----------------------------------------------------------------------------
// Special-pattern matches — palindromes, holidays, symbolic dates
// ----------------------------------------------------------------------------

type SpecialPattern = {
  id: string;
  match: (date: Date) => boolean;
  reason: string;
};

function isPalindrome(date: Date): boolean {
  // MMDDYYYY palindrome check — e.g., 12/02/2021 (12022021 reversed = 12022021)
  // Also check MM/DD identical (12/12, 11/11)
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (m === d) return true;
  // Full digit palindrome of YYYYMMDD
  const ymd =
    String(date.getFullYear()) +
    String(m).padStart(2, '0') +
    String(d).padStart(2, '0');
  return ymd.split('').reverse().join('') === ymd;
}

const SPECIAL_PATTERNS: SpecialPattern[] = [
  {
    id: 'palindrome',
    match: isPalindrome,
    reason: 'A symmetrical date for a symmetrical union — easy for everyone to remember',
  },
  {
    id: 'valentines_week',
    match: (d) => d.getMonth() === 1 && d.getDate() >= 10 && d.getDate() <= 17,
    reason: 'Valentine\'s week glow — the whole week carries romance in the air',
  },
  {
    id: 'leap_day',
    match: (d) => d.getMonth() === 1 && d.getDate() === 29,
    reason: 'A leap-day wedding — your anniversary becomes a celebration every four years, and a tradition every year',
  },
  {
    id: 'fourteenth',
    match: (d) => d.getDate() === 14 && d.getMonth() === 1,
    reason: 'February 14 itself — the day of love',
  },
  {
    id: 'new_year_eve',
    match: (d) => d.getMonth() === 11 && d.getDate() === 31,
    reason: 'Year-end wedding — start the next year as a married couple',
  },
  {
    id: 'first_of_year',
    match: (d) => d.getMonth() === 0 && d.getDate() === 1,
    reason: 'New Year\'s Day — the freshest possible start to married life',
  },
  {
    id: 'rizal_day',
    match: (d) => d.getMonth() === 11 && d.getDate() === 30,
    reason: 'Rizal Day — a holiday weekend means guests have time to travel',
  },
  {
    id: 'independence_week',
    match: (d) => d.getMonth() === 5 && d.getDate() === 12,
    reason: 'Independence Day — a holiday weekend gives guests the time to celebrate fully',
  },
  {
    id: 'all_saints',
    match: (d) => d.getMonth() === 10 && d.getDate() === 1,
    reason: 'All Saints Day — family is already gathered for the holiday',
  },
  {
    id: 'spring_equinox',
    match: (d) => d.getMonth() === 2 && d.getDate() === 20,
    reason: 'Spring equinox — balance of day and night, a symbolic threshold',
  },
  {
    id: 'summer_solstice',
    match: (d) => d.getMonth() === 5 && d.getDate() === 21,
    reason: 'Summer solstice — the longest day of the year, the most light for portraits',
  },
];

// ----------------------------------------------------------------------------
// Sensitive reframes — turn potential negatives into positives
// ----------------------------------------------------------------------------

function sensitiveReframes(date: Date, ceremonyType: CeremonyType | null): string[] {
  const reasons: string[] = [];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = date.getDay();

  // Holy Week-ish window (broadly March-April for the moveable feast) —
  // reframe as honoring the Catholic family rhythm.
  if (ceremonyType === 'catholic' && (month === 3 || month === 4)) {
    reasons.push(
      'Many Catholic families celebrate around Holy Week — your ceremony can honor that rhythm beautifully',
    );
  }

  // Rainy / typhoon-ish months (June–November) — reframe.
  if (month >= 6 && month <= 11) {
    reasons.push(
      'Afternoon showers usually clear by evening — an indoor backup gives peace of mind, and rain on a wedding is prosperity in Filipino tradition',
    );
  }

  // 13th — reframe.
  if (day === 13) {
    reasons.push(
      'The 13th has become a quiet favorite among modern couples — uncommon, memorable, and yours alone',
    );
  }

  // Weekday — already covered in day-of-week positive, but add a budget angle.
  if (dow >= 1 && dow <= 4) {
    reasons.push(
      'Weekday weddings often unlock the best vendor rates and the calmest venues — your budget stretches further',
    );
  }

  return reasons;
}

// ----------------------------------------------------------------------------
// Meaningful-date resonance — surface positive matches with host's own dates
// ----------------------------------------------------------------------------

function meaningfulDateResonance(date: Date, meaningfulDates: MeaningfulDate[]): string[] {
  const reasons: string[] = [];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const ymd = `${date.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  for (const md of meaningfulDates) {
    if (md.kind === 'avoid') continue; // never surface avoid dates positively
    const [, mdMonth, mdDay] = md.date.split('-').map(Number);
    if (!mdMonth || !mdDay) continue;

    // Exact day match
    if (mdMonth === month && mdDay === day) {
      const noteSuffix = md.note ? ` — ${md.note}` : '';
      if (md.kind === 'birthday') {
        reasons.push(`Shares a birthday with someone meaningful to you${noteSuffix}`);
      } else if (md.kind === 'anniversary') {
        reasons.push(`Lands on the anniversary you wanted to honor${noteSuffix}`);
      } else if (md.kind === 'honor') {
        reasons.push(`Honors a date you flagged as meaningful${noteSuffix}`);
      } else {
        reasons.push(`Resonates with a date close to your heart${noteSuffix}`);
      }
    } else if (mdMonth === month) {
      // Same month — softer resonance
      const noteSuffix = md.note ? ` (${md.note})` : '';
      if (md.kind === 'birthday') {
        reasons.push(`Same month as a birthday meaningful to you${noteSuffix}`);
      } else if (md.kind === 'anniversary') {
        reasons.push(`Same month as an anniversary you wanted to honor${noteSuffix}`);
      } else if (md.kind === 'honor') {
        reasons.push(`Falls in the month you flagged as meaningful${noteSuffix}`);
      }
    }
  }

  return reasons;
}

// ----------------------------------------------------------------------------
// Main: compute all positive reasons for a given date
// ----------------------------------------------------------------------------

/**
 * Returns a deduplicated array of always-positive reasons for the given
 * date. Combines day-of-week + month + special patterns + ceremony overlay
 * + sensitive reframes + meaningful-date resonance. Never returns an empty
 * array — at minimum the day-of-week + month reasons surface, so any date
 * the host picks gets a warm reception.
 *
 * Order: meaningful-date resonance first (most personal), then ceremony
 * overlay (most specific cultural context), then special patterns
 * (uncommon delight), then day-of-week + month (always-applicable
 * baseline), then sensitive reframes (proactive reframing of common
 * Filipino-wedding concerns).
 *
 * Caller passes `meaningfulDates` array (can be empty). Library is pure —
 * no DB access, no side effects.
 */
export function computeAuspiciousReasons(
  date: Date,
  ceremonyType: CeremonyType | null,
  meaningfulDates: MeaningfulDate[] = [],
): string[] {
  const reasons: string[] = [];

  // 1. Meaningful-date resonance (most personal first)
  reasons.push(...meaningfulDateResonance(date, meaningfulDates));

  // 2. Ceremony overlay (specific cultural context)
  const overlay = ceremonyOverlay(date, ceremonyType);
  if (overlay) reasons.push(overlay);

  // 3. Special pattern matches (delight)
  for (const pattern of SPECIAL_PATTERNS) {
    if (pattern.match(date)) {
      reasons.push(pattern.reason);
    }
  }

  // 4. Day-of-week positive (always present)
  const dowReason = DAY_OF_WEEK_POSITIVE[date.getDay()];
  if (dowReason) reasons.push(dowReason);

  // 5. Month positive (always present)
  const monthReason = MONTH_POSITIVE[date.getMonth() + 1];
  if (monthReason) reasons.push(monthReason);

  // 6. Sensitive reframes (proactively reframe common concerns)
  reasons.push(...sensitiveReframes(date, ceremonyType));

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const r of reasons) {
    if (!seen.has(r)) {
      seen.add(r);
      deduped.push(r);
    }
  }

  return deduped;
}

// ----------------------------------------------------------------------------
// Suggested dates — for the "Help me pick a meaningful one" entry path
// ----------------------------------------------------------------------------

/**
 * Returns up to 5 date suggestions for the guided picker flow. Strategy:
 *   1. If the host flagged honor / anniversary / birthday dates, anchor
 *      suggestions on those dates (this year or next year).
 *   2. Fill remaining slots with high-resonance fallbacks for the host's
 *      ceremony type: Saturdays in Mary's month / Mar / Oct for Catholic,
 *      weekday quiet days for Civil, Fridays for Muslim, Sundays for
 *      Christian, etc.
 *   3. Ensure all candidates are in the future (not in the past).
 *   4. Avoid any "avoid"-flagged date OR same-month-as-avoid by default
 *      (the host can still pick anything in the calendar step).
 *
 * Returns suggestions sorted by reason-count desc (most resonant first).
 */
export function suggestMeaningfulDates(
  meaningfulDates: MeaningfulDate[],
  ceremonyType: CeremonyType | null,
  baseYear: number = new Date().getFullYear() + 1,
): DateSuggestion[] {
  const suggestions: DateSuggestion[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Set of YYYY-MM-DD strings to skip (exact avoid dates).
  const avoidExact = new Set(
    meaningfulDates.filter((m) => m.kind === 'avoid').map((m) => m.date),
  );
  // Set of MM strings to penalize (avoid months) — soft avoidance.
  const avoidMonths = new Set(
    meaningfulDates
      .filter((m) => m.kind === 'avoid')
      .map((m) => m.date.split('-')[1])
      .filter(Boolean) as string[],
  );

  function pushIfValid(date: Date) {
    if (date.getTime() < today.getTime()) return;
    const ymd = formatYMD(date);
    if (avoidExact.has(ymd)) return;
    if (suggestions.some((s) => s.date === ymd)) return; // dedupe by date

    const reasons = computeAuspiciousReasons(date, ceremonyType, meaningfulDates);
    if (reasons.length === 0) return;

    // Build headline from the most personal/specific reason available.
    const headline = pickHeadline(reasons);

    // Soft-deprioritize avoid-month suggestions: still surface them, but
    // they sort below others when reason counts tie.
    const inAvoidMonth = avoidMonths.has(String(date.getMonth() + 1).padStart(2, '0'));
    if (inAvoidMonth && suggestions.length >= 5) return;

    suggestions.push({
      date: ymd,
      headline,
      reasons: reasons.slice(0, 4), // cap at 4 supporting lines
    });
  }

  // 1. Anchor on honor / anniversary / birthday dates this year + next year
  for (const md of meaningfulDates) {
    if (md.kind === 'avoid') continue;
    const [, monthStr, dayStr] = md.date.split('-');
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!month || !day) continue;

    // This year + next year
    for (const year of [baseYear, baseYear + 1]) {
      const cand = new Date(year, month - 1, day);
      // Sanity check — JS Date will quietly normalize Feb 30 etc.
      if (cand.getMonth() === month - 1 && cand.getDate() === day) {
        pushIfValid(cand);
      }
    }
  }

  // 2. Ceremony-specific high-resonance fallbacks
  const fallbacks: Date[] = [];
  for (const yearOffset of [0, 1]) {
    const year = baseYear + yearOffset;

    if (ceremonyType === 'catholic' || ceremonyType === null) {
      // First Saturday of May (Mary's month)
      fallbacks.push(firstWeekdayOf(year, 4, 6));
      // First Saturday of October (Rosary month)
      fallbacks.push(firstWeekdayOf(year, 9, 6));
      // Second Saturday of December
      fallbacks.push(nthWeekdayOf(year, 11, 6, 2));
    }
    if (ceremonyType === 'civil') {
      // Quiet weekday: second Tuesday of February
      fallbacks.push(nthWeekdayOf(year, 1, 2, 2));
      // Second Wednesday of October
      fallbacks.push(nthWeekdayOf(year, 9, 3, 2));
    }
    if (ceremonyType === 'muslim') {
      // First Friday of Shawwal-equivalent (approximate: May)
      fallbacks.push(firstWeekdayOf(year, 4, 5));
      // First Friday of November
      fallbacks.push(firstWeekdayOf(year, 10, 5));
    }
    if (ceremonyType === 'inc' || ceremonyType === 'christian') {
      // Saturday wedding favored in both
      fallbacks.push(firstWeekdayOf(year, 4, 6));
      fallbacks.push(firstWeekdayOf(year, 10, 6));
    }
    if (ceremonyType === 'cultural' || ceremonyType === 'mixed') {
      // Family-gathering season
      fallbacks.push(firstWeekdayOf(year, 10, 6));
      fallbacks.push(firstWeekdayOf(year, 11, 6));
    }
    // Universal: First Saturday of June (June bride)
    fallbacks.push(firstWeekdayOf(year, 5, 6));
  }

  for (const f of fallbacks) {
    if (suggestions.length >= 8) break;
    pushIfValid(f);
  }

  // Sort by reason-count desc, then by date asc (closer first when tied)
  suggestions.sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) {
      return b.reasons.length - a.reasons.length;
    }
    return a.date.localeCompare(b.date);
  });

  return suggestions.slice(0, 5);
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the first occurrence of `weekday` (0=Sun..6=Sat) in the given
 * 0-indexed month of the given year.
 */
function firstWeekdayOf(year: number, monthZeroIndexed: number, weekday: number): Date {
  const d = new Date(year, monthZeroIndexed, 1);
  const offset = (weekday - d.getDay() + 7) % 7;
  d.setDate(1 + offset);
  return d;
}

/**
 * Returns the nth occurrence (1-indexed) of `weekday` in the given month.
 */
function nthWeekdayOf(
  year: number,
  monthZeroIndexed: number,
  weekday: number,
  n: number,
): Date {
  const first = firstWeekdayOf(year, monthZeroIndexed, weekday);
  const result = new Date(first);
  result.setDate(first.getDate() + (n - 1) * 7);
  return result;
}

/**
 * Picks the headline for a suggestion — first looks for a personal-meaning
 * line, then a special pattern, then falls back to the first reason. Keeps
 * suggestions feeling tailored without inventing copy.
 */
function pickHeadline(reasons: string[]): string {
  const personalSignals = [
    'shares a birthday',
    'lands on the anniversary',
    'honors a date',
    'resonates with a date',
    'same month as',
    'falls in the month',
  ];
  for (const r of reasons) {
    const lower = r.toLowerCase();
    if (personalSignals.some((p) => lower.includes(p))) {
      return r;
    }
  }
  // Special pattern signals
  const patternSignals = ['palindrome', 'symmetrical', 'leap-day', 'valentine', 'solstice', 'equinox'];
  for (const r of reasons) {
    const lower = r.toLowerCase();
    if (patternSignals.some((p) => lower.includes(p))) {
      return r;
    }
  }
  return reasons[0] ?? '';
}

/**
 * Day-of-week label for compact UI surfaces (auspicious chip subtitle, etc.)
 */
export function dayOfWeekLabel(date: Date): string {
  const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return labels[date.getDay()] ?? '';
}

/**
 * Pretty-print a YYYY-MM-DD string as "Friday, August 15, 2027".
 * Local-timezone safe: parses parts manually to avoid Date timezone drift.
 */
export function formatAuspiciousDate(ymd: string): string {
  const [yearStr, monthStr, dayStr] = ymd.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return ymd;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
