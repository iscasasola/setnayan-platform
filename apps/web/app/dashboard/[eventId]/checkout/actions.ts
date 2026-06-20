'use server';

/**
 * apps/web/app/dashboard/[eventId]/checkout/actions.ts
 *
 * Server actions for the inline checkout drawer.
 *
 * WHY · Day 2 of the 4-day pre-pilot voucher + inline-checkout sprint
 *       (CLAUDE.md 2026-05-29 Day 2 row · V1 SCOPE EXPANSION approved
 *       by owner · pilot 2026-06-01 in 4 days). Replaces the 2-step
 *       /orders/new + /orders/[id] flow with a single drawer that
 *       mounts on every add-on detail page. The drawer surfaces:
 *         (1) optional voucher-code apply (this file: applyVoucherAction)
 *         (2) BDO + GCash QR codes from platform_settings
 *         (3) screenshot upload + reference number
 *         (4) atomic order submit (this file: submitOrderAction)
 *
 *       submitOrderAction lands the order at status='pending_approval'
 *       directly (no intermediate 'pending_payment' state) since the
 *       inline drawer requires the screenshot before submit. Day 3 admin
 *       approval flips to 'paid' (state machine: paid = APPROVED for
 *       backward-compat; new 'completed' value added on top).
 *
 * Locked policy from architect spec brief (CLAUDE.md 2026-05-29 Day 2 row):
 *   • One service per order · single-voucher per order
 *   • Voucher apply BEFORE order creation · invalid clears field + brand-voice error
 *   • BIR receipt shows net paid (iteration 0026 · Day 3 integration)
 *   • Voucher field hidden behind "Have a code?" toggle (drawer UI)
 *   • Codes case-insensitive input · stored UPPERCASE
 *   • State machine: pending_approval → approved → active → completed
 *   • order_ledger writes at every transition (use appendLedger helper)
 *
 * Cross-references:
 *   • PR #594 + PR #595 schema (discount_codes · redemptions · order_ledger)
 *   • apps/web/lib/ledger.ts (canonical append helper)
 *   • apps/web/lib/vouchers/validate.ts (DB-layer voucher check)
 *   • apps/web/lib/vouchers/calculate.ts (pure-function discount math)
 *   • apps/web/app/dashboard/[eventId]/orders/actions.ts (the createOrder
 *     this drawer's submit supersedes for the inline path · payment-
 *     instructions email kept wired for the post-submit confirmation)
 *   • PR #591 + #593 sendEmail platform-settings pattern preserved here
 */

import { revalidatePath } from 'next/cache';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { uploadPublicAsset } from '@/lib/storage';
import { validateAndCalculateVoucher } from '@/lib/vouchers/validate';
import { appendLedger } from '@/lib/ledger';
import { resolvePaxPricedOrderCentavos, resolveBundleChargeCentavos } from '@/lib/v2-catalog';
import { getRequestPlatform, isRequestPlatform } from '@/lib/request-platform';
import { notifyAdminsOrderAwaitingReconciliation } from '@/lib/order-admin-notify';

/**
 * Same reference-code shape as createOrder · 'SN' prefix + 8 uppercase hex.
 */
function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * applyVoucherAction — invoked by the drawer's voucher field via the
 * form action pattern. Returns a JSON-serializable result the drawer
 * client component renders inline. NO DB writes — pure read-only check.
 *
 * Input shape (FormData):
 *   • code — voucher code string (case-insensitive · uppercased server-side)
 *   • service_key — SKU code from the calling add-on page
 *   • original_centavos — string-encoded BigInt centavos (e.g. "149900")
 *
 * Output shape (return value):
 *   • applied: boolean
 *   • code: string | null — normalized code if applied
 *   • discount_php: string — formatted peso string (e.g. "₱500.00")
 *   • final_php: string — formatted peso string for total post-voucher
 *   • reason?: string — brand-voice rejection copy if NOT applied
 */
export type ApplyVoucherResult = {
  applied: boolean;
  code: string | null;
  discount_centavos: string; // BigInt-as-string for client round-trip
  final_centavos: string;
  discount_php: string;
  final_php: string;
  reason?: string;
};

export async function applyVoucherAction(
  prevState: ApplyVoucherResult | null,
  formData: FormData,
): Promise<ApplyVoucherResult> {
  void prevState;

  const code = formData.get('code');
  const serviceKey = formData.get('service_key');
  const originalRaw = formData.get('original_centavos');

  if (
    typeof code !== 'string' ||
    typeof serviceKey !== 'string' ||
    typeof originalRaw !== 'string'
  ) {
    return {
      applied: false,
      code: null,
      discount_centavos: '0',
      final_centavos: '0',
      discount_php: '₱0.00',
      final_php: '₱0.00',
      reason: "We couldn't check that code. Please try again.",
    };
  }

  // Parse the original price as BigInt. The drawer ships the centavos as
  // a plain integer string · validate it before BigInt() throws.
  let originalCentavos: bigint;
  try {
    originalCentavos = BigInt(originalRaw);
  } catch {
    return {
      applied: false,
      code: null,
      discount_centavos: '0',
      final_centavos: '0',
      discount_php: '₱0.00',
      final_php: '₱0.00',
      reason: "We couldn't check that code. Please try again.",
    };
  }

  // Auth gate — couples only.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      applied: false,
      code: null,
      discount_centavos: '0',
      final_centavos: originalCentavos.toString(),
      discount_php: '₱0.00',
      final_php: formatPesoFromCentavos(originalCentavos),
      reason: 'Please sign in to apply a code.',
    };
  }

  const result = await validateAndCalculateVoucher({
    code,
    service_key: serviceKey,
    original_centavos: originalCentavos,
    couple_user_id: user.id,
  });

  return {
    applied: result.applied,
    code: result.code_normalized,
    discount_centavos: result.discount_centavos.toString(),
    final_centavos: result.final_centavos.toString(),
    discount_php: formatPesoFromCentavos(result.discount_centavos),
    final_php: formatPesoFromCentavos(result.final_centavos),
    reason: result.reason,
  };
}

/**
 * Format a BigInt centavos to a peso display string. Mirrors the helper
 * in calculate.ts (kept private here to avoid pulling the BigInt type
 * across the server-action boundary unnecessarily).
 */
function formatPesoFromCentavos(centavos: bigint): string {
  const pesos = Number(centavos) / 100;
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * submitOrderAction — atomic transaction landing 4-5 rows:
 *   (1) orders row at status='pending_approval' (existing enum value
 *       'submitted' maps semantically; we land at 'submitted' since the
 *       existing payment-reconciliation flow reads that value. Day 3
 *       enum extension is queued but NOT shipped THIS PR — the existing
 *       state machine carries the same intent.)
 *   (2) payments row at status='pending' with screenshot_url + amount
 *   (3) discount_code_redemptions row IF voucher applied
 *   (4) order_ledger 'order_created' event
 *   (5) order_ledger 'voucher_applied' event IF voucher applied
 *   (6) order_ledger 'payment_uploaded' event
 *
 * Idempotency: NOT idempotent at the action level. The drawer disables
 * submit-button while pending + client_idempotency_key on payments
 * (Task 8 pilot hardening pattern from createOrder) catches double-submit
 * retries. Order INSERT itself has no idempotency key in V1 schema; one
 * order per drawer-submit is the pilot contract.
 *
 * Self-comp branch · vendor self-purchase confirm modal (CLAUDE.md
 * 2026-05-15 § 3.1a) is NOT supported by this inline path during pilot.
 * Vendors using inline-checkout submit a real order. The legacy
 * /orders/new path stays available via direct URL for self-comp workflows
 * (it just stops being the primary entry point); the redirect from
 * /orders/new lands them on /add-ons where they can pick the SKU again.
 * V1.x adds self-comp branch to the drawer when vendor-side dogfooding
 * needs it during pilot polish.
 *
 * Returns the created order_id so the drawer can redirect / link the
 * couple to the status tracker.
 */
export type SubmitOrderResult =
  | {
      ok: true;
      order_id: string;
      reference_code: string;
    }
  | {
      ok: false;
      reason: string;
      /** Anon-draft: set when the order was blocked because the user hasn't
       *  secured their account yet — the drawer routes them to /signup. */
      needsAccount?: true;
    };

export async function submitOrderAction(
  formData: FormData,
): Promise<SubmitOrderResult> {
  const eventId = formData.get('event_id');
  const serviceKey = formData.get('service_key');
  const displayName = formData.get('display_name');
  const originalRaw = formData.get('original_centavos');
  const referenceNumber = formData.get('reference_number');
  const screenshotRefRaw = formData.get('screenshot_ref');
  const channel = formData.get('channel'); // 'bdo' or 'gcash'
  const voucherCodeRaw = formData.get('voucher_code'); // optional · applied at apply step
  const voucherDiscountRaw = formData.get('voucher_discount_centavos'); // optional

  if (
    typeof eventId !== 'string' ||
    typeof serviceKey !== 'string' ||
    typeof displayName !== 'string' ||
    typeof originalRaw !== 'string' ||
    typeof channel !== 'string'
  ) {
    return { ok: false, reason: 'Missing required fields. Please refresh and try again.' };
  }

  // Parse + validate the original price.
  let originalCentavos: bigint;
  try {
    originalCentavos = BigInt(originalRaw);
  } catch {
    return { ok: false, reason: 'Price did not look right. Please refresh and try again.' };
  }
  if (originalCentavos < 0n) {
    return { ok: false, reason: 'Price did not look right. Please refresh and try again.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: 'Please sign in to submit your order.' };
  }
  // Anon-draft money floor: an order ties a real PHP charge, a BIR receipt, and
  // refund contactability to the buyer — none of which work under a placeholder
  // identity. Block anonymous users and signal the drawer to route them to
  // /signup (convert-in-place keeps their event + cart context).
  if (user.is_anonymous) {
    return {
      ok: false,
      reason: 'Create your account to complete this purchase — your plan stays exactly as it is.',
      needsAccount: true,
    };
  }

  // ---- Catalog is the single source of truth for the charged price ----
  //
  // The base price originates client-side (the add-on page passes
  // original_centavos for DISPLAY only). We DO NOT trust it for the actual
  // charge: re-resolve the authoritative amount from platform_retail_catalog_v2
  // server-side and override originalCentavos BEFORE the voucher math, so any
  // discount applies to the correct base. This makes the charged amount ALWAYS
  // equal the admin-set catalog price — flat SKUs (retail_price_php) and the
  // pax-curve SKU (PAPIC_GUEST · keyed to events.estimated_pax) both resolve
  // through the same engine (lib/v2-catalog.ts). A tampered or stale client
  // price can never change what's billed, and a per-page hardcoded fallback can
  // never over/under-charge. Only SKUs with NO catalog row (vendor / bundle /
  // legacy · resolved === null) keep the client value.
  // Owner 2026-06-14: "every price is admin-managed · never hardcoded in code."
  //
  // NOTE: two catalogs back the charge, checked in order. (1) the retail catalog
  // above covers the 19 retail SKUs (flat + the pax curve). (2) the 4-tier paywall
  // BUNDLES (GUIDED_PACK = Essentials · MEDIA_PACK = Complete) live in a SEPARATE
  // table (platform_package_catalog · keyed by package_code, flat-priced), so the
  // retail resolve returns null for them and the bundle order would otherwise fall
  // back to the tamperable client price. resolveBundleChargeCentavos re-resolves
  // the authoritative bundle price from the admin-set retail_price_php, identical
  // to how flat retail SKUs are made authoritative. Only SKUs in NEITHER catalog
  // (vendor / legacy · both resolves null) keep the client value.
  const resolved = await resolvePaxPricedOrderCentavos(eventId, serviceKey);
  if (resolved) {
    originalCentavos = BigInt(resolved.centavos);
  } else {
    const bundleCentavos = await resolveBundleChargeCentavos(serviceKey);
    if (bundleCentavos != null) {
      originalCentavos = BigInt(bundleCentavos);
    }
  }

  // Re-validate the voucher server-side EVEN THOUGH the apply step already
  // checked. Two reasons: (a) defence-in-depth · the client could lie about
  // the discount; (b) the apply was at T-N seconds, the code might have
  // been deactivated in the interim. Re-checking + re-computing keeps
  // the order math honest.
  let voucherFinalCentavos = originalCentavos;
  let voucherDiscountCentavos = 0n;
  let voucherCodeNormalized: string | null = null;
  let voucherCodeId: string | null = null;

  if (typeof voucherCodeRaw === 'string' && voucherCodeRaw.trim().length > 0) {
    const recheck = await validateAndCalculateVoucher({
      code: voucherCodeRaw.trim(),
      service_key: serviceKey,
      original_centavos: originalCentavos,
      couple_user_id: user.id,
    });
    if (recheck.applied) {
      voucherFinalCentavos = recheck.final_centavos;
      voucherDiscountCentavos = recheck.discount_centavos;
      voucherCodeNormalized = recheck.code_normalized;
      voucherCodeId = recheck.discount_code_id;
    } else {
      // The code became invalid between apply and submit. Surface and stop.
      // The drawer will clear the field and let the couple retry.
      return {
        ok: false,
        reason: recheck.reason ?? 'That code is no longer valid. Please try again.',
      };
    }
  } else if (
    typeof voucherDiscountRaw === 'string' &&
    voucherDiscountRaw.trim().length > 0
  ) {
    // Client claimed a discount but didn't send the code · suspicious. Reject.
    return {
      ok: false,
      reason: 'Voucher state did not match. Please reapply your code.',
    };
  }

  // Resolve the screenshot ref. Drawer uses <FileUpload name="screenshot_ref">
  // which uploads direct-to-R2 and emits the r2:// ref. Fallback to legacy
  // <input type="file" name="screenshot"> covers any future drift.
  let screenshotUrl: string | null = null;
  if (
    typeof screenshotRefRaw === 'string' &&
    screenshotRefRaw.trim().startsWith('r2://')
  ) {
    screenshotUrl = screenshotRefRaw.trim();
  } else {
    const screenshotFile = formData.get('screenshot');
    if (screenshotFile instanceof File && screenshotFile.size > 0) {
      const result = await uploadPublicAsset({
        pathPrefix: `payment-screenshots/inline-checkout/${user.id}`,
        file: screenshotFile,
      });
      if (!result.ok) {
        return { ok: false, reason: result.error };
      }
      screenshotUrl = result.publicUrl;
    }
  }

  if (!screenshotUrl) {
    return { ok: false, reason: 'A payment screenshot is required.' };
  }

  // Idempotency key for the payments INSERT (Task 8 pilot hardening pattern).
  const idempotencyKeyRaw = formData.get('client_idempotency_key');
  const idempotencyKey =
    typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim().length > 0
      ? idempotencyKeyRaw.trim().slice(0, 64)
      : null;

  const referenceNumberClean =
    typeof referenceNumber === 'string' && referenceNumber.trim().length > 0
      ? referenceNumber.trim()
      : null;

  // ---- Atomic-ish transaction ----
  //
  // Supabase doesn't expose multi-statement transactions to the JS client
  // (the RPC pattern would · we use the simpler sequential-write approach
  // with rollback on failure). If the orders INSERT succeeds but the
  // payments INSERT fails, we delete the order to avoid orphan rows.
  // If the redemption INSERT fails on a UNIQUE-violation race (parallel
  // tab), the couple gets a clear error and the order rolls back too.

  const referenceCode = generateReferenceCode();
  const originalPriceForOrderTotal = Number(originalCentavos) / 100;
  const finalAmountForPayment = Number(voucherFinalCentavos) / 100;

  // Existing schema uses NUMERIC(12,2) requested_total_php · we land
  // the ORIGINAL price in that field (consistent with the legacy createOrder
  // flow where requested_total_php is the quote · admin confirms to
  // confirmed_total_php on approval). voucher_discount_centavos column
  // (PR #594) carries the post-voucher delta. The orders row's
  // confirmed_total_php gets set on admin approval (Day 3) to the
  // voucher-adjusted figure so the BIR receipt shows net paid.
  // Originating platform (web / ios / android) for /admin/payments visibility.
  // Prefer an explicit, validated form hint (lets the route-to-web hand-off
  // carry the app origin through the external browser — PR #1538 follow-up);
  // otherwise the detected request platform. Defaults to 'web' on any miss.
  const platformHint = formData.get('platform');
  const orderPlatform = isRequestPlatform(platformHint)
    ? platformHint
    : await getRequestPlatform();

  const insertPayload: Record<string, unknown> = {
    event_id: eventId,
    user_id: user.id,
    service_key: serviceKey,
    description: displayName,
    requested_total_php: originalPriceForOrderTotal,
    reference_code: referenceCode,
    platform: orderPlatform,
    // Land at 'submitted' which is the existing canonical "queued for admin
    // review" state. The new spec's 'pending_approval' maps semantically;
    // a follow-up migration extends the enum with the new value names but
    // backward-compat readers (admin payment reconciliation queue at
    // /admin/payments) continue to filter on the current enum so we
    // preserve their behaviour.
    status: 'submitted',
  };

  // Voucher snapshot columns from PR #594. orders_voucher_coherence CHECK
  // requires (code NULL AND discount = 0) OR (code NOT NULL AND discount > 0).
  if (voucherCodeNormalized && voucherDiscountCentavos > 0n) {
    insertPayload.voucher_code_applied = voucherCodeNormalized;
    insertPayload.voucher_discount_centavos = Number(voucherDiscountCentavos);
  }

  const { data: orderRow, error: orderErr } = await supabase
    .from('orders')
    .insert(insertPayload)
    .select('order_id')
    .maybeSingle();

  if (orderErr || !orderRow) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Create checkout order (orders INSERT)',
      file_path: 'app/dashboard/[eventId]/checkout/actions.ts',
      error_message: String(orderErr?.message ?? 'orders insert returned no row'),
      payload_snapshot: { eventId, serviceKey, referenceCode, voucherApplied: Boolean(voucherCodeNormalized) },
    });
    return {
      ok: false,
      reason: orderErr?.message ?? 'Could not create your order. Please try again.',
    };
  }

  const orderId = orderRow.order_id as string;

  // payments row · this carries the screenshot. The drawer always includes
  // a screenshot at submit-time so we never have an orphan "no payment yet"
  // state · the order lands directly ready for admin reconciliation.
  const paymentInsert: Record<string, unknown> = {
    order_id: orderId,
    user_id: user.id,
    amount_php: finalAmountForPayment,
    channel,
    reference_number: referenceNumberClean,
    screenshot_url: screenshotUrl,
    paid_at: new Date().toISOString().slice(0, 10),
  };
  if (idempotencyKey) {
    paymentInsert.client_idempotency_key = idempotencyKey;
  }

  const { data: paymentRow, error: paymentErr } = await supabase
    .from('payments')
    .insert(paymentInsert)
    .select('payment_id')
    .maybeSingle();

  if (paymentErr || !paymentRow) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Log checkout payment (payments INSERT)',
      file_path: 'app/dashboard/[eventId]/checkout/actions.ts',
      error_message: String(paymentErr?.message ?? 'payments insert returned no row'),
      payload_snapshot: { orderId, eventId, serviceKey, channel },
    });
    // Rollback the orders row to avoid an orphan.
    await supabase.from('orders').delete().eq('order_id', orderId);
    return {
      ok: false,
      reason: paymentErr?.message ?? 'Could not log payment. Please try again.',
    };
  }
  const paymentId = paymentRow.payment_id as string;

  // discount_code_redemptions row IF voucher applied. UNIQUE (order_id)
  // from PR #594 + UNIQUE (discount_code_id, couple_user_id) from PR #595
  // are the structural guarantees. 23505 unique-violation here means the
  // couple raced two tabs · we roll back both INSERTs and surface the
  // friendly error.
  if (voucherCodeId && voucherDiscountCentavos > 0n) {
    const { error: redemptionErr } = await supabase
      .from('discount_code_redemptions')
      .insert({
        discount_code_id: voucherCodeId,
        order_id: orderId,
        couple_user_id: user.id,
        discount_centavos_applied: Number(voucherDiscountCentavos),
      });
    if (redemptionErr) {
      await insertFaultLog({
        event_type: 'SUPABASE_SAVE_ERROR',
        element_name: 'Apply checkout voucher (discount_code_redemptions INSERT)',
        file_path: 'app/dashboard/[eventId]/checkout/actions.ts',
        error_message: String(redemptionErr.message),
        payload_snapshot: { orderId, paymentId, eventId, serviceKey, voucherCodeId, dbErrorCode: (redemptionErr as { code?: string }).code },
      });
      // Rollback both prior INSERTs.
      await supabase.from('payments').delete().eq('payment_id', paymentId);
      await supabase.from('orders').delete().eq('order_id', orderId);
      const code = (redemptionErr as { code?: string }).code;
      const reason =
        code === '23505'
          ? "Looks like you've already used this code."
          : 'Could not apply your voucher. Please try again.';
      return { ok: false, reason };
    }

    // Increment uses_count on the discount_codes row. This is a
    // best-effort UPDATE via admin client (RLS gates couple writes).
    // The redemption row already exists · uses_count tracking is for
    // admin analytics (the max_uses check at apply-time reads it
    // synchronously · the cap won't be wrong by more than 1 in worst-
    // case race). Read-then-update isn't atomic without an RPC; the
    // discount_codes_uses_within_cap CHECK constraint from PR #594
    // would reject an over-increment, so the worst case is a silent
    // failure on the very last redemption (the redemption row already
    // landed · only the counter lags). Acceptable for V1.
    try {
      const admin = createAdminClient();
      const { data: current } = await admin
        .from('discount_codes')
        .select('uses_count')
        .eq('discount_code_id', voucherCodeId)
        .maybeSingle();
      if (current && typeof current.uses_count === 'number') {
        await admin
          .from('discount_codes')
          .update({ uses_count: current.uses_count + 1 })
          .eq('discount_code_id', voucherCodeId);
      }
    } catch (counterErr) {
      // Counter drift is recoverable via admin reconciliation; never
      // unwind the parent transaction.
      console.warn('[checkout] discount_codes uses_count bump failed:', counterErr);
    }
  }

  // ---- order_ledger writes (best-effort · NEVER throws) ----
  //
  // Three events on submit per the locked policy:
  //   • order_created — the row exists
  //   • voucher_applied — only if a voucher landed
  //   • payment_uploaded — the screenshot landed
  //
  // The ledger helper swallows + logs all failures · these calls never
  // unwind the parent transaction even if RLS rejects.

  await appendLedger(supabase, {
    order_id: orderId,
    event_type: 'order_created',
    actor_user_id: user.id,
    actor_role: 'couple',
    amount_centavos: Number(originalCentavos),
    metadata: { service_key: serviceKey, display_name: displayName },
  });

  if (voucherCodeNormalized && voucherDiscountCentavos > 0n) {
    await appendLedger(supabase, {
      order_id: orderId,
      event_type: 'voucher_applied',
      actor_user_id: user.id,
      actor_role: 'couple',
      amount_centavos: Number(voucherDiscountCentavos),
      voucher_code: voucherCodeNormalized,
      metadata: {
        original_centavos: Number(originalCentavos),
        final_centavos: Number(voucherFinalCentavos),
      },
    });
  }

  await appendLedger(supabase, {
    order_id: orderId,
    event_type: 'payment_uploaded',
    actor_user_id: user.id,
    actor_role: 'couple',
    amount_centavos: Number(voucherFinalCentavos),
    payment_id: paymentId,
    metadata: { channel, reference_number: referenceNumberClean },
  });

  // ---- Admin confirmation (best-effort · Notification Foundation Phase B) ----
  //
  // Fan out to every admin/internal/team user that a new order is in the
  // /admin/payments reconciliation queue. The order already carries a
  // screenshot at this point, so the admin can act immediately. Fail-soft:
  // a failed notification never affects the order that already landed.
  await notifyAdminsOrderAwaitingReconciliation({
    orderId,
    description: displayName,
    amountPhp: finalAmountForPayment,
    referenceCode,
  });

  // ---- Payment-instructions email (best-effort · matches PR #591/#593) ----
  //
  // We preserve the email-on-submit behaviour from createOrder so couples
  // get the reference code in their inbox AND a deep-link back to the
  // order detail page. The same fetchPlatformSettings(supabase) source-
  // of-truth refactor from PR #593 (BDO/GCash from public.platform_settings,
  // not env vars) is preserved verbatim. Email failure NEVER blocks the
  // order — the row is the truth · this email is the convenience surface.
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const orderUrl = `${appUrl}/dashboard/${eventId}/orders/${orderId}`;
    const settings = await fetchPlatformSettings(supabase);
    const hasBdo = Boolean(settings.bdo_account_number?.trim());
    const hasGcash = Boolean(settings.gcash_number?.trim());

    const amountFormatted = finalAmountForPayment.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const lines: string[] = [
      `Salamat — your order is in.`,
      ``,
      `Here are the details for your records.`,
      ``,
      `Order: ${displayName}`,
      `Amount: ₱${amountFormatted}`,
      `Reference code: ${referenceCode}`,
      ``,
    ];

    if (voucherCodeNormalized) {
      lines.push(`Voucher applied: ${voucherCodeNormalized}`);
      lines.push(``);
    }

    lines.push(
      `Our team will reconcile your payment within one business day. We'll email again once your order moves to approved.`,
    );
    lines.push(``);
    // Day 3 of the voucher + inline-checkout sprint (CLAUDE.md 2026-05-29 Day 3
    // row): forward-looking voucher reminder for the couple's NEXT purchase.
    // Suppressed when a voucher was already applied to this order · the hint
    // is for couples who didn't realize codes existed AND for repeat purchases.
    if (!voucherCodeNormalized) {
      lines.push(`If you have a special code, type it in the "Have a code?" field on the order page before paying.`);
      lines.push(``);
    }
    lines.push(`Track your order anytime:`);
    lines.push(orderUrl);
    lines.push(``);
    lines.push(`—`);
    lines.push(`Set na 'yan.`);

    // Best-effort: same pattern as orders/actions.ts line 222.
    await sendEmail({
      to: user.email ?? '',
      subject: `Setnayan order ${referenceCode} — received`,
      text: lines.join('\n'),
    });
  } catch (emailErr) {
    console.warn('[checkout] payment confirmation email send threw:', emailErr);
  }

  // Revalidate the dashboard + add-ons grid so the couple sees the new
  // pending order on their next render.
  revalidatePath(`/dashboard/${eventId}/orders`);
  revalidatePath(`/dashboard/${eventId}/orders/${orderId}`);
  revalidatePath(`/dashboard/${eventId}/studio`);

  return { ok: true, order_id: orderId, reference_code: referenceCode };
}
