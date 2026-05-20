'use server';

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

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const accountType = parseAccountType(formData.get('account_type'));
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
    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });

      // Persist the Public Event Summary consent timestamp. The DB trigger
      // tied to auth.signUp creates the public.users row; we then UPDATE
      // public_summary_consent_at = NOW() when the couple opted in at
      // signup. Wrapped defensively — if the column or trigger isn't yet
      // applied in this env (pre-migration push) the signup flow still
      // succeeds and the consent can be captured later via the dashboard
      // privacy surface.
      if (publicSummaryConsent) {
        // The DB trigger that creates public.users runs on a separate
        // connection from this admin write. If we race the trigger
        // the UPDATE hits zero rows and the consent timestamp is
        // silently dropped — bad for RA 10173 audit trail. Poll
        // briefly for the row to exist, then update.
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: row } = await admin
            .from('users')
            .select('user_id')
            .eq('user_id', data.user.id)
            .maybeSingle();
          if (row) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        try {
          const { error: consentErr } = await admin
            .from('users')
            .update({ public_summary_consent_at: new Date().toISOString() })
            .eq('user_id', data.user.id);
          if (consentErr) {
            console.warn(
              '[signup] public_summary_consent update failed:',
              consentErr.message,
            );
          }
        } catch (err) {
          // Non-blocking: signup completes even if the consent write fails.
          console.warn('[signup] public_summary_consent update threw:', err);
        }
      }

      // Fire a welcome email if Resend is wired — best-effort, never blocks.
      const accountKindLabel = accountType === 'vendor' ? 'vendor' : 'couple';
      const landingPath = accountType === 'vendor' ? '/vendor-dashboard' : '/dashboard';
      await sendEmail({
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
      });

      autoConfirmed = true;
    } catch (err) {
      // Re-throw Next.js redirect/notFound control-flow errors so the caller
      // still navigates correctly. Anything else (admin env not configured,
      // Resend send error, etc.) falls through to the legacy "check your
      // email" path so the user has a way forward.
      if (isRedirectError(err)) throw err;
    }
  }

  if (autoConfirmed) {
    // Fire the funnel event before the redirect. Wrapped in its own
    // try/catch so a telemetry hiccup never escapes — and never trips
    // Next's isRedirectError handling on the way out.
    try {
      if (data.user?.id) {
        await captureEvent({
          distinctId: data.user.id,
          event: 'signup_completed',
          properties: { account_type: accountType },
        });
      }
    } catch {
      // analytics is fire-and-forget; never block the signup redirect.
    }
    return redirect(
      `/login?ready=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  }
  return redirect(
    `/login?check_email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
  );
}
