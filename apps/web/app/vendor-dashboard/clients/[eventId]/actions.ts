'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { uploadPublicAsset } from '@/lib/storage';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * Vendor Suggest flow on the shared day-of timeline — feature-access program
 * Phase 3 (corpus 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md
 * § 4). Vendors PROPOSE changes; the couple (or a delegate with schedule
 * edit) approves or declines on the couple's Schedule page. No direct vendor
 * writes to event_schedule_blocks — RLS enforces the booked gate + own-org
 * authorship on the suggestion row itself.
 */

function nullIfBlank(raw: FormDataEntryValue | null, max = 200): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function parseDatetimeLocal(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Vendor-side completion handshake (Event Lifecycle Menu §6.1, step 1). The
 * vendor marks their service complete → the couple is asked to confirm receipt
 * (which unlocks the review + galleries; a 7-day silence auto-confirms). Verifies
 * the caller's vendor profile owns the event_vendors row, writes via the admin
 * client (the completion columns have no vendor-update RLS path), idempotent, and
 * notifies the couple best-effort.
 */
export async function vendorMarkServiceComplete(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string') throw new Error('Invalid input');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from('event_vendors')
    .select('vendor_id, vendor_name, completion_status, service_marked_complete_at')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!ev) redirect(`/vendor-dashboard/clients/${eventId}`);

  if (!ev.service_marked_complete_at && ev.completion_status !== 'confirmed') {
    await admin
      .from('event_vendors')
      .update({
        service_marked_complete_at: new Date().toISOString(),
        completion_status: 'vendor_marked',
      })
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', profile.vendor_profile_id)
      .is('service_marked_complete_at', null);

    const { data: couple } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple')
      .maybeSingle();
    if (couple?.user_id) {
      await emitNotification({
        userId: couple.user_id,
        type: 'review_request',
        title: `${ev.vendor_name ?? 'Your vendor'} marked their service complete`,
        body: 'Confirm you received everything to unlock your review and galleries.',
        relatedUrl: `/dashboard/${eventId}/vendors/${ev.vendor_id}/review`,
      });
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(`/vendor-dashboard/clients/${eventId}?completed=1`);
}

/**
 * Vendor-side deposit acknowledgement (Deposit Reservation Lock-Free · Wave 3).
 * The couple recorded a deposit off-platform and the date is held; the vendor
 * confirms "deposit received" here. Single-winner + idempotent serialization
 * lives in the acknowledge_vendor_deposit SECURITY DEFINER RPC (SELECT … FOR
 * UPDATE + deposit_acknowledged_at-IS-NULL precondition), which also enforces
 * ownership (current_vendor_event_vendor_ids / is_admin) — so we forward
 * directly under the vendor's own RLS client. No money moves: acknowledge is a
 * signal, Setnayan never holds funds. Notifies the couple best-effort.
 */
export async function vendorAcknowledgeDeposit(formData: FormData) {
  const eventId = formData.get('event_id');
  const eventVendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || typeof eventVendorId !== 'string') {
    throw new Error('Invalid input');
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('acknowledge_vendor_deposit', {
    p_event_vendor_id: eventVendorId,
  });

  // Notify the couple only on a fresh acknowledgement (status 'ok'); a re-call
  // ('already') stays silent. Best-effort — never blocks the ack itself.
  const env = (data ?? {}) as { status?: string };
  if (!error && env.status === 'ok') {
    try {
      const admin = createAdminClient();
      const { data: ev } = await admin
        .from('event_vendors')
        .select('vendor_name')
        .eq('vendor_id', eventVendorId)
        .maybeSingle();
      const vendorName = (ev as { vendor_name?: string } | null)?.vendor_name ?? 'Your vendor';
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of members ?? []) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'payment_confirmed',
          title: `${vendorName} confirmed your deposit`,
          body: 'Your date is locked in — the vendor confirmed they received your deposit.',
          relatedUrl: `/dashboard/${eventId}/vendors/${eventVendorId}/workspace`,
        });
      }
    } catch (e) {
      console.error('[vendorAcknowledgeDeposit] couple notify failed:', e);
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  const flag = error ? 'error' : env.status ?? 'ok';
  redirect(`/vendor-dashboard/clients/${eventId}?deposit_ack=${flag}`);
}

export async function suggestScheduleChange(formData: FormData) {
  const eventId = formData.get('event_id');
  const note = formData.get('note');
  if (typeof eventId !== 'string' || typeof note !== 'string' || note.trim().length === 0) {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const blockId = nullIfBlank(formData.get('block_id'), 64);

  // RLS enforces: booked on the event, own org, own user, status open.
  const { error } = await supabase.from('event_schedule_suggestions').insert({
    event_id: eventId,
    block_id: blockId,
    vendor_profile_id: profile.vendor_profile_id,
    suggested_by_user_id: user.id,
    suggested_by_name: profile.business_name ?? null,
    kind: blockId ? 'adjust' : 'new',
    proposed_label: nullIfBlank(formData.get('proposed_label'), 120),
    proposed_start_at: parseDatetimeLocal(formData.get('proposed_start_at')),
    proposed_end_at: parseDatetimeLocal(formData.get('proposed_end_at')),
    proposed_location: nullIfBlank(formData.get('proposed_location'), 200),
    note: (note as string).trim().slice(0, 1000),
    status: 'open',
  });

  // Notify every couple member that a timeline suggestion is waiting for their
  // okay (best-effort — never block the suggestion). event_schedule_suggestions
  // is a vendor write the couple has no read-push for, so without this the
  // proposal lands silently on the couple's Schedule page. Uses the admin
  // client to fan out over event_members without leaking the vendor's scope.
  if (!error) {
    try {
      const admin = createAdminClient();
      const vendorName = profile.business_name?.trim() || 'A vendor';
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of members ?? []) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'schedule_suggestion',
          title: `${vendorName} suggested a timeline change`,
          body: (note as string).trim().slice(0, 200),
          relatedUrl: `/dashboard/${eventId}/schedule`,
        });
      }
    } catch (e) {
      console.error('[suggestScheduleChange] couple notify failed:', e);
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(
    `/vendor-dashboard/clients/${eventId}?suggest=${error ? 'error' : 'sent'}`,
  );
}

// ==========================================================================
// Delivery Handover (Wave 4) — VENDOR side.
//
// The vendor posts a deliverable on a booked event: a gallery link (external —
// big galleries stay Drive/Pixieset, never proxied), a small proof/sample image
// (uploaded to R2 via uploadPublicAsset — R2 is the record), a note, or a
// closing sign-off. RLS-gated insert (booked event ∩ own profile ∩
// status='delivered'). The couple confirms receipt via the single-winner
// acknowledge_handover RPC on their workspace; on acknowledge the booking can
// advance to 'delivered' (reusing the existing review-request emit). No money.
// ==========================================================================

/**
 * vendorPostHandover — VENDOR posts a delivery handover on a booked event.
 *
 * Resolves the booked event_vendors row (vendor_id) for the denormalized
 * columns, builds the payload per `kind` (gallery_link → URL, file → R2 image
 * upload, note/signoff → text), inserts the RLS-gated row, and notifies the
 * couple best-effort. Vendors never write the couple's data directly — a
 * handover is a row they own; the couple acknowledges it.
 */
export async function vendorPostHandover(formData: FormData) {
  const eventId = formData.get('event_id');
  const kindRaw = formData.get('kind');
  const kind =
    kindRaw === 'gallery_link' || kindRaw === 'file' || kindRaw === 'note' || kindRaw === 'signoff'
      ? kindRaw
      : null;
  if (typeof eventId !== 'string' || !kind) {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Resolve THIS org's booking (event_vendors.vendor_id) — RLS already scopes
  // vendor reads to their own bookings — for the denormalized event_vendor_id.
  const { data: ev } = await supabase
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', profile.vendor_profile_id)
    .maybeSingle();
  const eventVendorId = (ev as { vendor_id?: string } | null)?.vendor_id ?? null;
  if (!eventVendorId) {
    redirect(`/vendor-dashboard/clients/${eventId}?handover=error`);
  }

  const label = nullIfBlank(formData.get('label'), 200);

  // Build the payload per kind. gallery_link / note / signoff are text; file is
  // an R2 upload (small proof/sample image only — large galleries stay links).
  let payload: string | null = null;
  if (kind === 'gallery_link') {
    const url = nullIfBlank(formData.get('payload'), 4000);
    if (!url || !/^https?:\/\//i.test(url)) {
      redirect(`/vendor-dashboard/clients/${eventId}?handover=badurl`);
    }
    payload = url;
  } else if (kind === 'file') {
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      redirect(`/vendor-dashboard/clients/${eventId}?handover=nofile`);
    }
    const up = await uploadPublicAsset({
      pathPrefix: `handovers/${eventId}`,
      file: file as File,
    });
    if (!up.ok) {
      redirect(`/vendor-dashboard/clients/${eventId}?handover=upload`);
    }
    payload = up.publicUrl;
  } else {
    // note / signoff — free text (signoff text optional).
    payload = nullIfBlank(formData.get('payload'), 4000);
    if (kind === 'note' && !payload) {
      redirect(`/vendor-dashboard/clients/${eventId}?handover=empty`);
    }
  }

  // RLS enforces: booked on the event, own profile, status='delivered'.
  const { error } = await supabase.from('booking_handovers').insert({
    event_vendor_id: eventVendorId,
    event_id: eventId,
    vendor_profile_id: profile.vendor_profile_id,
    kind,
    label,
    payload,
    status: 'delivered',
  });

  // Notify the couple a delivery is waiting for their confirmation (best-effort).
  // Reuses the schedule_suggestion notification type — the same generic
  // "vendor posted something, open the workspace" nudge the change-order flow
  // uses — pointed at the couple's vendor workspace.
  if (!error) {
    try {
      const admin = createAdminClient();
      const vendorName = profile.business_name?.trim() || 'A vendor';
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of members ?? []) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'schedule_suggestion',
          title: `${vendorName} delivered your handover`,
          body: `${label ? `${label.slice(0, 100)} — ` : ''}open the vendor to confirm receipt.`,
          relatedUrl: `/dashboard/${eventId}/vendors/${eventVendorId}/workspace`,
        });
      }
    } catch (e) {
      console.error('[vendorPostHandover] couple notify failed:', e);
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(`/vendor-dashboard/clients/${eventId}?handover=${error ? 'error' : 'sent'}`);
}

// ==========================================================================
// Change-Order Trail (Wave 3) — VENDOR side.
//
// The both-acknowledged add-on/removal log, sitting beside the Suggest flow.
// A change order is a propose → accept/decline/withdraw STATE MACHINE on a ROW
// (vendor_change_orders) — NEVER a 2-way write into the couple's data. The
// vendor raises a vendor-side order (RLS-gated insert), and accepts/declines a
// COUPLE-raised order via the single-winner accept/decline RPCs (which also
// enforce ownership and, on accept, settle the delta into the budget ledger).
//
// OFF-PLATFORM MONEY / 0% COMMISSION: delta_amount_php is a vendor-entered PHP
// figure (signed: +add-on / −removal). No money moves through Setnayan.
// ==========================================================================

function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * vendorRaiseChangeOrder — the vendor proposes a mid-plan add-on or removal.
 *
 * Inserts a `proposed` vendor_change_orders row (RLS-gated: booked on the
 * event + own vendor profile + raised_by='vendor' + proposed_by_user_id=
 * auth.uid()). The couple accepts/declines on their workspace; only on ACCEPT
 * does the RPC settle the delta into the budget ledger. Notifies the couple.
 */
export async function vendorRaiseChangeOrder(formData: FormData) {
  const eventId = formData.get('event_id');
  const title = formData.get('title');
  if (typeof eventId !== 'string' || typeof title !== 'string' || title.trim().length === 0) {
    redirect('/vendor-dashboard/clients');
  }
  const magnitude = parseAmount(formData.get('amount_php'));
  if (magnitude === null) {
    redirect(`/vendor-dashboard/clients/${eventId}?change_order=error`);
  }
  const isRemoval = formData.get('change_kind') === 'removal';
  const delta = isRemoval ? -magnitude : magnitude;
  const dueRaw = formData.get('proposed_due_date');
  const dueDate = typeof dueRaw === 'string' && dueRaw.length > 0 ? dueRaw : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Resolve THIS org's booking (event_vendors.vendor_id) on this event. RLS on
  // event_vendors already scopes vendor reads to their own bookings.
  const { data: ev } = await supabase
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', profile.vendor_profile_id)
    .maybeSingle();
  const eventVendorId = (ev as { vendor_id?: string } | null)?.vendor_id ?? null;
  if (!eventVendorId) {
    redirect(`/vendor-dashboard/clients/${eventId}?change_order=error`);
  }

  // RLS enforces: booked on the event, own profile, raised_by='vendor',
  // proposer=auth.uid(), status='proposed'.
  const { error } = await supabase.from('vendor_change_orders').insert({
    event_vendor_id: eventVendorId,
    event_id: eventId,
    vendor_profile_id: profile.vendor_profile_id,
    raised_by: 'vendor',
    title: (title as string).trim().slice(0, 120),
    description: nullIfBlank(formData.get('description'), 2000),
    delta_amount_php: delta,
    proposed_due_date: dueDate,
    status: 'proposed',
    proposed_by_user_id: user.id,
  });

  // Notify the couple a change order awaits their okay (best-effort).
  if (!error) {
    try {
      const admin = createAdminClient();
      const vendorName = profile.business_name?.trim() || 'A vendor';
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of members ?? []) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'schedule_suggestion',
          title: `${vendorName} proposed a change order`,
          body: `${(title as string).trim().slice(0, 120)} — open the vendor to accept or decline.`,
          relatedUrl: `/dashboard/${eventId}/vendors/${eventVendorId}/workspace`,
        });
      }
    } catch (e) {
      console.error('[vendorRaiseChangeOrder] couple notify failed:', e);
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(`/vendor-dashboard/clients/${eventId}?change_order=${error ? 'error' : 'sent'}`);
}

/**
 * vendorRespondChangeOrder — the vendor accepts/declines a COUPLE-raised order.
 *
 * Forwards to the single-winner accept_change_order / decline_change_order
 * SECURITY DEFINER RPCs (SELECT … FOR UPDATE + status=proposed precondition;
 * idempotent). Ownership (the vendor is the counterparty to a couple-raised
 * order) is enforced inside the RPC. On accept the RPC settles the delta into
 * event_vendor_line_items atomically. Notifies the couple best-effort.
 */
export async function vendorRespondChangeOrder(formData: FormData) {
  const eventId = formData.get('event_id');
  const changeOrderId = formData.get('change_order_id');
  const decision = formData.get('decision');
  if (
    typeof eventId !== 'string' ||
    typeof changeOrderId !== 'string' ||
    (decision !== 'accept' && decision !== 'decline')
  ) {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } =
    decision === 'accept'
      ? await supabase.rpc('accept_change_order', { p_change_order_id: changeOrderId })
      : await supabase.rpc('decline_change_order', {
          p_change_order_id: changeOrderId,
          p_reason: nullIfBlank(formData.get('reason'), 500),
        });
  const env = (data ?? {}) as { status?: string };

  // Notify the couple only on a fresh resolution (status 'ok'). Best-effort.
  if (!error && env.status === 'ok') {
    try {
      const admin = createAdminClient();
      const { data: co } = await admin
        .from('vendor_change_orders')
        .select('event_vendor_id, title')
        .eq('change_order_id', changeOrderId)
        .maybeSingle();
      const eventVendorId = (co as { event_vendor_id?: string } | null)?.event_vendor_id ?? null;
      const coTitle = (co as { title?: string } | null)?.title ?? 'Change order';
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of members ?? []) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'schedule_suggestion',
          title: decision === 'accept' ? 'Change order accepted' : 'Change order declined',
          body: `Your vendor ${decision === 'accept' ? 'accepted' : 'declined'} "${coTitle.slice(0, 80)}".`,
          relatedUrl: eventVendorId
            ? `/dashboard/${eventId}/vendors/${eventVendorId}/workspace`
            : `/dashboard/${eventId}/vendors`,
        });
      }
    } catch (e) {
      console.error('[vendorRespondChangeOrder] couple notify failed:', e);
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  const flag = error ? 'error' : env.status ?? 'ok';
  redirect(`/vendor-dashboard/clients/${eventId}?change_order_resp=${flag}`);
}

/**
 * vendorWithdrawChangeOrder — the vendor retracts their own proposed order.
 * Forwards to the single-winner withdraw_change_order RPC (idempotent).
 */
export async function vendorWithdrawChangeOrder(formData: FormData) {
  const eventId = formData.get('event_id');
  const changeOrderId = formData.get('change_order_id');
  if (typeof eventId !== 'string' || typeof changeOrderId !== 'string') {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('withdraw_change_order', {
    p_change_order_id: changeOrderId,
  });
  const env = (data ?? {}) as { status?: string };

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  const flag = error ? 'error' : env.status ?? 'ok';
  redirect(`/vendor-dashboard/clients/${eventId}?change_order_resp=${flag}`);
}
