import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { applyPersistentCookieDefaults } from './cookies';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Proactively refresh the session when the access token is within this many
// milliseconds of expiry. Prevents in-flight requests from hitting the boundary
// and failing — and prevents users coming back to a tab after ~50 minutes from
// having to re-auth on the next click.
const PROACTIVE_REFRESH_WINDOW_MS = 10 * 60 * 1000;

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, applyPersistentCookieDefaults(options)),
          );
        },
      },
    },
  );

  // getUser() validates and refreshes the access token if it has already
  // expired. We additionally check the local session and refresh proactively
  // if the token is near expiry — covers the "tab open for 55 minutes" case
  // where getUser succeeds but the very next API call would fail.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.expires_at) {
      const msRemaining = session.expires_at * 1000 - Date.now();
      if (msRemaining > 0 && msRemaining < PROACTIVE_REFRESH_WINDOW_MS) {
        await supabase.auth.refreshSession();
      }
    }
  }

  return response;
}
