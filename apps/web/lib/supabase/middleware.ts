import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { applyPersistentCookieDefaults, readClientType } from './cookies';
import { SESSION_CHECK_BUDGET_MS, withBudget } from './session-budget';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export type UpdateSessionResult = {
  response: NextResponse;
  user: User | null;
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

  // getUser() validates and refreshes the access token if it has already
  // expired. We additionally check the local session and refresh proactively
  // if the token is near expiry — covers the "tab open for an hour" case
  // where getUser succeeds but the very next API call would fail. Native-like
  // clients get a wider window so the boundary is essentially never hit.
  //
  // ⏱ ALL OF IT UNDER ONE DEADLINE. This runs in front of EVERY page, and on
  // 2026-08-20 an unbounded version of it turned an unreachable database into
  // 504s across the entire site — public pages included, for visitors with no
  // session at all. See ./session-budget.ts for the incident and for why the
  // safe direction is "nobody is signed in".
  const outcome = await withBudget(async () => {
    const {
      data: { user: authedUser },
    } = await supabase.auth.getUser();

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
