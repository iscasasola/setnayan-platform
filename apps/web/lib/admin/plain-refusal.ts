import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * What an admin screen says when a database call was refused: a plain sentence,
 * with the refusal's own words sent to the log (Vercel + Sentry) instead.
 *
 * 🔑 A raw `error.message` names a column, a constraint or a table — text the
 * operator cannot act on and that reads as a crash. The detail is not lost; it
 * moves to where somebody who can use it will look. Returns the sentence.
 */
export function plainRefusal(callSite: string, error: unknown, what = 'save that'): string {
  logQueryError(callSite, error);
  return `Couldn’t ${what} — nothing was changed. Try again, and tell the developers if it repeats.`;
}

/** Log the refusal and contribute nothing to the sentence being built (returns ''). */
export function logRefusal(callSite: string, error: unknown): string {
  logQueryError(callSite, error);
  return '';
}
