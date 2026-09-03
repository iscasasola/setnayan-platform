'use server';

// ============================================================================
// recordEventCost / deleteEventCost — the couple writes down money that has
// nobody on the other side of it, and the money that does. (BA7, 2026-09-03.)
//
// One form, one fork, stated by the owner on 2026-09-02:
//   *"if they add a budget it means it is automatically locked. and it will
//    automatically be on the marketplace as well. then they also get a QR Code
//    to add that vendor to the app (already planned before)."*
//
//   · NO SUPPLIER NAMED → one `event_costs` row. Rings, the licence fee, tips,
//     ang pao. No Merkado row and no QR: there is nobody to invite.
//   · SUPPLIER NAMED    → an `event_vendors` row at `contracted` (LOCKED —
//     which IS the Merkado row), the cost as an `event_vendor_line_items` row,
//     anything already handed over as an `event_vendor_payments` row, and a
//     claim QR.
//
// 🔑 RULE 0 — NONE OF THE SUPPLIER HALF IS NEW PLUMBING. The claim link is the
// shipped `/vendor/claim/[token]` route; the token comes from the shipped
// idempotent `ensureAutoShareInvite`; the URL from `buildClaimUrl`; the picture
// from `renderUrlQrSvg` (lib/qr.ts), the same helper the Papic seat-claim and
// Plan-3D join codes already use. This file composes them, and writes none of
// them.
//
// ⚖ AND IT DOES NOT CREATE A SECOND WAY TO SEE THE QR. A row created here has
// `marketplace_vendor_id IS NULL` and `status = 'contracted'`, which is exactly
// the shape the vendor workspace page already renders `ClaimLinkShare` for
// (`const needsInvite = ev.marketplace_vendor_id === null`). So the invite the
// modal hands over stays reachable afterwards through a surface that already
// ships, and this action needs no "show it again" of its own.
// ============================================================================

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  readCostDraft,
  vendorCategoryForCostCategory,
  type CostDraft,
} from '@/lib/event-costs';
import { buildClaimUrl, ensureAutoShareInvite } from '@/lib/vendor-invites';
import { renderUrlQrSvg } from '@/lib/qr';

export type RecordCostResult =
  | {
      ok: true;
      /** Present only when a supplier was named — the two are the same fork. */
      supplier: {
        eventVendorId: string;
        name: string;
        claimUrl: string;
        qrSvg: string;
      } | null;
      /** True when the supplier was locked but the invite could not be minted. */
      inviteUnavailable: boolean;
    }
  | { ok: false; error: string };

export type DeleteCostResult = { ok: true } | { ok: false; error: string };

function revalidate(eventId: string) {
  revalidatePath(`/dashboard/${eventId}/budget`);
  // The Merkado reads the same `event_vendors` rows, and a supplier locked
  // here has to appear there without the couple hunting for a refresh.
  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
}

/**
 * The supplier fork. Creates the LOCKED Merkado row, hangs the cost off it
 * through the existing line-item + payment tables, and mints the claim QR.
 *
 * ⚠ IT DOES NOT FALL BACK TO AN `event_costs` ROW ON FAILURE. Recording the
 * money twice under two different shapes is the one outcome worse than
 * recording it once and saying so: a caller that quietly retried down the
 * other door would double the couple's total. Every failure below returns an
 * error the couple can act on, having written nothing.
 */
async function recordWithSupplier(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: { eventId: string; userId: string; draft: CostDraft; supplierName: string },
): Promise<RecordCostResult> {
  const { eventId, userId, draft, supplierName } = args;

  const { data: vendorRow, error: vendorErr } = await supabase
    .from('event_vendors')
    .insert({
      event_id: eventId,
      vendor_name: supplierName,
      category: vendorCategoryForCostCategory(draft.planGroupId),
      // 🔒 LOCKED ON ARRIVAL — the owner's ruling. `contracted` is the first
      // rung of CONFIRMED_VENDOR_STATUSES, so the resolver counts this money
      // as AGREED immediately, which is what "if they add a budget it means it
      // is automatically locked" says.
      status: 'contracted',
      // `bucketForVendor` reads this FIRST, so the money lands in the category
      // the couple actually picked rather than in whatever the vendor category
      // happens to map to. It is the same field the plan cards write.
      covers_plan_groups: [draft.planGroupId],
      // The host typed this themselves — same stamp `attachManualVendorToCategory`
      // uses, so the auto-cascade chip does not fire on a row nobody cascaded.
      source: 'host_manual',
      notes: draft.note,
    })
    .select('vendor_id')
    .single();

  if (vendorErr || !vendorRow) {
    return {
      ok: false,
      error: vendorErr?.message ?? 'Could not save that supplier. Please try again.',
    };
  }
  const eventVendorId = vendorRow.vendor_id as string;

  const { error: lineErr } = await supabase.from('event_vendor_line_items').insert({
    event_id: eventId,
    vendor_id: eventVendorId,
    label: draft.label,
    amount_php: draft.amountPhp,
    due_date: draft.dueDate,
  });
  if (lineErr) {
    // The vendor row is already in; leaving it with no cost on it would show
    // the couple a supplier they never chose to add on its own. Roll it back.
    await supabase.from('event_vendors').delete().eq('vendor_id', eventVendorId);
    return { ok: false, error: lineErr.message };
  }

  if (draft.paidPhp > 0) {
    // The itemized log, not `deposit_paid_php` — the resolver prefers the log
    // whenever it exists and treats the legacy field as a non-additive
    // fallback, so writing the log is the one that cannot double-count.
    const { error: payErr } = await supabase.from('event_vendor_payments').insert({
      event_id: eventId,
      vendor_id: eventVendorId,
      amount_php: draft.paidPhp,
      method: 'Recorded on the budget page',
    });
    if (payErr) {
      // Do NOT roll back here. The cost is recorded and correct; only the
      // "already paid" half failed. Saying so leaves the couple one field to
      // fix, where a rollback would throw away work they just did.
      return {
        ok: false,
        error:
          `Saved ${draft.label} against ${supplierName}, but could not record the ` +
          `₱${draft.paidPhp.toLocaleString('en-PH')} already paid — log it on ` +
          `their card below.`,
      };
    }
  }

  // The invite. `ensureAutoShareInvite` is idempotent (a partial unique index
  // enforces one live auto-share row per booking), so a couple who submits
  // twice gets the same token rather than two.
  //
  // 🔑 THE GATE IS `marketplace_vendor_id IS NULL`, WHICH THIS ROW IS BY
  // CONSTRUCTION. That is the SUBSTANTIVE condition and the one the workspace
  // page — the shipped surface that actually renders this link — uses on its
  // own. `createManualVendorInvite` additionally demands `manual_vendor_id IS
  // NOT NULL`; that half is not copied here, because a supplier the couple
  // named with nothing but a name has no `event_manual_vendors` contact card
  // (that table requires a contact person AND a number, both NOT NULL) and
  // still plainly deserves an invite.
  let supplier: { eventVendorId: string; name: string; claimUrl: string; qrSvg: string } | null =
    null;
  let inviteUnavailable = false;
  try {
    const invite = await ensureAutoShareInvite(supabase, {
      eventVendorId,
      invitedByUserId: userId,
      businessName: supplierName,
      serviceCategory: vendorCategoryForCostCategory(draft.planGroupId),
    });
    if (invite) {
      const claimUrl = buildClaimUrl(invite.claim_token);
      supplier = {
        eventVendorId,
        name: supplierName,
        claimUrl,
        qrSvg: await renderUrlQrSvg(claimUrl, 220),
      };
    } else {
      inviteUnavailable = true;
    }
  } catch {
    // The money is saved and the supplier is locked. An invite that could not
    // be minted is a missing QR, not a lost cost — and the workspace page
    // offers a "Create link" action for exactly this state, so the couple is
    // not stuck. Reported rather than swallowed: `inviteUnavailable` reaches
    // the render, because a log line never changed a pixel.
    inviteUnavailable = true;
  }

  revalidate(eventId);
  return { ok: true, supplier, inviteUnavailable };
}

/**
 * Record one cost. `supplier_name` blank → the supplier-less door.
 */
export async function recordEventCost(formData: FormData): Promise<RecordCostResult> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { ok: false, error: 'Missing event reference. Please refresh and try again.' };
  }

  const parsed = readCostDraft({
    planGroupId: formData.get('plan_group_id'),
    label: formData.get('label'),
    amountPhp: formData.get('amount_php'),
    paidPhp: formData.get('paid_php'),
    dueDate: formData.get('due_date'),
    note: formData.get('note'),
    supplierName: formData.get('supplier_name'),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const draft = parsed.draft;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  if (draft.supplierName) {
    return recordWithSupplier(supabase, {
      eventId,
      userId: user.id,
      draft,
      supplierName: draft.supplierName,
    });
  }

  // No supplier. One row, and RLS is the authorization — `event_costs`'
  // couple-write policy admits only `current_couple_event_ids()`, so a forged
  // event_id is refused by the database rather than by a check here that could
  // drift from it.
  const { error } = await supabase.from('event_costs').insert({
    event_id: eventId,
    plan_group_id: draft.planGroupId,
    label: draft.label,
    amount_php: draft.amountPhp,
    paid_php: draft.paidPhp,
    due_date: draft.dueDate,
    note: draft.note,
    created_by_user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidate(eventId);
  return { ok: true, supplier: null, inviteUnavailable: false };
}

export async function deleteEventCost(formData: FormData): Promise<DeleteCostResult> {
  const eventId = formData.get('event_id');
  const costId = formData.get('cost_id');
  if (typeof eventId !== 'string' || typeof costId !== 'string') {
    return { ok: false, error: 'Missing input. Please refresh and try again.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase
    .from('event_costs')
    .delete()
    .eq('cost_id', costId)
    .eq('event_id', eventId);
  if (error) return { ok: false, error: error.message };

  revalidate(eventId);
  return { ok: true };
}
