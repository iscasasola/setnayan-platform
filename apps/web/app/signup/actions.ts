'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { isEmailBlacklisted } from '@/lib/blacklist';
import { captureEvent } from '@/lib/analytics';
import { safeNext } from '@/lib/auth';

function parseAccountType(raw: FormDataEntryValue | null): 'customer' | 'vendor' {
  const value = raw ? String(raw) : '';
  return value === 'vendor' ? 'vendor' : 'customer';
}

/**
 * "Stay signed in" cookie downgrade — mirror of the login/actions.ts
 * helper. See that file for the full WHY block. signUp() may set sb-*
 * session cookies when Supabase's email-confirm-required is off (the
 * auto-confirm admin path further reinforces this) — so honoring the
 * checkbox at signup time matches the contract on login.
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

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const accountType = parseAccountType(formData.get('account_type'));
  // Checkbox defaults CHECKED in the form — browsers submit 'on' when
  // checked, omit the field when unchecked. See login/actions.ts for the
  // canonical HTML form contract note.
  const remember = String(formData.get('remember') ?? '') === 'on';
  const next = safeNext(formData.get('next'));
  // Public Event Summary consent — couples only. Captured at signup per
  // CLAUDE.md decision-log rows 426 + 428 (2026-05-19) + the 8 RA 10173
  // safe-harbor guardrails. Vendors don't get this field (form hides it
  // via :has(); we double-check the account type here so a forged POST
  // can't write the column for a vendor row).
  const publicSummaryConsent =
    accountType === 'customer' && String(formData.get('public_summary_consent') ?? '') === 'yes';

  if (!email || !password) {
    return redirect(`/signup?error=missing&next=${encodeURIComponent(next)}`);
  }
  if (password.length < 8) {
    return redirect(`/signup?error=password_too_short&next=${encodeURIComponent(next)}`);
  }

  if (await isEmailBlacklisted(email)) {
    return redirect(`/signup?error=blacklisted&next=${encodeURIComponent(next)}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      // The trigger reads raw_user_meta_data->>'account_type' to pick the
      // public.account_type enum value for the new public.users row.
      data: { account_type: accountType },
    },
  });

  if (error) {
    return redirect(
      `/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  // V1 work-around: Supabase's built-in email sender drops into spam folders
  // and free-tier rate limits are tight. Auto-confirm every new signup with
  // the admin API so the user can sign in immediately without waiting on a
  // confirmation link, and fire a Resend-backed welcome email on the side.
  // Real email-based verification returns when Supabase's SMTP is pointed at
  // Resend (separate dashboard config).
  let autoConfirmed = false;
  if (data.user?.id) {
    const userId = data.user.id;
    try {
      const admin = createAdminClient();

      // 2026-05-30 perceived-signup-lag fix (CLAUDE.md decision-log
      // row · sibling to PRs #674 + #676 OAuth button + dashboard-root
      // skeleton). Owner's "Sequential Await Bottleneck (The Silent
      // Killer)" principle applied here: the three side-effects of a
      // successful auth.signUp — admin updateUserById to flip
      // email_confirm, the RA 10173 public summary consent write for
      // couples who opted in, and the Resend welcome email — are
      // INDEPENDENT. None reads what another writes. Pre-fix they ran
      // serially, blocking the redirect for ~400-1400ms after
      // auth.signUp returned. Parallelize via Promise.allSettled so
      // the total wait collapses to the slowest single operation
      // (~600ms worst case · ~250ms typical).
      //
      // allSettled (not .all): a failure in one operation doesn't
      // cancel the other two. Matches the existing per-operation
      // error semantics:
      //   • updateUserById is load-bearing for autoConfirmed (user
      //     can't sign in immediately if email_confirm didn't land);
      //   • consent write was already explicitly "non-blocking" per
      //     the 2026-05-19 RA 10173 lock — signup still completes if
      //     it fails;
      //   • sendEmail has a fallback ("check your email" redirect
      //     branch) if the auto-confirm path can't activate.
      //
      // The consent IIFE keeps poll → update sequential WITHIN itself
      // (the DB-trigger race against public.users row creation hasn't
      // gone away · we still need to wait for the row before UPDATEing
      // its column). The IIFE itself runs in parallel with the other
      // two operations.

      const accountKindLabel = accountType === 'vendor' ? 'vendor' : 'couple';
      const landingPath = accountType === 'vendor' ? '/vendor-dashboard' : '/dashboard';

      const consentPromise = publicSummaryConsent
        ? (async () => {
            // The DB trigger that creates public.users runs on a
            // separate connection from this admin write. If we race
            // the trigger the UPDATE hits zero rows and the consent
            // timestamp is silently dropped — bad for RA 10173 audit
            // trail. Poll briefly for the row to exist, then update.
            for (let attempt = 0; attempt < 5; attempt++) {
              const { data: row } = await admin
                .from('users')
                .select('user_id')
                .eq('user_id', userId)
                .maybeSingle();
              if (row) break;
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
            const { error: consentErr } = await admin
              .from('users')
              .update({ public_summary_consent_at: new Date().toISOString() })
              .eq('user_id', userId);
            if (consentErr) {
              console.warn(
                '[signup] public_summary_consent update failed:',
                consentErr.message,
              );
            }
          })()
        : Promise.resolve();

      const [updateResult, consentResult, emailResult] = await Promise.allSettled([
        admin.auth.admin.updateUserById(userId, { email_confirm: true }),
        consentPromise,
        sendEmail({
          to: email,
          subject: 'Welcome to Setnayan',
          text: [
            `Welcome to Setnayan.`,
            ``,
            `Your ${accountKindLabel} account is ready. Sign in here:`,
            `${appUrl}/login`,
            ``,
            `What's next:`,
            accountType === 'vendor'
              ? `• Open ${appUrl}${landingPath} and fill in your business profile — couples search by contact email to find you.`
              : `• Open ${appUrl}${landingPath} and create your event.`,
            ``,
            `Need help? ${appUrl}/help`,
            ``,
            `—`,
            `Set na 'yan.`,
          ].join('\n'),
        }),
      ]);

      // Per-operation observability (best-effort — none of these
      // block the redirect since allSettled never throws).
      if (updateResult.status === 'rejected') {
        console.warn('[signup] updateUserById failed:', updateResult.reason);
      }
      if (consentResult.status === 'rejected') {
        console.warn('[signup] consent IIFE threw:', consentResult.reason);
      }
      if (emailResult.status === 'rejected') {
        console.warn('[signup] welcome email failed:', emailResult.reason);
      }

      // updateUserById is the load-bearing operation for autoConfirmed —
      // if it failed, the user's email isn't confirmed yet and the
      // immediate-sign-in path would 401. Fall through to the legacy
      // "check your email" redirect branch.
      autoConfirmed = updateResult.status === 'fulfilled';
    } catch (err) {
      // Re-throw Next.js redirect/notFound control-flow errors so the caller
      // still navigates correctly. Anything else (admin env not configured,
      // createAdminClient throw, etc.) falls through to the legacy "check
      // your email" path so the user has a way forward.
      if (isRedirectError(err)) throw err;
    }
  }

  // Defensive cookie downgrade. signUp() may have set sb-* session cookies
  // when Supabase's email-confirm-required is off — honor the checkbox
  // before redirecting. When email-confirm is on (the more common config)
  // no session cookies were set and this is a no-op. Runs before either
  // redirect path so both autoConfirmed + check-email branches honor it.
  if (!remember) {
    const cookieStore = await cookies();
    downgradeSupabaseCookiesToSessionOnly(cookieStore);
  }

  if (autoConfirmed) {
    // 2026-05-30 perceived-signup-lag fix — pre-fix this was
    // `await captureEvent(...)` inside a try/catch with a comment
    // saying "analytics is fire-and-forget; never block the signup
    // redirect" — but the `await` blocked it for ~50-100ms anyway.
    // Honor the documented intent by NOT awaiting: the promise
    // continues executing in the Node server runtime background
    // after the redirect response is sent. `.catch()` swallows
    // any rejection so it doesn't become an unhandled-promise
    // warning. `void` discards the returned promise so TypeScript's
    // no-floating-promises rule stays satisfied.
    if (data.user?.id) {
      void captureEvent({
        distinctId: data.user.id,
        event: 'signup_completed',
        properties: { account_type: accountType },
      }).catch(() => {
        // Telemetry failure never blocks. Silent.
      });
    }
    return redirect(
      `/login?ready=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  }
  return redirect(
    `/login?check_email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
  );
}
