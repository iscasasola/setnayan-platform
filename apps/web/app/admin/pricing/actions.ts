'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SETNAYAN_PAY_FEE_PCT } from '@/lib/vendor-earnings';

/**
 * /admin/pricing server action · V2 catalog bulk edit
 *
 * ONE action — `saveAllPricing` — owns the WRITE path to every pricing table
 * the admin surface exposes:
 *   - platform_retail_catalog_v2  (customer SKUs · title/desc/cost/price/active)
 *   - platform_package_catalog    (bundles · title/price/active)
 *   - vendor_billing_catalog      (vendor subs + token packs · price/active)
 *   - platform_settings.setnayan_pay_fee_pct (Setnayan Pay convenience fee)
 *
 * WHY one action (owner directive 2026-06-18): the prior surface forced a
 * separate Edit → Save → reload round-trip for EVERY single row. Editing a
 * dozen prices meant a dozen reloads. This action takes the whole catalog as
 * one form submission, diffs each field against the live DB row, and UPDATEs
 * only the rows that actually changed — so the admin types every new price in
 * place and clicks ONE "Save all changes" button.
 *
 * Field naming convention (set by page.tsx):
 *   retail.<field>.<service_code>   field ∈ title|desc|cost|price|active
 *   bundle.<field>.<package_code>   field ∈ title|price|active
 *   vendor.<field>.<sku_code>       field ∈ price|active
 *   setnayan_pay_fee_pct            (singleton)
 * Checkboxes only POST when checked, so an absent `active` key = FALSE. Text +
 * number inputs always POST, so the set of row codes is recoverable from them.
 *
 * Robustness: a single bad field never throws the whole batch away. A row that
 * fails validation (empty required title · negative price · vendor price ≤ 0,
 * which the DB CHECK forbids) is SKIPPED — it keeps its live value — and the
 * skip count is surfaced back in the redirect. Valid rows still save.
 *
 * Auto-update guarantee: one revalidatePath sweep after the batch kicks the
 * three surfaces that read V2 catalog rows (/pricing · /for-vendors ·
 * /admin/pricing), plus the fee-only surfaces when the fee changed.
 *
 * Audit trail: every changed row writes an admin_audit_log row (per § 9.1)
 * with the same per-table action names the old single-row actions used
 * (v2_retail_sku_edit · v2_bundle_sku_edit · v2_vendor_sku_edit ·
 * platform_fee_edit) so existing log filters keep working. Best-effort — an
 * audit insert failure logs to console but does NOT roll back the prices.
 *
 * Two-admin gate on large deltas (>₱500 price · >2.0pp fee) stays a
 * console.warn for now (deferred V1.x · pilot is owner-only admin).
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

// Round to 2 decimals to match the NUMERIC(10,2) catalog columns and avoid
// float drift on high-precision input.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type FieldName = 'title' | 'desc' | 'cost' | 'price' | 'active';
// kind.field.code — code is the remainder so it may safely contain dots /
// underscores. kind + field are fixed enums so the split is unambiguous.
const FIELD_KEY = /^(retail|bundle|vendor)\.(title|desc|cost|price|active)\.(.+)$/;

type RetailInput = {
  title: string;
  desc: string;
  cost: string;
  price: string;
  active: boolean;
};
type BundleInput = { title: string; desc: string; price: string; active: boolean };
type VendorInput = { desc: string; price: string; active: boolean };

// ─── saveAllPricing ───────────────────────────────────────────────────
export async function saveAllPricing(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  // 1 ─ Group the flat form fields back into per-row records.
  const retail = new Map<string, RetailInput>();
  const bundle = new Map<string, BundleInput>();
  const vendor = new Map<string, VendorInput>();

  const ensureRetail = (code: string) => {
    let r = retail.get(code);
    if (!r) {
      r = { title: '', desc: '', cost: '', price: '', active: false };
      retail.set(code, r);
    }
    return r;
  };
  const ensureBundle = (code: string) => {
    let b = bundle.get(code);
    if (!b) {
      b = { title: '', desc: '', price: '', active: false };
      bundle.set(code, b);
    }
    return b;
  };
  const ensureVendor = (code: string) => {
    let v = vendor.get(code);
    if (!v) {
      v = { desc: '', price: '', active: false };
      vendor.set(code, v);
    }
    return v;
  };

  for (const [key, raw] of formData.entries()) {
    const m = key.match(FIELD_KEY);
    if (!m) continue;
    const kindRaw = m[1];
    const fieldRaw = m[2];
    const code = m[3];
    if (!kindRaw || !fieldRaw || !code) continue;
    const kind = kindRaw as 'retail' | 'bundle' | 'vendor';
    const field = fieldRaw as FieldName;
    const value = typeof raw === 'string' ? raw : '';

    if (kind === 'retail') {
      const r = ensureRetail(code);
      if (field === 'title') r.title = value;
      else if (field === 'desc') r.desc = value;
      else if (field === 'cost') r.cost = value;
      else if (field === 'price') r.price = value;
      else if (field === 'active') r.active = true;
    } else if (kind === 'bundle') {
      const b = ensureBundle(code);
      if (field === 'title') b.title = value;
      else if (field === 'desc') b.desc = value;
      else if (field === 'price') b.price = value;
      else if (field === 'active') b.active = true;
    } else {
      const v = ensureVendor(code);
      if (field === 'desc') v.desc = value;
      else if (field === 'price') v.price = value;
      else if (field === 'active') v.active = true;
    }
  }

  const feeRaw = formData.get('setnayan_pay_fee_pct');

  const admin = createAdminClient();

  // 2 ─ Snapshot the live rows so we only UPDATE what changed + can audit the
  // before/after diff. Small tables · read in full.
  const [priorRetail, priorBundle, priorVendor, priorSettings] = await Promise.all([
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, title, description, retail_price_php, saas_overhead_cost_php, is_active'),
    admin
      .from('platform_package_catalog')
      .select('package_code, title, description, retail_price_php, is_active'),
    admin
      .from('vendor_billing_catalog')
      .select('sku_code, description, price_php, is_active'),
    admin
      .from('platform_settings')
      .select('setnayan_pay_fee_pct')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const priorRetailMap = new Map(
    (priorRetail.data ?? []).map((r) => [r.service_code as string, r]),
  );
  const priorBundleMap = new Map(
    (priorBundle.data ?? []).map((r) => [r.package_code as string, r]),
  );
  const priorVendorMap = new Map(
    (priorVendor.data ?? []).map((r) => [r.sku_code as string, r]),
  );

  type AuditRow = {
    action: string;
    target_id: string;
    actor_user_id: string;
    metadata: Record<string, unknown>;
  };
  const auditRows: AuditRow[] = [];
  // Supabase query builders are PromiseLike (thenable), not real Promises — so
  // type the queue as PromiseLike. Promise.all() accepts them either way.
  const updates: PromiseLike<{ error: { message: string } | null }>[] = [];
  let changed = 0;
  const skipped: string[] = [];
  let feeChanged = false;

  // 3 ─ Retail SKUs.
  for (const [code, input] of retail) {
    const prior = priorRetailMap.get(code);
    if (!prior) {
      skipped.push(code);
      continue;
    }
    const title = input.title.trim();
    if (!title) {
      skipped.push(code);
      continue;
    }
    const price = Number(input.price);
    const cost = Number(input.cost);
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(cost) || cost < 0) {
      skipped.push(code);
      continue;
    }
    const priceR = round2(price);
    const costR = round2(cost);
    const desc = input.desc.trim();
    const descVal = desc === '' ? null : desc;

    const same =
      prior.title === title &&
      (prior.description ?? null) === descVal &&
      Number(prior.retail_price_php) === priceR &&
      Number(prior.saas_overhead_cost_php) === costR &&
      prior.is_active === input.active;
    if (same) continue;

    if (Math.abs(Number(prior.retail_price_php) - priceR) > 500) {
      console.warn(
        `[saveAllPricing] retail price delta > ₱500 on ${code}: ` +
          `₱${prior.retail_price_php} → ₱${priceR} · two-admin gate deferred V1.x.`,
      );
    }

    changed += 1;
    updates.push(
      admin
        .from('platform_retail_catalog_v2')
        .update({
          title,
          description: descVal,
          retail_price_php: priceR,
          saas_overhead_cost_php: costR,
          is_active: input.active,
          updated_by_admin_id: adminUserId,
          // updated_at auto-stamped by tg_v2_catalog_set_updated_at trigger.
        })
        .eq('service_code', code),
    );
    auditRows.push({
      action: 'v2_retail_sku_edit',
      target_id: code,
      actor_user_id: adminUserId,
      metadata: {
        table: 'platform_retail_catalog_v2',
        service_code: code,
        bulk: true,
        before: prior,
        after: {
          title,
          description: descVal,
          retail_price_php: priceR,
          saas_overhead_cost_php: costR,
          is_active: input.active,
        },
      },
    });
  }

  // 4 ─ Bundles.
  for (const [code, input] of bundle) {
    const prior = priorBundleMap.get(code);
    if (!prior) {
      skipped.push(code);
      continue;
    }
    const title = input.title.trim();
    if (!title) {
      skipped.push(code);
      continue;
    }
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) {
      skipped.push(code);
      continue;
    }
    const priceR = round2(price);
    const desc = input.desc.trim();
    const descVal = desc === '' ? null : desc;

    const same =
      prior.title === title &&
      (prior.description ?? null) === descVal &&
      Number(prior.retail_price_php) === priceR &&
      prior.is_active === input.active;
    if (same) continue;

    if (Math.abs(Number(prior.retail_price_php) - priceR) > 500) {
      console.warn(
        `[saveAllPricing] bundle price delta > ₱500 on ${code}: ` +
          `₱${prior.retail_price_php} → ₱${priceR} · two-admin gate deferred V1.x.`,
      );
    }

    changed += 1;
    updates.push(
      admin
        .from('platform_package_catalog')
        .update({
          title,
          description: descVal,
          retail_price_php: priceR,
          is_active: input.active,
          updated_by_admin_id: adminUserId,
        })
        .eq('package_code', code),
    );
    auditRows.push({
      action: 'v2_bundle_sku_edit',
      target_id: code,
      actor_user_id: adminUserId,
      metadata: {
        table: 'platform_package_catalog',
        package_code: code,
        bulk: true,
        before: prior,
        after: { title, description: descVal, retail_price_php: priceR, is_active: input.active },
      },
    });
  }

  // 5 ─ Vendor SKUs. price_php has a CHECK (> 0) — a vendor SKU has no FREE
  // state, so a 0/blank/invalid price is skipped rather than failing the batch.
  for (const [code, input] of vendor) {
    const prior = priorVendorMap.get(code);
    if (!prior) {
      skipped.push(code);
      continue;
    }
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0) {
      skipped.push(code);
      continue;
    }
    const priceR = round2(price);
    const desc = input.desc.trim();
    const descVal = desc === '' ? null : desc;

    const same =
      Number(prior.price_php) === priceR &&
      (prior.description ?? null) === descVal &&
      prior.is_active === input.active;
    if (same) continue;

    if (Math.abs(Number(prior.price_php) - priceR) > 500) {
      console.warn(
        `[saveAllPricing] vendor price delta > ₱500 on ${code}: ` +
          `₱${prior.price_php} → ₱${priceR} · two-admin gate deferred V1.x.`,
      );
    }

    changed += 1;
    updates.push(
      admin
        .from('vendor_billing_catalog')
        .update({
          price_php: priceR,
          description: descVal,
          is_active: input.active,
          // No updated_at trigger on this table — stamp it explicitly.
          updated_at: new Date().toISOString(),
        })
        .eq('sku_code', code),
    );
    auditRows.push({
      action: 'v2_vendor_sku_edit',
      target_id: code,
      actor_user_id: adminUserId,
      metadata: {
        table: 'vendor_billing_catalog',
        sku_code: code,
        bulk: true,
        before: prior,
        after: { price_php: priceR, description: descVal, is_active: input.active },
      },
    });
  }

  // 6 ─ Platform fee (Setnayan Pay convenience %).
  if (typeof feeRaw === 'string' && feeRaw.trim() !== '') {
    const fee = Number(feeRaw);
    if (Number.isFinite(fee) && fee >= 0 && fee <= 100) {
      const feeR = round2(fee);
      const priorFee =
        priorSettings.data?.setnayan_pay_fee_pct != null
          ? Number(priorSettings.data.setnayan_pay_fee_pct)
          : null;
      // The editor shows the code-constant fallback when the column is unset,
      // so submitting that unchanged value must NOT register as a change.
      // Compare against the EFFECTIVE prior (DB value, else the constant).
      const effectivePrior = priorFee ?? SETNAYAN_PAY_FEE_PCT;
      if (effectivePrior !== feeR) {
        if (Math.abs(effectivePrior - feeR) > 2) {
          console.warn(
            `[saveAllPricing] Setnayan Pay fee delta > 2.0pp: ` +
              `${priorFee}% → ${feeR}% · two-admin gate deferred V1.x.`,
          );
        }
        feeChanged = true;
        changed += 1;
        updates.push(
          admin
            .from('platform_settings')
            .update({
              setnayan_pay_fee_pct: feeR,
              updated_at: new Date().toISOString(),
            })
            .eq('id', 1),
        );
        auditRows.push({
          action: 'platform_fee_edit',
          target_id: 'setnayan_pay_fee_pct',
          actor_user_id: adminUserId,
          metadata: {
            table: 'platform_settings',
            field: 'setnayan_pay_fee_pct',
            bulk: true,
            before: priorFee,
            after: feeR,
          },
        });
      }
    } else {
      skipped.push('setnayan_pay_fee_pct');
    }
  }

  // 7 ─ Apply all UPDATEs in parallel. Surface the first DB error (if any) but
  // let the rest land — a single constraint hiccup shouldn't silently drop the
  // batch. (N is tiny: ~30 rows.)
  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) {
    console.error('[saveAllPricing] update error', firstError.message);
  }

  // 8 ─ Audit rows in one batch. Best-effort.
  if (auditRows.length > 0) {
    const { error: auditErr } = await admin.from('admin_audit_log').insert(auditRows);
    if (auditErr) {
      console.error('[saveAllPricing] audit log insert failed', auditErr.message);
    }
  }

  // 9 ─ One revalidate sweep. The core three always; the fee additionally
  // touches the payments + vendor-dashboard surfaces.
  revalidatePath('/pricing');
  revalidatePath('/for-vendors');
  revalidatePath('/admin/pricing');
  if (feeChanged) {
    revalidatePath('/admin/payments');
    revalidatePath('/vendor-dashboard', 'layout');
  }

  // 10 ─ Land back on the surface with a result the page renders as a banner.
  const params = new URLSearchParams({ saved: String(changed) });
  if (skipped.length > 0) params.set('skipped', String(skipped.length));
  if (firstError) params.set('error', '1');
  redirect(`/admin/pricing?${params.toString()}`);
}

// ─── createBundle ─────────────────────────────────────────────────────
//
// Insert a brand-new row into platform_package_catalog from the "Create a
// bundle" form (owner 2026-06-18 · "a place where I can create bundles · pick
// name and set a bundle price"). A bundle is name + price (+ optional
// description); platform_package_catalog stores no membership, so what a bundle
// *unlocks* stays a separate concern. The package_code is derived from the
// name (UPPER_SNAKE) and de-duplicated against existing codes.
//
// Form fields: bundle_name (required) · bundle_price (required · ≥0) ·
// bundle_desc (optional). On success → revalidate the 3 surfaces + redirect
// with ?created=<code> so the new bundle shows in the list, ready to fine-tune
// in the bulk editor. On validation failure → redirect with ?createError=<why>.
//
export async function createBundle(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const name = (formData.get('bundle_name') ?? '').toString().trim();
  const priceRaw = (formData.get('bundle_price') ?? '').toString().trim();
  const desc = (formData.get('bundle_desc') ?? '').toString().trim();

  if (!name) redirect('/admin/pricing?createError=name');
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price < 0) {
    redirect('/admin/pricing?createError=price');
  }
  const priceR = round2(price);

  // Derive a stable UPPER_SNAKE package_code from the name.
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'BUNDLE';

  const admin = createAdminClient();

  // De-dupe against existing codes that share the base (e.g. BUNDLE, BUNDLE_2).
  const { data: existing } = await admin
    .from('platform_package_catalog')
    .select('package_code')
    .like('package_code', `${base}%`);
  const taken = new Set((existing ?? []).map((r) => r.package_code as string));
  let code = base;
  for (let n = 2; taken.has(code); n += 1) code = `${base}_${n}`;

  const { error } = await admin.from('platform_package_catalog').insert({
    package_code: code,
    title: name,
    description: desc === '' ? null : desc,
    retail_price_php: priceR,
    is_active: true,
    updated_by_admin_id: adminUserId,
  });
  if (error) {
    console.error('[createBundle] insert failed', error.message);
    redirect('/admin/pricing?createError=db');
  }

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'v2_bundle_sku_create',
    target_id: code,
    actor_user_id: adminUserId,
    metadata: {
      table: 'platform_package_catalog',
      package_code: code,
      title: name,
      description: desc === '' ? null : desc,
      retail_price_php: priceR,
    },
  });
  if (auditErr) {
    console.error('[createBundle] audit log insert failed', auditErr.message);
  }

  revalidatePath('/pricing');
  revalidatePath('/for-vendors');
  revalidatePath('/admin/pricing');
  redirect(`/admin/pricing?created=${encodeURIComponent(code)}`);
}
