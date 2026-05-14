'use server';

import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { isEmailBlacklisted } from '@/lib/blacklist';

function safeNext(raw: FormDataEntryValue | null): string {
  const value = raw ? String(raw) : '';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function parseAccountType(raw: FormDataEntryValue | null): 'customer' | 'vendor' {
  const value = raw ? String(raw) : '';
  return value === 'vendor' ? 'vendor' : 'customer';
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const accountType = parseAccountType(formData.get('account_type'));
  const next = safeNext(formData.get('next'));

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
    return redirect(
      `/login?ready=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
    );
  }
  return redirect(
    `/login?check_email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
  );
}
