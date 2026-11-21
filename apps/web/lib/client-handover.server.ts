import 'server-only';

/**
 * KEEP · GIVE · HANDLED BY ▾ — the writes behind the Clients Hand over mark (supplier roles d–h, #8013 (f)).
 *
 * Who handles a client is the server's column (browsers cannot write it — migration
 * `supplier_roles_one_client_one_account_manager`), so this resolves the caller's OWN seat in the thread's shop with the
 * service role, asks `lib/client-handover.ts` whether they may, and only then writes. Every change the client should
 * know about posts ONE Setnayan line in the same chat (drawing (h)).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { postThreadSystemLine } from '@/lib/chat-system-line.server';
import { handledByLine } from '@/lib/handled-by-lines';
import { memberChatName } from '@/lib/inquiry-routing.server';
import { handoverWrite, mayAnswerHandOver, mayMoveClient, type HandoverCaller, type HandoverOp } from '@/lib/client-handover';

export type HandoverResult = { ok: true } | { ok: false; message: string };

export async function callerIn(admin: SupabaseClient, shopId: string, userId: string): Promise<HandoverCaller | null> {
  const [{ data: shop }, { data: seat, error }] = await Promise.all([
    admin.from('vendor_profiles').select('user_id').eq('vendor_profile_id', shopId).maybeSingle(),
    admin
      .from('vendor_team_members')
      .select('vendor_team_member_id, duty, branch_id')
      .eq('vendor_profile_id', shopId)
      .eq('user_id', userId)
      .is('deactivated_at', null)
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) logQueryError('client-handover: caller seat', error, { shop: shopId }, 'graceful_degrade');
  const s = seat as { vendor_team_member_id: string; duty: string | null; branch_id: string | null } | null;
  if ((shop as { user_id: string } | null)?.user_id === userId) {
    return { memberId: s?.vendor_team_member_id ?? null, duty: 'shop_manager', branchId: null };
  }
  return s ? { memberId: s.vendor_team_member_id, duty: s.duty ?? '', branchId: s.branch_id } : null;
}

export async function answerClientHandling(
  admin: SupabaseClient,
  userId: string,
  input: { threadId: string; op: HandoverOp; moveTo: string | null },
): Promise<HandoverResult> {
  const { data: t, error } = await admin
    .from('chat_threads')
    .select('thread_id, event_id, vendor_profile_id, handled_by_member_id, hand_over_member_id')
    .eq('thread_id', input.threadId)
    .maybeSingle();
  if (error || !t) {
    if (error) logQueryError('client-handover: thread', error, { thread: input.threadId }, 'graceful_degrade');
    return { ok: false, message: 'That client could not be found.' };
  }
  const thread = t as { thread_id: string; event_id: string; vendor_profile_id: string; handled_by_member_id: string | null; hand_over_member_id: string | null };
  const caller = await callerIn(admin, thread.vendor_profile_id, userId);
  if (!caller) return { ok: false, message: 'Only this shop’s team can move a client.' };

  // The card's branch: the booking's card, else the Hand over card's pick — a branch is where the card is filed.
  const { data: ev } = await admin.from('event_vendors').select('service_id').eq('event_id', thread.event_id).eq('marketplace_vendor_id', thread.vendor_profile_id).not('service_id', 'is', null).limit(1).maybeSingle();
  const sid = (ev as { service_id: string | null } | null)?.service_id ?? null;
  const { data: card } = sid ? await admin.from('vendor_services').select('branch_id').eq('vendor_service_id', sid).maybeSingle() : { data: null };
  const branch = (card as { branch_id: string | null } | null)?.branch_id ?? null;

  const allowed = input.op === 'move' ? mayMoveClient(caller, branch) : mayAnswerHandOver(caller, thread.handled_by_member_id, branch);
  if (!allowed) return { ok: false, message: input.op === 'move' ? 'Only a Shop or Branch Manager can change who handles a client.' : 'Only the person who has this client, or a manager, can hand them over.' };

  if (input.op === 'move' && input.moveTo) {
    const { data: target } = await admin.from('vendor_team_members').select('vendor_team_member_id').eq('vendor_team_member_id', input.moveTo).eq('vendor_profile_id', thread.vendor_profile_id).is('deactivated_at', null).maybeSingle();
    if (!target) return { ok: false, message: 'That person isn’t active on this shop.' };
  }
  const w = handoverWrite(input.op, { handledBy: thread.handled_by_member_id, handOver: thread.hand_over_member_id }, input.moveTo);
  if (!w) return { ok: false, message: 'Nothing to change — someone may have moved this client already.' };

  const { error: upErr } = await admin
    .from('chat_threads')
    .update({ handled_by_member_id: w.handledBy, handled_by_set_at: new Date().toISOString(), hand_over_member_id: null, covering_member_id: null })
    .eq('thread_id', thread.thread_id);
  if (upErr) {
    logQueryError('client-handover: write', upErr, { thread: thread.thread_id }, 'graceful_degrade');
    return { ok: false, message: 'That change didn’t save. Try again.' };
  }
  if (w.tellClient && w.handledBy) {
    const who = await memberChatName(admin, thread.vendor_profile_id, w.handledBy);
    if (who) await postThreadSystemLine(admin, { eventId: thread.event_id, vendorProfileId: thread.vendor_profile_id, body: handledByLine({ kind: 'moved', who }) });
  }
  return { ok: true };
}
