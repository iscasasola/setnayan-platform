'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
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

  return redirect(
    `/login?check_email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`,
  );
}
