import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { emitNotification } from '@/lib/notification-emit';
import {
  hasPurchaseChange,
  purchaseChangeCardBody,
  purchaseChangeItems,
  purchaseChangeNote,
  purchaseChangeNotice,
  type PurchaseChange,
} from '@/lib/supplier-purchase-change';

/**
 * 🧾 THE I/O HALF OF `lib/supplier-purchase-change.ts` — a supplier's change to the couple's purchase reaches the couple
 * as the SHIPPED amendment (`proposal_amendments`), in two steps that follow the claim's own two steps:
 *
 *   1. STAGED at the claim finish (`app/open-shop/claim-actions.ts`), where the supplier states it: one `proposed`
 *      amendment, raised by the supplier, on the couple's record, with NO thread yet. Every reader of amendments is
 *      thread-scoped (the chat stream, the chat pins, the supplier's thread page), so a staged row is drawn nowhere —
 *      the supplier is not let in yet, and the couple has not been asked to let them in.
 *   2. DELIVERED at the couple's Approve (`answerClaimAccess`): the staged row is pointed at the row that now carries
 *      the booking and at the one conversation for (event, shop), its card is posted into that chat, and the couple is
 *      told. A Decline WITHDRAWS it — nothing was let in, so nothing is asked.
 *
 * Nothing here writes `event_vendors`: the couple's price and services stay theirs until they accept the card.
 * All writes run on the admin client: the supplier has no booked access to the event at step 1, and step 2 runs on the
 * couple's Approve, for the supplier. Fail-soft and logged at both steps — the claim and the approval are committed.
 */

type Admin = SupabaseClient;

/** A staged amendment: proposed, raised by the supplier, on no conversation yet. */
function staged(admin: Admin, eventId: string, shopId: string) {
  return admin
    .from('proposal_amendments')
    .select('amendment_id, proposed_by_user_id')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', shopId)
    .eq('raised_by', 'vendor')
    .eq('status', 'proposed')
    .is('thread_id', null);
}

async function withdrawStaged(admin: Admin, eventId: string, shopId: string, reason: string): Promise<void> {
  const { error } = await admin
    .from('proposal_amendments')
    .update({ status: 'withdrawn', decline_reason: reason.slice(0, 500), updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('vendor_profile_id', shopId)
    .eq('raised_by', 'vendor')
    .eq('status', 'proposed')
    .is('thread_id', null);
  if (error) console.error('[supabase-error] lib/supplier-purchase-change.server.ts · withdraw staged', error.message);
}

/**
 * Step 1 — stage the change the supplier stated on the claim door. A retried finish replaces what it staged before
 * (the earlier one is withdrawn), so the couple is only ever asked about the supplier's latest word. No change → nothing
 * staged (and an earlier staged one is withdrawn: the supplier put the couple's record back).
 */
export async function stagePurchaseChange(
  admin: Admin,
  args: { eventId: string; recordVendorId: string; shopId: string; supplierUserId: string; shopName: string | null; change: PurchaseChange },
): Promise<{ staged: boolean }> {
  await withdrawStaged(admin, args.eventId, args.shopId, 'Replaced by the supplier');
  if (!hasPurchaseChange(args.change)) return { staged: false };

  const { data, error } = await admin
    .from('proposal_amendments')
    .insert({
      event_id: args.eventId,
      event_vendor_id: args.recordVendorId,
      vendor_profile_id: args.shopId,
      thread_id: null,
      base_proposal_id: null,
      raised_by: 'vendor',
      proposed_by_user_id: args.supplierUserId,
      note: purchaseChangeNote(args.shopName),
      status: 'proposed',
    })
    .select('amendment_id')
    .maybeSingle();
  if (error || !data) {
    console.error('[supabase-error] lib/supplier-purchase-change.server.ts · from:proposal_amendments.insert', error?.message);
    return { staged: false };
  }
  const amendmentId = (data as { amendment_id: string }).amendment_id;
  const { error: itemsErr } = await admin.from('proposal_amendment_items').insert(
    purchaseChangeItems(args.change).map((it, idx) => ({
      amendment_id: amendmentId,
      event_id: args.eventId,
      vendor_profile_id: args.shopId,
      item_kind: it.kind,
      label: it.label,
      amount_php: it.amount_php,
      sort_order: idx,
    })),
  );
  if (itemsErr) {
    // An amendment with no lines would ask the couple to accept nothing — take it back rather than leave it.
    console.error('[supabase-error] lib/supplier-purchase-change.server.ts · from:proposal_amendment_items.insert', itemsErr.message);
    await withdrawStaged(admin, args.eventId, args.shopId, 'Could not record the change');
    return { staged: false };
  }
  return { staged: true };
}

/** Decline: the supplier was not let in, so the couple is not asked about their price either. */
export async function withdrawStagedPurchaseChange(admin: Admin, args: { eventId: string; shopId: string }): Promise<void> {
  await withdrawStaged(admin, args.eventId, args.shopId, 'The couple declined access');
}

/**
 * Step 2 — the couple let the supplier in: the staged change becomes the card in their one conversation, on the row
 * that now carries the booking. No staged change → nothing to do. No conversation → logged and left staged (never
 * reported as delivered): the chat is where the couple answers it.
 */
export async function deliverPurchaseChange(
  admin: Admin,
  args: { eventId: string; shopId: string; bookingVendorId: string | null; shopName: string | null },
): Promise<{ delivered: boolean }> {
  const { data: rows, error } = await staged(admin, args.eventId, args.shopId).order('created_at', { ascending: false }).limit(1);
  if (error) {
    console.error('[supabase-error] lib/supplier-purchase-change.server.ts · staged read', error.message);
    return { delivered: false };
  }
  const row = ((rows ?? []) as { amendment_id: string; proposed_by_user_id: string | null }[])[0];
  if (!row) return { delivered: false };

  const { data: thread, error: threadErr } = await admin
    .from('chat_threads')
    .select('thread_id')
    .eq('event_id', args.eventId)
    .eq('vendor_profile_id', args.shopId)
    .maybeSingle();
  const threadId = (thread as { thread_id?: string } | null)?.thread_id ?? null;
  if (threadErr || !threadId) {
    console.error('[supplier-purchase-change] no conversation to deliver the change into — left staged', threadErr?.message ?? 'no thread', {
      event_id: args.eventId,
    });
    return { delivered: false };
  }

  const { data: moved, error: moveErr } = await admin
    .from('proposal_amendments')
    .update({
      thread_id: threadId,
      // The row that carries the booking now (a merge may have moved it off the couple's record).
      ...(args.bookingVendorId ? { event_vendor_id: args.bookingVendorId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('amendment_id', row.amendment_id)
    .eq('status', 'proposed')
    .is('thread_id', null)
    .select('amendment_id');
  if (moveErr || !moved || moved.length === 0) {
    console.error('[supabase-error] lib/supplier-purchase-change.server.ts · attach to thread', moveErr?.message ?? 'not moved');
    return { delivered: false };
  }

  const { data: items } = await admin.from('proposal_amendment_items').select('item_id').eq('amendment_id', row.amendment_id);
  const n = (items ?? []).length;
  const { error: cardErr } = await admin.from('chat_messages').insert({
    thread_id: threadId,
    event_id: args.eventId,
    vendor_profile_id: args.shopId,
    // The supplier's own proposal — posted on their behalf on the service role, which keeps an explicit sender.
    sender_user_id: row.proposed_by_user_id,
    sender_role: 'vendor',
    body: purchaseChangeCardBody(n),
    amendment_id: row.amendment_id,
  });
  if (cardErr) console.error('[supabase-error] lib/supplier-purchase-change.server.ts · from:chat_messages.insert', cardErr.message);

  // 📣 The couple is told in the app (the same type the shipped amendment flow uses — no email).
  const { data: members } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', args.eventId)
    .eq('member_type', 'couple');
  const notice = purchaseChangeNotice({ eventId: args.eventId, threadId, shopName: args.shopName });
  await Promise.all(
    ((members ?? []) as { user_id: string | null }[])
      .map((m) => m.user_id)
      .filter((u): u is string => !!u)
      .map((userId) =>
        emitNotification({ userId, type: 'schedule_suggestion', eventId: args.eventId, ...notice }).catch((e: unknown) =>
          console.error('[supplier-purchase-change] couple notice failed:', e),
        ),
      ),
  );
  return { delivered: !cardErr };
}
