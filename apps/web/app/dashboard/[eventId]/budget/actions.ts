'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Hard upper bound on the budget setter (₱100,000,000 = 10_000_000_000
// centavos). Captures real-world Filipino wedding budgets without
// allowing nonsense values that would trip the BIGINT column or skew
// projections downstream in BudgetCountdownHeader.
const MAX_BUDGET_PHP = 100_000_000;

export type SetEventBudgetResult =
  | { ok: true; budgetCentavos: number | null }
  | { ok: false; error: string };

/**
 * Parses the host's free-form PHP budget input and persists it onto
 * events.estimated_budget_centavos. Closes the BudgetCountdownHeader
 * loop landed in PR #329 (2026-05-22) — that header was already reading
 * the column defensively, this action is what populates it.
 *
 * Accepts:
 *   • Numeric strings: "680000", "1500000.50"
 *   • Display-formatted: "₱ 680,000", "680,000.00", "1,500,000.50"
 *   • Empty/blank: clears the target (sets column to NULL)
 *
 * Rejects:
 *   • Non-numeric strings after symbol/comma strip
 *   • Negative numbers
 *   • Values above ₱100M (caught before DB to keep error message kind)
 *
 * Revalidates both the budget page (so the form re-renders with the new
 * value) and the event home (so BudgetCountdownHeader picks up the new
 * target on the next visit without a hard refresh).
 */
export async function setEventBudget(formData: FormData): Promise<SetEventBudgetResult> {
  const eventIdRaw = formData.get('event_id');
  const budgetRaw = formData.get('budget_php');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    return { ok: false, error: 'Missing event reference. Please refresh and try again.' };
  }

  // Empty input = clear the target. Useful when a host wants to step
  // back to the unset state and re-think their number.
  const stripped =
    typeof budgetRaw === 'string'
      ? budgetRaw.replace(/[₱,\s]/g, '').trim()
      : '';

  let budgetCentavos: number | null = null;
  if (stripped.length > 0) {
    const php = Number(stripped);
    if (!Number.isFinite(php)) {
      return {
        ok: false,
        error: 'Please enter a number — for example, 680,000 or 1,500,000.',
      };
    }
    if (php < 0) {
      return { ok: false, error: 'Budget can’t be negative.' };
    }
    if (php > MAX_BUDGET_PHP) {
      return {
        ok: false,
        error: 'Please enter a budget between ₱0 and ₱100,000,000.',
      };
    }
    // PHP centavos = round to avoid floating-point drift on inputs
    // like "1500000.555". Round half-up to nearest centavo.
    budgetCentavos = Math.round(php * 100);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('events')
    .update({ estimated_budget_centavos: budgetCentavos })
    .eq('event_id', eventIdRaw);

  if (error) {
    // RLS denial surfaces as a generic Postgres error — translate to
    // brand voice so the host doesn't see a raw error string.
    return {
      ok: false,
      error:
        'Couldn’t save your budget. If this keeps happening, please reach out from /help.',
    };
  }

  // Both surfaces need fresh data: this page for the form value, the
  // event home so BudgetCountdownHeader picks up the new target.
  revalidatePath(`/dashboard/${eventIdRaw}/budget`);
  revalidatePath(`/dashboard/${eventIdRaw}`);

  return { ok: true, budgetCentavos };
}

function parseMoney(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function parseRequiredMoney(raw: FormDataEntryValue | null): number {
  const v = parseMoney(raw);
  if (v === null || v <= 0) throw new Error('Amount must be a positive number');
  return v;
}

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function addLineItem(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const label = formData.get('label');
  const dueDateRaw = formData.get('due_date');

  if (typeof eventId !== 'string' || typeof vendorId !== 'string' || typeof label !== 'string') {
    throw new Error('Invalid input');
  }
  const trimmedLabel = label.trim();
  if (trimmedLabel.length === 0 || trimmedLabel.length > 64) {
    throw new Error('Label must be 1–64 chars');
  }
  const amount = parseRequiredMoney(formData.get('amount_php'));
  const dueDate =
    typeof dueDateRaw === 'string' && dueDateRaw.length > 0 && isIsoDate(dueDateRaw)
      ? dueDateRaw
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('event_vendor_line_items').insert({
    event_id: eventId,
    vendor_id: vendorId,
    label: trimmedLabel,
    amount_php: amount,
    due_date: dueDate,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/budget`);
}

export async function deleteLineItem(formData: FormData) {
  const eventId = formData.get('event_id');
  const lineItemId = formData.get('line_item_id');
  if (typeof eventId !== 'string' || typeof lineItemId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_vendor_line_items')
    .delete()
    .eq('line_item_id', lineItemId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/budget`);
}

export async function logPayment(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const lineItemRaw = formData.get('line_item_id');
  const paidAtRaw = formData.get('paid_at');

  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    throw new Error('Invalid input');
  }
  const amount = parseRequiredMoney(formData.get('amount_php'));
  const paidAt =
    typeof paidAtRaw === 'string' && paidAtRaw.length > 0 && isIsoDate(paidAtRaw)
      ? paidAtRaw
      : new Date().toISOString().slice(0, 10);
  const lineItemId =
    typeof lineItemRaw === 'string' && lineItemRaw.length > 0 ? lineItemRaw : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('event_vendor_payments').insert({
    event_id: eventId,
    vendor_id: vendorId,
    line_item_id: lineItemId,
    amount_php: amount,
    paid_at: paidAt,
    method: nullIfBlank(formData.get('method')),
    reference: nullIfBlank(formData.get('reference')),
    notes: nullIfBlank(formData.get('notes')),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/budget`);
}

export async function deletePayment(formData: FormData) {
  const eventId = formData.get('event_id');
  const paymentId = formData.get('payment_id');
  if (typeof eventId !== 'string' || typeof paymentId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_vendor_payments')
    .delete()
    .eq('payment_id', paymentId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/budget`);
}
