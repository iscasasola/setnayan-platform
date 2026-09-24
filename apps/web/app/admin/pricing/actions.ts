'use server';

import { revalidatePath } from 'next/cache';
import {
  MAX_ONBOARDING_DISCOUNT_PCT,
  DEFAULT_ONBOARDING_DISCOUNT_PCT,
} from '@/lib/onboarding-discount';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { recheckRetailRemovability, computeRetailRemovabilityMap } from '@/lib/admin/pricing-removability';
import { validateRetailRowFields, retailRowUnchanged } from '@/lib/admin/pricing-row-diff';
import {
  changedPriceFields,
  describePriceChange,
  CUSTOMER_PRICE_FIELDS,
} from '@/lib/retail-price-change';

/**
 * /admin/pricing server actions · per-row catalog editor (2026-08-26 rebuild)
 *
 * REPLACES the single `saveAllPricing` bulk-form action. See
 * WHATS_NEXT_Managing_Prices_2026-08-26.md § 2:
 *
 *   "Every 'Save all changes' blanks the description of every row whose ⓘ
 *   panel was closed. Measured, not suspected: 32 of the last 34 bulk-edit
 *   rows wiped a description; 0 preserved one."
 *
 * The bug was a SHAPE problem: a field that only exists in the DOM while its
 * disclosure panel is open is a field a bulk-diff will read as "changed to
 * empty" the instant the panel is closed. The fix is also a shape fix — every
 * action below owns exactly ONE row's fields, and every field that row owns
 * is ALWAYS in the form while it is open (see catalog-editor.tsx), so there
 * is no field left to silently blank. A description this file never received
 * is a description this file never touches.
 *
 * Each action returns a `RowActionState` for `useActionState` rather than
 * redirecting — the browsing screen (search text, which shelf is open, which
 * card is expanded) is CLIENT state, and a redirect would blow all of it away
 * on every single save. The caller calls `router.refresh()` on success to
 * re-pull fresh server data in place.
 *
 * Three states, no new enum — see the retirement-metadata migration
 * (20271171390705) for why: on sale = is_active; retired = !is_active with a
 * retired_at stamp; draft = !is_active with no stamp (never launched).
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// `useActionState` initial values live in `_components/action-state.ts`, NOT
// here — a `'use server'` file may export only async functions (Next fails
// the production build on anything else); see that file's docblock.
export type RowActionState = { ok: boolean; message: string | null };

function revalidateCatalogSurfaces() {
  revalidatePath('/pricing');
  revalidatePath('/vendors');
  revalidatePath('/admin/pricing');
}

// ─── Retail (customer SKU) rows — platform_retail_catalog_v2 ──────────────

export async function saveRetailRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  // Every field the row card can submit, read HERE and nowhere else —
  // `scan-admin-jobs.ts` (the generator behind the committed admin job
  // checklist) finds a job's fields by reading `formData.get(...)` calls
  // directly inside this exported function's own body, so the extraction
  // stays inline even though the validation it feeds lives in
  // lib/admin/pricing-row-diff.ts (testable without a request context).
  const code = String(formData.get('service_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing service code.' };
  const title = String(formData.get('title') ?? '');
  if (!title.trim()) return { ok: false, message: 'A price needs a name customers can read.' };
  const desc = String(formData.get('desc') ?? '');
  const price = String(formData.get('price') ?? '');
  const cost = String(formData.get('cost') ?? '');
  const active = formData.get('active') === 'on';
  const onboardingPrice = String(formData.get('onboarding_price') ?? '');
  const billingPeriod = String(formData.get('billing_period') ?? 'one_time');
  const isPaxPriced = formData.get('is_pax_priced') === 'on';
  const paxFloor = String(formData.get('pax_floor') ?? '');
  const paxFloorPrice = String(formData.get('pax_floor_price') ?? '');
  const paxIncrementSize = String(formData.get('pax_increment_size') ?? '');
  const paxIncrementPrice = String(formData.get('pax_increment_price') ?? '');

  const validated = validateRetailRowFields({
    serviceCode: code,
    title,
    desc,
    price,
    cost,
    active,
    onboardingPrice,
    billingPeriod,
    isPaxPriced,
    paxFloor,
    paxFloorPrice,
    paxIncrementSize,
    paxIncrementPrice,
  });
  if (!validated.ok) return { ok: false, message: validated.message };
  const nextRow = validated.next;

  const { data: prior, error: readErr } = await admin
    .from('platform_retail_catalog_v2')
    .select(
      'service_code,title,description,retail_price_php,saas_overhead_cost_php,is_active,onboarding_price_php,billing_period,is_pax_priced,pax_floor,pax_floor_price_php,pax_increment_size,pax_increment_price_php',
    )
    .eq('service_code', code)
    .maybeSingle();
  if (readErr || !prior) {
    return { ok: false, message: "Couldn't find that row — refresh and try again." };
  }

  if (retailRowUnchanged(prior, nextRow)) {
    return { ok: true, message: 'No changes to save.' };
  }

  // ── VENDOR AGREEMENT § 9.1 · changing what a customer PAYS takes two ─────
  //
  // Only the price fields are gated. The title, the customer-facing blurb, the
  // active flag and `saas_overhead_cost_php` save immediately — renaming a SKU
  // is copy, and the cost column is OUR margin, not anyone's bill. See
  // lib/retail-price-change.ts for why this covers every price change rather
  // than only mid-quarter ones: the corpus never bounds the review window, and
  // a guessed boundary would decide whether a money change needs two admins.
  const changed = changedPriceFields(prior, nextRow);

  if (changed.length > 0) {
    const summary = describePriceChange(prior, nextRow);

    // One pending change per SKU. Two approvals in flight could be granted by
    // two different admins and the last write would silently win.
    const { data: alreadyPending } = await admin
      .from('admin_approval_requests')
      .select('approval_id')
      .eq('action_type', 'approve_retail_price_change')
      .eq('target_id', code)
      .eq('status', 'pending')
      .maybeSingle();
    if (alreadyPending) {
      return {
        ok: false,
        message: `A price change for ${code} is already waiting on a second admin — decide that one in /admin/approvals first.`,
      };
    }

    // 🔑 SAVE THE COPY NOW. An admin fixing a typo in a SKU's blurb must not
    // have that edit held hostage by a price change sitting in a queue — and
    // discarding it silently would be worse.
    const priceValues: Record<string, unknown> = {};
    const copyOnly: Record<string, unknown> = { ...nextRow };
    for (const f of changed) {
      priceValues[f] = (nextRow as Record<string, unknown>)[f];
      delete copyOnly[f];
    }

    const { error: copyErr } = await admin
      .from('platform_retail_catalog_v2')
      .update({ ...copyOnly, updated_by_admin_id: adminUserId })
      .eq('service_code', code);
    if (copyErr) {
      return { ok: false, message: `Couldn't save — ${copyErr.message}` };
    }

    const { error: reqErr } = await admin.from('admin_approval_requests').insert({
      action_type: 'approve_retail_price_change',
      target_id: code,
      payload: { service_code: code, fields: priceValues },
      rationale: `Change what customers pay for ${code} — ${summary}`,
      initiated_by: adminUserId,
      // 72 hours, matching the comp and refund gates. A price is not an
      // emergency; an expired request is re-opened deliberately rather than
      // approved days later by someone who has forgotten the reasoning.
      expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    });
    if (reqErr) {
      return { ok: false, message: `Could not open the approval: ${reqErr.message}` };
    }

    const { error: reqAuditErr } = await admin.from('admin_audit_log').insert({
      action: 'v2_retail_price_change_requested',
      target_id: code,
      actor_user_id: adminUserId,
      metadata: { table: 'platform_retail_catalog_v2', service_code: code, changed, summary },
    });
    if (reqAuditErr) {
      console.error('[saveRetailRow] request audit insert failed (non-fatal):', reqAuditErr);
    }

    revalidateCatalogSurfaces();
    return {
      ok: false,
      message: `Everything except the price was saved. Changing what customers pay needs a second admin (Vendor Agreement § 9.1) — the request is open in /admin/approvals: ${summary}`,
    };
  }

  const { error: updateErr } = await admin
    .from('platform_retail_catalog_v2')
    .update({ ...nextRow, updated_by_admin_id: adminUserId })
    .eq('service_code', code);
  if (updateErr) {
    return { ok: false, message: `Couldn't save — ${updateErr.message}` };
  }

  // Reads its error now: this is the paper trail for a catalogue edit, and
  // Supabase RESOLVES with { error } rather than throwing, so a discarded one
  // is silent. Non-fatal — the edit has already succeeded above.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'v2_retail_sku_edit',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_retail_catalog_v2', service_code: code, before: prior, after: nextRow },
  });
  if (auditErr) {
    console.error('[saveRetailRow] audit insert failed (non-fatal):', auditErr);
  }

  revalidateCatalogSurfaces();
  return { ok: true, message: `Saved — ₱${nextRow.retail_price_php.toLocaleString('en-PH')}.` };
}

/**
 * executeRetailPriceChange — the § 9.1 price change, run by the SECOND admin.
 *
 * Called only from the approvals dispatcher, which has already claimed the row
 * atomically and enforced `decided_by <> initiated_by` (the DB constraint
 * `admin_approval_four_eyes` enforces it again).
 *
 * 🔒 THE NUMBERS COME FROM THE PAYLOAD, NEVER RE-READ FROM A FORM. The second
 * admin is approving the exact figures the first one proposed. Re-deriving
 * anything here would let two admins agree to different prices — which is the
 * whole failure this gate exists to prevent.
 */
export async function executeRetailPriceChange(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    payload: unknown;
    initiatedByAdminId: string;
    confirmingAdminId: string;
  },
): Promise<void> {
  const body = (params.payload ?? {}) as {
    service_code?: string;
    fields?: Record<string, unknown>;
  };
  const code = body.service_code;
  if (!code) throw new Error('Price approval has no service code');
  const fields = body.fields ?? {};
  const keys = Object.keys(fields);
  if (keys.length === 0) throw new Error('Price approval carries no fields');

  // Only ever write columns the rule module names as customer prices. A
  // payload that names its own target column is a write primitive, and a
  // second admin must not approve a column they were never shown.
  const allowed = new Set<string>(CUSTOMER_PRICE_FIELDS);
  const bad = keys.filter((k) => !allowed.has(k));
  if (bad.length > 0) {
    throw new Error(`Price approval names non-price column(s): ${bad.join(', ')}`);
  }

  // Re-read so the audit trail carries the real before-state: the request may
  // have sat up to 72 hours, and the copy fields can have moved since.
  const { data: before, error: readErr } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code,title,retail_price_php,onboarding_price_php,billing_period,is_pax_priced,pax_floor_price_php,pax_increment_price_php')
    .eq('service_code', code)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!before) throw new Error(`SKU ${code} no longer exists — it may have been removed since the request.`);

  const { error: updErr } = await admin
    .from('platform_retail_catalog_v2')
    .update({ ...fields, updated_by_admin_id: params.confirmingAdminId })
    .eq('service_code', code);
  if (updErr) throw new Error(`Price change failed: ${updErr.message}`);

  // ⚠ The only place two admins are recorded together for this change. Loud
  // but non-fatal: the price is already live and must not be rolled back
  // because a log write did not land.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'v2_retail_price_changed',
    target_id: code,
    actor_user_id: params.confirmingAdminId,
    metadata: {
      table: 'platform_retail_catalog_v2',
      service_code: code,
      before,
      after: fields,
      initiated_by: params.initiatedByAdminId,
      confirmed_by: params.confirmingAdminId,
    },
  });
  if (auditErr) {
    console.error(
      '[executeRetailPriceChange] audit insert FAILED — the price is live but unrecorded:',
      auditErr,
    );
  }

  revalidateCatalogSurfaces();
}

export async function retireRetailRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();
  const code = String(formData.get('service_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing service code.' };

  const reasonRaw = String(formData.get('reason') ?? '').trim();
  const replacedByRaw = String(formData.get('replaced_by') ?? '').trim();

  const { data: prior } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code,is_active,retired_at')
    .eq('service_code', code)
    .maybeSingle();
  if (!prior) return { ok: false, message: "Couldn't find that row — refresh and try again." };

  const { error } = await admin
    .from('platform_retail_catalog_v2')
    .update({
      is_active: false,
      retired_at: new Date().toISOString(),
      retired_by_admin_id: adminUserId,
      retirement_reason: reasonRaw === '' ? null : reasonRaw,
      replaced_by_service_code: replacedByRaw === '' ? null : replacedByRaw,
      updated_by_admin_id: adminUserId,
    })
    .eq('service_code', code);
  if (error) return { ok: false, message: `Couldn't retire it — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'v2_retail_retire',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_retail_catalog_v2', service_code: code, before: prior, reason: reasonRaw || null, replaced_by: replacedByRaw || null },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: 'Retired — off the public price page.' };
}

export async function reactivateRetailRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();
  const code = String(formData.get('service_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing service code.' };

  const { error } = await admin
    .from('platform_retail_catalog_v2')
    .update({
      is_active: true,
      retired_at: null,
      retired_by_admin_id: null,
      retirement_reason: null,
      replaced_by_service_code: null,
      updated_by_admin_id: adminUserId,
    })
    .eq('service_code', code);
  if (error) return { ok: false, message: `Couldn't put it back on sale — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'v2_retail_reactivate',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_retail_catalog_v2', service_code: code },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: 'Back on sale.' };
}

export async function removeRetailRowForGood(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();
  const code = String(formData.get('service_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing service code.' };

  const { data: prior } = await admin
    .from('platform_retail_catalog_v2')
    .select('*')
    .eq('service_code', code)
    .maybeSingle();
  if (!prior) return { ok: true, message: 'Already gone.' };
  if (prior.is_active) {
    return { ok: false, message: 'This is on sale — retire it first.' };
  }

  // The render-time flag is up to a page-load stale; re-measure right now,
  // server-side, before doing anything irreversible.
  const check = await recheckRetailRemovability(admin, code);
  if (!check.safeToRemove) {
    return {
      ok: false,
      message: `Can't remove it — ${check.reasons[0] ?? 'something still depends on it'}.`,
    };
  }

  const { error } = await admin.from('platform_retail_catalog_v2').delete().eq('service_code', code);
  if (error) return { ok: false, message: `Couldn't remove it — ${error.message}` };

  // Logged AFTER the delete actually lands — an audit row claiming a removal
  // that then failed would be worse than no row at all.
  await admin.from('admin_audit_log').insert({
    action: 'v2_retail_delete',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_retail_catalog_v2', service_code: code, before: prior },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: 'Removed for good.' };
}

export type RemoveAllState = { ok: boolean; message: string | null; removed: number };

/**
 * "Remove all N for good" — re-derives the safe set SERVER-SIDE (never trusts
 * the list the confirmation modal showed, which could be a minute stale) and
 * removes exactly that set. One admin_audit_log row per removed SKU, same as
 * the single-row action, so the history stays row-addressable.
 */
export async function removeAllSafeRetailRows(): Promise<RemoveAllState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const { data: retired } = await admin
    .from('platform_retail_catalog_v2')
    .select('*')
    .eq('is_active', false);
  const rows = retired ?? [];
  if (rows.length === 0) return { ok: true, message: 'Nothing retired to remove.', removed: 0 };

  const codes = rows.map((r) => r.service_code as string);
  const removability = await computeRetailRemovabilityMap(admin, codes);

  const safeRows = rows.filter((r) => removability.get(r.service_code as string)?.safeToRemove);
  if (safeRows.length === 0) {
    return { ok: true, message: 'Nothing was actually safe to remove — refresh and check again.', removed: 0 };
  }

  const { error } = await admin
    .from('platform_retail_catalog_v2')
    .delete()
    .in('service_code', safeRows.map((r) => r.service_code as string));
  if (error) {
    return { ok: false, message: `Removed 0 — ${error.message}`, removed: 0 };
  }

  // Logged AFTER the delete lands, one row per SKU actually removed.
  const auditRows = safeRows.map((r) => ({
    action: 'v2_retail_delete',
    target_id: r.service_code as string,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_retail_catalog_v2', service_code: r.service_code, before: r, bulk: true },
  }));
  await admin.from('admin_audit_log').insert(auditRows);

  revalidateCatalogSurfaces();
  return { ok: true, message: `Removed ${safeRows.length} for good.`, removed: safeRows.length };
}

// ─── Bundles — platform_package_catalog ───────────────────────────────────
// Remove-for-good is deliberately NOT offered on bundles — WHATS_NEXT_
// Managing_Prices_2026-08-26.md § 7.3 leaves the wiring check for bundles +
// vendor rows unrun ("not yet checked"). Save + retire + reactivate only.

export async function saveBundleRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const code = String(formData.get('package_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing bundle code.' };
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { ok: false, message: 'A bundle needs a name.' };
  const price = Number(formData.get('price'));
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, message: 'Price must be a number, ₱0 or more.' };
  }
  const descRaw = String(formData.get('desc') ?? '').trim();
  const description = descRaw === '' ? null : descRaw;
  const active = formData.get('active') === 'on';

  const { data: prior } = await admin
    .from('platform_package_catalog')
    .select('package_code,title,description,retail_price_php,is_active')
    .eq('package_code', code)
    .maybeSingle();
  if (!prior) return { ok: false, message: "Couldn't find that bundle — refresh and try again." };

  const priceR = round2(price);
  const same =
    prior.title === title &&
    (prior.description ?? null) === description &&
    Number(prior.retail_price_php) === priceR &&
    prior.is_active === active;
  if (same) return { ok: true, message: 'No changes to save.' };

  const { error } = await admin
    .from('platform_package_catalog')
    .update({ title, description, retail_price_php: priceR, is_active: active, updated_by_admin_id: adminUserId })
    .eq('package_code', code);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'v2_bundle_sku_edit',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_package_catalog', package_code: code, before: prior, after: { title, description, retail_price_php: priceR, is_active: active } },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: `Saved — ₱${priceR.toLocaleString('en-PH')}.` };
}

export async function retireBundleRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();
  const code = String(formData.get('package_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing bundle code.' };
  const reasonRaw = String(formData.get('reason') ?? '').trim();
  const replacedByRaw = String(formData.get('replaced_by') ?? '').trim();

  const { data: prior } = await admin
    .from('platform_package_catalog')
    .select('package_code')
    .eq('package_code', code)
    .maybeSingle();
  if (!prior) return { ok: false, message: "Couldn't find that bundle — refresh and try again." };

  const { error } = await admin
    .from('platform_package_catalog')
    .update({
      is_active: false,
      retired_at: new Date().toISOString(),
      retired_by_admin_id: adminUserId,
      retirement_reason: reasonRaw === '' ? null : reasonRaw,
      replaced_by_package_code: replacedByRaw === '' ? null : replacedByRaw,
      updated_by_admin_id: adminUserId,
    })
    .eq('package_code', code);
  if (error) return { ok: false, message: `Couldn't retire it — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'v2_bundle_retire',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_package_catalog', package_code: code, reason: reasonRaw || null, replaced_by: replacedByRaw || null },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: 'Retired — off the public price page.' };
}

export async function reactivateBundleRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();
  const code = String(formData.get('package_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing bundle code.' };

  const { error } = await admin
    .from('platform_package_catalog')
    .update({
      is_active: true,
      retired_at: null,
      retired_by_admin_id: null,
      retirement_reason: null,
      replaced_by_package_code: null,
      updated_by_admin_id: adminUserId,
    })
    .eq('package_code', code);
  if (error) return { ok: false, message: `Couldn't put it back on sale — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'v2_bundle_reactivate',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_package_catalog', package_code: code },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: 'Back on sale.' };
}

// ─── Vendor pricing — vendor_billing_catalog ───────────────────────────────
// Title stays migration-owned (wires tier gates) — unchanged from before.

export async function saveVendorRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const code = String(formData.get('sku_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing SKU code.' };
  const price = Number(formData.get('price'));
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, message: 'Vendor prices must be greater than ₱0.' };
  }
  const descRaw = String(formData.get('desc') ?? '').trim();
  const description = descRaw === '' ? null : descRaw;
  const active = formData.get('active') === 'on';

  const { data: prior } = await admin
    .from('vendor_billing_catalog')
    .select('sku_code,description,price_php,is_active')
    .eq('sku_code', code)
    .maybeSingle();
  if (!prior) return { ok: false, message: "Couldn't find that row — refresh and try again." };

  const priceR = round2(price);
  const same =
    Number(prior.price_php) === priceR &&
    (prior.description ?? null) === description &&
    prior.is_active === active;
  if (same) return { ok: true, message: 'No changes to save.' };

  const { error } = await admin
    .from('vendor_billing_catalog')
    .update({ price_php: priceR, description, is_active: active, updated_at: new Date().toISOString() })
    .eq('sku_code', code);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'v2_vendor_sku_edit',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'vendor_billing_catalog', sku_code: code, before: prior, after: { price_php: priceR, description, is_active: active } },
  });

  revalidateCatalogSurfaces();
  revalidatePath('/admin/payments');
  return { ok: true, message: `Saved — ₱${priceR.toLocaleString('en-PH')}.` };
}

export async function retireVendorRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();
  const code = String(formData.get('sku_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing SKU code.' };
  const reasonRaw = String(formData.get('reason') ?? '').trim();
  const replacedByRaw = String(formData.get('replaced_by') ?? '').trim();

  const { data: prior } = await admin
    .from('vendor_billing_catalog')
    .select('sku_code')
    .eq('sku_code', code)
    .maybeSingle();
  if (!prior) return { ok: false, message: "Couldn't find that row — refresh and try again." };

  const { error } = await admin
    .from('vendor_billing_catalog')
    .update({
      is_active: false,
      retired_at: new Date().toISOString(),
      retired_by_admin_id: adminUserId,
      retirement_reason: reasonRaw === '' ? null : reasonRaw,
      replaced_by_sku_code: replacedByRaw === '' ? null : replacedByRaw,
      updated_at: new Date().toISOString(),
    })
    .eq('sku_code', code);
  if (error) return { ok: false, message: `Couldn't retire it — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'v2_vendor_retire',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'vendor_billing_catalog', sku_code: code, reason: reasonRaw || null, replaced_by: replacedByRaw || null },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: 'Retired — off the public price page.' };
}

export async function reactivateVendorRow(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();
  const code = String(formData.get('sku_code') ?? '').trim();
  if (!code) return { ok: false, message: 'Missing SKU code.' };

  const { error } = await admin
    .from('vendor_billing_catalog')
    .update({
      is_active: true,
      retired_at: null,
      retired_by_admin_id: null,
      retirement_reason: null,
      replaced_by_sku_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq('sku_code', code);
  if (error) return { ok: false, message: `Couldn't put it back on sale — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'v2_vendor_reactivate',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'vendor_billing_catalog', sku_code: code },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: 'Back on sale.' };
}

/*
  ── THE HOUSE SET-UP DISCOUNT IS RETIRED AS A CONTROL, 2026-08-29 ───────────
  Owner: *"this one doesn't exist anymore. onboarding discounts are already
  placed for setnayan AI and Papic which are the only services we sell on the
  onboarding."* That SUPERSEDES his 2026-08-28 *"I want to be able to change 10%
  anytime"* — it is a reversal, not a mistake being corrected.

  `saveOnboardingDiscount` and its form are DELETED because after the box came
  off the screen nothing could reach them, and an action with no caller is the
  shape this repo keeps paying for.

  ⚠ `platform_settings.onboarding_discount_pct` AND ITS READERS ARE KEPT, AND
  THIS IS THE PART TO NOT "TIDY UP". `onboarding-services-orders.ts` and
  `onboarding/services-step-server.ts` still read it as the fallback for a
  product with NO sign-up price of its own. Measured 2026-08-29: the set-up step
  sells exactly two families — Papic rungs and Setnayan AI — and every one of
  those rows carries its own `onboarding_price_php`, so the fallback governs
  nothing today. It costs nothing and removing it is its own change with its own
  measurement. Removing a CONTROL is not removing a CAPABILITY.
*/

/*
  ── THE PLATFORM-FEE EDITOR IS GONE TOO, 2026-09-18 (S34) ─────────────────────
  `saveFeeSetting` and `_components/fee-form.tsx` were taken off the screen on
  2026-08-29 (see pricing-surface.tsx) and left behind with no caller. Deleted,
  same reasoning as the set-up discount above.

  ⚠ `platform_settings.setnayan_pay_fee_pct` IS STILL READ: `getSetnayanFeeBps`
  in lib/payouts.ts is the fallback in the payout dispatch in
  app/admin/payments/actions.ts, for an order with no `setnayan_fee_bps`
  snapshot. It is not editable from any screen now; the stored value (or the
  5.0% constant) holds. Bringing a control back is the owner's call.
*/
