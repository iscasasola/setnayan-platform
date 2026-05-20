'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  if (!email || !password) {
    return redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  return redirect(next);
}

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const next = safeNext(formData.get('next'));
  if (!email) {
    return redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    return redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  return redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
}
