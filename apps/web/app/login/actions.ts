'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { stampLastLogin } from '@/lib/login-activity';
import { linkGuestSessionToUser } from '@/lib/link-guest-account';
import { captureEvent } from '@/lib/analytics';
import { captchaOptions, captchaTokenFromForm } from '@/lib/turnstile';

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

/**
 * The credential exchange itself — everything BOTH sign-in surfaces do, with no
 * opinion about where you end up.
 *
 * 🔑 EXTRACTED, NOT DUPLICATED. The two surfaces differ in exactly one way: the
 * /login route REDIRECTS (it is a whole page; there is nothing behind it), and
 * the in-place overlay must NOT (the whole point of the seam is that the page
 * behind you survives). Everything before that fork — the remember-me cookie
 * downgrade, the last_login_at stamp, the guest-session link, the account-type
 * home resolution — is identical, and a copy of it would be a second thing to
 * keep in step. There is exactly one copy, here.
 *
 * Returns the resolved destination on success so the caller can redirect to it,
 * navigate to it, or ignore it and stay put.
 */
async function exchangeCredentials(formData: FormData): Promise<
  { ok: true; destination: string } | { ok: false; error: string; fallbackNext: string }
> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  // Checkbox defaults CHECKED in the form. Browser submits 'on' when
  // checked and omits the field entirely when unchecked — that's the
  // canonical HTML form contract for checkboxes. So `remember === 'on'`
  // means "stay signed in"; anything else means session-only.
  const remember = String(formData.get('remember') ?? '') === 'on';
  const rawNext = safeNext(formData.get('next'));
  // Signing in from the front door RETURNS YOU TO THE FRONT DOOR (owner
  // 2026-08-13: "i thought that once we log in, it still looks like the public
  // website, but we have added sidebar"). `/` is no longer rewritten away.
  const fallbackNext = rawNext;

  if (!email || !password) {
    return { ok: false, error: 'missing', fallbackNext };
  }

  const supabase = await createClient();
  // Turnstile token (present only once captcha is configured + enabled). Empty
  // → captchaOptions() yields {} → identical to the pre-captcha call.
  const captchaToken = captchaTokenFromForm(formData);
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaOptions(captchaToken),
  });

  if (error) {
    return { ok: false, error: error.message, fallbackNext };
  }

  if (!remember) {
    const cookieStore = await cookies();
    downgradeSupabaseCookiesToSessionOnly(cookieStore);
  }

  // Stamp last_login_at — the "now" reference for the login-driven ghosting
  // check (lib/ghosting.ts). Fail-soft inside; never blocks the redirect.
  await stampLastLogin(supabase);

  // Persistent guest accounts (PR-E): a returning user who just attended a new
  // wedding as a guest (on this browser) gets that event linked so the photos
  // surface in their Account hub. Best-effort — the helper never throws.
  // Awaited so the DB write lands before the redirect tears down the request.
  if (data.user?.id) {
    const guestLink = await linkGuestSessionToUser(data.user.id);
    if (guestLink.linked) {
      void captureEvent({
        distinctId: data.user.id,
        event: 'guest_account_linked',
        properties: { ref: 'guest' },
      }).catch(() => {
        // Telemetry failure never blocks. Silent.
      });
    }
  }

  /*
    WHERE YOU LAND — and why this stopped calling accountHomePath().

    This block used to send anyone arriving from `/` to their account home
    (vendor → /vendor-dashboard · admin → /admin · else /dashboard), to avoid
    "the double-hop where vendors landed on /dashboard then got bounced to
    /vendor-dashboard by dashboard/layout.tsx".

    THAT RULE WAS RIGHT, AND ITS PREMISE EXPIRED. It was written while `/` was
    the ELN cinematic homepage, which had NOTHING for a signed-in person — so
    leaving them there was the one thing you could not do. `/` became the front
    door on 2026-08-13 and now carries a signed-in state of its own
    (_components/frontdoor/front-door-shell.tsx: My Home with Events + Alaala,
    the Marketplace group, the account cluster), and nothing redirects a
    signed-in visitor away from it.

    So `next` is now honoured for EVERY origin including `/`, which is what the
    seam promises everywhere else: you come back where you started. The
    double-hop it guarded against cannot return, because `/` is a real
    destination rather than a redirect chain — dashboard/layout.tsx still owns
    the vendor bounce for anyone who genuinely lands on /dashboard.

    accountHomePath() is deliberately NOT deleted — /login?next=/dashboard and
    every caller that asks for an account home still uses it.
  */
  const destination = fallbackNext;

  return { ok: true, destination };
}

export async function signInWithPassword(formData: FormData) {
  const result = await exchangeCredentials(formData);
  if (!result.ok) {
    return redirect(
      `/login?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(result.fallbackNext)}`,
    );
  }
  return redirect(result.destination);
}

export type SignInInPlaceState = {
  /** Null until a submit has actually failed. */
  error: string | null;
  /** True only after the credentials were actually accepted by Supabase. */
  ok: boolean;
  /** Bumped on every completed submit so a repeated identical failure still
   *  re-renders (two wrong attempts with the same password are two events). */
  attempt: number;
};

/*
  ⚠ THE INITIAL STATE IS NOT EXPORTED FROM HERE, and that is a hard rule, not a
  preference. This module is `'use server'`, and Next allows a server-action
  file to export ONLY async functions — a plain `export const` fails the
  PRODUCTION BUILD with "Only async functions are allowed to be exported in a
  'use server' file". `tsc` is perfectly happy with it, so the first cut of this
  change typechecked green and would have broken the deploy. The constant lives
  beside its consumer in `_components/sign-in-state.ts`.
  (A `export type` is fine — types are erased before that check runs.)
*/

/**
 * signInInPlace — the same sign-in, with the redirect removed.
 *
 * 🔑 WHY A SECOND ENTRY POINT AT ALL. `signInWithPassword` answers a wrong
 * password by redirecting to `/login?error=…`. On a whole-page login that is
 * right. Opened OVER a shop page it is the exact harm this session exists to
 * remove: one typo and the page you were reading — and the enquiry you were
 * half-way through writing — is gone, replaced by a login screen. Here the
 * message comes back as a value and renders inside the card, on the page you
 * never left.
 *
 * ⚠ IT NEVER REDIRECTS AND NEVER THROWS. A `redirect()` inside a server action
 * consumed by `useActionState` unmounts the caller, which is the behaviour
 * being avoided. The client decides what happens next: stay and refresh (the
 * default), or navigate to `destination` when the sign-in had nowhere to
 * return to.
 */
export async function signInInPlace(
  prev: SignInInPlaceState,
  formData: FormData,
): Promise<SignInInPlaceState> {
  const attempt = prev.attempt + 1;
  const result = await exchangeCredentials(formData);
  if (!result.ok) {
    return {
      error:
        result.error === 'missing'
          ? 'Enter your email and your password.'
          : result.error,
      ok: false,
      attempt,
    };
  }
  /*
    `result.destination` is deliberately DROPPED here. In place, there is
    nowhere to send anybody — the whole point is that the page you are on is
    where you stay. Landing on the account board is the job of the /login
    ROUTE, which is reached by a hard load or a redirect and genuinely has
    nothing behind it. Returning a destination nobody navigates to would be a
    value that looks like a decision and is not one.
  */
  return { error: null, ok: true, attempt };
}
