/**
 * The thank-you's two lines (guest pathway, owner 2026-09-27 prototype frame 4:
 * "Thank you — See you on the 18th, Ana!" · "Joyfully accepts · 3 seats · Fish").
 *
 * Pure. The DATE is the event's own `YYYY-MM-DD`, read as text — never through
 * `new Date()`, which is midnight UTC and the previous day in Manila.
 */

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`;
}

/** "18th" from "2026-12-18"; null when there is no usable date. */
export function dayOrdinal(eventDate: string | null | undefined): string | null {
  const m = /^\d{4}-\d{2}-(\d{2})/.exec(eventDate ?? '');
  if (!m) return null;
  const day = Number(m[1]);
  return day >= 1 && day <= 31 ? ordinal(day) : null;
}

export function thankYouHeadline(input: {
  status: string;
  firstName: string | null | undefined;
  eventDate: string | null | undefined;
  solemn: boolean;
}): string {
  const first = (input.firstName ?? '').trim().split(/\s+/)[0] || '';
  const who = first ? `, ${first}` : '';
  const day = dayOrdinal(input.eventDate);
  if (input.status === 'attending' && !input.solemn) {
    return day ? `See you on the ${day}${who}!` : `See you there${who}!`;
  }
  if (input.status === 'declined') return `Thank you${who} — you'll be missed`;
  return `Thank you${who}`;
}

const MEAL_WORD: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids',
};

export function replySummary(input: {
  status: string;
  seats: number;
  meal: string | null | undefined;
  solemn: boolean;
}): string | undefined {
  const answer =
    input.status === 'attending'
      ? input.solemn
        ? 'Will be there'
        : 'Joyfully accepts'
      : input.status === 'declined'
        ? input.solemn
          ? 'Unable to come'
          : 'Regretfully declines'
        : input.status === 'maybe'
          ? 'Undecided, for now'
          : null;
  if (!answer) return undefined;
  const parts = [answer];
  if (input.status === 'attending') {
    parts.push(input.seats === 1 ? '1 seat' : `${input.seats} seats`);
    const meal = MEAL_WORD[input.meal ?? ''];
    if (meal) parts.push(meal);
  }
  return parts.join(' · ');
}
