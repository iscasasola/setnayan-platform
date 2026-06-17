'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { stampLastLogin } from '@/lib/login-activity';
import { accountHomePath } from '@/lib/account-security';

/**
 * "Stay signed in" cookie downgrade.
 *
 * The codebase forces persistent (1-year browser · 10-year PWA/Tauri)
 * cookies on every Supabase auth write — see lib/supabase/cookies.ts
 * `applyPersistentCookieDefaults`. That's the right default for the
 * dashboard-as-a-companion-tool experience (sessions survive browser
 * restarts so a couple coming back next morning doesn't have to re-log).
 *
 * But on shared / borrowed devices (cousin's laptop · public computer ·
 * vendor laptop with multiple staff) the right default flips. The
 * checkbox on /login + /signup defaults CHECKED — explicit opt-out only.
 * When unchecked, we read every sb-* cookie Supabase just set and re-set
 * each one without `maxAge` / `expires` so it becomes a session cookie
 * that dies when the browser closes.
 *
 * Why post-auth overwrite instead of threading sessionOnly through
 * applyPersistentCookieDefaults: the helper is request-scoped + cached
 * via createClient. Threading per-call state would force a cache-key
 * rewrite and risk cross-action pollution. The overwrite is local +
 * surgical + keeps the helper untouched.
 *
 * httpOnly + secure + sameSite + path mirror the security posture
 * Supabase / applyPersistentCookieDefaults would have set — we only
 * drop maxAge/expires.
 *
 * setnayan-client-type is preserved (used by middleware to detect PWA /
 * Tauri visits) — we only touch sb-* names.
 */
function downgradeSupabaseCookiesToSessionOnly(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith('sb-')) {
      cookieStore.set(c.name, c.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        // No maxAge, no expires → session cookie that clears on browser close.
      });
    }
  }
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  // Checkbox defaults CHECKED in the form. Browser submits 'on' when
  // checked and omits the field entirely when unchecked — that's the
  // canonical HTML form contract for checkboxes. So `remember === 'on'`
  // means "stay signed in"; anything else means session-only.
  const remember = String(formData.get('remember') ?? '') === 'on';
  const rawNext = safeNext(formData.get('next'));
  // When no explicit next, use /dashboard as error-redirect fallback.
  // Real post-auth destination is computed by account_type below.
  const fallbackNext = rawNext === '/' ? '/dashboard' : rawNext;

  if (!email || !password) {
    return redirect(`/login?error=missing&next=${encodeURIComponent(fallbackNext)}`);
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(fallbackNext)}`,
    );
  }

  if (!remember) {
    const cookieStore = await cookies();
    downgradeSupabaseCookiesToSessionOnly(cookieStore);
  }

  // Stamp last_login_at — the "now" reference for the login-driven ghosting
  // check (lib/ghosting.ts). Fail-soft inside; never blocks the redirect.
  await stampLastLogin(supabase);

  // Route directly to the account's home when no explicit destination was given —
  // avoids the double-hop where vendors landed on /dashboard then got bounced
  // to /vendor-dashboard by dashboard/layout.tsx.
  let destination = fallbackNext;
  const userId = data.user?.id;
  if (rawNext === '/' && userId) {
    const { data: profile } = await supabase
      .from('users')
      .select('account_type')
      .eq('user_id', userId)
      .maybeSingle();
    destination = accountHomePath(profile?.account_type);
  }

  return redirect(destination);
}
