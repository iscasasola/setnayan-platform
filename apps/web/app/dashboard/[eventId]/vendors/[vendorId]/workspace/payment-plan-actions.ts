'use server';

// ============================================================================
// /dashboard/[eventId]/vendors/[vendorId]/workspace/payment-plan-actions.ts
//
// THE COUPLE'S OWN INSTALMENT PLAN for a supplier they added themselves — and
// the ONLY thing about a self-added supplier that touches the event's money.
//
// ── Why this is its own file ──────────────────────────────────────────────
// It lived in `actions.ts` for about an hour, beside
// `saveSelfAddedServiceCard`, and `the-payment-note-is-inert.test.ts` failed —
// correctly. That guard asserts no file which writes a real money table also
// reads a payment NOTE, and one file doing both is indistinguishable, to a
// file-level check, from a file that pipes one into the other.
//
// 🔑 THE GUARD WAS RIGHT AND THE STRUCTURE WAS WRONG. The two really are
// different things: the payment METHOD is a GCash number the couple wrote
// down (inert, no due date, moves nothing) and the payment PLAN is what they
// are tracked against. Splitting them restores the guard's meaning instead of
// widening it to tolerate the mixture — and the split is better structure on
// its own terms, because the two have different blast radii.
//
// Nothing in THIS file may ever read `payment_method_note`. That is the
// property the guard checks, and now it can.
// ============================================================================

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { agreedTotalNow, fetchChangeLinesByVendor } from '@/lib/agreed-total-and-its-changes';
import {
  buildCouplePaymentPlan,
  type CouplePlanRowInput,
} from '@/lib/self-added-payment-plan';

// ============================================================================
// saveSelfAddedPaymentPlan (2026-09-20)
//
// Owner: "Payment Plan Must set date for until the payment is fully paid.
// just like on our quote maker."
//
// Writes the couple's own instalments for a supplier THEY added into
// `event_vendor_payment_plan` — the same table `finalizeVendor` freezes a
// marketplace booking's plan into, and the one the Payments surface already
// reads (`paymentScheduleSource` returns 'plan' as soon as it has steps). So
// the plan renders through machinery that already exists; nothing new draws it.
//
// ⚖ THIS IS THE ONE PIECE OF THE MANUAL SUPPLIER THAT IS *NOT* INERT, AND THAT
// IS DELIBERATE. The payment METHOD stays a note (a GCash number moves no
// money). A plan with due dates is the event's real money by construction —
// "until fully paid" is unobservable unless something counts it.
//
// ── The three things that could go wrong, and where each is stopped ───────
//  1. A plan that does not add up → `buildCouplePaymentPlan` refuses it and
//     names both figures. A short plan would let the couple pay the last
//     instalment and read the booking as settled while part of it was never
//     scheduled.
//  2. A stale price → the total comes from `agreedTotalNow`, never the raw
//     `total_cost_php`, for the same reason the supplier's seed does.
//  3. A marketplace supplier → refused outright. Their plan is theirs, frozen
//     from their own schedule at lock; a couple must not overwrite it.
// ============================================================================
export async function saveSelfAddedPaymentPlan(formData: FormData): Promise<void> {
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

  const { data: booking, error: bookingErr } = await supabase
    .from('event_vendors')
    .select('total_cost_php, marketplace_vendor_id, created_at')
    .eq('vendor_id', vendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (bookingErr) throw new Error(bookingErr.message);
  if (!booking) throw new Error('Booking not found');
  const bk = booking as {
    total_cost_php: number | string | null;
    marketplace_vendor_id: string | null;
    created_at: string | null;
  };
  if (bk.marketplace_vendor_id) {
    throw new Error(
      'This supplier sets their own payment terms on Setnayan, so this plan is theirs to change.',
    );
  }

  // The agreed total NOW — see reason 2 above.
  const { byVendor, error: linesError } = await fetchChangeLinesByVendor(supabase, eventId);
  if (linesError) {
    throw new Error('Could not read this booking’s price right now — try again.');
  }
  const totalPhp = agreedTotalNow(bk.total_cost_php, byVendor.get(vendorId) ?? []);

  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  const eventDateIso = ((ev as { event_date: string | null } | null)?.event_date ?? null) || null;

  // 🔑 WHAT "AFTER LOCK" MEANS FOR A SUPPLIER WITH NO HANDSHAKE. A marketplace
  // booking anchors `on_lock` on the day the lock landed. A self-added
  // supplier never handshakes, so the closest honest date is the day the
  // couple added them (`event_vendors.created_at`), falling back to today if
  // that is somehow unreadable. Never `new Date()` alone: re-saving the plan
  // months later would silently slide every on_lock date forward.
  const lockDateIso = (bk.created_at ?? new Date().toISOString()).slice(0, 10);

  const rows: CouplePlanRowInput[] = [];
  const labels = formData.getAll('plan_label');
  for (let i = 0; i < labels.length; i += 1) {
    rows.push({
      label: String(labels[i] ?? ''),
      amount_kind: String(formData.getAll('plan_kind')[i] ?? 'percent') === 'fixed' ? 'fixed' : 'percent',
      value: String(formData.getAll('plan_value')[i] ?? ''),
      due_anchor: (() => {
        const a = String(formData.getAll('plan_anchor')[i] ?? '');
        return a === 'on_lock' || a === 'before_event' ? a : '';
      })(),
      due_offset_days: String(formData.getAll('plan_days')[i] ?? '0'),
    });
  }

  const built = buildCouplePaymentPlan({ rows, totalPhp, lockDateIso, eventDateIso });
  if (!built.ok) throw new Error(built.message);

  // One plan per booking — the table's own UNIQUE (event_id, event_vendor_id).
  const { data: written, error } = await supabase
    .from('event_vendor_payment_plan')
    .upsert(
      {
        event_id: eventId,
        event_vendor_id: vendorId,
        instances_json: built.instances,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,event_vendor_id' },
    )
    .select('plan_id');
  if (error) throw new Error(error.message);
  // A zero-row upsert returns no error; without this an RLS refusal would look
  // exactly like a saved plan.
  if (!written || written.length === 0) {
    throw new Error('Could not save the plan — refresh and try again.');
  }

  revalidatePath(`/dashboard/${eventId}/vendors`, 'layout');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}
