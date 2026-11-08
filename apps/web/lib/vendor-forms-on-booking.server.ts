import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { supplierQuestionsHref } from '@/lib/supplier-questions-href';
import { formsForBookedCards } from '@/lib/vendor-forms';
import { readBookedCardIds } from '@/lib/vendor-forms.server';

/**
 * 📋 A LINKED FORM REACHES THE COUPLE BY ITSELF WHEN THEY BOOK (THE ONE BUILD · C3 Forms; v111 item 18, owner verbatim
 * "Link to Service Card"; DECISION_LOG 2026-10-28 "Link to service card … sent automatically when they book").
 *
 * "Booked" = the deposit is confirmed — the app's booking moment (THE ONE BUILD §4 controller call, B2 Q5). So this
 * runs from ONE place: `runDepositAcknowledgedEffects` (`lib/deposit-acknowledged-effects.server.ts`, "THE ONE PLACE
 * THE DEPOSIT-ACKNOWLEDGED EFFECTS RUN", every door). `lib/forms-send-on-booking-from-every-door.test.ts` keeps it
 * there and nowhere else.
 *
 * • Idempotent: `event_form_sends` is keyed (event_id, form_id); a repeat call inserts nothing and tells nobody twice.
 * • A form already SENT by the supplier is left as it is (its row stays 'supplier').
 * • Retired forms are never sent (the trigger refuses them too).
 * • NEVER throws — the deposit already committed; this is news about it. The outcome is returned for the record.
 * • `admin` is the service role: the 'on_booking' lane is the service role's alone (RLS refuses it to a browser).
 */
export type FormsOnBookingOutcome =
  | { status: 'none' }
  | { status: 'sent'; formIds: string[] }
  | { status: 'error'; detail: string };

export async function sendLinkedFormsForBooking(
  admin: SupabaseClient,
  args: { eventVendorId: string; eventId: string },
): Promise<FormsOnBookingOutcome> {
  try {
    const { data: row, error } = await admin
      .from('event_vendors')
      .select('marketplace_vendor_id')
      .eq('vendor_id', args.eventVendorId)
      .maybeSingle();
    if (error) return { status: 'error', detail: `booking read failed: ${error.message}` };
    const shop = (row as { marketplace_vendor_id: string | null } | null)?.marketplace_vendor_id ?? null;
    if (!shop) return { status: 'none' }; // a couple's own hand-added supplier has no shop, so no library

    const booked = await readBookedCardIds(admin, args.eventId, shop);
    if (booked.status !== 'ok') return { status: 'error', detail: 'booked cards unreadable' };
    if (booked.cardIds.length === 0) return { status: 'none' };

    const [linksRes, formsRes, sentRes, threadRes, shopRes] = await Promise.all([
      admin.from('vendor_form_service_links').select('form_id, vendor_service_id').in('vendor_service_id', booked.cardIds),
      admin.from('vendor_forms').select('form_id, title').eq('vendor_profile_id', shop).is('retired_at', null),
      admin.from('event_form_sends').select('form_id').eq('event_id', args.eventId),
      admin.from('chat_threads').select('thread_id').eq('event_id', args.eventId).eq('vendor_profile_id', shop).maybeSingle(),
      admin.from('vendor_profiles').select('business_name').eq('vendor_profile_id', shop).maybeSingle(),
    ]);
    const err = linksRes.error ?? formsRes.error ?? sentRes.error ?? threadRes.error ?? shopRes.error;
    if (err) return { status: 'error', detail: err.message };

    const live = new Map(((formsRes.data ?? []) as { form_id: string; title: string }[]).map((f) => [f.form_id, f.title]));
    const already = new Set(((sentRes.data ?? []) as { form_id: string }[]).map((s) => s.form_id));
    const toSend = formsForBookedCards(
      (linksRes.data ?? []) as { form_id: string; vendor_service_id: string }[],
      booked.cardIds,
      new Set(live.keys()),
    ).filter((id) => !already.has(id));
    if (toSend.length === 0) return { status: 'none' };

    const threadId = (threadRes.data as { thread_id: string } | null)?.thread_id ?? null;
    const { data: inserted, error: insErr } = await admin
      .from('event_form_sends')
      .upsert(
        toSend.map((form_id) => ({
          event_id: args.eventId,
          form_id,
          vendor_profile_id: shop,
          thread_id: threadId,
          sent_by: 'on_booking',
        })),
        { onConflict: 'event_id,form_id', ignoreDuplicates: true },
      )
      .select('form_id');
    if (insErr) return { status: 'error', detail: insErr.message };
    const landed = ((inserted ?? []) as { form_id: string }[]).map((r) => r.form_id);
    const shopName = (shopRes.data as { business_name: string | null } | null)?.business_name ?? null;
    for (const formId of landed) {
      await notifyHostsOfForm({ eventId: args.eventId, threadId, shop, shopName, title: live.get(formId) ?? 'a form' });
    }
    return { status: 'sent', formIds: landed };
  } catch (e) {
    return { status: 'error', detail: e instanceof Error ? e.message : String(e) };
  }
}

/** In-app notice to the event's hosts that a form arrived (no email). Shared by Send to chat and the booking moment. Never throws. */
export async function notifyHostsOfForm(args: {
  eventId: string;
  threadId: string | null;
  shop: string;
  shopName: string | null;
  title: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const [{ data: members }, { data: booking }] = await Promise.all([
      admin.from('event_members').select('user_id').eq('event_id', args.eventId).eq('member_type', 'couple'),
      admin
        .from('event_vendors')
        .select('vendor_id')
        .eq('event_id', args.eventId)
        .eq('marketplace_vendor_id', args.shop)
        .limit(1)
        .maybeSingle(),
    ]);
    const evId = (booking as { vendor_id: string } | null)?.vendor_id ?? null;
    const relatedUrl = evId || args.threadId ? supplierQuestionsHref(args.eventId, evId, args.threadId ?? '') : null;
    const shopName = args.shopName?.trim() || 'Your supplier';
    for (const m of (members ?? []) as { user_id: string | null }[]) {
      if (!m.user_id) continue;
      await emitNotification({
        userId: m.user_id,
        type: 'supplier_questions_sent',
        title: `${shopName} sent you a form`,
        body: `“${args.title}” — answer it in your event. Only you and they read your answers.`,
        relatedUrl,
      });
    }
  } catch (e) {
    console.error('[vendor-forms] notice failed:', e);
  }
}
