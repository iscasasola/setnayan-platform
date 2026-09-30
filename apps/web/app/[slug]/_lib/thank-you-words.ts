/**
 * The thank-you's two lines (guest pathway, owner 2026-09-27 prototype frame 4:
 * "Thank you — See you on the 18th!" · "Joyfully accepts · 3 seats · Fish").
 *
 * 🎩 NO FIRST NAME (owner, DECISION_LOG 2026-09-30 — no casual greetings): the
 * prototype's "See you on the 18th, Ana!" is a salutation, and a guest's
 * screen does not call them by their first name.
 *
 * Pure. The DATE is the event's own `YYYY-MM-DD`, read as text — never through
 * `new Date()`, which is midnight UTC and the previous day in Manila.
 */
import type { RsvpWords } from '@/lib/rsvp-ask';

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
  eventDate: string | null | undefined;
  solemn: boolean;
}): string {
  const day = dayOrdinal(input.eventDate);
  if (input.status === 'attending' && !input.solemn) {
    return day ? `See you on the ${day}!` : 'See you there!';
  }
  if (input.status === 'declined') return 'Thank you — you’ll be missed';
  return 'Thank you';
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
  /** 📝 The couple's own YES / NO words (`rsvpAnswerWord`) — display only; null = today's. */
  answerWord?: string | null;
}): string | undefined {
  const answer =
    (input.status === 'attending' || input.status === 'declined') && input.answerWord
      ? input.answerWord
      : input.status === 'attending'
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

/**
 * 📝 THE COUPLE'S OWN WORDS ON THE SCREEN AFTER A REPLY (the RSVP stage, owner
 * 2026-09-30: *"the RSVP, after they Submit, or when they declined"*). An
 * attending guest reads "After they submit" (`thanksHeading` · `thanksMessage`);
 * a declining guest reads "When they decline" — its OWN words
 * (`declineHeading` · `declineMessage`), never the thank-you's. Unset, the
 * heading is today's (`ownHeadline`, from `thankYouHeadline`) and there is no
 * extra message. `keys` names which pair this screen reads (null for a reply
 * that is neither — nothing of the couple's is shown).
 */
export function thankYouWords(input: {
  status: string;
  words: RsvpWords | null | undefined;
  ownHeadline: string;
  /** Who `{name}` becomes in the couple's line (the prototype: *"{name} fills each guest's name"*). */
  name?: string | null;
}): {
  heading: string;
  message: string | null;
  keys: { heading: 'thanksHeading' | 'declineHeading'; message: 'thanksMessage' | 'declineMessage' } | null;
} {
  const keys =
    input.status === 'declined'
      ? ({ heading: 'declineHeading', message: 'declineMessage' } as const)
      : input.status === 'attending'
        ? ({ heading: 'thanksHeading', message: 'thanksMessage' } as const)
        : null;
  if (!keys) return { heading: input.ownHeadline, message: null, keys: null };
  const fill = (text: string) => fillRsvpName(text, input.name);
  const heading = input.words?.[keys.heading];
  const message = input.words?.[keys.message];
  return { heading: heading ? fill(heading) : input.ownHeadline, message: message ? fill(message) : null, keys };
}

/** `{name}` in a couple's line → the guest's name (nothing when there is none). */
export function fillRsvpName(text: string, name: string | null | undefined): string {
  const who = (name ?? '').trim();
  const filled = who ? text.replace(/\{name\}/g, who) : text.replace(/[,\s]*\{name\}/g, '');
  return filled.replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
