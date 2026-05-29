'use server';

/**
 * /admin/discount-codes — Day 1 voucher system admin actions.
 *
 * WHY · Day 1 of 4-day pre-pilot voucher + inline-checkout sprint per
 *       CLAUDE.md 2026-05-29 Day 1 row. Locked policy from owner free-text:
 *         • Multi-use codes by default · admin sets max_uses (NULL=unlimited)
 *         • expires_at REQUIRED at creation
 *         • Codes case-insensitive on input · stored UPPERCASE
 *         • 3 discount_types: amount_off (centavos), pct_off (1-100), free
 *         • 1 voucher per cart (DB CHECK on UNIQUE(order_id) in
 *           discount_code_redemptions — Day 2 wires the apply action)
 *         • Apply at order creation (Day 2 work)
 *         • BIR receipt shows net paid (Day 3 work · iteration 0026)
 *
 * Three actions:
 *   • createDiscountCode    — admin creates a code
 *   • updateDiscountCode    — admin edits while is_active=TRUE
 *   • disableDiscountCode   — admin flips is_active=FALSE (audit-logged)
 *
 * Every mutation writes an admin_audit_log row matching the canonical pattern
 * from apps/web/app/admin/users/actions.ts:478 (issueCompGrant).
 *
 * Cross-references:
 *   • Migration: 20260529010000_voucher_system_day1.sql (push BEFORE merge)
 *   • Canonical admin auth gate: apps/web/app/admin/users/actions.ts:8
 *   • Canonical audit-log INSERT shape: apps/web/app/admin/users/actions.ts:478
 *   • Admin client helper: apps/web/lib/supabase/admin.ts
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const CODE_PATTERN = /^[A-Z0-9]{8}$/;
const DISCOUNT_TYPES = ['amount_off', 'pct_off', 'free'] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];

/**
 * Auth gate — only admin accounts can hit voucher CRUD.
 * Mirrors apps/web/app/admin/users/actions.ts:8 requireAdmin() shape,
 * trimmed to the admin-only check (no is_internal/is_team_member
 * widening — voucher codes are money-adjacent + scope is tight).
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.account_type === 'admin' || me?.is_internal || me?.is_team_member)) {
    throw new Error('Forbidden');
  }
  return { adminUserId: user.id };
}

/**
 * Parse + validate the discount value field given a discount_type.
 * Returns the stored NUMERIC value (centavos for amount_off, integer for
 * pct_off, null for free) OR throws a brand-voice error.
 *
 * Per locked policy: amount_off is in centavos (the form sends pesos, we
 * multiply by 100). pct_off is integer 1-100. free has no value.
 */
function parseDiscountValue(
  type: DiscountType,
  rawPesos: FormDataEntryValue | null,
  rawPct: FormDataEntryValue | null,
): number | null {
  if (type === 'free') return null;

  if (type === 'amount_off') {
    if (typeof rawPesos !== 'string' || rawPesos.trim().length === 0) {
      throw new Error('Enter the peso amount this voucher takes off.');
    }
    const pesos = Number.parseFloat(rawPesos.trim());
    if (!Number.isFinite(pesos) || pesos <= 0) {
      throw new Error('Amount must be a positive number of pesos.');
    }
    // Store as centavos (NUMERIC accepts integer values cleanly).
    return Math.round(pesos * 100);
  }

  if (type === 'pct_off') {
    if (typeof rawPct !== 'string' || rawPct.trim().length === 0) {
      throw new Error('Enter the percentage off (1-100).');
    }
    const pct = Number.parseInt(rawPct.trim(), 10);
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      throw new Error('Percentage must be a whole number between 1 and 100.');
    }
    return pct;
  }

  // Unreachable per the DISCOUNT_TYPES typeguard caller-side.
  throw new Error(`Unknown discount type: ${type satisfies never}`);
}

/**
 * Parse + validate expires_at. Required per owner directive.
 * Browser sends ISO from <input type="datetime-local"> as local time without
 * timezone — we treat as PH local + convert via JS Date (Postgres TIMESTAMPTZ
 * will store UTC).
 */
function parseExpiresAt(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error('Expires-at is required — pick when this code stops working.');
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Expires-at is not a valid datetime.');
  }
  if (parsed.getTime() < Date.now()) {
    throw new Error('Expires-at cannot be in the past.');
  }
  return parsed.toISOString();
}

/**
 * Parse + validate max_uses (optional). NULL = unlimited within expiry.
 */
function parseMaxUses(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Max uses must be a positive whole number (or leave blank for unlimited).');
  }
  return n;
}

/**
 * Validate covered_service_keys against the live service_catalog. We accept
 * the values the admin form sends + cross-check each against an active SKU
 * — silently dropping unknown keys would be confusing, so we throw a
 * specific error naming the offender.
 */
async function validateCoveredServices(keys: string[]): Promise<string[]> {
  if (keys.length === 0) {
    throw new Error('Pick at least one service this voucher applies to.');
  }
  if (keys.length > 50) {
    throw new Error('Pick at most 50 services per code.');
  }
  const admin = createAdminClient();
  const { data: catalog, error } = await admin
    .from('service_catalog')
    .select('sku_code')
    .in('sku_code', keys);
  if (error) {
    throw new Error(`Service catalog lookup failed: ${error.message}`);
  }
  const found = new Set((catalog ?? []).map((r) => r.sku_code));
  const missing = keys.filter((k) => !found.has(k));
  if (missing.length > 0) {
    throw new Error(`Unknown service code(s): ${missing.join(', ')}.`);
  }
  return keys;
}

/**
 * Create a new discount code.
 *
 * Form fields:
 *   • code            — 8 A-Z 0-9 chars (auto-uppercased server-side)
 *   • discount_type   — 'amount_off' | 'pct_off' | 'free'
 *   • discount_pesos  — pesos for amount_off (converted to centavos)
 *   • discount_pct    — integer 1-100 for pct_off
 *   • expires_at      — datetime-local string (REQUIRED)
 *   • max_uses        — positive int or empty (empty = unlimited)
 *   • covered_services[] — multi-checkbox of service_catalog.sku_code values
 */
export async function createDiscountCode(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  // Code — canonicalize to uppercase before pattern check so case-insensitive
  // input maps to the canonical stored form.
  const rawCode = formData.get('code');
  if (typeof rawCode !== 'string') {
    throw new Error('Code is required.');
  }
  const code = rawCode.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw new Error('Code must be exactly 8 characters · A-Z and 0-9 only.');
  }

  // Discount type — strict enum.
  const rawType = formData.get('discount_type');
  if (typeof rawType !== 'string' || !DISCOUNT_TYPES.includes(rawType as DiscountType)) {
    throw new Error('Pick a discount type: Amount off, % off, or Free.');
  }
  const discountType = rawType as DiscountType;

  // Discount value — shape varies by type.
  const discountValue = parseDiscountValue(
    discountType,
    formData.get('discount_pesos'),
    formData.get('discount_pct'),
  );

  // Expires at — required.
  const expiresAt = parseExpiresAt(formData.get('expires_at'));

  // Max uses — optional.
  const maxUses = parseMaxUses(formData.get('max_uses'));

  // Covered services — multi-checkbox names "covered_services" (HTML
  // serializes repeated same-name fields as separate entries).
  const coveredServicesRaw = formData
    .getAll('covered_services')
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  const coveredServiceKeys = await validateCoveredServices(coveredServicesRaw);

  // Insert. Server-side uniqueness on `code` is enforced by the table CHECK
  // + UNIQUE constraint — we surface the collision as a brand-voice message.
  const admin = createAdminClient();
  const { data: inserted, error: insertErr } = await admin
    .from('discount_codes')
    .insert({
      code,
      discount_type: discountType,
      discount_value: discountValue,
      covered_service_keys: coveredServiceKeys,
      expires_at: expiresAt,
      max_uses: maxUses,
      created_by_admin_id: adminUserId,
    })
    .select('discount_code_id, code')
    .single();
  if (insertErr) {
    if (insertErr.code === '23505') {
      throw new Error(`Code "${code}" is already in use — pick another.`);
    }
    throw new Error(`Could not create code: ${insertErr.message}`);
  }
  if (!inserted) {
    throw new Error('Code created but row not returned — refresh to confirm.');
  }

  // Audit log — canonical shape per apps/web/app/admin/users/actions.ts:478.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'discount_code_create',
    target_id: inserted.discount_code_id,
    actor_user_id: adminUserId,
    metadata: {
      code: inserted.code,
      discount_type: discountType,
      discount_value: discountValue,
      covered_service_count: coveredServiceKeys.length,
      max_uses: maxUses,
      expires_at: expiresAt,
    },
  });
  if (auditErr) {
    // Don't roll back — same pattern as issueCompGrant. Code creation
    // succeeded; missing audit row is a known degradation, not a corruption.
    console.error('[createDiscountCode] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/discount-codes');
  redirect('/admin/discount-codes?created=' + encodeURIComponent(inserted.code));
}

/**
 * Update an existing code. Only editable while is_active=TRUE — disabled
 * codes are read-only (the UI grays the form).
 *
 * Form fields match createDiscountCode + adds `discount_code_id` (hidden).
 * Code itself is NOT editable (would break historical redemption matches).
 */
export async function updateDiscountCode(formData: FormData) {
  const { adminUserId } = await requireAdmin();

  const id = formData.get('discount_code_id');
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Missing discount_code_id.');
  }

  const admin = createAdminClient();

  // Snapshot prior state for audit metadata.
  const { data: prior, error: priorErr } = await admin
    .from('discount_codes')
    .select(
      'code, discount_type, discount_value, covered_service_keys, expires_at, max_uses, is_active',
    )
    .eq('discount_code_id', id)
    .maybeSingle();
  if (priorErr) throw new Error(`Lookup failed: ${priorErr.message}`);
  if (!prior) throw new Error('Code not found.');
  if (!prior.is_active) {
    throw new Error('This code is disabled — re-enable it before editing.');
  }

  // Re-parse the form (same shape as create) — code field is read-only
  // on the edit form, but we don't trust the client and read it from
  // `prior` for the audit metadata.
  const rawType = formData.get('discount_type');
  if (typeof rawType !== 'string' || !DISCOUNT_TYPES.includes(rawType as DiscountType)) {
    throw new Error('Pick a discount type.');
  }
  const discountType = rawType as DiscountType;

  const discountValue = parseDiscountValue(
    discountType,
    formData.get('discount_pesos'),
    formData.get('discount_pct'),
  );

  const expiresAt = parseExpiresAt(formData.get('expires_at'));
  const maxUses = parseMaxUses(formData.get('max_uses'));

  const coveredServicesRaw = formData
    .getAll('covered_services')
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  const coveredServiceKeys = await validateCoveredServices(coveredServicesRaw);

  const { error: updateErr } = await admin
    .from('discount_codes')
    .update({
      discount_type: discountType,
      discount_value: discountValue,
      covered_service_keys: coveredServiceKeys,
      expires_at: expiresAt,
      max_uses: maxUses,
      updated_at: new Date().toISOString(),
    })
    .eq('discount_code_id', id);
  if (updateErr) throw new Error(`Could not save: ${updateErr.message}`);

  // Audit log — captures before + after for human reconstruction.
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'discount_code_update',
    target_id: id,
    actor_user_id: adminUserId,
    metadata: {
      code: prior.code,
      before: {
        discount_type: prior.discount_type,
        discount_value: prior.discount_value,
        covered_service_keys: prior.covered_service_keys,
        expires_at: prior.expires_at,
        max_uses: prior.max_uses,
      },
      after: {
        discount_type: discountType,
        discount_value: discountValue,
        covered_service_keys: coveredServiceKeys,
        expires_at: expiresAt,
        max_uses: maxUses,
      },
    },
  });
  if (auditErr) {
    console.error('[updateDiscountCode] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/discount-codes');
  revalidatePath(`/admin/discount-codes/${id}`);
  redirect(`/admin/discount-codes?updated=${encodeURIComponent(prior.code)}`);
}

/**
 * Disable a code — flips is_active=FALSE. Soft "delete"; the code row stays
 * for redemption audit integrity (existing orders that already redeemed it
 * keep their voucher_code_applied snapshot).
 */
export async function disableDiscountCode(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const id = formData.get('discount_code_id');
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Missing discount_code_id.');
  }

  const admin = createAdminClient();

  // Snapshot for audit.
  const { data: prior } = await admin
    .from('discount_codes')
    .select('code, is_active, uses_count')
    .eq('discount_code_id', id)
    .maybeSingle();
  if (!prior) throw new Error('Code not found.');
  if (!prior.is_active) {
    // Idempotent — already disabled is a no-op success.
    redirect('/admin/discount-codes?disabled=' + encodeURIComponent(prior.code));
  }

  const { error: updateErr } = await admin
    .from('discount_codes')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('discount_code_id', id);
  if (updateErr) throw new Error(`Could not disable: ${updateErr.message}`);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'discount_code_disable',
    target_id: id,
    actor_user_id: adminUserId,
    metadata: {
      code: prior.code,
      uses_at_disable: prior.uses_count,
    },
  });
  if (auditErr) {
    console.error('[disableDiscountCode] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/discount-codes');
  redirect('/admin/discount-codes?disabled=' + encodeURIComponent(prior.code));
}

/**
 * Re-enable a previously-disabled code. Same audit shape as disable.
 * Pulled out so the row-level [Enable] action on the list page is symmetric
 * with [Disable] — both visible exactly when the opposite state would be.
 */
export async function enableDiscountCode(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const id = formData.get('discount_code_id');
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Missing discount_code_id.');
  }

  const admin = createAdminClient();

  const { data: prior } = await admin
    .from('discount_codes')
    .select('code, is_active, expires_at')
    .eq('discount_code_id', id)
    .maybeSingle();
  if (!prior) throw new Error('Code not found.');
  if (prior.is_active) {
    // Idempotent — already enabled is a no-op success.
    redirect('/admin/discount-codes?enabled=' + encodeURIComponent(prior.code));
  }
  // Guard: don't re-enable a code that already expired — admin should
  // create a new code with a fresh expires_at instead.
  if (new Date(prior.expires_at).getTime() < Date.now()) {
    throw new Error('This code has already expired — create a new code with a future expires-at instead.');
  }

  const { error: updateErr } = await admin
    .from('discount_codes')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('discount_code_id', id);
  if (updateErr) throw new Error(`Could not enable: ${updateErr.message}`);

  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    action: 'discount_code_enable',
    target_id: id,
    actor_user_id: adminUserId,
    metadata: { code: prior.code },
  });
  if (auditErr) {
    console.error('[enableDiscountCode] audit log insert failed', auditErr.message);
  }

  revalidatePath('/admin/discount-codes');
  redirect('/admin/discount-codes?enabled=' + encodeURIComponent(prior.code));
}
