import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { NextRequest, NextResponse } from 'next/server';
import { applyPersistentCookieDefaults, readClientType } from '@/lib/supabase/cookies';
import type { CurrentSession, FreshSession } from '@/lib/account-switch';

/**
 * The account routes' Supabase plumbing (avatar sheet PR2 — `lib/account-jars.ts`).
 *
 * `requestClient` reads the ACTIVE session from the request and COLLECTS what it would write, so the route decides
 * what reaches the response (nothing, on a refused switch). `statelessClient` stores nothing at all — it exchanges a
 * parked refresh token without ever touching this browser's cookies.
 */
type CookieToSet = { name: string; value: string; options?: CookieOptions };

export function requestClient(request: NextRequest) {
  const pending: CookieToSet[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (c: CookieToSet[]) => {
        pending.push(...c);
      },
    },
  });
  return { supabase, pending };
}

export function statelessClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function refreshParked(refreshToken: string): Promise<FreshSession | null> {
  try {
    const { data, error } = await statelessClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session || !data.user) return null;
    return { uid: data.user.id, access: data.session.access_token, refresh: data.session.refresh_token };
  } catch {
    return null;
  }
}

/** Revoke a parked session at Supabase (best effort) — "Sign out of all accounts". */
export async function revokeParked(refreshToken: string): Promise<void> {
  try {
    const c = statelessClient();
    const { data, error } = await c.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return;
    await c.auth.signOut({ scope: 'local' });
  } catch {
    /* a session we cannot reach is one nobody can use from this device either: its jar is expired below */
  }
}

/** The signed-in session — VERIFIED user (getUser) + the refresh token to park. */
export async function readCurrent(supabase: ReturnType<typeof requestClient>['supabase']): Promise<CurrentSession | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.refresh_token) return null;
    const { data: profile } = await supabase.from('users').select('display_name').eq('user_id', user.id).maybeSingle();
    return {
      uid: user.id,
      email: user.email ?? '',
      name: ((profile as { display_name?: string | null } | null)?.display_name ?? null) || null,
      refresh: session.refresh_token,
    };
  } catch {
    return null;
  }
}

/** Expire every session cookie the request carried (`sb-*`) — the same sweep `/auth/sign-out` does. */
export function expireSessionCookies(request: NextRequest, response: NextResponse, secure: boolean) {
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith('sb-')) {
      response.cookies.set(c.name, '', { maxAge: 0, path: '/', httpOnly: true, secure, sameSite: 'lax' });
    }
  }
}

/** Apply what the request client wrote (the new active session), with the app's persistent-cookie defaults. */
export function applyPending(request: NextRequest, response: NextResponse, pending: readonly CookieToSet[]) {
  const hint = readClientType(request.cookies.get('setnayan-client-type')?.value);
  for (const { name, value, options } of pending) {
    response.cookies.set(name, value, applyPersistentCookieDefaults(options, hint));
  }
}
