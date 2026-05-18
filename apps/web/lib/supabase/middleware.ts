import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { applyPersistentCookieDefaults, readClientType } from './cookies';

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
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

  return { response, user };
}
