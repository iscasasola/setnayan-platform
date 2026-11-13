/**
 * Where "Sign out of all accounts" posts — split out of `lib/account-jars.ts` so the browser can have it alone.
 *
 * ⚡ WHY ITS OWN FILE (measured 2026-11-13, production build). The account switcher (a client component) needed only
 * this one pure function, but importing it from `lib/account-jars.ts` brought that whole module into the browser
 * bundle — and its server-side base64url helpers name the global `Buffer`, which makes webpack inject the `buffer`
 * polyfill (~17KB gzipped) wherever the switcher ships: on the front page and in the `(shell)` layout's chunk on
 * every signed-in page. Nothing here names `Buffer`; `account-jars.ts` re-exports it, so every existing import holds.
 * 🛡 app/_components/frontdoor/the-front-page-ships-only-what-it-draws.test.ts.
 */
import type { ParkedAccount } from './account-jars';

/** Where "Sign out of all accounts" posts: with nobody else on the phone it is the plain sign-out, unchanged. */
export function signOutAllAction(others: readonly ParkedAccount[] | null | undefined): '/auth/sign-out' | '/auth/accounts/sign-out-all' {
  return others && others.length > 0 ? '/auth/accounts/sign-out-all' : '/auth/sign-out';
}
