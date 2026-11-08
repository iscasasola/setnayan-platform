'use server';

/**
 * ✍️ A SUPPLIER'S PROPOSED CHANGE — the ONE server action both sides call (owner 8 Nov 2026: *"only coordinator and
 * hosts has the final say. so any supplier that is not a coordinator still has to request a host or coordinator to
 * accept the change"*).
 *
 *   { op: 'propose' }  a booked supplier holding the part proposes a change to the guest list, the seat plan or the
 *                      suppliers; every host and the booked coordinator get one in-app notice (`change_requested`)
 *   { op: 'withdraw' } the supplier takes their own open change back
 *   { op: 'answer' }   a host or the booked coordinator Accepts (applied in place) or Declines; the supplier gets one
 *                      in-app notice (`change_answered`)
 *
 * 🔢 ONE EXPORT ON PURPOSE: every exported server action is a route and the repo budget
 * (`scripts/lint-server-action-budget.mjs`) sits at its ceiling.
 *
 * 🔑 Every rule is in SQL (migration 20271331202840): the INSERT policy (a booked supplier holding at least View on
 * the part, in their own name), the whitelist CHECK, and `answer_event_change_request` (who may answer, never the
 * proposer, applied in place in one transaction). Each op runs under the CALLER'S OWN session, so `auth.uid()` is the
 * person pressing. This file carries input and says the answer in words. In-app notices only — never email.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { eventFeeBlocksAction } from '@/lib/vendor-event-fee-access.server';
import { readBookedSupplierFacts } from '@/lib/booked-supplier-facts.server';
import { resolveAreaLevel, type ModeratorPermissions } from '@/lib/delegate-areas';
import {
  buildChange,
  changeAnswerRefusal,
  changeAnsweredNotice,
  changeRequestedNotice,
  type ChangeArea,
  type ProposeInput,
} from '@/lib/change-requests';

export type ChangeRequestOp =
  | { op: 'propose'; input: ProposeInput; note?: string | null }
  | { op: 'withdraw'; changeId: string }
  | { op: 'answer'; changeId: string; accept: boolean; note?: string | null };

export type ChangeRequestResult = { ok: boolean; error?: string; summary?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function touch(eventId: string): void {
  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/schedule`);
}

/** Every host, and every booked coordinator holding EDIT on the part — exactly the people who can answer. */
async function answerersOf(eventId: string, area: ChangeArea): Promise<string[]> {
  const admin = createAdminClient();
  const [couple, seats, suppliers] = await Promise.all([
    admin.from('event_members').select('user_id').eq('event_id', eventId).eq('member_type', 'couple'),
    admin
      .from('event_moderators')
      .select('user_id, permissions_json')
      .eq('event_id', eventId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null),
    readBookedSupplierFacts(admin, eventId),
  ]);
  if (couple.error) logQueryError('changeRequest.answerers.couple', couple.error, { eventId }, 'graceful_degrade');
  if (seats.error) logQueryError('changeRequest.answerers.seats', seats.error, { eventId }, 'graceful_degrade');
  const out = new Set<string>();
  for (const m of (couple.data ?? []) as { user_id: string | null }[]) if (m.user_id) out.add(m.user_id);
  for (const s of (seats.data ?? []) as { user_id: string | null; permissions_json: ModeratorPermissions | null }[]) {
    if (!s.user_id || !suppliers.get(s.user_id)?.bookedCoordinator) continue;
    if (resolveAreaLevel(s.permissions_json, area) === 'edit') out.add(s.user_id);
  }
  return [...out];
}

export async function changeRequestAction(eventId: string, req: ChangeRequestOp): Promise<ChangeRequestResult> {
  if (!UUID_RE.test(eventId)) return { ok: false, error: 'Could not find that event.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  if (req.op === 'propose') {
    const built = buildChange(req.input);
    if (!built.ok) return { ok: false, error: built.error };
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return { ok: false, error: 'No supplier profile.' };
    const feeBlocked = await eventFeeBlocksAction(profile.vendor_profile_id, eventId);
    if (feeBlocked) return { ok: false, error: feeBlocked };
    const note = req.note?.replace(/\s+/g, ' ').trim().slice(0, 240) || null;
    const { error } = await supabase.from('event_change_requests').insert({
      event_id: eventId,
      area: built.area,
      op: built.op,
      target_id: built.targetId,
      payload: built.payload,
      summary: built.summary,
      note,
      proposed_by_user_id: user.id,
      vendor_profile_id: profile.vendor_profile_id,
    });
    if (error) {
      logQueryError('changeRequest.propose', error, { eventId }, 'graceful_degrade');
      return {
        ok: false,
        error: /row-level security/i.test(error.message)
          ? 'You can only propose changes to a part the host shared with you.'
          : 'We could not send that just now. Nothing has changed. Please try again.',
      };
    }
    try {
      const notice = changeRequestedNotice({ eventId, supplierName: profile.business_name ?? null, summary: built.summary });
      for (const userId of await answerersOf(eventId, built.area)) {
        if (userId === user.id) continue;
        await emitNotification({ userId, type: 'change_requested', eventId, ...notice });
      }
    } catch (e) {
      console.error('[change-requests] propose notice failed:', e);
    }
    touch(eventId);
    return { ok: true, summary: built.summary };
  }

  if (!UUID_RE.test(req.changeId)) return { ok: false, error: 'Could not find that change.' };

  if (req.op === 'withdraw') {
    const { data, error } = await supabase
      .from('event_change_requests')
      .update({ status: 'withdrawn' })
      .eq('change_id', req.changeId)
      .eq('event_id', eventId)
      .eq('status', 'open')
      .select('change_id');
    // A refused or zero-row update is not a withdrawal — it is said, never shown as done.
    if (error || !data || data.length === 0) return { ok: false, error: 'That change was already answered.' };
    touch(eventId);
    return { ok: true };
  }

  const { data: answered, error } = await supabase.rpc('answer_event_change_request', {
    p_change_id: req.changeId,
    p_accept: req.accept,
    p_note: req.note?.replace(/\s+/g, ' ').trim().slice(0, 240) || null,
  });
  if (error) {
    logQueryError('changeRequest.answer', error, { eventId }, 'graceful_degrade');
    return { ok: false, error: changeAnswerRefusal(error.message) };
  }
  const result = (answered ?? {}) as { proposed_by_user_id?: string; summary?: string };
  try {
    if (result.proposed_by_user_id) {
      const { data: ev } = await createAdminClient().from('events').select('display_name').eq('event_id', eventId).maybeSingle();
      const notice = changeAnsweredNotice({
        eventId,
        accepted: req.accept,
        summary: result.summary ?? 'Your change',
        eventName: (ev as { display_name?: string | null } | null)?.display_name ?? null,
      });
      await emitNotification({ userId: result.proposed_by_user_id, type: 'change_answered', eventId, ...notice });
    }
  } catch (e) {
    console.error('[change-requests] answer notice failed:', e);
  }
  touch(eventId);
  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath(`/dashboard/${eventId}/seating`);
  revalidatePath(`/dashboard/${eventId}/vendors`);
  return { ok: true, summary: result.summary };
}
