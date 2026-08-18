'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';
import { isPasswordLeaked } from '@/lib/leaked-password';

/**
 * Set a password on a passwordless email-link account (Invite/Join v2). The
 * guest is already authenticated (they just clicked the magic link), so this is
 * a logged-in updateUser — not the recovery-token reset flow. Clearing
 * needs_password ensures they're never prompted again.
 */
export async function setPasswordAction(eventId: string, formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));
  const dest = next === '/' ? `/dashboard/${eventId}` : next;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/set-password`)}`);
  }

  // Match the signup minimum (8 chars).
  if (password.length < 8) {
    return redirect(
      `/join/${eventId}/set-password?next=${encodeURIComponent(dest)}&error=too_short`,
    );
  }

  // Same refusal as signup — a breached password is no safer because the person
  // arrived through an invitation.
  if ((await isPasswordLeaked(password)).leaked) {
    return redirect(
      `/join/${eventId}/set-password?next=${encodeURIComponent(dest)}&error=leaked`,
    );
  }

  const { error } = await supabase.auth.updateUser({
    password,
    data: { needs_password: false },
  });
  if (error) {
    return redirect(
      `/join/${eventId}/set-password?next=${encodeURIComponent(dest)}&error=failed`,
    );
  }

  return redirect(dest);
}
