import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * hostRefusal — what a host, guest or supplier reads when the database refused an action (SW-RAWDB, final check
 * 25 Nov 2026): one plain sentence. The refusal's own words (a column, a constraint, a policy name) go to the log —
 * Vercel and Sentry — where somebody who can act on them will look, and never to the screen.
 *
 * The admin side has its own voice for this (`lib/admin/plain-refusal.ts`, "tell the developers"); this one is for
 * the people the product is for.
 */
export function hostRefusal(callSite: string, error: unknown, what = 'save that'): string {
  logQueryError(callSite, error, {}, 'graceful_degrade');
  return `Couldn’t ${what} — nothing was changed. Try again.`;
}
