/**
 * _lib/papic-in-place.ts — 📍 WHAT A PAPIC ACTION'S REDIRECT MEANS WHEN THE PRESS STAYS IN PLACE — Papic's own words
 * for the app-wide door (`app/_actions/save-in-place.ts`, read by `lib/save-in-place.ts`).
 *
 * A Papic action ends in `redirect(<back>?<news>)`. Asked in place, that URL is read instead of followed:
 *   · a refusal — `?…_error=<code>` or `?add=full` → `{ ok: false, error }`, said on the row in the page's own words;
 *   · somewhere a press must really go — signed out (`/login…`), not on this event (`/dashboard`), off the dashboard
 *     → `'navigate'` (the redirect is let through);
 *   · anything else (`?…_set=…`, a bare back) → `{ ok: true }`: saved; the action's own `revalidatePath` re-renders
 *     the page in place.
 * Pure. Held by `papic-saves-in-place.test.ts`.
 */
import { inPlaceAnswer, type StayResult, type StayWords } from '@/lib/save-in-place';
import { STAY_DOORS } from '@/lib/stay-doors';

/** Every Papic action a control may save in place through (the `papic.` doors of `lib/stay-doors.ts`). */
export const PAPIC_DOORS = STAY_DOORS.filter((d) => d.startsWith('papic.'));
export type PapicDoor = Extract<(typeof STAY_DOORS)[number], `papic.${string}`>;

const SAY: Readonly<Record<string, string>> = {
  /* The allotments' own words (`page.tsx`'s banner), said on the row instead. */
  bad_everyone: 'A limit of nothing is not a limit, so that number starts at 1. Leave it empty to cap everyone at an equal share.',
  bad_minimum: 'A minimum of nothing is not a promise, so that number starts at 1. Leave it empty for no minimum.',
  minimum_above_limit: 'The least anybody gets cannot be more than the limit you set for everyone.',
  bad_number: 'That needs to be a whole number of credits, or empty to let it work itself out.',
  unknown_guest: 'We could not find that guest on your list.',
};
const FULL = 'Ten challenges are already on — turn one off first.';

export const PAPIC_WORDS: StayWords = {
  say: SAY,
  refuse: (q) => (q.get('add') === 'full' ? FULL : null),
};

export function papicInPlaceAnswer(url: string): StayResult | 'navigate' {
  return inPlaceAnswer(url, PAPIC_WORDS);
}
