'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { fetchReasonCodes } from '@/lib/inquiry-outcomes';

/**
 * recordInquiryOutcome — Won & Lost Reasons capture (Wave 6).
 *
 * The vendor self-reports how an inquiry ended: WON (booked them — a
 * SELF-REPORTED signal, NOT a verified on-platform payment; Setnayan settles
 * off-platform), LOST (picked someone else), or NO_RESPONSE (couple went
 * quiet). They optionally tag a reason from the admin-managed taxonomy
 * (inquiry_outcome_reason_codes) + a short note.
 *
 * One outcome per inquiry — anchored to the thread (chat_thread_id). The DB
 * unique index is on an EXPRESSION (vendor_profile_id, COALESCE(proposal,
 * thread)), which ON CONFLICT can't target by column list, so we do an explicit
 * select-then-update/insert: re-recording overwrites the existing row in place
 * rather than erroring on the unique index.
 *
 * THE REASON LIST IS NEVER HARDCODED. We read it from the taxonomy via
 * fetchReasonCodes both to populate the picker (in the thread page) AND to
 * validate the submitted code here, so a stale/removed code can't slip in.
 */
export async function recordInquiryOutcome(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const threadId = String(formData.get('thread_id') ?? '');
  const back = `/vendor-dashboard/messages/${threadId}`;

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) {
    redirect('/vendor-dashboard/messages');
  }

  const outcome = String(formData.get('outcome') ?? '');
  if (!['won', 'lost', 'no_response'].includes(outcome)) {
    redirect(`${back}?notice=outcome_invalid`);
  }

  // Validate the reason against the LIVE taxonomy — never a hardcoded list.
  // Empty reason ("no reason given") is allowed.
  const reasonRaw = String(formData.get('reason_code') ?? '').trim();
  let reasonCode: string | null = null;
  if (reasonRaw) {
    const codes = await fetchReasonCodes(supabase);
    const match = codes.find((c) => c.reasonCode === reasonRaw);
    if (!match) redirect(`${back}?notice=outcome_bad_reason`);
    reasonCode = match.reasonCode;
  }

  const noteRaw = String(formData.get('free_text') ?? '').trim();
  const freeText = noteRaw ? noteRaw.slice(0, 1000) : null;

  // One outcome per inquiry (thread anchor). The unique index is on an
  // expression, so we can't ON CONFLICT it by column list — explicit
  // select-then-update/insert instead. RLS insert/update/select all gate on
  // current_vendor_profile_ids(), so this only ever touches the vendor's own
  // rows even though we filter by id.
  const payload = {
    outcome,
    reason_code: reasonCode,
    free_text: freeText,
    recorded_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('inquiry_outcomes')
    .select('outcome_id')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('chat_thread_id', threadId)
    .is('vendor_proposal_id', null)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from('inquiry_outcomes')
        .update(payload)
        .eq('outcome_id', existing.outcome_id)
    : await supabase.from('inquiry_outcomes').insert({
        vendor_profile_id: profile.vendor_profile_id,
        chat_thread_id: threadId,
        ...payload,
      });

  if (error) {
    console.error('[recordInquiryOutcome] write failed', error.message);
    redirect(`${back}?notice=outcome_failed`);
  }

  revalidatePath(back);
  revalidatePath('/vendor-dashboard/messages');
  redirect(`${back}?notice=outcome_saved`);
}
