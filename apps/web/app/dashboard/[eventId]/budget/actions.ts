'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import {
  fetchBudgetSnapshot,
  buildBudgetLiveSummary,
  type BudgetLiveSummary,
} from '@/lib/budget';

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

  // Both surfaces share the same VendorItemizationCard component since the
  // 2026-05-22 extraction. Revalidating /budget alone left the workspace
  // page rendering stale data when the host added a milestone from the
  // embedded card. The workspace revalidation uses the path pattern; the
  // dynamic [eventVendorId] segment matches `vendor_id` 1:1 because
  // workspace pages are routed by event_vendor.vendor_id.
  revalidatePath(`/dashboard/${eventId}/budget`);
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
}

export type SuggestMilestonesResult =
  | { ok: true; created: number }
  | { ok: false; error: string };

/**
 * One-click "suggest a deposit + balance split" for an off-platform (manual)
 * vendor that has a lump-sum total but no dated milestones yet. Seeds two
 * editable, deletable line items — Deposit (50%, due now) + Balance (50%, due
 * ~2 weeks before the event) — so the couple's live "next payments" list and
 * the .ics export populate without hand-typing each milestone.
 *
 * Deliberately NOT silent auto-creation: it fires only from an explicit button,
 * only when the vendor is manual-priced (no vendor catalog items — adding manual
 * rows on top of those would double-count the total), has a total > 0, and has
 * ZERO existing line items (so it never duplicates or fights host edits). The
 * 50/50 split is the common PH vendor term; every field stays editable after.
 */
export async function addSuggestedMilestones(
  formData: FormData,
): Promise<SuggestMilestonesResult> {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    return { ok: false, error: 'Invalid input.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Resolve the vendor's headline total + the event date (for the balance due
  // date) under the couple's RLS — proves ownership implicitly.
  const [vendorRes, eventRes, existingRes] = await Promise.all([
    supabase
      .from('event_vendors')
      .select('vendor_id, total_cost_php, marketplace_vendor_id')
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .maybeSingle(),
    supabase.from('events').select('event_date').eq('event_id', eventId).maybeSingle(),
    supabase
      .from('event_vendor_line_items')
      .select('line_item_id')
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .limit(1),
  ]);

  const vendor = vendorRes.data as
    | { total_cost_php: number | null; marketplace_vendor_id: string | null }
    | null;
  if (!vendor) return { ok: false, error: 'Vendor not found.' };

  // Marketplace vendors set their own payment plan / catalog pricing — manual
  // milestones there would double-count. Suggestion is for off-platform vendors.
  if (vendor.marketplace_vendor_id !== null) {
    return {
      ok: false,
      error: 'This vendor sets their own payment plan, so a suggested split isn’t needed.',
    };
  }

  const total = Number(vendor.total_cost_php ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    return {
      ok: false,
      error: 'Add a total cost for this vendor first, then we can suggest a split.',
    };
  }

  // Guard against duplicates / fighting host edits — only seed when empty.
  if ((existingRes.data ?? []).length > 0) {
    return {
      ok: false,
      error: 'This vendor already has line items. Add or edit them individually.',
    };
  }

  // 50/50 split; balance absorbs the rounding remainder so the two always sum
  // to the exact total (no centavo drift).
  const deposit = Math.round(total * 0.5 * 100) / 100;
  const balance = Math.round((total - deposit) * 100) / 100;

  // Deposit due today (deposits are paid at contracting); balance due ~14 days
  // before the event when a date exists and that date is still in the future,
  // else left undated for the host to set.
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const depositDue = iso(today);
  let balanceDue: string | null = null;
  const eventDateRaw = (eventRes.data as { event_date: string | null } | null)?.event_date;
  if (eventDateRaw && isIsoDate(eventDateRaw)) {
    const bal = new Date(`${eventDateRaw}T00:00:00`);
    bal.setDate(bal.getDate() - 14);
    if (bal > today) balanceDue = iso(bal);
  }

  const { error } = await supabase.from('event_vendor_line_items').insert([
    {
      event_id: eventId,
      vendor_id: vendorId,
      label: 'Deposit (50%)',
      amount_php: deposit,
      due_date: depositDue,
      sort_order: 0,
    },
    {
      event_id: eventId,
      vendor_id: vendorId,
      label: 'Balance (50%)',
      amount_php: balance,
      due_date: balanceDue,
      sort_order: 1,
    },
  ]);
  if (error) {
    return {
      ok: false,
      error: 'Couldn’t add the suggested payments. Please try again.',
    };
  }

  revalidatePath(`/dashboard/${eventId}/budget`);
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
  return { ok: true, created: 2 };
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

  // Look up the vendor_id before the delete so we can revalidate the
  // matching workspace path after. RLS scopes the SELECT to the host's own
  // events; missing row → just skip the workspace revalidation.
  const { data: lineRow } = await supabase
    .from('event_vendor_line_items')
    .select('vendor_id')
    .eq('line_item_id', lineItemId)
    .eq('event_id', eventId)
    .maybeSingle();

  const { error } = await supabase
    .from('event_vendor_line_items')
    .delete()
    .eq('line_item_id', lineItemId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/budget`);
  if (lineRow?.vendor_id) {
    revalidatePath(`/dashboard/${eventId}/vendors/${lineRow.vendor_id}/workspace`);
  }
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

  // Vendor-controlled-line-item selection convention — the budget page
  // surfaces vendor_package_items + vendor_services entries in the same
  // payment-attribution dropdown as event_vendor_line_items rows, but
  // those vendor-controlled rows don't have a corresponding row in the
  // local event_vendor_line_items table to FK to.
  //
  // To preserve the FK constraint, the budget page tags vendor-
  // controlled options with a synthetic value of the form `vc:<label>`
  // (see budget/page.tsx PaymentSection optgroup). When the action sees
  // this prefix, it writes line_item_id=NULL and stores the label in
  // notes so the payment record still shows what the host attributed
  // the payment to.
  let lineItemId: string | null = null;
  let vendorControlledLabel: string | null = null;
  if (typeof lineItemRaw === 'string' && lineItemRaw.length > 0) {
    if (lineItemRaw.startsWith('vc:')) {
      vendorControlledLabel = lineItemRaw.slice(3);
    } else {
      lineItemId = lineItemRaw;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Resolve notes — prefer the explicit notes field if the host typed
  // one, otherwise fall back to the vendor-controlled label so the
  // payment list renders something meaningful next to the amount.
  const explicitNotes = nullIfBlank(formData.get('notes'));
  const notes = explicitNotes ?? vendorControlledLabel;

  // Optional receipt screenshot the host attaches to their own payment
  // record. Couples pay vendors off-platform, so this is the host's
  // evidence of the transfer — NOT a Setnayan-verified proof. The
  // FileUpload widget submits an `r2://media/…` ref; absent an upload the
  // field is blank → stored NULL. Column added by migration
  // 20260820000000_vendor_payment_methods.sql (nullable TEXT).
  const proofR2Key = nullIfBlank(formData.get('proof_r2_key'));

  // Optional installment attribution (Phase 2 PR-C) — when the booking has a
  // frozen payment plan (event_vendor_payment_plan.instances_json), the host can
  // tie this payment to a specific installment by its `seq`. NULL = a generic
  // payment not attributed to any installment. Column added by migration
  // 20270202160006_event_vendor_payment_confirm.sql (nullable INT).
  const seqRaw = formData.get('schedule_instance_seq');
  let scheduleInstanceSeq: number | null = null;
  if (typeof seqRaw === 'string' && seqRaw.length > 0) {
    const parsed = Number.parseInt(seqRaw, 10);
    if (Number.isInteger(parsed) && parsed >= 0) scheduleInstanceSeq = parsed;
  }

  const { error } = await supabase.from('event_vendor_payments').insert({
    event_id: eventId,
    vendor_id: vendorId,
    line_item_id: lineItemId,
    amount_php: amount,
    paid_at: paidAt,
    method: nullIfBlank(formData.get('method')),
    reference: nullIfBlank(formData.get('reference')),
    notes,
    proof_r2_key: proofR2Key,
    schedule_instance_seq: scheduleInstanceSeq,
  });
  if (error) throw new Error(error.message);

  // Phase 2 PR-C — notify the VENDOR a payment was logged against their
  // booking so they can confirm receipt in the thread. Best-effort: a failed
  // notify must never roll back the recorded payment. Resolve the booking's
  // marketplace vendor owner via the admin client (the couple can't read
  // vendor_profiles); off-platform/manual vendors (no marketplace_vendor_id)
  // have no vendor account to notify, so this quietly no-ops.
  try {
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from('event_vendors')
      .select('marketplace_vendor_id, vendor_name')
      .eq('vendor_id', vendorId)
      .maybeSingle();
    if (ev?.marketplace_vendor_id) {
      const { data: vp } = await admin
        .from('vendor_profiles')
        .select('user_id')
        .eq('vendor_profile_id', ev.marketplace_vendor_id)
        .maybeSingle();
      const { data: thread } = await admin
        .from('chat_threads')
        .select('thread_id')
        .eq('event_id', eventId)
        .eq('vendor_profile_id', ev.marketplace_vendor_id)
        .maybeSingle();
      if (vp?.user_id) {
        const proofLine = proofR2Key ? ' A receipt is attached.' : '';
        await emitNotification({
          userId: vp.user_id,
          type: 'payment_logged',
          title: 'A couple logged a payment',
          body: `The couple recorded a ₱${amount.toLocaleString('en-PH')} payment.${proofLine} Confirm it was received.`,
          relatedUrl: thread?.thread_id
            ? `/vendor-dashboard/messages/${thread.thread_id}`
            : '/vendor-dashboard/messages',
        });
      }
    }
  } catch (e) {
    console.error('[budget] payment_logged notify failed:', e);
  }

  // Revalidate both /budget AND the workspace page — the embedded
  // VendorItemizationCard on the workspace surface needs the new payment
  // row + recomputed totals on the next visit.
  revalidatePath(`/dashboard/${eventId}/budget`);
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/workspace`);
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

  // Look up the vendor_id before the delete for the workspace revalidation
  // path. Same pattern as deleteLineItem above — missing row just skips.
  const { data: paymentRow } = await supabase
    .from('event_vendor_payments')
    .select('vendor_id')
    .eq('payment_id', paymentId)
    .eq('event_id', eventId)
    .maybeSingle();

  const { error } = await supabase
    .from('event_vendor_payments')
    .delete()
    .eq('payment_id', paymentId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/budget`);
  if (paymentRow?.vendor_id) {
    revalidatePath(`/dashboard/${eventId}/vendors/${paymentRow.vendor_id}/workspace`);
  }
}

/**
 * Re-read the budget snapshot and return the live payment-progress summary
 * (total to pay / paid / balance / % + next coming payments). Called by the
 * BudgetLiveSummaryCard whenever a Realtime change lands on the event's
 * payments or line items, so the card refreshes its numbers without a page
 * reload.
 *
 * Uses the RLS-scoped authed client — the snapshot only ever covers the
 * caller's own event. Returns null on no-auth / bad input / transient
 * failure; the card keeps its last-known values rather than flashing an
 * error (Realtime auto-reconnects and the next event heals the gap).
 */
export async function getBudgetLiveSummary(
  eventId: string,
): Promise<BudgetLiveSummary | null> {
  if (typeof eventId !== 'string' || eventId.length === 0) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  try {
    const snapshot = await fetchBudgetSnapshot(supabase, eventId);
    return buildBudgetLiveSummary(snapshot);
  } catch {
    return null;
  }
}
