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
import { getTaxonomy } from '@/lib/taxonomy-db';
import { COVER_TILE_PREFIX, tileForCover } from '@/lib/shortlist-taxonomy';
import { restoreTileToPlan } from '../../category-decision-actions';
import { createAdminClient } from '@/lib/supabase/admin';
import { planSupplierMove } from '@/lib/move-supplier-category';
import { logQueryError } from '@/lib/supabase/error-detect';
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
        : 'Supplier',
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

  // "Also covers" — the Suppliers page's rows (2026-10-20, `coverKeyForTile`):
  // a plan-group id, or `tile:<id>` for a row no plan group opens on. Each is
  // validated against its OWN registry so the column never stores an
  // off-registry key — a plan group against PLAN_GROUPS, a row against the
  // taxonomy snapshot the Suppliers page draws its rows from.
  const validGroups = new Set<string>(PLAN_GROUPS.map((g) => g.id as string));
  const knownTiles = (await getTaxonomy()).tileLabel as Record<string, string>;
  const isValidCover = (c: string) =>
    validGroups.has(c) ||
    (c.startsWith(COVER_TILE_PREFIX) && typeof knownTiles[c.slice(COVER_TILE_PREFIX.length)] === 'string');
  const covers = [
    ...new Set(
      formData
        .getAll('covers')
        .filter((c): c is string => typeof c === 'string' && isValidCover(c)),
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
  // What it covered BEFORE this save — so a row ticked just now can be put on
  // the event (below) without re-adding every row on each save.
  const { data: before } = await supabase
    .from('event_vendors')
    .select('covers_plan_groups')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  const coveredBefore = new Set<string>(
    Array.isArray(before?.covers_plan_groups) ? (before.covers_plan_groups as string[]) : [],
  );

  const { error } = await supabase
    .from('event_vendors')
    .update({ host_inclusions: inclusions, covers_plan_groups: covers })
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .is('marketplace_vendor_id', null);
  if (error) throw new Error(error.message);

  // A ROW TICKED HERE IS ON THE EVENT (owner 2026-10-20: ticking one the plan
  // does not have yet "adds it the same way the Suppliers page adds a row").
  // The SAME action as the page's "＋ Add to your event" — `restoreTileToPlan`
  // clears a removal and records the row in `added_categories` — so there is no
  // second writer of "which rows this event has". Its refusal (flag off, not a
  // host) is not this save's failure: the covers above are already stored, and
  // the card still draws under the row whenever the page shows it.
  for (const key of covers) {
    if (coveredBefore.has(key)) continue;
    const tile = tileForCover(key);
    if (!tile) continue;
    await restoreTileToPlan({ eventId, tile });
  }

  // 'layout' on /vendors so the Shortlist card chips + Compare inclusions
  // pick up the new covers/inclusions on the next paint.
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}

// ============================================================================
// moveSupplierToCategory (owner 2026-10-20 — "Move to another category" → "okay")
//
// Moves the card's OWN row: Dunkin' Donuts, typed in under Everything else, is
// really a Food Truck. The plan is `planSupplierMove` (pure, shared with the
// guard): `category` = the enum label the rest of the app keys on,
// `category_key` = the row itself when the enum cannot name it, and "also
// covers" without the new home or the old one. Price, payments, notes and the
// contact card live on this same row, so they move with it.
//
// AUTH — THE SAME AS THE CARD'S OTHER EDITS (`updateHostServiceDetails`): a
// signed-in session, the write under RLS (the event's own couple / a writing
// coordinator), and off-platform rows only (`marketplace_vendor_id IS NULL`).
// A supplier with a shop of their own never shows this block: their card is
// theirs, and what they may see of the event is decided by this very column
// (`get_vendor_seat_plan` / `get_vendor_event_brief` key on
// `event_vendors.category`), so it is not moved from here.
//
// 🔑 A ZERO-ROW UPDATE IS NOT A MOVE. `.select()` reads the row back; nothing
// returned means RLS or the off-platform rule refused it, and the couple is
// told so instead of seeing "Moved".
//
// The supplier's pending claim link (`vendor_invites.service_category`, the
// category the claim files their shop under) is kept in step — on the admin
// client, AFTER the session write above proved the caller may write this row,
// because a coordinator holds no RLS on `vendor_invites`.
// ============================================================================

export type MoveSupplierResult =
  | { ok: true; from: string | null; to: string; removedCovers: string[]; warning?: string }
  | { ok: false; error: string };

export async function moveSupplierToCategory(input: {
  eventId: string;
  vendorId: string;
  tile: string;
  /** Undo only: "also covers" keys the move took off, put back. Validated like a save. */
  restoreCovers?: string[];
}): Promise<MoveSupplierResult> {
  const eventId = typeof input?.eventId === 'string' ? input.eventId : '';
  const vendorId = typeof input?.vendorId === 'string' ? input.vendorId : '';
  const tile = typeof input?.tile === 'string' ? input.tile.trim() : '';
  if (!eventId || !vendorId || !tile) return { ok: false, error: 'Invalid input' };

  // The target must be a row the Suppliers page can draw — the same snapshot
  // the page and the picker are built from.
  const knownTiles = (await getTaxonomy()).tileLabel as Record<string, string>;
  if (typeof knownTiles[tile] !== 'string') return { ok: false, error: 'That category is not on the list.' };
  const validGroups = new Set<string>(PLAN_GROUPS.map((g) => g.id as string));
  const restore = (Array.isArray(input.restoreCovers) ? input.restoreCovers : []).filter(
    (c): c is string =>
      typeof c === 'string' &&
      (validGroups.has(c) ||
        (c.startsWith(COVER_TILE_PREFIX) && typeof knownTiles[c.slice(COVER_TILE_PREFIX.length)] === 'string')),
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  // Under the caller's own RLS — the read is the ownership check.
  const { data: row, error: readErr } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, category, category_key, covers_plan_groups, marketplace_vendor_id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (readErr) {
    logQueryError('moveSupplierToCategory.read', readErr, { event_id: eventId, vendor_id: vendorId });
    return { ok: false, error: 'That did not load. Please try again.' };
  }
  if (!row) return { ok: false, error: 'Supplier not found.' };
  const name = typeof row.vendor_name === 'string' && row.vendor_name.trim() ? row.vendor_name.trim() : 'This supplier';
  if (row.marketplace_vendor_id) {
    return { ok: false, error: `${name} is on Setnayan now — their card can’t be moved from here.` };
  }

  const plan = planSupplierMove(
    {
      category: row.category as string,
      category_key: (row.category_key as string | null) ?? null,
      covers_plan_groups: (row.covers_plan_groups as string[] | null) ?? [],
    },
    tile,
    restore,
  );
  if ('refused' in plan) return { ok: false, error: `${name} is already in that category.` };

  const { data: moved, error: moveErr } = await supabase
    .from('event_vendors')
    .update({ category: plan.category, category_key: plan.category_key, covers_plan_groups: plan.covers })
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .is('marketplace_vendor_id', null)
    .select('vendor_id');
  if (moveErr) {
    logQueryError('moveSupplierToCategory.update', moveErr, { event_id: eventId, vendor_id: vendorId, tile });
    // 23505: a category that holds one booked supplier only already has one.
    return {
      ok: false,
      error:
        moveErr.code === '23505'
          ? `${knownTiles[tile]} already has a booked supplier, so ${name} can’t move there.`
          : `${name} did not move. Please try again.`,
    };
  }
  if (!moved || moved.length === 0) return { ok: false, error: `${name} did not move. Please try again.` };

  const warnings: string[] = [];
  const { error: inviteErr } = await createAdminClient()
    .from('vendor_invites')
    .update({ service_category: plan.category })
    .eq('vendor_id', vendorId)
    .eq('status', 'pending');
  if (inviteErr) {
    logQueryError('moveSupplierToCategory.invite', inviteErr, { event_id: eventId, vendor_id: vendorId });
    warnings.push('their sign-up link still names the old category');
  }

  // A row the event does not have yet is put on it the way "Also covers" and
  // "＋ Add to your event" do — the one writer of which rows an event has. Its
  // refusal is not the move's failure: a row holding a supplier always draws.
  await restoreTileToPlan({ eventId, tile }).catch(() => null);

  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
  revalidatePath(`/dashboard/${eventId}/budget`);
  return {
    ok: true,
    from: plan.from,
    to: plan.to,
    removedCovers: plan.removedCovers,
    ...(warnings.length > 0 ? { warning: `Moved — but ${warnings.join(' and ')}.` } : {}),
  };
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
      .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
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
// The payment METHOD note reaches no payment machinery: no
// `event_vendor_payment_plan` row, no `event_vendor_payments`, no schedule, no
// rail, no notification. It is the GCash number the couple wrote down, and
// `the-payment-note-is-inert.test.ts` fails CI if a writer of those tables
// ever learns to read it.
//
// ⚖ THE PAYMENT PLAN IS A DIFFERENT ANIMAL AND IS NOT WRITTEN HERE. Owner
// 2026-09-20: "Payment Plan Must set date for until the payment is fully paid.
// just like on our quote maker." A plan with due dates IS the event's money —
// it belongs in `event_vendor_payment_plan` through `computePlanInstances`,
// not in a text column beside a phone number.
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
  const contactPerson = readNote(formData, 'contact_person', CONTACT_PERSON_MAX);
  const contactNumber = readNote(formData, 'contact_number', CONTACT_NUMBER_MAX);
  const businessName = readNote(formData, 'business_name', 128);

  // ── TWO FORMS WRITE THIS ROW, AND NEITHER OWNS EVERY COLUMN (2026-09-21) ──
  // The workspace card posts the payment METHOD note but no map pin; the
  // Details sheet posts a pin and a name but no method note. A column is
  // therefore written only when the posting form ACTUALLY CARRIES it. Writing
  // `payment_method_note` unconditionally — as this did — meant saving the
  // Details sheet would have silently erased the GCash number the couple wrote
  // on the workspace. Same class of bug as the crew reset in updateVendorCosts.
  const carriesMethodNote = formData.has('payment_method_note');
  // A pin is BOTH-OR-NEITHER (the table CHECKs it) and only posted once placed,
  // so absence means "this form did not set one" — never "clear it".
  const pinLat = Number(formData.get('address_latitude'));
  const pinLng = Number(formData.get('address_longitude'));
  const carriesPin =
    formData.has('address_latitude') &&
    formData.has('address_longitude') &&
    Number.isFinite(pinLat) &&
    Number.isFinite(pinLng) &&
    Math.abs(pinLat) <= 90 &&
    Math.abs(pinLng) <= 180;

  if (row.manual_vendor_id) {
    // 🔑 `.select()` AND A ROW COUNT. A zero-row UPDATE returns no error, so an
    // RLS refusal would otherwise be indistinguishable from a save and the card
    // would print "Saved" over unchanged text.
    const update: Record<string, unknown> = {
      address: address.value,
      updated_at: new Date().toISOString(),
    };
    if (carriesMethodNote) update.payment_method_note = paymentMethodNote;
    if (carriesPin) {
      update.address_latitude = pinLat;
      update.address_longitude = pinLng;
    }
    if (businessName) update.business_name = businessName;
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
        business_name: businessName ?? ((row.vendor_name ?? '').trim() || 'Supplier'),
        address_latitude: carriesPin ? pinLat : null,
        address_longitude: carriesPin ? pinLng : null,
        contact_person: contactPerson,
        contact_number: contactNumber,
        address: address.value,
        payment_method_note: paymentMethodNote,
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
