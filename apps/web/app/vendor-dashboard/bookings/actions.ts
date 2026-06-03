'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Vendor-side server actions for the HYBRID Preparation schedule
 * (2026-06-03). A booked vendor can add dated items to the couple's
 * Preparation agenda (e.g. "Send shot list", "Final headcount due") from
 * their Bookings view, backed by the new `event_preparation_items` table.
 *
 * Authorization is RLS-enforced AND guarded here:
 *   • The vendor may only INSERT for an event they hold an ACCEPTED
 *     chat_threads row on (event_prep_items_vendor_insert WITH CHECK). We
 *     re-verify the accepted thread in the action before writing so a
 *     mismatched event_id/vendor pairing fails with a clear message rather
 *     than a raw RLS rejection.
 *   • The inserted row stamps the vendor's OWN vendor_profile_id +
 *     source_tag='vendor_prep'. The vendor can later UPDATE/DELETE only
 *     their own rows (event_prep_items_vendor_update/_delete).
 *
 * A pre-migration deploy (table missing → 42P01) surfaces the Postgres
 * error to the caller; the couple-facing agenda still graceful-degrades to
 * autofill-only via lib/preparation.ts.
 */

const MAX_LABEL = 200;

function trimToNull(raw: FormDataEntryValue | null, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

function parseDateInput(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return t;
}

type PrepKind = 'task' | 'meeting' | 'payment';

/** Normalize the `kind` field; anything unexpected falls back to 'task'. */
function parseKind(raw: FormDataEntryValue | null): PrepKind {
  return raw === 'meeting' || raw === 'payment' ? raw : 'task';
}

/**
 * Parse the optional ₱ amount for a payment item. Non-negative number or null.
 * Throws on a present-but-invalid value. Mirrors CHECK (amount_php >= 0).
 */
function parseAmountPhp(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Enter a valid amount (₱0 or more).');
  }
  return Math.round(n * 100) / 100;
}

/**
 * Confirm the signed-in user owns `vendorProfileId` AND that vendor holds an
 * ACCEPTED thread on `eventId`. Returns true iff both hold. This mirrors the
 * RLS insert policy so we fail fast with a friendly message; RLS remains the
 * real gate.
 */
async function vendorMayAddToEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  vendorProfileId: string,
  eventId: string,
): Promise<boolean> {
  // Ownership: the vendor_profile must belong to the current user.
  const { data: profile } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile) return false;

  // Booking: an accepted thread between this vendor and this event.
  const { data: thread } = await supabase
    .from('chat_threads')
    .select('thread_id')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('inquiry_status', 'accepted')
    .maybeSingle();
  return Boolean(thread);
}

/**
 * Add a vendor-authored item to a booked couple's Preparation schedule.
 * Inputs: eventId, vendorProfileId, label, dueDate, optional notes — passed
 * as FormData fields (event_id / vendor_profile_id / label / due_date /
 * notes).
 */
export async function vendorAddPreparationItem(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const vendorProfileId = formData.get('vendor_profile_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof vendorProfileId !== 'string' ||
    vendorProfileId.length === 0
  ) {
    throw new Error('Invalid input');
  }

  const label = trimToNull(formData.get('label'), MAX_LABEL);
  if (!label) throw new Error('Add a short label for this item.');

  const dueDate = parseDateInput(formData.get('due_date'));
  if (!dueDate) throw new Error('Pick a valid date for this item.');

  const notes = trimToNull(formData.get('notes'), 2000);

  // Typed items (2026-06-03): a booked vendor may place a generic task, a
  // meeting, or a payment schedule entry on the couple's agenda. A payment
  // requires a positive amount.
  const kind = parseKind(formData.get('kind'));
  const amountPhp = parseAmountPhp(formData.get('amount_php'));
  if (kind === 'payment' && (amountPhp === null || amountPhp <= 0)) {
    throw new Error('Enter the payment amount in pesos.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const allowed = await vendorMayAddToEvent(
    supabase,
    user.id,
    vendorProfileId,
    eventId,
  );
  if (!allowed) {
    throw new Error('You can only add items to a booking you’ve accepted.');
  }

  const { error } = await supabase.from('event_preparation_items').insert({
    event_id: eventId,
    vendor_profile_id: vendorProfileId,
    due_date: dueDate,
    label,
    notes,
    kind,
    amount_php: kind === 'payment' ? amountPhp : null,
    source_tag: 'vendor_prep',
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/vendor-dashboard/bookings');
}

/**
 * Delete a vendor-added item. RLS (event_prep_items_vendor_delete) restricts
 * this to rows the vendor authored; we scope by item_id and let RLS enforce
 * ownership.
 */
export async function vendorDeletePreparationItem(formData: FormData): Promise<void> {
  const itemId = formData.get('item_id');
  if (typeof itemId !== 'string' || itemId.length === 0) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_preparation_items')
    .delete()
    .eq('item_id', itemId);
  if (error) throw new Error(error.message);

  revalidatePath('/vendor-dashboard/bookings');
}
