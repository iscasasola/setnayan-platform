/**
 * "Sign in" that brings you BACK — the not-found page's door (owner, 23 Oct 2026).
 *
 * The bare-root not-found says "if the page is yours, sign in below". Its button went to a bare `/login`, so a
 * signed-out owner who opened their own shop address, signed in, and landed on Home — never on the page they had
 * opened. Now the button carries the address it was pressed on, through THE ONE rule (`lib/safe-next.ts`), and
 * `/login` honours `next` for every origin (app/login/actions.ts). Pure, no `server-only`: the client button and
 * the guard read the same function.
 *
 * PATH ONLY — never the query. A guest's link can carry `?invite=` / `?k=` tokens, and a token must not be copied
 * into a login URL (it would land in history and logs a second time).
 */
import { safeNext } from '@/lib/safe-next';

export function signInBackHereHref(pathname: string | null | undefined): string {
  const next = safeNext(pathname ?? '/');
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}
