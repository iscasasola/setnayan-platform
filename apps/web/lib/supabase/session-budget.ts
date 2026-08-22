/**
 * A time budget for the sign-in check that runs in front of EVERY page.
 *
 * ── WHY THIS EXISTS — 2026-08-20, a total outage ────────────────────────────
 * The database stopped answering for about 50 minutes. Vercel was healthy, the
 * app was healthy, and **every page on the site returned 504
 * `MIDDLEWARE_INVOCATION_TIMEOUT`** — including public pages that need no
 * session and no data at all. The one path that stayed up the whole time was
 * `/api/health`, and only because the middleware matcher excludes it.
 *
 * The mechanism: `updateSession()` awaits `supabase.auth.getUser()` on every
 * request. Measured in the edge logs during the incident, `/auth/v1/token` and
 * `/rest/v1/*` were both returning **522 (connection timed out)** — so that
 * await simply never came back, and Vercel killed the request after ~25s.
 *
 * 🔑 THE FAULT IS NOT THAT THE CHECK IS SLOW — IT IS THAT IT IS UNBOUNDED, AND
 * THAT EVERY PAGE WAITS ON IT. For an anonymous visitor reading a public page,
 * the answer changes nothing about what renders. Making a stranger wait 25
 * seconds for it, and then showing them a gateway error, is the worst possible
 * trade.
 *
 * ⚖ WHICH WAY IT FAILS. On timeout the request continues as if NOBODY IS
 * SIGNED IN. That is the safe direction in this codebase: every protected
 * surface does its own `auth.getUser()` server-side and redirects — the
 * middleware's copy is used only for a `?demo=1` admin flag and one
 * already-signed-in redirect target. A timeout can therefore never open a door;
 * at worst somebody signed in briefly sees the signed-out version of a public
 * page, and their session cookies are left exactly as they were.
 *
 * ⚠ WHAT THIS DOES NOT FIX, said plainly: a page that reads the database in its
 * own body still waits on the database. This keeps the PUBLIC site standing
 * when the database is unwell; it cannot make a dashboard work without one.
 */

/** How long the whole session check may take before the page goes on without it. */
export const SESSION_CHECK_BUDGET_MS = 2_000;

export type BudgetOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'timeout' | 'error' };

/**
 * Run `work` with a deadline. Returns what it produced, or says it ran out of
 * time — never throws, and never leaves a timer holding the runtime open.
 *
 * 🪤 THE RACE IS NOT THE WHOLE JOB. The losing promise keeps running: its
 * `setAll` cookie callback can still fire after we have handed the response
 * back, which would mutate a response already on its way to the browser. The
 * caller must therefore ALSO stop accepting side effects once this returns
 * `ok: false` — see how `bailed` is used in ./middleware.ts. A budget that only
 * stops the WAITING and not the WRITING is half a fix.
 */
export async function withBudget<T>(
  work: () => Promise<T>,
  budgetMs: number = SESSION_CHECK_BUDGET_MS,
): Promise<BudgetOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<BudgetOutcome<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), budgetMs);
  });
  try {
    return await Promise.race([
      work().then(
        (value): BudgetOutcome<T> => ({ ok: true, value }),
        // A rejection degrades exactly like a timeout. Both mean "we do not
        // know who this is", and the caller must treat them the same — a
        // branch that told them apart would be a branch that could get one of
        // them wrong.
        (): BudgetOutcome<T> => ({ ok: false, reason: 'error' }),
      ),
      deadline,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
