'use server';

import { revalidatePath } from 'next/cache';
import {
  MAX_ONBOARDING_DISCOUNT_PCT,
  DEFAULT_ONBOARDING_DISCOUNT_PCT,
} from '@/lib/onboarding-discount';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { SETNAYAN_PAY_FEE_PCT } from '@/lib/vendor-earnings';
import { recheckRetailRemovability, computeRetailRemovabilityMap } from '@/lib/admin/pricing-removability';
import { validateRetailRowFields, retailRowUnchanged } from '@/lib/admin/pricing-row-diff';

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

  const { error: updateErr } = await admin
    .from('platform_retail_catalog_v2')
    .update({ ...nextRow, updated_by_admin_id: adminUserId })
    .eq('service_code', code);
  if (updateErr) {
    return { ok: false, message: `Couldn't save — ${updateErr.message}` };
  }

  await admin.from('admin_audit_log').insert({
    action: 'v2_retail_sku_edit',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: { table: 'platform_retail_catalog_v2', service_code: code, before: prior, after: nextRow },
  });

  revalidateCatalogSurfaces();
  return { ok: true, message: `Saved — ₱${nextRow.retail_price_php.toLocaleString('en-PH')}.` };
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

// ─── The set-up discount — platform_settings.onboarding_discount_pct ──────

/**
 * ⚖ OWNER, 2026-08-28: *"I want to be able to change 10% anytime. so I can set
 * discount on onboarding today and change it tomorrow. or anytime i want."*
 *
 * 🔴 THE FIRST ANSWER WAS A STAMP, NOT A DIAL. The house 10% shipped as sixteen
 * per-row prices written once by a migration. That does not follow a reprice, it
 * never shows what the discount currently IS, and it can only ever deepen — a
 * stored 10%-off price is cheaper than a 5%-off calculation, so turning it down
 * would have done nothing at all, silently.
 *
 * 🔑 SO THE PERCENTAGE IS THE STORED RULE and every set-up price derives from it
 * (`lib/onboarding-discount.ts`, read by the card AND the charge). The per-row
 * "sign-up price" beside it stays what it has always been: a DELIBERATE
 * exception — Setnayan AI's 40% — never a copy of this number.
 *
 * Its own form and its own save, exactly like the fee below: a singleton must
 * never share a save button with the catalog browser.
 */
export async function saveOnboardingDiscount(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const raw = String(formData.get('onboarding_discount_pct') ?? '').trim();
  const pct = Number(raw);
  // ⚠ An empty box is REFUSED, not read as 0. `Number('')` is 0 and 0 is a legal
  // discount, so a blank save would silently retract the discount from every
  // product at once.
  if (raw === '' || !Number.isFinite(pct) || pct < 0 || pct > MAX_ONBOARDING_DISCOUNT_PCT) {
    return {
      ok: false,
      message: `Discount must be a number between 0 and ${MAX_ONBOARDING_DISCOUNT_PCT}.`,
    };
  }
  const pctR = round2(pct);

  const { data: prior } = await admin
    .from('platform_settings')
    .select('onboarding_discount_pct')
    .eq('id', 1)
    .maybeSingle();
  const priorPct =
    prior?.onboarding_discount_pct != null
      ? Number(prior.onboarding_discount_pct)
      : DEFAULT_ONBOARDING_DISCOUNT_PCT;
  if (priorPct === pctR) return { ok: true, message: 'No changes to save.' };

  const { error } = await admin
    .from('platform_settings')
    .update({ onboarding_discount_pct: pctR, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'onboarding_discount_edit',
    target_id: 'onboarding_discount_pct',
    actor_user_id: adminUserId,
    // One edit moves every set-up price on the platform, so it is recorded with
    // what it was.
    metadata: {
      table: 'platform_settings',
      field: 'onboarding_discount_pct',
      before: priorPct,
      after: pctR,
    },
  });

  revalidatePath('/admin/pricing');
  return { ok: true, message: `Saved — ${pctR}% off during set-up.` };
}

// ─── Platform fee — platform_settings.setnayan_pay_fee_pct (singleton) ────

export async function saveFeeSetting(
  _prev: RowActionState,
  formData: FormData,
): Promise<RowActionState> {
  const { userId: adminUserId } = await requireAdminAction();
  const admin = createAdminClient();

  const feeRaw = String(formData.get('setnayan_pay_fee_pct') ?? '').trim();
  const fee = Number(feeRaw);
  if (!Number.isFinite(fee) || fee < 0 || fee > 100) {
    return { ok: false, message: 'Fee must be between 0 and 100.' };
  }
  const feeR = round2(fee);

  const { data: priorSettings } = await admin
    .from('platform_settings')
    .select('setnayan_pay_fee_pct')
    .eq('id', 1)
    .maybeSingle();
  const priorFee =
    priorSettings?.setnayan_pay_fee_pct != null ? Number(priorSettings.setnayan_pay_fee_pct) : null;
  const effectivePrior = priorFee ?? SETNAYAN_PAY_FEE_PCT;
  if (effectivePrior === feeR) return { ok: true, message: 'No changes to save.' };

  const { error } = await admin
    .from('platform_settings')
    .update({ setnayan_pay_fee_pct: feeR, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}` };

  await admin.from('admin_audit_log').insert({
    action: 'platform_fee_edit',
    target_id: 'setnayan_pay_fee_pct',
    actor_user_id: adminUserId,
    metadata: { table: 'platform_settings', field: 'setnayan_pay_fee_pct', before: priorFee, after: feeR },
  });

  revalidatePath('/admin/payments');
  revalidatePath('/vendor-dashboard', 'layout');
  revalidatePath('/admin/pricing');
  return { ok: true, message: `Saved — ${feeR}%.` };
}
