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
