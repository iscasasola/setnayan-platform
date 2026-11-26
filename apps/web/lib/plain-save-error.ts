import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * plainSaveError — the ONE mapper from a database refusal to what a person reads (SW-RAWDB, final check 25 Nov 2026;
 * plan `PLAN-area-2.md` batch A-7). The refusal's own words (a column, a constraint, a policy name) go to the log —
 * Vercel and Sentry — and never to the screen. A person reads one plain sentence that says what to do:
 *
 *   · a duplicate (23505)              → it is already there;
 *   · no permission (42501 / RLS)      → ask a host;
 *   · a missing reference (23503)      → something changed meanwhile, reload;
 *   · the network (fetch failed …)     → check the connection;
 *   · anything else                    → "Didn’t save · Try again."
 *
 * The admin side has its own voice for this (`lib/admin/plain-refusal.ts`, "tell the developers"); this one is for
 * the people the product is for.
 */
export const DIDNT_SAVE = 'Didn’t save · Try again.';

const NOT_ALLOWED = 'You can’t change this here. Ask a host of this event.';

const SAID: { test: (code: string, message: string) => boolean; words: string }[] = [
  { test: (c) => c === '23505', words: 'That’s already there — check the list, then try again.' },
  { test: (c, m) => c === '42501' || /row-level security|permission denied/i.test(m), words: NOT_ALLOWED },
  { test: (c) => c === '23503', words: 'Something this needs was changed meanwhile. Reload, then try again.' },
  {
    test: (_c, m) => /fetch failed|network|timeout|ECONN/i.test(m),
    words: 'Couldn’t reach Setnayan. Check your connection, then try again.',
  },
];

/** The sentence for a refusal — no logging; `plainSaveError` is the one the actions call. */
export function plainSaveWords(error: unknown): string {
  const e = (error ?? {}) as { code?: unknown; message?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : '';
  return SAID.find((s) => s.test(code, message))?.words ?? DIDNT_SAVE;
}

/** Log the refusal where somebody can act on it, and return the one plain sentence a person reads. */
export function plainSaveError(callSite: string, error: unknown): string {
  logQueryError(callSite, error, {}, 'graceful_degrade');
  return plainSaveWords(error);
}
