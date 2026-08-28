'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { collectBookingFeeAtLock, resolveFeeAnchorRowId } from '@/lib/booking-fee-lock.server';
import { acquireSchedulePoolsForBooking } from '@/lib/schedule-pools';
import { emitNotification } from '@/lib/notification-emit';
import { narrowEventDateAfterAgreement } from '@/lib/date-narrowing.server';
import { formatCandidateDate } from '@/lib/candidate-dates';
import { uploadPublicAsset } from '@/lib/storage';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { createVendorChallenge } from '@/lib/papic-games';

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

    // ────────────────────────────────────────────────────────────────────
    // THE HANDSHAKE COMPLETES HERE (owner 2026-07-27, ruling 5 of 5).
    //
    // "when vendor accepts the payment, the schedule is now locked" — and the
    // vendor "will be billed for the syncing fee alongside accepting it". So
    // this single transition owns BOTH: the money and the reservation.
    //
    // Idempotency is FREE: `acknowledge_vendor_deposit` is single-winner and
    // returns status:'already' on re-call, so this block runs at most once per
    // booking. Everything inside is additionally fail-soft — the acknowledge
    // has already COMMITTED and must never roll back or throw before the
    // redirect below. A vendor's confirmation is not allowed to fail because a
    // fee or a pool row misbehaved.
    // ────────────────────────────────────────────────────────────────────
    {
      try {
        const admin = createAdminClient();

        // Resolve the MONEY ROW first. A package's cascade rows can reach this
        // path (nothing in the DB stops a covered row carrying deposit
        // markers), and billing one would freeze a ledger ordinal on a row that
        // must never carry money. NULL ⇒ bill nothing, acquire nothing.
        const anchorId = await resolveFeeAnchorRowId(admin, eventVendorId);

        if (anchorId && isBookingFeeEnabled()) {
          const fee = await collectBookingFeeAtLock(createMoneyWriterClient(), {
            eventVendorId: anchorId,
          });
          // `not_contracted` is the silent money leak: `recordDeposit` has no
          // status precondition, so a deposit recorded on a `considering` row
          // reaches acknowledge, the RPC skips it, and that booking is FREE
          // FOREVER — the ordinal is computed once and never recovers. It is
          // unreachable from today's call sites, which is exactly why it would
          // go unnoticed if it ever became reachable. Say so, loudly.
          if (fee.status === 'skipped' && fee.reason === 'not_contracted') {
            console.error(
              `[vendorAcknowledgeDeposit] BOOKING FEE SKIPPED as not_contracted — ` +
                `event_vendor_id=${anchorId} event_id=${eventId}. This booking can ` +
                `never be billed; the ledger ordinal is frozen. Investigate how a ` +
                `deposit was acknowledged on a pre-contracted row.`,
            );
          }
        }

        // Reserve the schedule. Acquiring on the ANCHOR (not the row we were
        // handed) is what stops a package double-consuming the vendor's daily
        // capacity: occupancy counts every `event_vendor_id <> ours`, so an
        // anchor-scoped acquire plus an earlier covered-row acquire would eat
        // two slots for one booking and tell a real second couple the date is
        // "fully booked". Re-acquiring the SAME id is idempotent.
        if (anchorId) {
          await acquireSchedulePoolsForBooking(admin, eventId, anchorId);
        }
      } catch (e) {
        console.error('[vendorAcknowledgeDeposit] fee/pool at acknowledge failed:', e);
      }
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  const flag = error ? 'error' : env.status ?? 'ok';
  redirect(`/vendor-dashboard/clients/${eventId}?deposit_ack=${flag}`);
}

/**
 * vendorRejectDeposit — VENDOR "I never received this downpayment".
 *
 * Calls the single-winner reject_vendor_deposit RPC. Ownership is enforced
 * inside the SECURITY DEFINER RPC, so this wrapper just forwards.
 *
 * 🛑 THIS DOCBLOCK USED TO SAY THE RPC "clears the couple-recorded deposit
 * markers so they must re-submit". THAT HAS BEEN FALSE SINCE PR #4927
 * (2026-08-27) and it is the sentence that made a whole session believe live
 * data was still being destroyed. The refusal is a MARK, not a deletion: the
 * couple keeps their amount, receipt, method and ledger row, and their card
 * quotes the supplier's words and offers "Send it again".
 * What the RPC does now: stamp the refusal, never un-lock the booking, refuse
 * to touch a confirmed deposit, and (2026-08-28) retire any earlier Setnayan
 * settlement so a fresh refusal is a fresh question for the admin queue.
 *
 * 2026-08-27 — REACHABLE FROM THE ANSWERS DESK (owner: "yes. they can declare
 * it."). The desk asked this money question and offered only YES; the NO lived
 * here, one screen away, so the answer was posted from the customer card or not
 * at all. `return_to` brings the supplier back to whichever surface they
 * answered on — an answer that silently moves you to another page reads like a
 * mis-press.
 * 🔒 THE POSTED VALUE IS NEVER USED AS A PATH. It selects one of two known
 * surfaces; anything else falls back to the customer card.
 */
export async function vendorRejectDeposit(formData: FormData) {
  const eventId = formData.get('event_id');
  const eventVendorId = formData.get('vendor_id');
  const reasonRaw = formData.get('reason');
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;
  if (typeof eventId !== 'string' || typeof eventVendorId !== 'string') {
    throw new Error('Invalid input');
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('reject_vendor_deposit', {
    p_event_vendor_id: eventVendorId,
    p_reason: reason,
  });

  // Notify the couple only on a fresh reject (status 'ok'). Best-effort.
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
          type: 'payment_rejected',
          title: `${vendorName} couldn't confirm your downpayment`,
          body: reason
            ? `Reason: “${reason}” — re-submit your downpayment proof from the vendor workspace.`
            : 'They couldn’t confirm the payment — re-submit your downpayment proof from the vendor workspace.',
          relatedUrl: `/dashboard/${eventId}/vendors/${eventVendorId}/workspace`,
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[vendorRejectDeposit] couple notify failed:', e);
    }
  }

  const flag = error ? 'error' : env.status ?? 'ok';
  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  if (formData.get('return_to') === '/vendor-dashboard') {
    revalidatePath('/vendor-dashboard');
    redirect(`/vendor-dashboard?deposit_answer=${flag}`);
  }
  redirect(`/vendor-dashboard/clients/${eventId}?deposit_reject=${flag}`);
}

// ==========================================================================
// Customer Card — private, team-shared CRM notes (vendor_client_notes).
//
// Design source: 03_Strategy/Customer_Card_Prototype_2026-07-03.html (Activity
// tab). vendor_client_notes is vendor-org-only RLS (current_vendor_profile_ids)
// with NO couple/admin policy — off-limits to hosts and to Setnayan HQ. All
// three actions run under the caller's OWN session (no admin client): the
// org-scoped RLS policy is the authorization boundary, so a plain insert /
// update / delete can only ever touch the caller's own org's rows. We resolve
// vendor_profile_id from the caller so the WITH CHECK passes; RLS rejects any
// cross-org write.
// ==========================================================================

/** Create a private note on this (vendor org, event) pair. */
export async function createClientNote(formData: FormData) {
  const eventId = formData.get('event_id');
  const body = formData.get('body');
  if (typeof eventId !== 'string' || typeof body !== 'string' || body.trim().length === 0) {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Optional follow-up reminder — a bare YYYY-MM-DD date or null.
  const remindRaw = formData.get('remind_at');
  const remindAt =
    typeof remindRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(remindRaw) ? remindRaw : null;

  // RLS (vendor_client_notes_org_all) enforces the org scope on WITH CHECK.
  await supabase.from('vendor_client_notes').insert({
    vendor_profile_id: profile.vendor_profile_id,
    event_id: eventId,
    author_user_id: user.id,
    body: (body as string).trim().slice(0, 2000),
    remind_at: remindAt,
  });

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(`/vendor-dashboard/clients/${eventId}?tab=activity`);
}

/** Toggle a note's done/reopened state. Team-shared: any org member may flip. */
export async function toggleClientNoteDone(formData: FormData) {
  const eventId = formData.get('event_id');
  const noteId = formData.get('note_id');
  const done = formData.get('done') === '1';
  if (typeof eventId !== 'string' || typeof noteId !== 'string') {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS scopes the UPDATE to the caller's own org's notes — no extra gate here.
  await supabase
    .from('vendor_client_notes')
    .update({ done_at: done ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('note_id', noteId);

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(`/vendor-dashboard/clients/${eventId}?tab=activity`);
}

/** Delete a private note. Team-shared: any org member may remove any org note. */
export async function deleteClientNote(formData: FormData) {
  const eventId = formData.get('event_id');
  const noteId = formData.get('note_id');
  if (typeof eventId !== 'string' || typeof noteId !== 'string') {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS scopes the DELETE to the caller's own org's notes.
  await supabase.from('vendor_client_notes').delete().eq('note_id', noteId);

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(`/vendor-dashboard/clients/${eventId}?tab=activity`);
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

/**
 * createVendorChallengeAction — Papic Games §3.4/§3.6: a booked Pro-and-up vendor
 * authors a custom Photo Challenge for this event. The RPC is the authoritative
 * gate (booked + Pro/Enterprise/Custom + copy bounds) and lands the mission
 * approved=false; the couple approves it on their Papic page. Mirrors
 * suggestScheduleChange (a vendor PROPOSES; the couple okays). Flag-gated in the
 * wrapper. (A couple notification would need a new NotificationType — deferred;
 * the couple sees pending challenges on their Papic studio page.)
 */
export async function createVendorChallengeAction(formData: FormData) {
  const eventId = formData.get('event_id');
  const prompt = formData.get('prompt');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof prompt !== 'string' ||
    prompt.trim().length === 0
  ) {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // The RPC is the authoritative gate (booked + Pro-and-up + copy bounds). On a
  // gate failure it no-ops and the challenge simply doesn't appear in the list;
  // the panel already shows the upsell to non-Pro vendors, so the common cases
  // never reach here. Feedback is the revalidated list (a new challenge appears).
  const res = await createVendorChallenge(supabase, {
    eventId,
    prompt: prompt.trim().slice(0, 280),
  });

  // On a successful submit, tell the couple a challenge is waiting for their okay
  // (gap #6 — otherwise a pending challenge stalls unseen behind the approval
  // panel). Best-effort fan-out over couple members via the admin client,
  // mirroring suggestScheduleChange. Only reached when the games flag is on
  // (createVendorChallenge no-ops with the flag off, so res.ok is false).
  if (res.ok) {
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
          type: 'papic_challenge_pending',
          title: `${vendorName} added a Papic Challenge`,
          body: 'Approve it to share it with your guests.',
          relatedUrl: `/dashboard/${eventId}/studio/papic`,
        });
      }
    } catch (e) {
      console.error('[createVendorChallengeAction] couple notify failed:', e);
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(`/vendor-dashboard/clients/${eventId}`);
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

  /*
    🔴 THIS READ WAS DEAD, AND SO WAS THE WHOLE ACTION. It ran on the vendor's
    own session under the comment "RLS already scopes vendor reads to their own
    bookings" — measured against production 2026-08-28, `event_vendors` carries
    four policies and NOT ONE admits a vendor, so the booked shop read 0 rows of
    its own booking and every delivery handover ever attempted bounced to
    `?handover=error`. Nothing threw: `maybeSingle()` on an RLS refusal returns
    `{ data: null }`, which is byte-identical to "you are not booked here".
    Now resolved by the shared helper, admin-scoped to the caller's OWN profile.
  */
  const eventVendorId = await resolveOwnBookingId(eventId, profile.vendor_profile_id);
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

  /*
    🔴 SAME DEAD READ AS `vendorPostHandover`, same false comment, same outcome:
    a supplier could never raise a change order — every attempt redirected
    `?change_order=error`. Two shipped features, one wrong sentence about RLS,
    and no symptom anywhere but a flag a person had to interpret. See
    `resolveOwnBookingId` for the measurement.
  */
  const eventVendorId = await resolveOwnBookingId(eventId, profile.vendor_profile_id);
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

/**
 * PR-H STEP 2 — the supplier answers.
 *
 * A couple pressing Lock now only ASKS (owner ruling 2026-07-27). These two
 * actions are the answer, and `vendor_agree_to_lock` is what actually creates
 * the booking: it writes `lock_request_state='agreed'` and `status='contracted'`
 * in one statement.
 *
 * 🔑 THE FORM CARRIES ONLY THE BOOKING ID, AND EVERY SIDE EFFECT KEYS ON THE
 * ENVELOPE'S `event_id` — NOT ON ANYTHING THE VENDOR POSTED.
 * `vendorAcknowledgeDeposit` above reads `event_id` from FormData, validates it
 * with `typeof === 'string'`, never cross-checks it against the booking, and
 * then aims an admin-client schedule write at it. That is a confused deputy, and
 * copying the shape here would have widened it: these actions notify a couple
 * and (from slice B) drive the post-lock effects. The RPCs return `event_id`
 * read off the row they authorized, so there is nothing to trust.
 * ⚠ Do not "simplify" this by taking event_id from the form to save a lookup.
 *
 * No TypeScript authorization re-check: the DEFINER RPC owns the gate
 * (`current_vendor_profile_ids`, plus an agent arm re-anchored to the org that
 * was actually asked), and a second check in TS would be a second answer to one
 * question.
 */
export async function vendorAgreeToLock(formData: FormData) {
  const eventVendorId = formData.get('vendor_id');
  if (typeof eventVendorId !== 'string') throw new Error('Invalid input');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('vendor_agree_to_lock', {
    p_event_vendor_id: eventVendorId,
  });
  const env = (data ?? {}) as { status?: string; event_id?: string; competing?: number };
  const eventId = typeof env.event_id === 'string' ? env.event_id : null;

  // Tell the couple, on a FRESH agreement only — a re-call ('already') stays
  // silent. Best-effort: the booking is already made and a notification hiccup
  // must never roll it back.
  if (!error && env.status === 'ok' && eventId) {
    try {
      const admin = createAdminClient();

      // ── THE DATE NARROWS HERE, NOT AT THE ASK (owner §6.1 · slice B) ──────
      // A couple with no wedding day yet carries CANDIDATE days; every supplier
      // they actually book removes the days that supplier cannot work, and when
      // one candidate is left, that is the date. Slice A deliberately SKIPPED
      // this at the couple's press — running it there would have pinned the
      // wedding date off a supplier who had agreed to nothing and could still
      // decline, and the date would have survived the decline. An AGREEMENT is
      // the event that legitimately narrows it, and this is that moment.
      //
      // Best-effort and ordered FIRST so the notification below can say what
      // happened: the booking is already committed by the RPC, and a failure to
      // narrow must never roll it back. `still_open` / `no_op` / `lost_race`
      // are all ordinary outcomes, not errors.
      let narrowedDate: string | null = null;
      try {
        const narrowed = await narrowEventDateAfterAgreement(admin, {
          eventId,
          forcedByEventVendorId: eventVendorId,
        });
        if (narrowed.status === 'locked') narrowedDate = narrowed.date;
      } catch (e) {
        console.error(
          `[vendorAgreeToLock] date narrowing failed for vendor_id=${eventVendorId}:`,
          e,
        );
      }

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
          type: 'lock_request_agreed',
          title: `${vendorName} said yes`,
          // 🗣 A DATE MUST NEVER APPEAR ON A COUPLE'S SCREEN WITHOUT THEM BEING
          // TOLD IT WAS SET. The narrowing writes their FINAL wedding day, so
          // the one message they are guaranteed to receive about this agreement
          // is the message that has to say so.
          body: narrowedDate
            ? `${vendorName} agreed to your booking. That leaves one day everyone you have booked can make, so your date is now ${formatCandidateDate(narrowedDate)}. They will send you their payment details next.`
            : `${vendorName} agreed to your booking. They will send you their payment details next.`,
          relatedUrl: `/dashboard/${eventId}/vendors/${eventVendorId}/workspace`,
        });
      }
    } catch (e) {
      console.error(
        `[vendorAgreeToLock] couple notify failed for vendor_id=${eventVendorId}:`,
        e,
      );
    }
  }

  revalidatePath('/vendor-dashboard');
  const flag = error ? 'error' : (env.status ?? 'ok');
  redirect(`/vendor-dashboard?lock_agree=${flag}`);
}

/**
 * The no — with the supplier's own words, which ARE persisted
 * (`lock_decline_reason`). Declining is also how a supplier clears the
 * `resolve_others_first` refusal on agree: the 2026-06-02 lock requires the
 * non-chosen couples to be told explicitly, never dropped silently.
 */
export async function vendorDeclineLock(formData: FormData) {
  const eventVendorId = formData.get('vendor_id');
  if (typeof eventVendorId !== 'string') throw new Error('Invalid input');
  const rawReason = formData.get('reason');
  const reason =
    typeof rawReason === 'string' && rawReason.trim() ? rawReason.trim().slice(0, 240) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('vendor_decline_lock', {
    p_event_vendor_id: eventVendorId,
    p_reason: reason,
  });
  const env = (data ?? {}) as { status?: string; event_id?: string };
  const eventId = typeof env.event_id === 'string' ? env.event_id : null;

  if (!error && env.status === 'ok' && eventId) {
    try {
      const admin = createAdminClient();
      const { data: ev } = await admin
        .from('event_vendors')
        .select('vendor_name')
        .eq('vendor_id', eventVendorId)
        .maybeSingle();
      const vendorName = (ev as { vendor_name?: string } | null)?.vendor_name ?? 'The vendor';
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of members ?? []) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id,
          type: 'lock_request_declined',
          title: `${vendorName} can't take this booking`,
          // The reason is the whole point of storing it — a refusal the couple
          // cannot read is not a refusal, it is a disappearance.
          body: reason
            ? `${vendorName} said: "${reason}" — you can pick someone else for this.`
            : `${vendorName} turned down this booking. You can pick someone else for this.`,
          relatedUrl: `/dashboard/${eventId}/vendors`,
        });
      }
    } catch (e) {
      console.error(
        `[vendorDeclineLock] couple notify failed for vendor_id=${eventVendorId}:`,
        e,
      );
    }
  }

  revalidatePath('/vendor-dashboard');
  const flag = error ? 'error' : (env.status ?? 'ok');
  redirect(`/vendor-dashboard?lock_decline=${flag}`);
}

/**
 * The supplier answers a deletion ask — agree, or decline with an optional
 * reason. Owner 2026-08-21: a celebration a supplier was PAID for cannot be
 * removed until they say so.
 *
 * ⚠ THE EVENT IS READ OFF THE ROW, NEVER FROM THE FORM. The RPC returns
 * `{ok, state}` and no event id, and the browser must not name which event this
 * answer belongs to — that is the couple's side of the fence. The row is fetched
 * by the `vendor_id` the RPC has already authorised.
 *
 * 🔑 `no_pending_request` DOES NOT MEAN "WITHDRAWN". The RPC returns it for
 * cancelled, agreed, declined AND never-asked alike. Mapping all four to "they
 * withdrew it" tells a supplier who double-tapped a lie, so the state is read
 * back and the four cases are told apart.
 */
async function answerDeletionRequest(formData: FormData, agree: boolean) {
  const eventVendorId = formData.get('vendor_id');
  if (typeof eventVendorId !== 'string') throw new Error('Invalid input');
  const reasonRaw = formData.get('reason');
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 240)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('vendor_answer_event_deletion', {
    p_event_vendor_id: eventVendorId,
    p_agree: agree,
    p_reason: reason,
  });

  if (error) {
    console.error('[deletion-answer] rpc failed', error);
    redirect('/vendor-dashboard?deletion=failed');
  }

  const env = (data ?? {}) as { ok?: boolean; reason?: string };
  if (env.ok !== true) {
    // Tell the four apart rather than guessing. The admin read is scoped to the
    // row the RPC already authorised this caller for.
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('event_vendors')
      .select('delete_request_state, event_id')
      .eq('vendor_id', eventVendorId)
      .maybeSingle();
    const state = (row?.delete_request_state as string | null) ?? null;
    const outcome =
      state === 'cancelled'
        ? 'withdrawn'
        : state === 'agreed' || state === 'declined'
          ? 'already'
          : 'failed';
    redirect(`/vendor-dashboard?deletion=${outcome}`);
  }

  /*
    Tell the COUPLE. Best-effort by contract: the answer is already recorded and
    a notification hiccup must never roll it back. The event id comes from the
    row, not the form.
  */
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('event_vendors')
    .select('event_id, vendor_name')
    .eq('vendor_id', eventVendorId)
    .maybeSingle();
  const eventId = (row?.event_id as string | null) ?? null;
  if (eventId) {
    try {
      const { data: couple } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      const name = (row?.vendor_name as string | null) ?? 'A supplier';
      for (const m of couple ?? []) {
        await emitNotification({
          userId: m.user_id as string,
          type: agree ? 'deletion_request_agreed' : 'deletion_request_declined',
          title: agree
            ? `${name} agreed to the removal`
            : `${name} would rather keep it for now`,
          body: agree
            ? 'You can remove this celebration now.'
            : reason ?? 'They did not give a reason.',
          relatedUrl: '/dashboard',
        });
      }
    } catch (err) {
      console.error('[deletion-answer] notify failed', err);
    }
  }

  revalidatePath('/vendor-dashboard');
  redirect(`/vendor-dashboard?deletion=${agree ? 'agreed' : 'declined'}`);
}

export async function vendorAgreeToDeletion(formData: FormData) {
  return answerDeletionRequest(formData, true);
}

export async function vendorDeclineDeletion(formData: FormData) {
  return answerDeletionRequest(formData, false);
}

// ==========================================================================
// ASK A BOOKED CUSTOMER FOR A PAYMENT (S4, 2026-08-28)
//
// The shop types an amount, what it is for, and optionally when it would like
// it. The couple is told and reads it on the same workspace card that already
// carries their deposit, plan and receipt. Nothing here moves money: the couple
// still pays the shop directly, off-platform, and the ledger is still the only
// record of what arrived.
//
// 🔑 THE INSERT GOES THROUGH THE CALLER'S OWN SESSION, ON PURPOSE. The fence is
// the RLS WITH CHECK on `vendor_payment_asks` (a confirmed booking of a profile
// this caller owns, `status='open'`, `asked_by_user_id = auth.uid()`), and the
// service-role client carries no user — writing through it would step outside
// every one of those rules while looking identical in the diff.
// ==========================================================================

/**
 * Resolve THIS shop's `event_vendors` row on an event, scoped by the caller's
 * own vendor_profile_id.
 *
 * 🔴 IT USES THE ADMIN CLIENT AND THAT IS NOT AN OPTIMISATION — IT IS THE ONLY
 * THING THAT WORKS. Measured against production (2026-08-28, in a rolled-back
 * transaction, as the shop's own authenticated role): `event_vendors` carries
 * FOUR policies — `couple_read`, `couple_write`, `moderator_read`,
 * `moderator_write` — and **not one of them admits a vendor**. The shop that is
 * genuinely booked on the one marketplace booking in production reads
 * **0 rows** of it through its own session.
 *
 * ⚠ TWO SHIPPED ACTIONS IN THIS FILE ALREADY DO IT THE OTHER WAY, EACH UNDER A
 * COMMENT ASSERTING THIS WORKS ("RLS already scopes vendor reads to their own
 * bookings"). It does not, and both are repaired to call this helper in the
 * same commit: `vendorPostHandover` (a supplier delivering a gallery link,
 * proof or sign-off) and `vendorRaiseChangeOrder` (a supplier proposing an
 * add-on) could NEVER resolve a booking, so both bounced to their own error
 * flag on every attempt, for every shop, always. Nothing threw and nothing
 * logged — `maybeSingle()` on an RLS refusal returns `{ data: null }`, byte for
 * byte what "this shop is not booked here" looks like. *An RLS denial and an
 * empty read are the same value.*
 *
 * The scoping is what keeps this safe: the id it filters on is the caller's own
 * profile, resolved from their session one line earlier, and the only column it
 * returns is the booking's primary key.
 */
async function resolveOwnBookingId(
  eventId: string,
  vendorProfileId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .maybeSingle();
  return (data as { vendor_id?: string } | null)?.vendor_id ?? null;
}

/**
 * vendorAskForPayment — "please send ₱X".
 *
 * Every refusal ends on a NAMED flag the page renders. A guard that refuses in
 * silence is indistinguishable from one that passed, and this one refuses for
 * four different reasons.
 */
export async function vendorAskForPayment(formData: FormData) {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    redirect('/vendor-dashboard/clients');
  }
  const amount = parseAmount(formData.get('amount_php'));
  if (amount === null) {
    redirect(`/vendor-dashboard/clients/${eventId}?tab=quote&ask=amount`);
  }
  const dueRaw = formData.get('due_date');
  const dueDate = typeof dueRaw === 'string' && dueRaw.length > 0 ? dueRaw : null;
  const note = nullIfBlank(formData.get('note'), 500);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const eventVendorId = await resolveOwnBookingId(eventId, profile.vendor_profile_id);
  if (!eventVendorId) {
    redirect(`/vendor-dashboard/clients/${eventId}?tab=quote&ask=notbooked`);
  }

  // RLS is the fence: confirmed booking ∩ own profile ∩ status='open' ∩
  // asked_by_user_id = auth.uid(). A shop that is merely in conversation is
  // refused HERE, not by a TypeScript check somebody could route around.
  const { error } = await supabase.from('vendor_payment_asks').insert({
    event_vendor_id: eventVendorId,
    event_id: eventId,
    vendor_profile_id: profile.vendor_profile_id,
    amount_php: amount,
    note,
    due_date: dueDate,
    status: 'open',
    asked_by_user_id: user.id,
  });

  if (!error) {
    try {
      const admin = createAdminClient();
      const shopName = profile.business_name?.trim() || 'Your supplier';
      const { data: members } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of members ?? []) {
        if (!m.user_id) continue;
        await emitNotification({
          userId: m.user_id as string,
          type: 'vendor_payment_asked',
          title: `${shopName} asked for a payment`,
          // The amount is the whole point of the message — a notice saying
          // "they asked for something" makes the reader open the page to find
          // out what, which is the shape this repo already fixed once on the
          // Papic studio banner that named no figure.
          body: note
            ? `₱${amount.toLocaleString('en-PH')} — ${note}`
            : `₱${amount.toLocaleString('en-PH')}`,
          relatedUrl: `/dashboard/${eventId}/vendors/${eventVendorId}/workspace`,
        });
      }
    } catch (e) {
      console.error('[vendorAskForPayment] couple notify failed:', e);
    }
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(
    `/vendor-dashboard/clients/${eventId}?tab=quote&ask=${error ? 'error' : 'sent'}`,
  );
}

/**
 * vendorWithdrawPaymentAsk — take it back.
 *
 * 🔑 THE INVERSE, SHIPPED WITH THE FORWARD PRIMITIVE. An ask is a sentence about
 * somebody's money; leaving it on their screen after it is settled or was a
 * mistake is the defect, not a missing nicety.
 *
 * Forwards to the single-winner SECURITY DEFINER RPC — the only writer of a
 * resolved state, since neither side holds an UPDATE policy or an UPDATE grant.
 * Called on the CALLER'S OWN SESSION: the RPC resolves ownership from
 * `auth.uid()`, which is NULL on the service-role client, so a service-role
 * call would refuse every withdrawal while looking finished.
 */
export async function vendorWithdrawPaymentAsk(formData: FormData) {
  const eventId = formData.get('event_id');
  const askId = formData.get('ask_id');
  if (typeof eventId !== 'string' || typeof askId !== 'string') {
    redirect('/vendor-dashboard/clients');
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('withdraw_vendor_payment_ask', {
    p_ask_id: askId,
  });
  const ok = !error && (data as { ok?: boolean } | null)?.ok === true;

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(
    `/vendor-dashboard/clients/${eventId}?tab=quote&ask=${ok ? 'withdrawn' : 'error'}`,
  );
}
