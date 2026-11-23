/**
 * oauth-front-door.ts — the phone app's Google sign-in opens on OUR address, not the database's.
 *
 * ─── WHY ─────────────────────────────────────────────────────────────────────
 * Owner screenshot, iPhone app, 22 Nov 2026: the sign-in sheet read
 *   "Setnayan" Wants to Use "njrupjnvkjkitfctetvi.supabase.co" to Sign In
 * — a raw database address at the front door of sign-up, which makes people back out. iOS's
 * ASWebAuthenticationSession names the host of the FIRST URL it is handed (`SetnayanAuthPlugin.swift`
 * `openAuthSession`), and `lib/native-oauth.ts` handed it the Supabase authorize URL straight from
 * `signInWithOAuth({ skipBrowserRedirect: true })`.
 *
 * ─── THE FIX (free · web code only · no app rebuild) ─────────────────────────
 * The session now opens `https://www.setnayan.com/auth/go?<the authorize query>`, and that route
 * (app/auth/go/route.ts) answers 302 to `https://<our ref>.supabase.co/auth/v1/authorize?<the same query>`.
 * The sheet names setnayan.com. The app loads the web bundle from www.setnayan.com (capacitor.config.ts,
 * REMOTE-URL pattern), so this reaches every installed app on the next deploy. Android's Custom Tab goes
 * through the same `systemBrowser` call and gets the same address.
 *
 * ─── 🔒 NOT AN OPEN REDIRECT ─────────────────────────────────────────────────
 * The route never takes a host or a path from the request. It carries ONLY the query string, onto ONE
 * fixed target built from `NEXT_PUBLIC_SUPABASE_URL` — and only when that is `https://<ref>.supabase.co`
 * with no port. Anything else and it refuses. `redirect_to` inside the query is checked by Supabase
 * against its own redirect allowlist, exactly as before.
 *
 * ─── 🔑 PKCE IS UNTOUCHED ────────────────────────────────────────────────────
 * `signInWithOAuth` still stores the code verifier in the app web view's cookies and puts only the
 * `code_challenge` in the query. The hop carries the challenge through byte-for-byte meaning (the query is
 * re-serialised, not edited), and the code still comes back to setnayan:// → /auth/callback in that same
 * web view, which holds the verifier.
 *
 * Pure: imported by the client (`lib/native-oauth.ts`), the route and the guard.
 */

export const OAUTH_FRONT_DOOR_PATH = '/auth/go';
export const SUPABASE_AUTHORIZE_PATH = '/auth/v1/authorize';
/** A query longer than this is not one supabase-js built. */
const MAX_QUERY_LENGTH = 4096;

/**
 * The project's Supabase origin, or null unless it is exactly `https://<ref>.supabase.co`.
 * The only host the front door will ever send anybody to.
 */
export function supabaseAuthOrigin(supabaseUrl: string | null | undefined): string | null {
  if (!supabaseUrl) return null;
  let u: URL;
  try {
    u = new URL(supabaseUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.port !== '' || u.username !== '' || u.password !== '') return null;
  if (!/^[a-z0-9]+\.supabase\.co$/.test(u.hostname)) return null;
  return u.origin;
}

/**
 * The client half: turn the authorize URL supabase-js built into OUR address for the same sign-in.
 * Null when `providerUrl` is not this project's authorize URL — the caller refuses then, it never opens
 * the raw URL.
 */
export function frontDoorAuthorizeUrl(
  appOrigin: string,
  providerUrl: string,
  supabaseUrl: string | null | undefined,
): string | null {
  const origin = supabaseAuthOrigin(supabaseUrl);
  if (!origin) return null;
  let u: URL;
  try {
    u = new URL(providerUrl);
  } catch {
    return null;
  }
  if (u.origin !== origin || u.pathname !== SUPABASE_AUTHORIZE_PATH) return null;
  if (!u.searchParams.get('provider') || u.search.length > MAX_QUERY_LENGTH) return null;
  return `${appOrigin.replace(/\/+$/, '')}${OAUTH_FRONT_DOOR_PATH}${u.search}`;
}

/**
 * The route half: where `/auth/go?<query>` sends the browser — ALWAYS this project's authorize endpoint,
 * or null (refuse). The request's own host and path are never read.
 */
export function authorizeTarget(search: string, supabaseUrl: string | null | undefined): string | null {
  const origin = supabaseAuthOrigin(supabaseUrl);
  if (!origin) return null;
  if (search.length > MAX_QUERY_LENGTH) return null;
  const query = new URLSearchParams(search);
  if (!query.get('provider')) return null;
  const target = new URL(SUPABASE_AUTHORIZE_PATH, origin);
  target.search = query.toString();
  return target.toString();
}
