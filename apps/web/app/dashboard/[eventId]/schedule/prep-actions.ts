'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Couple-side server actions for the HYBRID Preparation schedule
 * (2026-06-03). The Preparation mode of /dashboard/[eventId]/schedule was a
 * read-only autofill in PR #840; these actions add the "couple can add /
 * delete their own prep items" layer on top, backed by the new
 * `event_preparation_items` table.
 *
 * Authorization is RLS-enforced: the authenticated supabase client only lets
 * a couple write/delete rows on events where they are an event_members
 * member_type='couple' (current_couple_event_ids policy in the migration),
 * and the couple's FOR ALL policy lets them delete vendor-added rows too
 * (dismiss anything on their own schedule). We still validate inputs here +
 * surface the real Postgres error to the caller so a pre-migration deploy
 * (missing table → 42P01) fails loudly in the form rather than silently.
 */

const MAX_LABEL = 200;

function trimToNull(raw: FormDataEntryValue | null, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

type PrepKind = 'task' | 'meeting' | 'payment';

/** Normalize the `kind` field; anything unexpected falls back to 'task'. */
function parseKind(raw: FormDataEntryValue | null): PrepKind {
  return raw === 'meeting' || raw === 'payment' ? raw : 'task';
}

/**
 * Parse the optional ₱ amount for a payment item. Returns a non-negative
 * number, or null when absent. Throws on a present-but-invalid value so the
 * form surfaces a clear message. Mirrors the CHECK (amount_php >= 0) guard.
 */
function parseAmountPhp(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Enter a valid amount (₱0 or more).');
  }
  // Two-decimal precision to match NUMERIC(12,2).
  return Math.round(n * 100) / 100;
}

/**
 * Validate a `<input type="date">` value (YYYY-MM-DD). Returns the canonical
 * string or null if absent/malformed. We accept past dates too — a couple
 * may log a deadline that already passed so it surfaces as "overdue" in the
 * agenda, matching the autofill's keep-overdue-visible behavior.
 */
function parseDateInput(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  // Reject impossible dates (e.g. 2026-02-31) by round-tripping through Date.
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return t;
}

/**
 * Add a couple-authored item to the event's Preparation schedule.
 * source_tag='couple_manual', created_by stamped from the session.
 */
export async function addPreparationItem(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('Invalid input');
  }

  const label = trimToNull(formData.get('label'), MAX_LABEL);
  if (!label) throw new Error('Add a short label for this item.');

  const dueDate = parseDateInput(formData.get('due_date'));
  if (!dueDate) throw new Error('Pick a valid date for this item.');

  const notes = trimToNull(formData.get('notes'), 2000);

  // Typed items (2026-06-03): the couple may place a generic task, a meeting,
  // or a payment schedule entry. A payment requires a positive amount.
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

  // RLS (event_prep_items_couple_all WITH CHECK) guarantees the event is the
  // couple's own; vendor_profile_id stays NULL → couple-added row. `kind`
  // defaults to 'task' and amount_php is only stamped on payment rows.
  const { error } = await supabase.from('event_preparation_items').insert({
    event_id: eventId,
    due_date: dueDate,
    label,
    notes,
    kind,
    amount_php: kind === 'payment' ? amountPhp : null,
    source_tag: 'couple_manual',
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Delete a Preparation item from the agenda. The couple can remove their own
 * items AND dismiss vendor-added ones (their FOR ALL policy covers both). We
 * scope the delete by item_id + event_id; RLS does the real authorization.
 */
export async function deletePreparationItem(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const itemId = formData.get('item_id');
  if (
    typeof eventId !== 'string' ||
    eventId.length === 0 ||
    typeof itemId !== 'string' ||
    itemId.length === 0
  ) {
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
    .eq('item_id', itemId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/schedule`);
  revalidatePath(`/dashboard/${eventId}`);
}
