/**
 * sign-in-landing.ts — where a person lands when they sign in and there is no
 * particular place to put them back.
 *
 * ─── WHY THIS IS ONE MODULE AND NOT THREE LINES ────────────────────────────
 * There are THREE doors into a signed-in session and they have to agree:
 *   · the whole-page `/login` route          (app/login/actions.ts)
 *   · the OAuth / magic-link return          (app/auth/callback/route.ts)
 *   · the in-place panel on the front door   (frontdoor/front-door-shell.tsx)
 *
 * The first two already carried a hand-copied line each. `DECISION_LOG.md`
 * 2026-08-13 names that duplication as the hazard in as many words — *"fix one
 * and Google sign-in disagrees with password sign-in: two answers to one
 * question"* — and this is the third door arriving, which would have made it
 * three copies. One rule, imported.
 *
 * ─── WHY IT IS NOT IN lib/auth.ts, WHERE safeNext LIVES ────────────────────
 * 🪤 `lib/auth.ts` opens with `import 'server-only'`. The front-door shell is a
 * CLIENT component, so importing that module from it is a build error — and no
 * `node:test` file can import it either, because `server-only` is not installed
 * in this repo, so the rule would ship untestable. The pure rule lives here on
 * its own; `safeNext` stays where it is and still runs first.
 *
 * ─── WHAT THIS CHANGES, SAID PLAINLY ───────────────────────────────────────
 * Owner 2026-08-28: *"when you log in, you should go directly to Events"*.
 *
 * ⚠ THIS REVERSES THE 2026-08-13 BEHAVIOUR ON ONE ORIGIN ONLY, AND THE OWNER
 * ASKED FOR IT. That day the rule became "`next` is honoured for EVERY origin,
 * `/` included — signing in from the front door returns you to the front door",
 * written after he signed in and was dropped on `/admin`. Landing on Events is
 * not a return to that: HQ is what he objected to, and Events is the board he
 * asked for by name. Every OTHER origin still returns you exactly where you
 * were — a shop you were reading, an invitation, a deep link — which is the
 * half of that decision this does not touch.
 */

/**
 * The board a signed-in person starts on. Vendors are NOT special-cased here on
 * purpose: `app/dashboard/layout.tsx` already bounces a vendor account to
 * `/vendor-dashboard`, and a second copy of that rule in a second place is the
 * exact duplication this module exists to avoid.
 */
export const SIGNED_IN_LANDING = '/dashboard';

/**
 * Resolve where a completed sign-in should go.
 *
 * `raw` is whatever `safeNext()` returned — already proven to be a same-site
 * path. Only the bare `/` is redirected: a real destination (including one that
 * merely starts with `/`, like `/vendors?q=cake`) is always honoured, because
 * somebody who was sent to sign in from a page is owed that page back.
 */
export function signInDestination(raw: string): string {
  return raw === '/' ? SIGNED_IN_LANDING : raw;
}
