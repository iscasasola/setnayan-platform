import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { applyPersistentCookieDefaults, readClientType } from './cookies';
import { SESSION_CHECK_BUDGET_MS, withBudget } from './session-budget';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Who the signed-in token belongs to — the id and nothing else, because that is
 * all the middleware's two readers (`?demo=1` and the signed-in redirect) use.
 * Deliberately NOT the full supabase `User`: the check below reads the token's
 * claims, not the auth server's row, so fields like `last_sign_in_at` are not
 * here to read — and a type that promised them would hand back `undefined`.
 */
export type SessionUser = { id: string };

export type UpdateSessionResult = {
  response: NextResponse;
  user: SessionUser | null;
};

// Proactively refresh the session when the access token is within this many
// milliseconds of expiry. Native-like clients (desktop app, installed PWA)
// use the wider window so they feel "always connected"; web uses a narrower
// window to limit unnecessary work.
const PROACTIVE_REFRESH_WINDOW_MS_NATIVE = 30 * 60 * 1000;
const PROACTIVE_REFRESH_WINDOW_MS_WEB = 10 * 60 * 1000;

export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request });
  // Set once the session check has run out of its budget. After that the
  // request is already on its way, so any cookie write arriving late would be
  // mutating a response nobody can still change — see setAll below.
  let bailed = false;

  const clientHint = readClientType(
    request.cookies.get('setnayan-client-type')?.value,
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // 🪤 THE LOSING SIDE OF A RACE KEEPS RUNNING. If the session check
          // timed out, this callback can still fire seconds later — rebuilding
          // `response` and rewriting session cookies on a request that has
          // already been answered. Dropping it here is the other half of the
          // budget: stop the WAITING and stop the WRITING.
          if (bailed) return;
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              applyPersistentCookieDefaults(options, clientHint),
            ),
          );
        },
      },
    },
  );

  // getClaims() refreshes the session if the access token has already expired
  // (it reads it through getSession()), then VERIFIES THE TOKEN'S SIGNATURE ON
  // THIS SERVER against the project's published ES256 key — no trip to the
  // auth server. The key is fetched once and cached for 10 minutes per
  // instance (auth-js JWKS_TTL). A token signed the legacy HS way has no key to
  // check against, and getClaims falls back to the old getUser() round trip on
  // its own, so nothing is refused that used to be let in.
  //
  // 🔑 WHY NOT getUser() ANY MORE (owner, 2026-09-29, "change it"). getUser()
  // asked Supabase over the network on EVERY request — public pages included —
  // for an answer this file only uses for `?demo=1` and one signed-in redirect.
  // ⚖ THE TRADE, STATED: the auth server knows about a sign-out-everywhere, a
  // ban or a deleted account the instant it happens; a still-valid token does
  // not, until it expires (up to an hour). That trade reaches ONLY those two
  // uses. Every protected surface still does its own server-side
  // `auth.getUser()` / `getCurrentUser()` and redirects (see session-budget.ts),
  // so no door that is shut there is opened here.
  //
  // We additionally check the local session and refresh proactively if the
  // token is near expiry — covers the "tab open for an hour" case where the
  // check succeeds but the very next API call would fail. Native-like clients
  // get a wider window so the boundary is essentially never hit.
  //
  // ⏱ ALL OF IT UNDER ONE DEADLINE. This runs in front of EVERY page, and on
  // 2026-08-20 an unbounded version of it turned an unreachable database into
  // 504s across the entire site — public pages included, for visitors with no
  // session at all. See ./session-budget.ts for the incident and for why the
  // safe direction is "nobody is signed in".
  const outcome = await withBudget(async (): Promise<SessionUser | null> => {
    const { data } = await supabase.auth.getClaims();
    // `sub` is the user id. No claims (no session, an expired session that
    // could not refresh, a bad signature) is exactly the old "no user".
    const sub = data?.claims?.sub;
    const authedUser: SessionUser | null =
      typeof sub === 'string' && sub.length > 0 ? { id: sub } : null;

    if (authedUser) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.expires_at) {
        const msRemaining = session.expires_at * 1000 - Date.now();
        const refreshWindow = clientHint.isNativeLike
          ? PROACTIVE_REFRESH_WINDOW_MS_NATIVE
          : PROACTIVE_REFRESH_WINDOW_MS_WEB;
        if (msRemaining > 0 && msRemaining < refreshWindow) {
          await supabase.auth.refreshSession();
        }
      }
    }
    return authedUser;
  }, SESSION_CHECK_BUDGET_MS);

  if (!outcome.ok) {
    bailed = true;
    // 🔊 SAY IT ONCE. An outage that degrades silently is an outage nobody
    // measures: every page would quietly render signed-out and look fine. This
    // is the only line that distinguishes "the site is calm" from "the site is
    // serving strangers to everybody".
    console.warn(
      `[session] sign-in check gave up after ${SESSION_CHECK_BUDGET_MS}ms (${outcome.reason}) — ` +
        'serving this request signed-out',
    );
    return { response, user: null };
  }

  return { response, user: outcome.value };
}
