'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * /admin/pricing server actions · V2 catalog edit
 *
 * Owns the WRITE path to platform_retail_catalog_v2 +
 * platform_package_catalog. Two server actions, one per table, both
 * gated to admin users only (matches /admin/users/actions.ts requireAdmin
 * pattern · CLAUDE.md 2026-05-12 § 9.1 + 2026-05-23 row 2).
 *
 * Auto-update guarantee: every successful UPDATE calls revalidatePath on
 * the three surfaces that read V2 catalog rows:
 *   - /pricing                (public · force-dynamic · already auto-pulls)
 *   - /for-vendors            (revalidate=3600 ISR · needs the kick)
 *   - /admin/pricing          (server component · needs the kick)
 *
 * Audit trail: every successful UPDATE writes admin_audit_log per § 9.1.
 * Metadata captures the before/after diff so the owner can reconstruct
 * who changed what. Best-effort · audit failure logs to console but does
 * NOT roll back the update (canonical pattern from /admin/users/actions.ts
 * lines 408 + 502).
 *
 * Two-admin gate on >₱500 deltas (per CLAUDE.md 2026-05-12 § 9.1 +
 * 2026-05-17 Add-on Management row · third-row deferrals list) deferred
 * to V1.x · pilot is owner-only-admin so the gate never fires anyway.
 * Surfaced as a console.warn for now so the owner can see it in logs.
 *
 * Schema audit columns (added in migration 20260713000000):
 *   - is_active BOOLEAN NOT NULL DEFAULT TRUE
 *   - created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   - updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() (auto-stamped by trigger)
 *   - updated_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { adminUserId: user.id };
}

// ─── updateRetailSku ──────────────────────────────────────────────────
//
// Edit a row in platform_retail_catalog_v2. Used by the per-row edit form
// at /admin/pricing.
//
// Form fields:
//   - service_code (hidden · PK · cannot be edited)
//   - title (required · TEXT)
//   - description (optional · TEXT)
//   - retail_price_php (required · NUMERIC(10,2) · in pesos)
//   - is_active (checkbox · TRUE if present)
//
// On success: revalidatePath the 3 consumer surfaces + write audit row +
// redirect back to /admin/pricing (drops the ?edit URL param naturally).
//
export async function updateRetailSku(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const serviceCode = formData.get('service_code');
  const title = formData.get('title');
  const description = formData.get('description');
  const retailPriceRaw = formData.get('retail_price_php');
  const costRaw = formData.get('saas_overhead_cost_php');
  // Checkboxes only post when checked. Coerce absence to FALSE.
  const isActiveRaw = formData.get('is_active');

  if (typeof serviceCode !== 'string' || !serviceCode) {
    throw new Error('Missing service_code');
  }
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Title is required');
  }
  if (typeof retailPriceRaw !== 'string') {
    throw new Error('Missing retail_price_php');
  }
  if (typeof costRaw !== 'string') {
    throw new Error('Missing saas_overhead_cost_php');
  }

  const retailPrice = Number(retailPriceRaw);
  if (!Number.isFinite(retailPrice) || retailPrice < 0) {
    throw new Error('retail_price_php must be a non-negative number');
  }
  // Round to 2 decimals to match NUMERIC(10,2) schema. Avoids floating-point
  // drift if admin enters a high-precision value.
  const retailPriceRounded = Math.round(retailPrice * 100) / 100;

  const cost = Number(costRaw);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error('saas_overhead_cost_php must be a non-negative number');
  }
  const costRounded = Math.round(cost * 100) / 100;

  const isActive = isActiveRaw === 'on' || isActiveRaw === 'true';

  const descriptionTrim =
    typeof description === 'string' ? description.trim() : '';

  const admin = createAdminClient();

  // Snapshot the prior row for the audit diff. Best-effort · if the read
  // fails we still proceed with the update (matches /admin/users pattern).
  const { data: prior } = await admin
    .from('platform_retail_catalog_v2')
    .select('title, description, retail_price_php, saas_overhead_cost_php, is_active')
    .eq('service_code', serviceCode)
    .maybeSingle();

  // Two-admin gate check (deferred V1.x · log only for now). If the price
  // delta exceeds ₱500, warn in console so the owner sees the threshold
  // crossing in logs. CLAUDE.md 2026-05-12 § 9.1.
  if (
    prior &&
    Math.abs(Number(prior.retail_price_php) - retailPriceRounded) > 500
  ) {
    console.warn(
      `[updateRetailSku] Price delta > ₱500 on ${serviceCode}: ` +
        `₱${prior.retail_price_php} → ₱${retailPriceRounded} · ` +
        `two-admin gate deferred V1.x · single-admin proceeding.`,
    );
  }

  const { error } = await admin
    .from('platform_retail_catalog_v2')
    .update({
      title: title.trim(),
      description: descriptionTrim === '' ? null : descriptionTrim,
      retail_price_php: retailPriceRounded,
      saas_overhead_cost_php: costRounded,
      is_active: isActive,
      updated_by_admin_id: adminUserId,
      // updated_at auto-stamped by tg_v2_catalog_set_updated_at trigger ·
      // do NOT set it here.
    })
    .eq('service_code', serviceCode);
  if (error) throw new Error(error.message);

  // Audit row per § 9.1. Best-effort.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'v2_retail_sku_edit',
    target_id: serviceCode,
    actor_user_id: adminUserId,
    metadata: {
      table: 'platform_retail_catalog_v2',
      service_code: serviceCode,
      before: prior ?? null,
      after: {
        title: title.trim(),
        description: descriptionTrim === '' ? null : descriptionTrim,
        retail_price_php: retailPriceRounded,
        saas_overhead_cost_php: costRounded,
        is_active: isActive,
      },
    },
  });
  if (auditErr) {
    console.error('[updateRetailSku] audit log insert failed', auditErr.message);
  }

  // Kick the 3 consumer surfaces so price changes propagate immediately.
  revalidatePath('/pricing');
  revalidatePath('/for-vendors');
  revalidatePath('/admin/pricing');

  redirect('/admin/pricing');
}

// ─── updateVendorSku ──────────────────────────────────────────────────
//
// Edit a row in vendor_billing_catalog (vendor subscriptions + token packs).
// Mirrors updateRetailSku EXACTLY — same validation, same audit + console.warn
// two-admin gate, same revalidate kick — against the vendor catalog table.
//
// Form fields:
//   - sku_code (hidden · PK · cannot be edited)
//   - price_php (required · NUMERIC(10,2) · in pesos · CHECK price_php > 0)
//   - is_active (checkbox · TRUE if present)
//
// We only let the admin move price + active state. title / offering_type /
// token_grant_count / tier caps are structural (they wire the purchase + tier
// gate) and stay migration-owned — same posture as updateRetailSku leaving
// service_code / is_token_able alone.
//
// On success: revalidatePath the marketing surfaces that read getVendorPrices()
// (/for-vendors + /pricing) + the admin surface itself, write admin_audit_log,
// redirect back to /admin/pricing.
//
// NOTE: vendor_billing_catalog has NO updated_by_admin_id column and NO
// updated_at trigger (unlike platform_retail_catalog_v2). We stamp updated_at
// explicitly here (matches the platform_settings write pattern) and capture the
// acting admin in the audit row instead.
//
export async function updateVendorSku(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const skuCode = formData.get('sku_code');
  const priceRaw = formData.get('price_php');
  const isActiveRaw = formData.get('is_active');

  if (typeof skuCode !== 'string' || !skuCode) {
    throw new Error('Missing sku_code');
  }
  if (typeof priceRaw !== 'string') {
    throw new Error('Missing price_php');
  }

  const price = Number(priceRaw);
  // vendor_billing_catalog has a CHECK (price_php > 0) — a vendor SKU must
  // carry a positive price (there is no FREE vendor SKU). Validate to a
  // friendly error instead of bubbling the raw constraint violation.
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('price_php must be a positive number');
  }
  // Round to 2 decimals to match NUMERIC(10,2) schema.
  const priceRounded = Math.round(price * 100) / 100;

  const isActive = isActiveRaw === 'on' || isActiveRaw === 'true';

  const admin = createAdminClient();

  // Snapshot the prior row for the audit diff. Best-effort.
  const { data: prior } = await admin
    .from('vendor_billing_catalog')
    .select('title, price_php, offering_type, is_active')
    .eq('sku_code', skuCode)
    .maybeSingle();

  // Two-admin gate check (deferred V1.x · log only for now) — mirror of the
  // updateRetailSku >₱500-delta console.warn. CLAUDE.md 2026-05-12 § 9.1.
  if (prior && Math.abs(Number(prior.price_php) - priceRounded) > 500) {
    console.warn(
      `[updateVendorSku] Price delta > ₱500 on ${skuCode}: ` +
        `₱${prior.price_php} → ₱${priceRounded} · ` +
        `two-admin gate deferred V1.x · single-admin proceeding.`,
    );
  }

  const { error } = await admin
    .from('vendor_billing_catalog')
    .update({
      price_php: priceRounded,
      is_active: isActive,
      // No updated_at trigger on this table — stamp it explicitly.
      updated_at: new Date().toISOString(),
    })
    .eq('sku_code', skuCode);
  if (error) throw new Error(error.message);

  // Audit row per § 9.1. Best-effort.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'v2_vendor_sku_edit',
    target_id: skuCode,
    actor_user_id: adminUserId,
    metadata: {
      table: 'vendor_billing_catalog',
      sku_code: skuCode,
      before: prior ?? null,
      after: {
        price_php: priceRounded,
        is_active: isActive,
      },
    },
  });
  if (auditErr) {
    console.error('[updateVendorSku] audit log insert failed', auditErr.message);
  }

  // Kick the surfaces that read getVendorPrices() so vendor price changes
  // propagate immediately to the marketing pages.
  revalidatePath('/for-vendors');
  revalidatePath('/pricing');
  revalidatePath('/admin/pricing');

  redirect('/admin/pricing');
}

// ─── updatePlatformFee ────────────────────────────────────────────────
//
// Edit the Setnayan Pay convenience-fee percentage. Stored on the
// platform_settings singleton (id = 1) in the setnayan_pay_fee_pct column
// (migration 20261225000000). lib/payouts.ts + lib/vendor-earnings.ts read
// this column with the code constants (5.0% / 500 bps) as the fallback, so an
// unset column = byte-identical current behavior.
//
// Form fields:
//   - setnayan_pay_fee_pct (required · NUMERIC(5,2) · whole-or-fractional %)
//
// requireAdmin-gated · writes admin_audit_log · revalidates the surfaces that
// render the fee. Mirrors the updateRetailSku audit + >₱-delta gate shape;
// the "delta" here is a percentage-point delta, gated at >2.0 pp so a large
// fee swing still trips the same console.warn discipline.
//
export async function updatePlatformFee(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const feeRaw = formData.get('setnayan_pay_fee_pct');
  if (typeof feeRaw !== 'string') {
    throw new Error('Missing setnayan_pay_fee_pct');
  }

  const fee = Number(feeRaw);
  // Fee is a percentage. Clamp to a sane 0–100 band (a 0% fee is a valid
  // owner choice — e.g. a promo period). Reject negatives / non-numbers.
  if (!Number.isFinite(fee) || fee < 0 || fee > 100) {
    throw new Error('setnayan_pay_fee_pct must be between 0 and 100');
  }
  const feeRounded = Math.round(fee * 100) / 100;

  const admin = createAdminClient();

  const { data: prior } = await admin
    .from('platform_settings')
    .select('setnayan_pay_fee_pct')
    .eq('id', 1)
    .maybeSingle();

  // Two-admin gate parallel — log a >2.0 percentage-point swing. CLAUDE.md
  // 2026-05-12 § 9.1.
  const priorFee =
    prior && prior.setnayan_pay_fee_pct != null
      ? Number(prior.setnayan_pay_fee_pct)
      : null;
  if (priorFee != null && Math.abs(priorFee - feeRounded) > 2) {
    console.warn(
      `[updatePlatformFee] Setnayan Pay fee delta > 2.0 pp: ` +
        `${priorFee}% → ${feeRounded}% · ` +
        `two-admin gate deferred V1.x · single-admin proceeding.`,
    );
  }

  const { error } = await admin
    .from('platform_settings')
    .update({
      setnayan_pay_fee_pct: feeRounded,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) throw new Error(error.message);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'platform_fee_edit',
    target_id: 'setnayan_pay_fee_pct',
    actor_user_id: adminUserId,
    metadata: {
      table: 'platform_settings',
      field: 'setnayan_pay_fee_pct',
      before: priorFee,
      after: feeRounded,
    },
  });
  if (auditErr) {
    console.error('[updatePlatformFee] audit log insert failed', auditErr.message);
  }

  // The fee appears on vendor earnings + checkout + admin payment surfaces.
  revalidatePath('/admin/pricing');
  revalidatePath('/admin/payments');
  revalidatePath('/vendor-dashboard', 'layout');

  redirect('/admin/pricing');
}

// ─── updateBundleSku ──────────────────────────────────────────────────
//
// Edit a row in platform_package_catalog. Same shape + semantics as
// updateRetailSku but against the bundles table. platform_package_catalog
// has columns (package_code · title · retail_price_php) so no description /
// is_token_able / saas_overhead fields.
//
export async function updateBundleSku(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const packageCode = formData.get('package_code');
  const title = formData.get('title');
  const retailPriceRaw = formData.get('retail_price_php');
  const isActiveRaw = formData.get('is_active');

  if (typeof packageCode !== 'string' || !packageCode) {
    throw new Error('Missing package_code');
  }
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Title is required');
  }
  if (typeof retailPriceRaw !== 'string') {
    throw new Error('Missing retail_price_php');
  }

  const retailPrice = Number(retailPriceRaw);
  if (!Number.isFinite(retailPrice) || retailPrice < 0) {
    throw new Error('retail_price_php must be a non-negative number');
  }
  const retailPriceRounded = Math.round(retailPrice * 100) / 100;

  const isActive = isActiveRaw === 'on' || isActiveRaw === 'true';

  const admin = createAdminClient();

  const { data: prior } = await admin
    .from('platform_package_catalog')
    .select('title, retail_price_php, is_active')
    .eq('package_code', packageCode)
    .maybeSingle();

  if (
    prior &&
    Math.abs(Number(prior.retail_price_php) - retailPriceRounded) > 500
  ) {
    console.warn(
      `[updateBundleSku] Price delta > ₱500 on ${packageCode}: ` +
        `₱${prior.retail_price_php} → ₱${retailPriceRounded} · ` +
        `two-admin gate deferred V1.x · single-admin proceeding.`,
    );
  }

  const { error } = await admin
    .from('platform_package_catalog')
    .update({
      title: title.trim(),
      retail_price_php: retailPriceRounded,
      is_active: isActive,
      updated_by_admin_id: adminUserId,
    })
    .eq('package_code', packageCode);
  if (error) throw new Error(error.message);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'v2_bundle_sku_edit',
    target_id: packageCode,
    actor_user_id: adminUserId,
    metadata: {
      table: 'platform_package_catalog',
      package_code: packageCode,
      before: prior ?? null,
      after: {
        title: title.trim(),
        retail_price_php: retailPriceRounded,
        is_active: isActive,
      },
    },
  });
  if (auditErr) {
    console.error('[updateBundleSku] audit log insert failed', auditErr.message);
  }

  revalidatePath('/pricing');
  revalidatePath('/for-vendors');
  revalidatePath('/admin/pricing');

  redirect('/admin/pricing');
}
