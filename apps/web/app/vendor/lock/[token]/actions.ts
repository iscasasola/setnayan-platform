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
import { createAdminClient } from '@/lib/supabase/admin';

function backToLock(token: string, status: string): never {
  redirect(`/vendor/lock/${encodeURIComponent(token)}?status=${status}`);
}

/**
 * Copy the vendor's chosen template contract onto the couple's freshly-locked
 * booking (owner 2026-07: "pick a contract for this process"). Runs once, right
 * after a successful ('ok') claim — the single-use token guarantees no repeat.
 * Uses the admin client because the CLAIMER is the couple, who has no RLS write
 * path into vendor_contracts. Self-swallowing: a contract-copy hiccup must never
 * undo the (already-committed) lock. Reuses the same R2 file (no re-upload).
 */
async function materializeLockedContract(
  token: string,
  eventId: string,
  eventVendorId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: tok } = await admin
      .from('vendor_locked_qr_tokens')
      .select('source_contract_id, vendor_profile_id, created_by_user_id')
      .eq('token', token)
      .maybeSingle();
    const sourceContractId = (tok as { source_contract_id?: string } | null)?.source_contract_id;
    if (!tok || !sourceContractId) return;

    const { data: src } = await admin
      .from('vendor_contracts')
      .select('title, description, file_url, file_name, file_size_bytes, mime_type')
      .eq('contract_id', sourceContractId)
      .maybeSingle();
    if (!src) return;

    const t = tok as { vendor_profile_id: string; created_by_user_id: string };
    await admin.from('vendor_contracts').insert({
      vendor_profile_id: t.vendor_profile_id,
      event_id: eventId,
      event_vendor_id: eventVendorId,
      uploaded_by_user_id: t.created_by_user_id,
      ...(src as Record<string, unknown>),
      status: 'sent_for_signature',
      sent_for_signature_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[locked-qr] materializeLockedContract:', err);
  }
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

  const result = data as { status?: string; event_vendor_id?: string } | null;
  const verdict = result?.status ?? 'error';
  if (verdict === 'ok' || verdict === 'already_claimed') {
    // First successful claim materializes the chosen contract onto the booking.
    if (verdict === 'ok' && result?.event_vendor_id) {
      await materializeLockedContract(token, eventId, result.event_vendor_id);
    }
    revalidatePath(`/dashboard/${eventId}/vendors`);
    redirect(`/dashboard/${eventId}/vendors?locked=1`);
  }
  // taken | void | invalid | not_your_event | unauthenticated
  backToLock(token, verdict);
}
