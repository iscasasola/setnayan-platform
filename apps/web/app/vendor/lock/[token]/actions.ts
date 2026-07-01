'use server';

/**
 * Locked QR claim. The couple, signed in, picks one of their events and the
 * single-use token is consumed by the atomic, race-safe vendor_claim_locked_qr()
 * RPC — which locks the vendor, freezes the payment plan, and records the
 * downpayment. See migration 20270414692373. On success the couple lands on that
 * event's vendors surface with the new booking already locked in.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function backToLock(token: string, status: string): never {
  redirect(`/vendor/lock/${encodeURIComponent(token)}?status=${status}`);
}

export async function claimLockedQr(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '').trim();
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!token) redirect('/');
  if (!eventId) backToLock(token, 'pick_event');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/signup?as=couple&next=${encodeURIComponent(`/vendor/lock/${token}`)}`);
  }

  const { data, error } = await supabase.rpc('vendor_claim_locked_qr', {
    p_token: token,
    p_event_id: eventId,
  });
  if (error) backToLock(token, 'error');

  const verdict = (data as { status?: string } | null)?.status ?? 'error';
  if (verdict === 'ok' || verdict === 'already_claimed') {
    revalidatePath(`/dashboard/${eventId}/vendors`);
    redirect(`/dashboard/${eventId}/vendors?locked=1`);
  }
  // taken | void | invalid | not_your_event | unauthenticated
  backToLock(token, verdict);
}
