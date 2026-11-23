/**
 * sign-in-landing.ts — where a person lands when they sign in and there is no
 * particular place to put them back.
 *
 * ─── WHY THIS IS ONE MODULE AND NOT THREE LINES ────────────────────────────
 * There are THREE doors into a signed-in session and they have to agree:
 *   · the whole-page `/login` route          (app/login/actions.ts)
 *   · the OAuth / magic-link return          (app/auth/callback/route.ts)
 *   · the in-place panel on the front door   (frontdoor/front-door-shell.tsx)
 * …and, since 2026-09-25, the two doors that CREATE an account: `signUp`
 * (via `signupLanding`, lib/signup-landing.ts) and the You card after it
 * (app/signup/you). Before that, a new couple from `/signup` whose `next` was
 * `/` landed on the front door while Google/Apple landed on the dashboard.
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
 * ⏩ REFINED 22 Nov 2026: *"don't start on discovery. start on their profile page"* — Events is now a section of
 *    Home, the profile page, so a `/` sign-in lands on Home (`?hub=1`; a supplier's on Shop). See below.
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

import { landingForAccount } from './auth-confirm-link';
import { asksForDiscover } from './discover-href';

/**
 * The page a signed-in person starts on when nothing says otherwise — their profile page, Home (owner 22 Nov 2026:
 * *"when i log in. don't start on discovery. start on their profile page"*). The rule itself is
 * `landingForAccount` (lib/auth-confirm-link.ts) — this is its answer for an account whose type the caller does not
 * know, kept as a name because the front door's in-place panel falls back to it.
 *
 * (This used to say vendors were not special-cased because `app/dashboard/layout.tsx` bounced them to
 * /vendor-dashboard. That bounce was removed — see the layout's "THE BOUNCE IS GONE" — so a supplier is now sent to
 * Home on Shop by the one rule, not by a second hop.)
 */
export const SIGNED_IN_LANDING = landingForAccount('/', null);

/**
 * Resolve where a completed sign-in should go.
 *
 * `raw` is whatever `safeNext()` returned — already proven to be a same-site
 * path. Only the bare `/` is redirected: a real destination (including one that
 * merely starts with `/`, like `/vendors?q=cake`) is always honoured, because
 * somebody who was sent to sign in from a page is owed that page back.
 *
 * `accountType` (`users.account_type`) picks which section of Home a `/` sign-in opens on — a supplier's opens on
 * Shop. ONE RULE: this delegates to `landingForAccount`, which the email-link door calls directly.
 */
export function signInDestination(raw: string, accountType: string | null | undefined = null): string {
  return landingForAccount(raw, accountType);
}

/**
 * 🏠 A SIGNED-IN VISIT TO `/` OPENS HOME — the same one rule as a sign-in (owner 23 Nov 2026, verbatim *"Yes, go to
 * Home"*; DECISION_LOG 2026-11-23 "A signed-in visit to setnayan.com opens Home", which closes the 22 Nov open call).
 * setnayan.com, the installed app's start (`manifest.json` `start_url: "/"`, the Capacitor and Tauri shells) and the
 * logo all open `/`; for an account that is signed in, `/` with nothing else on it means "nowhere of my own", exactly
 * as a sign-in's bare `next` does, so it answers with `landingForAccount('/', accountType)` — never a second rule.
 *
 * Returns the address to send them to, or `null` to draw the page (Discover / the public front page):
 *   · signed out, or the session read failed (`signedIn: false`)                      → null — the public page, untouched;
 *   · an anonymous session (a host who started an event with no account yet)           → null — not signed in yet;
 *   · ANY parameter of Discover's own on the address — `?discover=1` (Discover's door,
 *     `DISCOVER_HREF`), `?q=` (its search), a supplier filter                           → null — Discover was asked for;
 *   · only tracking tags (`utm_*`, `fbclid`, `gclid`) or nothing at all                → Home, by `landingForAccount`.
 *
 * 🔒 lib/a-signed-in-visit-to-the-root-opens-home.test.ts
 */

export function signedInRootLanding(
  params: Record<string, string | string[] | undefined>,
  who: { signedIn: boolean; isAnonymous: boolean; accountType: string | null | undefined },
): string | null {
  if (!who.signedIn || who.isAnonymous) return null;
  if (asksForDiscover(Object.keys(params).filter((k) => params[k] !== undefined))) return null;
  return landingForAccount('/', who.accountType);
}
