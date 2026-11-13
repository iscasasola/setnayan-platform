'use server';

/**
 * The HOST's side of the access conversation (owner ruling 2026-07-27).
 *
 * The host answers LINE BY LINE — a partial yes is a first-class outcome, not
 * a rounding error. Granting writes the mechanism that already ships:
 * `event_moderators.permissions_json.areas`, which every gated feature already
 * reads through `moderator_area_level`. Nothing new decides access.
 *
 * ✋ WIDENED 8 Nov 2026 (owner: *"only coordinator and hosts has the final say"*): the BOOKED COORDINATOR answers a
 * non-coordinator supplier's ask too — from their client page, through this same action. Still never their own: a
 * coordinator's ask is the hosts' alone, and `answer_area_access_request` refuses anybody answering their own ask.
 *
 * ⚠ CORRECTED 2026-09-09 — this paragraph named the wrong function, and the one
 * it named is the dangerous one. `event_access_requests_host_answer` is scoped
 * to `current_couple_event_ids()` (member_type = 'couple'). It is
 * `current_event_ids()` that has NO member_type filter and admits a GUEST who
 * merely scanned the event QR. The intent here was always right; the helper
 * quoted for it was not, and a reader repairing the sibling table would have
 * copied the wrong one straight into a policy. Read the object, never the
 * comment.
 */

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AreaVerdict } from '@/lib/floor-command';
import { COORDINATOR_AREAS } from '@/lib/delegate-areas';
import { DELEGATE_AREAS, PERMISSION_TEMPLATES, type DelegateArea } from '@/lib/event-moderators';
import { accessAnswerNotice, areaAnswerRefusal } from '@/lib/access-answer-notice';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { mintBookingFeeForBooking } from '@/lib/booking-fee-mint.server';
import { emitNotification } from '@/lib/notification-emit';
import { foundYouLeadNotice, readFoundYou } from '@/lib/found-you';
import { claimAnswerNotice } from '@/lib/claim-access-wait';
import { correctionsNotice, supplierCorrections } from '@/lib/supplier-corrections';
import { deliverPurchaseChange, withdrawStagedPurchaseChange } from '@/lib/supplier-purchase-change.server';

export type AnswerResult = { ok: boolean; error?: string };

function isArea(v: string): v is DelegateArea {
  return (DELEGATE_AREAS as readonly string[]).includes(v);
}

/**
 * Answer one request. `verdicts` maps each requested area to granted/declined;
 * anything left untouched stays unanswered and is simply not granted.
 *
 * The grant and the record are ONE transaction since 8 Nov 2026
 * (`answer_area_access_request`): the seat is merged — never replaced — and the
 * ask is marked answered in the same statement, so a refused grant never reads
 * as answered and an answered ask never lacks its grant.
 */
export async function answerAccessRequest(
  eventId: string,
  requestId: string,
  verdicts: Record<string, AreaVerdict>,
): Promise<AnswerResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, null);
  if (helperRefusal) return { ok: false, error: helperRefusal };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: reqRow, error: reqErr } = await supabase
    .from('event_access_requests')
    .select('request_id, requester_user_id, requested_areas, status, kind')
    .eq('request_id', requestId)
    .eq('event_id', eventId)
    .maybeSingle();

  if (reqErr || !reqRow) return { ok: false, error: 'Could not find that request.' };
  const req = reqRow as {
    requester_user_id: string;
    requested_areas: string[];
    status: string;
    kind?: string | null;
  };
  if (req.status !== 'pending') return { ok: false, error: 'That request was already answered.' };
  // A supplier who joined from the couple's link is ONE Approve / Decline, not
  // line by line: `verdicts.access` carries it to `answerClaimAccess` below.
  // (The same exported action, not a second one — the server-action budget.)
  if (req.kind === 'claim') {
    const v = verdicts.access;
    if (v !== 'granted' && v !== 'declined') return { ok: false, error: 'Choose Approve or Decline.' };
    return answerClaimAccess(eventId, requestId, v === 'granted');
  }

  // 🤝 ONE ANSWER PATH, IN THE DATABASE (owner 8 Nov 2026: *"only coordinator and hosts has the final say"*).
  // `answer_area_access_request` decides WHO may answer (a host; the booked coordinator for a non-coordinator's ask;
  // never the asker), WHAT the coordinator may share (only a part they hold), and the LEVEL (`grantLevelFor`'s rule:
  // the booked coordinator → Edit, any other supplier → see and propose). It merges the seat after materialising its
  // areas — the 2026-08-25 lesson — in one transaction, so a refused grant never reads as answered.
  const asked = req.requested_areas.filter(isArea);
  const decisions: Partial<Record<DelegateArea, AreaVerdict>> = {};
  for (const area of asked) {
    const v = verdicts[area];
    if (v === 'granted' || v === 'declined') decisions[area] = v;
  }
  if (Object.keys(decisions).length === 0) {
    return { ok: false, error: 'Choose share or decline for at least one thing.' };
  }

  const { data: answered, error: answerErr } = await supabase.rpc('answer_area_access_request', {
    p_request_id: requestId,
    p_verdicts: decisions,
  });
  if (answerErr) {
    console.error('[supabase-error] access-requests/actions.ts · answer_area_access_request', answerErr.message, {
      event_id: eventId,
    });
    return { ok: false, error: areaAnswerRefusal(answerErr.message) };
  }

  // 📣 TELL THE SUPPLIER THE ANSWER — in the app only (`access_answered` is not on EMAIL_ENABLED_TYPES). Fail-soft:
  // the answer is committed.
  try {
    const admin = createAdminClient();
    const { data: ev } = await admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle();
    const notice = accessAnswerNotice({
      eventId,
      eventName: (ev as { display_name?: string | null } | null)?.display_name ?? null,
      decisions,
      askerIsCoordinator: (answered as { asker_is_coordinator?: boolean } | null)?.asker_is_coordinator === true,
    });
    await emitNotification({ userId: req.requester_user_id, type: 'access_answered', eventId, ...notice });
  } catch (e) {
    console.error('[access-requests] access answer notice failed:', e);
  }

  revalidatePath(`/dashboard/${eventId}/access-requests`);
  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  return { ok: true };
}

/**
 * 🤝 A SUPPLIER WHO JOINED FROM THE COUPLE'S LINK — Approve or Decline (owner
 * 2026-10-20: *"access to the event is automatic but has an approval. it should
 * proceed to that approval giving access once they sync."*).
 *
 * ONE answer, not line by line: what a supplier opens is set by their category
 * (DECISION_LOG 2026-10-07 — a coordinator is "Same access as you", every other
 * booked supplier "is defined depending on the category they provide"), so
 * there are no lines to choose.
 *
 * The couple's own session reads the ask first — `event_access_requests_host_read`
 * is couple-scoped, so a row that comes back IS the couple's — then the grant
 * runs in ONE transaction on the server (`answer_claim_access_request`, service
 * role), which checks the couple again and checks a real claim stands behind the
 * ask. Approve: the bond to the shop (merge-aware), booked-if-paid, a
 * coordinator's host-level seat. Decline: the answer, nothing else.
 */
async function answerClaimAccess(
  eventId: string,
  requestId: string,
  approve: boolean,
): Promise<AnswerResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: row, error: readErr } = await supabase
    .from('event_access_requests')
    .select('request_id, status, kind, requester_user_id, event_vendor_id, vendor_profile_id')
    .eq('request_id', requestId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (readErr || !row) return { ok: false, error: 'Could not find that request.' };
  const ask = row as {
    status: string;
    kind: string | null;
    requester_user_id: string | null;
    /** The couple's own record the supplier joined through — read BEFORE the approval re-points the ask. */
    event_vendor_id: string | null;
    vendor_profile_id: string | null;
  };
  if (ask.kind !== 'claim') return { ok: false, error: 'Could not find that request.' };
  if (ask.status !== 'pending') return { ok: false, error: 'That request was already answered.' };

  const admin = createAdminClient();
  const { data: answer, error } = await admin.rpc('answer_claim_access_request', {
    p_request_id: requestId,
    p_decided_by: user.id,
    p_approve: approve,
    // The grant every coordinator seat is created with (hosts/actions.ts
    // `inviteHost`): the external-planner template + COORDINATOR_AREAS.
    p_coordinator_permissions: {
      ...PERMISSION_TEMPLATES.wedding_planner_external,
      areas: { ...COORDINATOR_AREAS },
    },
  });
  if (error) {
    console.error('[supabase-error] access-requests/actions.ts · answer_claim_access_request', error.message, {
      event_id: eventId,
    });
    return {
      ok: false,
      error: approve
        ? 'We could not let them in just now. Nothing has changed. Please try again.'
        : 'We could not record that just now. Please try again.',
    };
  }

  // 💸 THE APPROVAL BOOKED THEM, SO IT MAKES THE FEE (supplier gate audit G4, 2026-11-02). Approve books the
  // couple's hand-added row (when it carried a payment) and links the shop — and no door made a charge for it, so
  // with "no charge" locking a booked shop, the supplier the couple had just let in found the event locked. The
  // ordinary rules decide the charge (`booking_fee_open_lock_charge`): a supplier the couple brought is
  // `waived_import`, nothing owed. Fail-soft: the approval is committed; the supplier's catch-up re-makes it.
  const result = (answer ?? {}) as { granted?: boolean; booked?: boolean; booking_vendor_id?: string | null };
  if (approve && result.granted && result.booked && result.booking_vendor_id) {
    try {
      await mintBookingFeeForBooking(admin, { eventVendorId: result.booking_vendor_id, door: 'claim_approved' });
    } catch (e) {
      console.error('[access-requests] claim approval fee mint failed:', e);
    }
  }

  // ✏️ THE COUPLE'S LIST TAKES THE SUPPLIER'S CORRECTIONS (DECISION_LOG 2026-11-07). Contact details only — a price
  // or a service on their purchase is never taken here (it reaches them as an amendment). Fail-soft: the approval is
  // committed; a missed comparison only loses the mark and the notice.
  if (approve && result.granted && ask.event_vendor_id && ask.vendor_profile_id) {
    try {
      await takeSupplierCorrections(admin, {
        eventId,
        requestId,
        recordVendorId: ask.event_vendor_id,
        shopId: ask.vendor_profile_id,
        bookingVendorId: result.booking_vendor_id ?? ask.event_vendor_id,
      });
    } catch (e) {
      console.error('[access-requests] claim corrections failed:', e);
    }
  }

  // 🧾 A PRICE OR SERVICE CHANGE ON THEIR PURCHASE IS THEIRS TO APPROVE (DECISION_LOG 2026-11-07). What the supplier
  // changed at the claim door was staged as the shipped amendment, on no conversation; Approve puts it in the couple's
  // chat as the amendment card (accept · counter · decline), Decline withdraws it. Their row keeps their price and
  // services until they accept. Fail-soft: the answer is committed; a missed delivery is logged and stays staged.
  if (ask.vendor_profile_id) {
    try {
      if (approve && result.granted) {
        const { data: shopRow } = await admin
          .from('vendor_profiles')
          .select('business_name')
          .eq('vendor_profile_id', ask.vendor_profile_id)
          .maybeSingle();
        await deliverPurchaseChange(admin, {
          eventId,
          shopId: ask.vendor_profile_id,
          bookingVendorId: result.booking_vendor_id ?? ask.event_vendor_id,
          shopName: (shopRow as { business_name?: string | null } | null)?.business_name ?? null,
        });
      } else if (!approve) {
        await withdrawStagedPurchaseChange(admin, { eventId, shopId: ask.vendor_profile_id });
      }
    } catch (e) {
      console.error('[access-requests] claim purchase change failed:', e);
    }
  }

  // 📣 TELL THE SUPPLIER THE ANSWER (audit G3). They were told at the claim that the couple must approve
  // (`/vendor-dashboard` "Waiting for … to let you in"); nothing told them when the couple did. In-app only —
  // `claim_access_answered` is not on EMAIL_ENABLED_TYPES (owner: no new emails without his word).
  if (ask.requester_user_id) {
    type EventFacts = { display_name?: string | null; event_type?: string | null; event_date?: string | null };
    let ev: EventFacts | null = null;
    try {
      const read = await admin.from('events').select('display_name, event_type, event_date').eq('event_id', eventId).maybeSingle();
      ev = (read.data as EventFacts | null) ?? null;
      const notice = claimAnswerNotice({ approved: approve, eventId, eventName: ev?.display_name ?? null });
      await emitNotification({ userId: ask.requester_user_id, type: 'claim_access_answered', eventId, ...notice });
    } catch (e) {
      console.error('[access-requests] claim answer notice failed:', e);
    }

    // 🕵️ FOUND-YOU LEAD ALERT (DECISION_LOG 2026-07-27 "CLAIM-SYNC is the authoritative checkpoint"). The Approve
    // above ran the found-check (`found_you_check_at_claim`) right after the bond: the couple had already opened
    // this shop on Setnayan before typing it in by hand. The supplier is told when and how often — data-minimal,
    // IN-APP ONLY (`found_you_lead` is not on EMAIL_ENABLED_TYPES). A supplier with no account before the record
    // is never found, so it is never sent one. The couple is not told anything about a fee (owner 2026-10-12).
    const found = approve && result.granted ? readFoundYou((answer as { found_you?: unknown } | null)?.found_you) : { found: false as const };
    if (found.found) {
      try {
        const lead = foundYouLeadNotice({
          eventId,
          eventName: ev?.display_name ?? null,
          eventType: ev?.event_type ?? null,
          eventDate: ev?.event_date ?? null,
          firstFoundAt: found.firstFoundAt,
          viewCount: found.viewCount,
        });
        await emitNotification({ userId: ask.requester_user_id, type: 'found_you_lead', eventId, ...lead });
      } catch (e) {
        console.error('[access-requests] found-you lead alert failed:', e);
      }
    }
  }

  revalidatePath(`/dashboard/${eventId}`, 'layout');
  return { ok: true };
}

/**
 * ✏️ WHAT THE SUPPLIER CORRECTED, KEPT ON THE ANSWERED ASK, AND TOLD TO THE COUPLE (DECISION_LOG 2026-11-07 — owner:
 * *"changing name or number, address, just gets notified"*).
 *
 * Compares the couple's own record — the row they added and their hand-typed card (`event_manual_vendors`), left exactly
 * as typed — with the shop the supplier corrected at the claim door (`vendor_profiles`, whichever door wrote it). The
 * difference lands on the ask (`decisions.updated`), which only this event's couple and the supplier can read: the
 * Suppliers page draws the shop's real name for that row and marks what changed (`lib/supplier-corrections.ts`).
 * NOTHING is written to `event_vendors` or `event_manual_vendors` — no price, no service, not even the name.
 * 📞 The new phone and address are kept IN FULL and shown to this couple (owner 2026-11-07: *"we are giving them more
 * freedom to talk outside since we already tracked them from our website"*) — the one surface the no-door-out guard
 * lets through by name (`lib/no-door-out-of-the-app.test.ts`).
 * Every couple member gets one in-app notice (`vendor_joined`, app-only; no email).
 */
async function takeSupplierCorrections(
  admin: ReturnType<typeof createAdminClient>,
  args: { eventId: string; requestId: string; recordVendorId: string; shopId: string; bookingVendorId: string },
): Promise<void> {
  const [recordRes, shopRes, coupleRes] = await Promise.all([
    admin.from('event_vendors').select('vendor_name, contact_phone, manual_vendor_id').eq('vendor_id', args.recordVendorId).maybeSingle(),
    admin
      .from('vendor_profiles')
      .select('business_name, business_owner_name, contact_phone, hq_address')
      .eq('vendor_profile_id', args.shopId)
      .maybeSingle(),
    admin.from('event_members').select('user_id').eq('event_id', args.eventId).eq('member_type', 'couple'),
  ]);
  if (recordRes.error || shopRes.error || !recordRes.data || !shopRes.data) {
    console.error('[access-requests] claim corrections read refused', recordRes.error?.message, shopRes.error?.message);
    return;
  }
  const record = recordRes.data as { vendor_name: string | null; contact_phone: string | null; manual_vendor_id: string | null };
  const shop = shopRes.data as {
    business_name: string | null;
    business_owner_name: string | null;
    contact_phone: string | null;
    hq_address: string | null;
  };
  type Card = { business_name: string | null; contact_person: string | null; contact_number: string | null; address: string | null };
  let card: Card | null = null;
  if (record.manual_vendor_id) {
    const cardRes = await admin
      .from('event_manual_vendors')
      .select('business_name, contact_person, contact_number, address')
      .eq('manual_vendor_id', record.manual_vendor_id)
      .maybeSingle();
    // A refused card read must not pass for "they typed nothing" — every shop detail would read as a correction.
    if (cardRes.error) {
      console.error('[access-requests] claim corrections card read refused', cardRes.error.message);
      return;
    }
    card = (cardRes.data as Card | null) ?? null;
  }

  const corrections = supplierCorrections(
    {
      name: card?.business_name || record.vendor_name,
      person: card?.contact_person ?? null,
      phone: card?.contact_number || record.contact_phone,
      address: card?.address ?? null,
    },
    { name: shop.business_name, person: shop.business_owner_name, phone: shop.contact_phone, address: shop.hq_address },
  );
  const notice = correctionsNotice({
    eventId: args.eventId,
    eventVendorId: args.bookingVendorId,
    shopName: shop.business_name,
    corrections,
  });
  if (!notice) return;

  const { error: keepErr } = await admin
    .from('event_access_requests')
    .update({ decisions: { access: 'granted', updated: corrections } })
    .eq('request_id', args.requestId);
  if (keepErr) console.error('[access-requests] claim corrections not kept', keepErr.message);

  const couple = ((coupleRes.data ?? []) as { user_id: string | null }[]).map((m) => m.user_id).filter((u): u is string => !!u);
  await Promise.all(
    couple.map((userId) => emitNotification({ userId, type: 'vendor_joined', eventId: args.eventId, ...notice })),
  );
}
