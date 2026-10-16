'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS, isR2Configured, r2SignedGet, r2Upload } from '@/lib/r2';
import { EXPENSE_CATEGORIES } from '@/lib/admin/platform-expenses';
import { clampTarget, coerceTargets } from '@/lib/telemetry/load-timing';
import { routePatterns } from '@/lib/telemetry/load-timing.server';

/**
 * Server actions for the Expenses & Receipts zone (App Performance PR 3).
 *
 * Admin gate mirrors admin/verify/actions.ts: the session user must be
 * internal / team / admin. Writes go through the service-role client after
 * the gate (RLS on platform_expenses is admin-only as well — defense in
 * depth, not the only line).
 *
 * Receipts land in the PRIVATE vendor-contracts bucket under a
 * `platform-receipts/` prefix (financial documents — never the public media
 * bucket) and are viewed via short-lived signed GETs.
 */

const RECEIPT_PREFIX = 'platform-receipts';
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB
const RECEIPT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: me } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Admin only.');
  }
  return user.id;
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function addExpense(formData: FormData): Promise<void> {
  const userId = await requireAdmin();

  const expensedOn = str(formData.get('expensed_on'));
  const vendorName = str(formData.get('vendor_name'));
  const category = str(formData.get('category'));
  const amount = Number.parseFloat(str(formData.get('amount_php')));
  const note = str(formData.get('note'));
  const nextDueOn = str(formData.get('next_due_on'));
  const recursMonthly = formData.get('recurs_monthly') === 'on';

  if (!expensedOn || !vendorName) throw new Error('Date and supplier are required.');
  if (!EXPENSE_CATEGORIES.some((c) => c.key === category)) {
    throw new Error('Unknown category.');
  }
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Bad amount.');

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from('platform_expenses')
    .insert({
      expensed_on: expensedOn,
      vendor_name: vendorName,
      category,
      amount_php: amount,
      note: note || null,
      next_due_on: nextDueOn || null,
      recurs_monthly: recursMonthly,
      created_by: userId,
    })
    .select('expense_id')
    .single();
  if (error) throw new Error(error.message);

  // Optional receipt attached at logging time — one round trip for the
  // common "log it with the invoice in hand" path.
  const receipt = formData.get('receipt');
  if (receipt instanceof File && receipt.size > 0) {
    await attachReceiptFile(String(inserted.expense_id), receipt);
  }

  revalidatePath('/admin/app-performance');
}

async function attachReceiptFile(expenseId: string, file: File): Promise<void> {
  if (!isR2Configured()) throw new Error('R2 is not configured on this environment.');
  if (file.size > MAX_RECEIPT_BYTES) throw new Error('Receipt over 10 MB.');
  if (!RECEIPT_TYPES.has(file.type)) throw new Error('Receipt must be PDF/JPG/PNG/WebP.');

  const ext = file.type === 'application/pdf' ? 'pdf' : (file.type.split('/')[1] ?? 'bin');
  const key = `${RECEIPT_PREFIX}/${expenseId}.${ext}`;
  await r2Upload({
    bucket: R2_BUCKETS.vendorContracts,
    key,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
  });

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_expenses')
    .update({
      receipt_r2_key: key,
      receipt_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('expense_id', expenseId);
  if (error) throw new Error(error.message);
}

export async function attachReceipt(formData: FormData): Promise<void> {
  await requireAdmin();
  const expenseId = str(formData.get('expense_id'));
  const file = formData.get('receipt');
  if (!expenseId || !(file instanceof File) || file.size === 0) {
    throw new Error('Pick a receipt file.');
  }
  await attachReceiptFile(expenseId, file);
  revalidatePath('/admin/app-performance');
}

/** Redirects to a 10-minute signed URL for the stored receipt. */
export async function viewReceipt(formData: FormData): Promise<void> {
  await requireAdmin();
  const expenseId = str(formData.get('expense_id'));
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('platform_expenses')
    .select('receipt_r2_key')
    .eq('expense_id', expenseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.receipt_r2_key) throw new Error('No receipt on this expense.');
  const url = await r2SignedGet({
    bucket: R2_BUCKETS.vendorContracts,
    key: data.receipt_r2_key,
    expiresIn: 600,
  });
  redirect(url);
}

/**
 * ⏱ A page's load-time target (the Slow loads tab, 2026-10-16). Seconds in,
 * ms stored in platform_settings.load_time_targets, clamped to 1–30 s (never
 * below what the browser always sends — lib/telemetry/load-timing.ts). Empty or
 * "Use 1.5 s" removes the override, so the page falls back to the default.
 * Only a route the app actually has (or one already holding a target) may be
 * set — the map can never fill with invented keys. Desktop only: the phone
 * admin answers, it does not edit (owner ruling 2026-08-26).
 */
export async function saveLoadTarget(formData: FormData): Promise<void> {
  const userId = await requireAdmin();
  const route = str(formData.get('route'));
  const clear = formData.get('clear') === '1';
  const seconds = Number.parseFloat(str(formData.get('target_s')));
  const back = (q: string) => redirect(`/admin/app-performance?tab=slow-loads&${q}`);

  const admin = createAdminClient();
  const { data, error } = await admin.from('platform_settings').select('load_time_targets').eq('id', 1).maybeSingle();
  if (error) back(`target=${encodeURIComponent('unread')}`);
  const targets = coerceTargets((data as { load_time_targets?: unknown } | null)?.load_time_targets);
  if (!routePatterns().includes(route) && !(route in targets)) back('target=unknown');

  if (clear || !str(formData.get('target_s'))) {
    delete targets[route];
  } else {
    const ms = clampTarget(Number.isFinite(seconds) ? seconds * 1000 : NaN);
    if (ms === null) back('target=invalid');
    targets[route] = ms as number;
  }

  const { error: saveErr } = await admin
    .from('platform_settings')
    .update({ load_time_targets: targets, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (saveErr) back(`target=${encodeURIComponent('refused')}`);
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'load_time_target_saved',
    actor_user_id: userId,
    metadata: { route, target_ms: targets[route] ?? null },
  });
  if (auditErr) console.error('[saveLoadTarget] audit insert failed (non-fatal):', auditErr);
  revalidatePath('/admin/app-performance');
  back('target=saved');
}
