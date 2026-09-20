'use server';

// ============================================================================
// /dashboard/[eventId]/vendors/[vendorId]/workspace/actions.ts
//
// Server actions for the per-service workspace page.
//
// createAutoShareInviteAction — explicitly generates the auto-share claim link
//   for a manual (off-platform) vendor the host has locked. This REPLACES the
//   prior render-time self-heal: generating an invite is a write, and a server-
//   component GET render (including Next.js prefetch) must never write. The
//   workspace page now renders a "Create a shareable invite link" button that
//   posts here instead.
//
// (The previous advanceWorkspaceStatus / advanceWorkspaceStatusForm exports were
//  removed — they had zero callers and the status stepper is driven off the
//  vendor_status enum, so workspace_status was never written.)
//
// Auth: gate on signed-in user, then rely on RLS — ensureAutoShareInvite runs
// under the host's session client, which can only touch their own event_vendors
// rows.
// ============================================================================

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureAutoShareInvite } from '@/lib/vendor-invites';
import { canInviteSupplier } from '@/lib/supplier-invite-eligibility';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  WORKING_NOTE_BODY_MAX,
  isCoordinatorVendorNotesEnabled,
  isWorkingNoteVisibility,
  workingNoteAuthorRole,
  type WorkingNoteViewer,
} from '@/lib/vendor-working-notes';
import { checkManualVenueAddress } from '@/lib/manual-venue-address';

/**
 * Idempotently create (or re-read) the auto-share claim link for a locked
 * off-platform supplier. Form-only — returns void and revalidates so the
 * freshly created link renders on the next paint. Silently no-ops on bad
 * input; the unique index in ensureAutoShareInvite makes repeat submits safe.
 *
 * ⚠ THIS WAS THE FOURTH ANSWER TO ONE QUESTION, AND IT WAS "NO CONDITION AT
 * ALL" — it minted an invite for whatever vendor_id the form named, including a
 * marketplace-linked supplier who already has an account and for whom the
 * invite is a no-op. It now asks `canInviteSupplier`, the same predicate the
 * page above it and both vendor actions ask.
 *
 * 🔑 AND THE INVITE'S IDENTITY NOW COMES FROM THE ROW, NOT THE FORM. The
 * denormalized `business_name` on `vendor_invites` is what the public claim
 * page shows the supplier; taking it from a hidden input let a caller stamp any
 * name onto it. Reading it here costs one query that the gate needs anyway.
 */
export async function createAutoShareInviteAction(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');

  if (typeof eventId !== 'string' || typeof vendorId !== 'string') return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS scopes this to the caller's own events, so the read is the ownership
  // check as well as the gate's input.
  const { data: row } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, category, marketplace_vendor_id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (!row || !canInviteSupplier(row)) return;

  await ensureAutoShareInvite(supabase, {
    eventVendorId: vendorId,
    invitedByUserId: user.id,
    businessName:
      typeof row.vendor_name === 'string' && row.vendor_name.trim().length > 0
        ? row.vendor_name.trim()
        : 'Vendor',
    serviceCategory: typeof row.category === 'string' && row.category.length > 0
      ? row.category
      : null,
  });

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}

// ============================================================================
// updateHostServiceDetails (2026-06-11 · dual-path DIY parity, owner doctrine:
// "add information about their order… place… what's included on their
// service. link other services to it as well.")
//
// The host describes a MANUAL (off-platform) vendor's package: free-text
// inclusion lines + "also covers" plan-group links. Marketplace rows keep
// their vendor-authored sources (vendor_package_items / vendor_service_links)
// — the update is hard-scoped to manual rows so there are never two sources
// of truth on a connected vendor. RLS scopes the write to the host's own
// event; the extra predicates here just make the manual-only rule explicit.
// ============================================================================

const MAX_INCLUSIONS = 20;
const MAX_INCLUSION_LEN = 120;

export async function updateHostServiceDetails(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof vendorId !== 'string' ||
    vendorId.length === 0
  ) {
    throw new Error('Invalid input');
  }

  // "What's included" — one line per inclusion, trimmed, deduped, capped.
  const rawInclusions = formData.get('inclusions');
  const inclusions = [
    ...new Set(
      (typeof rawInclusions === 'string' ? rawInclusions : '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.slice(0, MAX_INCLUSION_LEN)),
    ),
  ].slice(0, MAX_INCLUSIONS);

  // "Also covers" — validated against the canonical plan groups so the column
  // never stores an off-registry id.
  const validGroups = new Set<string>(PLAN_GROUPS.map((g) => g.id as string));
  const covers = [
    ...new Set(
      formData
        .getAll('covers')
        .filter((c): c is string => typeof c === 'string' && validGroups.has(c)),
    ),
  ];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Off-platform only: a marketplace supplier authors their own package, and
  // the host must not overwrite it.
  //
  // ⚠ THIS ALSO CARRIED `.not('manual_vendor_id', 'is', null)` until
  // 2026-09-03 — the same wrong half as the invite gate. For the 43 of 45
  // production suppliers with both ids NULL it matched no row, and an UPDATE
  // that matches nothing returns NO ERROR: the host pressed save, nothing
  // happened, and nothing said so. The render gate above hid the form from
  // those suppliers too, so the two failures concealed each other.
  const { error } = await supabase
    .from('event_vendors')
    .update({ host_inclusions: inclusions, covers_plan_groups: covers })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .is('marketplace_vendor_id', null);
  if (error) throw new Error(error.message);

  // 'layout' on /vendors so the Shortlist card chips + Compare inclusions
  // pick up the new covers/inclusions on the next paint.
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}

// ============================================================================
// Working-folder notes (Coordinator P4 · 2026-07-20 · flag-gated).
//
// Per-vendor note stream with the private-vs-shared split: a coordinator
// writes at either visibility; the couple writes 'shared' only and never sees
// 'coordinator_private' rows. RLS on event_vendor_working_notes (migration
// 20270825279091) is the real wall — the session-client insert/delete below
// cannot exceed it. The role probe here only decides which author_role to
// stamp (the RLS WITH CHECK verifies the claim).
//
// Behind NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED (default OFF): flag off
// ⇒ the actions no-op, matching the panel not rendering at all.
// ============================================================================

async function resolveWorkingNoteViewer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  userId: string,
): Promise<WorkingNoteViewer> {
  const [{ data: member }, { data: moderator }] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('member_type', 'couple')
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  return { isCouple: Boolean(member), isCoordinator: Boolean(moderator) };
}

/** Append one working-folder note. Form-only; silent no-op on bad input. */
export async function addWorkingNoteAction(formData: FormData): Promise<void> {
  if (!isCoordinatorVendorNotesEnabled()) return;

  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const rawBody = formData.get('body');
  const rawVisibility = formData.get('visibility');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof vendorId !== 'string' ||
    vendorId.length === 0 ||
    typeof rawBody !== 'string'
  ) {
    return;
  }
  const body = rawBody.trim().slice(0, WORKING_NOTE_BODY_MAX);
  if (body.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const viewer = await resolveWorkingNoteViewer(supabase, eventId, user.id);
  const authorRole = workingNoteAuthorRole(viewer);
  if (!authorRole) return;

  // Couple submissions are forced to 'shared' (their form has no toggle; the
  // DB CHECK + RLS WITH CHECK back this up). Coordinators pick either value;
  // anything unrecognized falls back to the safe default: private.
  const visibility =
    authorRole === 'couple'
      ? 'shared'
      : isWorkingNoteVisibility(rawVisibility)
        ? rawVisibility
        : 'coordinator_private';

  const { error } = await supabase.from('event_vendor_working_notes').insert({
    event_id: eventId,
    event_vendor_id: vendorId,
    author_user_id: user.id,
    author_role: authorRole,
    visibility,
    body,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}

/** Remove the caller's OWN note (author safety valve — RLS enforces author). */
export async function deleteWorkingNoteAction(formData: FormData): Promise<void> {
  if (!isCoordinatorVendorNotesEnabled()) return;

  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const noteId = formData.get('note_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof vendorId !== 'string' ||
    vendorId.length === 0 ||
    typeof noteId !== 'string' ||
    noteId.length === 0
  ) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_vendor_working_notes')
    .delete()
    .eq('note_id', noteId)
    .eq('author_user_id', user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}


// ============================================================================
// saveSelfAddedServiceCard (2026-09-20)
//
// THE ONE WRITE BEHIND THE COUPLE'S SERVICE CARD for a supplier they added
// themselves: contact person, contact number, exact address, and two free-text
// payment notes.
//
// Owner, across one sitting:
//   · "the ceremony and reception venues to lock needs an exact address if
//      added manually … they will be used for the event itself"
//   · "payment method and payment option can be entered manually. but this is
//      just manual … no connection to the user's event."
//   · "payment options doesn't need to be a qr. just a note so the user can
//      rely on the payment method."
//
// ── IT CREATES THE ROW WHEN THERE ISN'T ONE ───────────────────────────────
// An earlier draft of this action refused with "remove and re-add them" when
// the booking had no `event_manual_vendors` row. That is a real state: two
// production rows with `source = 'host_manual'` carry no contact card
// (2026-09-15 and 2026-06-18), created before or outside the Add-a-contact
// modal's two-step. Telling a couple to delete a booking to record its address
// is not a fix, so this upserts instead.
//
// ⚠ AND THAT IS WHY contact_person / contact_number ARE WRITTEN HERE TOO. They
// are NOT NULL on the table, so the row cannot be created without them — the
// card collects all three or none. The alternative (address-only, refusing the
// two rows above) is the behaviour this replaces.
//
// ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────
// The payment notes reach NO payment machinery. No `event_vendor_payment_plan`
// row, no `event_vendor_payments`, no schedule, no rail, no notification. They
// are text the couple can read back. `the-payment-note-is-inert.test.ts` fails
// CI if a writer of those tables ever learns to read them.
//
// Auth: the couple's session client throughout. RLS
// (`event_manual_vendors_host_all`) is the wall; the event_id equalities are
// defence in depth. A marketplace-linked booking is refused outright — their
// address and payment methods are theirs to publish.
// ============================================================================

/** Caps. Generous, and only here so one paste cannot fill a column. */
const PAYMENT_NOTE_MAX = 400;
const CONTACT_PERSON_MAX = 128;
const CONTACT_NUMBER_MAX = 32;

function readNote(formData: FormData, key: string, max: number): string | null {
  const raw = formData.get(key);
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

export async function saveSelfAddedServiceCard(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof vendorId !== 'string' ||
    vendorId.length === 0
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The booking carries the CATEGORY — the only thing that decides whether an
  // address is owed — plus the link to the contact row and the account fact.
  const { data: booking, error: bookingErr } = await supabase
    .from('event_vendors')
    .select('category, vendor_name, manual_vendor_id, marketplace_vendor_id')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (bookingErr) throw new Error(bookingErr.message);
  if (!booking) throw new Error('Booking not found');

  const row = booking as {
    category: string | null;
    vendor_name: string | null;
    manual_vendor_id: string | null;
    marketplace_vendor_id: string | null;
  };

  // Fails closed rather than writing over somebody else's record.
  if (row.marketplace_vendor_id) {
    throw new Error(
      'This supplier is on Setnayan now, so their address and payment details come from their own listing.',
    );
  }

  const address = checkManualVenueAddress(row.category, formData.get('address'));
  if (!address.ok) throw new Error(address.message);

  const paymentMethodNote = readNote(formData, 'payment_method_note', PAYMENT_NOTE_MAX);
  const paymentTermsNote = readNote(formData, 'payment_terms_note', PAYMENT_NOTE_MAX);
  const contactPerson = readNote(formData, 'contact_person', CONTACT_PERSON_MAX);
  const contactNumber = readNote(formData, 'contact_number', CONTACT_NUMBER_MAX);

  if (row.manual_vendor_id) {
    // 🔑 `.select()` AND A ROW COUNT. A zero-row UPDATE returns no error, so an
    // RLS refusal would otherwise be indistinguishable from a save and the card
    // would print "Saved" over unchanged text.
    const update: Record<string, unknown> = {
      address: address.value,
      payment_method_note: paymentMethodNote,
      payment_terms_note: paymentTermsNote,
      updated_at: new Date().toISOString(),
    };
    // NOT NULL columns: only overwritten when the card actually sent a value,
    // so clearing the input cannot violate the constraint or wipe a contact.
    if (contactPerson) update.contact_person = contactPerson;
    if (contactNumber) update.contact_number = contactNumber;

    const { data: written, error } = await supabase
      .from('event_manual_vendors')
      .update(update)
      .eq('manual_vendor_id', row.manual_vendor_id)
      .eq('event_id', eventId)
      .select('manual_vendor_id');
    if (error) throw new Error(error.message);
    if (!written || written.length === 0) {
      throw new Error('Could not save — refresh and try again.');
    }
  } else {
    // No contact card yet. Create one, then link the booking to it.
    if (!contactPerson || !contactNumber) {
      throw new Error(
        'Add a contact person and number as well — this supplier has no contact card yet.',
      );
    }
    const { data: created, error: createErr } = await supabase
      .from('event_manual_vendors')
      .insert({
        event_id: eventId,
        business_name: (row.vendor_name ?? '').trim() || 'Supplier',
        contact_person: contactPerson,
        contact_number: contactNumber,
        address: address.value,
        payment_method_note: paymentMethodNote,
        payment_terms_note: paymentTermsNote,
        created_by_user_id: user.id,
      })
      .select('manual_vendor_id')
      .single();
    if (createErr || !created) {
      throw new Error(createErr?.message ?? 'Could not create the contact card.');
    }

    // ⚠ THE LINK IS THE HALF THAT CAN BE LOST. Without it the row exists and
    // the card still renders empty on the next paint — a save that looks like a
    // failure. Row count checked for the same reason as the UPDATE above.
    const { data: linked, error: linkErr } = await supabase
      .from('event_vendors')
      .update({ manual_vendor_id: created.manual_vendor_id })
      .eq('vendor_id', vendorId)
      .eq('event_id', eventId)
      .is('marketplace_vendor_id', null)
      .select('vendor_id');
    if (linkErr) throw new Error(linkErr.message);
    if (!linked || linked.length === 0) {
      throw new Error('Saved the details but could not attach them — refresh and try again.');
    }
  }

  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}
