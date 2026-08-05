'use server';

/**
 * /vendor-dashboard/partnerships · vendor-scoped server actions (Phase 4).
 *
 * MUTUAL-ACCEPT model (replaces the old admin-verified declaration flow):
 *   • propose   — the PROPOSER creates a row (status forced to 'proposed')
 *   • accept    — the RECIPIENT accepts an incoming proposal (→ 'accepted')
 *   • decline   — the RECIPIENT declines an incoming proposal (→ 'declined')
 *   • withdraw  — the PROPOSER withdraws their own proposal   (→ 'withdrawn')
 *
 * ALL writes use the NORMAL user-scoped server client (`@/lib/supabase/server`),
 * NEVER the service-role admin client — so RLS is the security boundary:
 *   • proposer INSERT policy forces status='proposed' + recommending ∈ mine
 *   • recipient UPDATE policy allows only accepted/declined + recommended ∈ mine
 *   • proposer UPDATE policy allows only withdrawn + recommending ∈ mine
 * The vendor_profile_id is ALWAYS resolved server-side from the authenticated
 * user (never trusted from the form) so we never echo a foreign id into a write;
 * RLS rejects a tampered payload anyway (defence in depth).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  PARTNERSHIP_KINDS,
  isPartnershipKind,
  type PartnershipKind,
} from '@/lib/vendor-partnership-kinds';

const PANEL_PATH = '/vendor-dashboard/partnerships';

// The four kinds live in one place now — see the file's own docblock for why
// "sponsored" here does NOT mean paid placement.
const RELATIONSHIP_TYPES = PARTNERSHIP_KINDS;
type RelationshipType = PartnershipKind;

/** Resolve the current user → their own vendor_profile_id, or bounce. */
async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, vendorProfileId: profile.vendor_profile_id };
}

function readString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function back(msg: string): never {
  redirect(`${PANEL_PATH}?error=${encodeURIComponent(msg)}`);
}

// ---------------------------------------------------------------------------
// propose — proposer creates a partnership proposal (status forced 'proposed')
// ---------------------------------------------------------------------------

export async function proposePartnership(formData: FormData) {
  const { supabase, vendorProfileId } = await ensureProfile();

  const recommendedId = readString(formData, 'recommended_vendor_id');
  const relationshipTypeRaw = readString(formData, 'relationship_type');

  if (!recommendedId || !relationshipTypeRaw) {
    back('Please choose a vendor and a partnership type.');
  }
  if (!(RELATIONSHIP_TYPES as readonly string[]).includes(relationshipTypeRaw)) {
    back('Unknown partnership type.');
  }
  const relationshipType = relationshipTypeRaw as RelationshipType;

  if (recommendedId === vendorProfileId) {
    back('You cannot propose a partnership with yourself.');
  }

  const { error } = await supabase.from('vendor_partnerships').insert({
    recommending_vendor_id: vendorProfileId, // resolved server-side, never from form
    recommended_vendor_id: recommendedId,
    relationship_type: relationshipType,
    status: 'proposed', // RLS enforces this too; set explicitly for clarity
    is_active: true,
  });

  if (error) {
    // 23505 = unique_violation → a partnership of this type already exists
    // between the two vendors (in either direction). Treat gracefully.
    if (error.code === '23505') {
      back('A partnership of this type already exists between you two.');
    }
    back(error.message);
  }

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?proposed=1`);
}

// ---------------------------------------------------------------------------
// respond — recipient accepts or declines an incoming proposal
// ---------------------------------------------------------------------------

async function respondToPartnership(
  formData: FormData,
  next: 'accepted' | 'declined',
) {
  const { supabase, vendorProfileId } = await ensureProfile();

  const idRaw = readString(formData, 'partnership_id');
  const partnershipId = Number.parseInt(idRaw, 10);
  if (!Number.isInteger(partnershipId) || partnershipId <= 0) {
    back('Missing partnership reference.');
  }

  // Update is gated by RLS (recipient policy: recommended ∈ mine + status in
  // accepted/declined). We ALSO scope by recommended_vendor_id + a
  // still-'proposed' guard so a stale button can't re-transition a resolved row.
  const patch: Record<string, unknown> = { status: next };
  if (next === 'accepted') patch.accepted_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('vendor_partnerships')
    .update(patch)
    .eq('id', partnershipId)
    .eq('recommended_vendor_id', vendorProfileId)
    .eq('status', 'proposed')
    .select('id')
    .maybeSingle();

  if (error) back(error.message);
  if (!data) {
    back('That proposal is no longer pending — it may have been withdrawn or already answered.');
  }

  revalidatePath(PANEL_PATH);
  revalidatePath('/explore');
  redirect(`${PANEL_PATH}?${next === 'accepted' ? 'accepted' : 'declined'}=1`);
}

export async function acceptPartnership(formData: FormData) {
  return respondToPartnership(formData, 'accepted');
}

export async function declinePartnership(formData: FormData) {
  return respondToPartnership(formData, 'declined');
}

// ---------------------------------------------------------------------------
// withdraw — proposer withdraws their own outstanding proposal
// ---------------------------------------------------------------------------

export async function withdrawPartnership(formData: FormData) {
  const { supabase, vendorProfileId } = await ensureProfile();

  const idRaw = readString(formData, 'partnership_id');
  const partnershipId = Number.parseInt(idRaw, 10);
  if (!Number.isInteger(partnershipId) || partnershipId <= 0) {
    back('Missing partnership reference.');
  }

  // RLS proposer policy: recommending ∈ mine + status='withdrawn'. We also
  // scope by recommending_vendor_id and only withdraw a still-'proposed' row.
  const { data, error } = await supabase
    .from('vendor_partnerships')
    .update({ status: 'withdrawn' })
    .eq('id', partnershipId)
    .eq('recommending_vendor_id', vendorProfileId)
    .eq('status', 'proposed')
    .select('id')
    .maybeSingle();

  if (error) back(error.message);
  if (!data) {
    back('That proposal can no longer be withdrawn — it may already be accepted, declined, or removed.');
  }

  revalidatePath(PANEL_PATH);
  revalidatePath('/explore');
  redirect(`${PANEL_PATH}?withdrawn=1`);
}

// ---------------------------------------------------------------------------
// change the kind of an existing partnership
// ---------------------------------------------------------------------------

/**
 * Move to a different kind by WITHDRAWING the old partnership and proposing the
 * new one.
 *
 * ── ⚠ WHY IT IS NOT AN UPDATE, AND WHY THE FIRST VERSION WAS DEAD ───────────
 * This shipped on 2026-08-05 as `.update({ relationship_type })` and it could
 * NEVER have succeeded for any vendor. Two independent live mechanisms refuse
 * it, and neither is visible in the table definition:
 *
 *   1. A BEFORE UPDATE trigger, `trg_vendor_partnerships_lock_immutable`,
 *      raises IMMUTABLE_PARTNERSHIP_FIELDS on any change to
 *      `relationship_type` (or the money columns) unless `is_admin()`.
 *   2. There is no UPDATE policy that permits it either. The proposer's only
 *      one has `WITH CHECK (… AND status = 'withdrawn')`.
 *
 * A vendor pressing Change got the raw string "IMMUTABLE_PARTNERSHIP_FIELDS"
 * in their error banner. The tests were all file-shape assertions, so CI was
 * green — nothing ever executed the write.
 *
 * ── THE LOCK IS RIGHT AND STAYS ─────────────────────────────────────────────
 * It exists so a partnership's TERMS cannot change under the partner who agreed
 * to them — the same concern the consent rule was written for, already solved
 * one layer down and solved better. Relaxing it to make my control work would
 * have removed a real protection to accommodate a mistake.
 *
 * So the change becomes what the database already allows: withdraw the old row,
 * insert a new proposal, and let the partner accept it. The badge comes down at
 * the withdrawal and returns only on their acceptance — which is exactly the
 * consent behaviour intended, now enforced by the schema rather than by this
 * function remembering to null a column.
 *
 * Not a transaction: two statements, and a failure between them leaves the old
 * partnership withdrawn with no replacement. That is the safe direction — a
 * missing badge is recoverable by proposing again; a stale one is a false claim
 * about someone else's pricing.
 */
export async function changePartnershipKind(formData: FormData) {
  const { supabase, vendorProfileId } = await ensureProfile();

  const idRaw = readString(formData, 'partnership_id');
  const partnershipId = Number.parseInt(idRaw, 10);
  if (!Number.isInteger(partnershipId) || partnershipId <= 0) {
    back('Missing partnership reference.');
  }

  const nextRaw = readString(formData, 'relationship_type');
  if (!isPartnershipKind(nextRaw)) {
    back('Unknown partnership type.');
  }
  const next = nextRaw;

  // Read the row first — we need the partner's id to re-propose, and scoping to
  // `recommending_vendor_id` is what stops anyone restating someone else's claim.
  const { data: existing, error: readErr } = await supabase
    .from('vendor_partnerships')
    .select('id, recommended_vendor_id, relationship_type')
    .eq('id', partnershipId)
    .eq('recommending_vendor_id', vendorProfileId)
    .maybeSingle();

  if (readErr) back(readErr.message);
  if (!existing) {
    back('That partnership could not be changed — it may have been withdrawn.');
  }
  if (existing.relationship_type === next) {
    back('That is already how this partnership is described.');
  }

  const { error: withdrawErr } = await supabase
    .from('vendor_partnerships')
    .update({ status: 'withdrawn' })
    .eq('id', partnershipId)
    .eq('recommending_vendor_id', vendorProfileId)
    .in('status', ['proposed', 'accepted']);
  if (withdrawErr) back(withdrawErr.message);

  const { error: insertErr } = await supabase.from('vendor_partnerships').insert({
    recommending_vendor_id: vendorProfileId,
    recommended_vendor_id: existing.recommended_vendor_id,
    relationship_type: next,
    status: 'proposed',
    is_active: true,
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      back('You already have that kind of partnership with this vendor.');
    }
    back(insertErr.message);
  }

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?proposed=1`);
}
