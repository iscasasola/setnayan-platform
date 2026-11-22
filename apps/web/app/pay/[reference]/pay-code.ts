import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { fetchPayableByReference } from '@/lib/payable-by-reference';
import { coordinatorMoneyScopeAllowed } from '@/lib/coordinator-money-scope';
import { validateAndCalculateVoucher } from '@/lib/vouchers/validate';
import { readOpenMayaCheckout } from '@/lib/maya-checkout.server';
import { appendLedger } from '@/lib/ledger';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { PAY_FREE_CHANNEL, payCodeErrorKeyOfReason, payCodeOpenFor, payFreeReference, payFreeRoute, type PayCodeErrorKey } from '@/lib/pay-code';
import { paymentWasLogged } from '@/lib/payment-logged';
import { paymentRowFor } from '@/lib/order-mint-identity';
import { notifyAdminsPaymentProofSubmitted } from '@/lib/order-admin-notify';
import { revalidatePath } from 'next/cache';

/**
 * 🎟 "Have a code?" on /pay/[reference] step 1 — EVERY PAYMENT WALL TAKES A CODE (owner 2026-11-22, DECISION_LOG
 * 00bfe8db: *"so check all payment walls and add the enter code"*).
 *
 * Reached as `intent=apply_code` on the page's existing form action (`submitPaymentProof`), so it adds no server
 * action (the budget is 1251/1251). It is the inline-checkout drawer's voucher apply on an order that ALREADY EXISTS:
 * the same engine (`validateAndCalculateVoucher` → `discount_codes`), the same redemption row
 * (`discount_code_redemptions`), the same order columns (`voucher_code_applied` + `voucher_discount_centavos`, which
 * `orderGrossOwed` already nets), the same counter bump and the same `voucher_applied` ledger event. No second engine.
 *
 * It re-prices only an UNPAID order nobody has started paying:
 *   · the reference is theirs (session read — RLS decides) and a coordinator has the couple's payment permission;
 *   · the order is `draft` / `awaiting_payment` with no payment row at all, no admin-quoted total and no code yet;
 *   · NO OPEN MAYA CHECKOUT — a checkout Maya already holds is never re-priced. That read FAILS CLOSED: a refused read
 *     refuses the code ("We couldn't check that code"), never applies it.
 * The price comes from the order's own row (`requested_total_php`, the pre-voucher base), never from the form.
 */
export async function applyPayCode(formData: FormData): Promise<never> {
  const raw = formData.get('reference');
  const reference = typeof raw === 'string' ? raw.trim() : '';
  if (!reference) redirect('/dashboard');
  // 🔒 `?code_error=` carries a KEY from the fixed list (`PAY_CODE_ERRORS`), never words — the page draws the message.
  const refuse = (key: PayCodeErrorKey): never => redirect(`/pay/${encodeURIComponent(reference)}?code_error=${key}`);
  const unchecked = (): never => refuse('unchecked');

  const codeRaw = formData.get('code');
  const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : '';
  if (!code) refuse('empty');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(`/pay/${reference}`));

  const payable = await fetchPayableByReference(supabase, reference, user.id);
  if (!payable) redirect('/dashboard');
  if (payable.status === 'unchecked') unchecked();
  if (payable.status !== 'awaiting_payment') refuse('settled');

  // The couple's coordinator payment-permission gate — the same lock the proof and Maya presses carry.
  if (payable.eventId && payable.ownerUserId !== user.id) {
    const allowed = await coordinatorMoneyScopeAllowed(createMoneyWriterClient(), payable.eventId, user.id, 'checkout');
    if (!allowed) refuse('permission');
  }

  const money = createMoneyWriterClient();
  const [orderRead, paymentsRead, maya] = await Promise.all([
    money
      .from('orders')
      .select('order_id,status,service_key,requested_total_php,confirmed_total_php,voucher_code_applied')
      .eq('order_id', payable.orderId)
      .maybeSingle(),
    money.from('payments').select('status,reference_number,screenshot_url').eq('order_id', payable.orderId).limit(200),
    readOpenMayaCheckout(payable.orderId),
  ]);
  if (orderRead.error || !orderRead.data || paymentsRead.error || maya === 'unread') unchecked();
  const order = orderRead.data as {
    status: string;
    service_key: string | null;
    requested_total_php: number | string | null;
    confirmed_total_php: number | string | null;
    voucher_code_applied: string | null;
  };
  const open = payCodeOpenFor({
    orderStatus: order.status,
    // A bill's own empty placeholder row is not a payment (`paymentWasLogged`) — only something somebody SENT closes the box.
    hasPayment: ((paymentsRead.data ?? []) as Array<{ status: string | null; reference_number: string | null; screenshot_url: string | null }>).some(paymentWasLogged),
    mayaCheckoutOpen: maya === 'open',
    codeApplied: Boolean(order.voucher_code_applied),
    quoted: order.confirmed_total_php != null,
  });
  if (!open.ok) refuse(open.reason);

  const basePhp = Number(order.requested_total_php ?? 0);
  if (!Number.isFinite(basePhp) || basePhp <= 0 || !order.service_key) unchecked();
  const originalCentavos = BigInt(Math.round(basePhp * 100));

  const result = await validateAndCalculateVoucher({
    code,
    service_key: order.service_key!,
    original_centavos: originalCentavos,
    couple_user_id: user.id,
  });
  if (!result.applied || !result.discount_code_id || !result.code_normalized || result.discount_centavos <= 0n) {
    refuse(payCodeErrorKeyOfReason(result.reason));
  }

  // ₱0 · A code that covers the whole price is applied like any other; the page then offers "Send for confirmation"
  // (`confirmFreeCode` below) — an admin confirms it, nothing switches on here.

  // 1 · The redemption — UNIQUE (order_id) and UNIQUE (code, person) are the race guards (a second tab gets 23505).
  const { error: redemptionErr } = await supabase.from('discount_code_redemptions').insert({
    discount_code_id: result.discount_code_id,
    order_id: payable.orderId,
    couple_user_id: user.id,
    discount_centavos_applied: Number(result.discount_centavos),
  });
  if (redemptionErr) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Apply a code on /pay (discount_code_redemptions INSERT)',
      file_path: 'app/pay/[reference]/pay-code.ts',
      error_message: String(redemptionErr.message),
      payload_snapshot: { orderId: payable.orderId, dbErrorCode: (redemptionErr as { code?: string }).code },
    });
    refuse((redemptionErr as { code?: string }).code === '23505' ? 'used' : 'unchecked');
  }

  // 2 · Re-price the order — ONE statement that lands only while the order is still exactly as checked (unpaid,
  // unquoted, no code yet) AND no Maya checkout is open for it: the re-check sits inside the update itself
  // (`pay_reprice_order_with_code`, migration 20271357859993), so another tab cannot open a checkout in between.
  const { data: repriced, error: repriceErr } = await money.rpc('pay_reprice_order_with_code', {
    p_order_id: payable.orderId,
    p_code: result.code_normalized,
    p_discount_centavos: Number(result.discount_centavos),
  });
  if (repriceErr || repriced !== true) {
    if (repriceErr) console.error('[pay-code] re-price refused', repriceErr.message);
    // Take the redemption back so the code is not spent on a price that never changed.
    const { error: undoErr } = await money.from('discount_code_redemptions').delete().eq('order_id', payable.orderId);
    if (undoErr) console.error('[pay-code] could not take back the redemption', payable.orderId, undoErr.message);
    unchecked();
  }

  // 3 · The counter and the ledger — best-effort, exactly as the drawer does them.
  const { error: counterErr } = await createAdminClient().rpc('increment_discount_uses', { p_id: result.discount_code_id });
  if (counterErr) console.warn('[pay-code] discount_codes uses_count bump failed:', counterErr.message);
  await appendLedger(supabase, {
    order_id: payable.orderId,
    event_type: 'voucher_applied',
    actor_user_id: user.id,
    actor_role: 'couple',
    amount_centavos: Number(result.discount_centavos),
    voucher_code: result.code_normalized,
    metadata: {
      original_centavos: Number(originalCentavos),
      final_centavos: Number(result.final_centavos),
      via: 'pay_page',
    },
  });

  return redirect(`/pay/${encodeURIComponent(reference)}?code=${encodeURIComponent(result.code_normalized!)}`);
}

/**
 * 🎟 ₱0 · "SEND FOR CONFIRMATION" (controller 2026-11-22, the follow-up to #8130). Reached as `intent=confirm_free` on
 * the page's existing form action — no new server action.
 *
 * A code covered the whole price, so there is nothing to pay: no Maya, no receipt. This writes ONE ₱0 payment row on
 * channel `voucher` into the existing /admin/payments queue and tells the admins. Nothing activates here — an admin's
 * approval is still the only thing that marks the order paid, which is what stops a leaked 100% code from switching
 * anything on by itself.
 *
 * Refused unless, re-read on the server: the bill is theirs and still awaiting payment, a code is on it, NOTHING is
 * left to pay (the order's own figures — nothing posted is trusted), nobody has sent a payment, and no Maya checkout
 * is open. ONCE: the row carries a fixed idempotency key per order, so a second press is the first one (23505).
 */
export async function confirmFreeCode(formData: FormData): Promise<never> {
  const raw = formData.get('reference');
  const reference = typeof raw === 'string' ? raw.trim() : '';
  if (!reference) redirect('/dashboard');
  const here = `/pay/${encodeURIComponent(reference)}`;
  const refuse = (key: PayCodeErrorKey): never => redirect(`${here}?code_error=${key}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(`/pay/${reference}`));

  const payable = await fetchPayableByReference(supabase, reference, user.id);
  if (!payable) redirect('/dashboard');
  if (payable.status === 'unchecked') refuse('unchecked');
  if (payable.status !== 'awaiting_payment') refuse('settled');
  if (payable.eventId && payable.ownerUserId !== user.id) {
    const allowed = await coordinatorMoneyScopeAllowed(createMoneyWriterClient(), payable.eventId, user.id, 'checkout');
    if (!allowed) refuse('permission');
  }
  // Nothing left to pay, by the ORDER's own figures — never a posted amount.
  if (!payFreeRoute({ awaitingPayment: true, amountPhp: payable.amountPhp, codeApplied: Boolean(payable.code) })) refuse('not_free');

  const money = createMoneyWriterClient();
  const [paymentsRead, maya] = await Promise.all([
    money.from('payments').select('status,reference_number,screenshot_url').eq('order_id', payable.orderId).limit(200),
    readOpenMayaCheckout(payable.orderId),
  ]);
  if (paymentsRead.error || maya === 'unread') refuse('unchecked');
  if (maya === 'open') refuse('maya_open');
  const rows = (paymentsRead.data ?? []) as Array<{ status: string | null; reference_number: string | null; screenshot_url: string | null }>;
  // Already sent (this button, pressed before) — it is in the queue once; say so, never a second row.
  if (rows.some(paymentWasLogged)) redirect(`${here}?sent=1`);

  const { data: inserted, error } = await money
    .from('payments')
    .insert(
      paymentRowFor(
        { userId: user.id, verifiedOrderId: payable.orderId },
        {
          amount_php: 0,
          channel: PAY_FREE_CHANNEL,
          reference_number: payFreeReference(payable.code!.code, payable.reference),
          screenshot_url: null,
          paid_at: new Date().toISOString().slice(0, 10),
          // One per order: a double press, or two tabs, is the same row (UNIQUE (order_id, client_idempotency_key)).
          client_idempotency_key: `voucher-zero-${payable.orderId}`,
        },
      ),
    )
    .select('payment_id')
    .maybeSingle();
  const duplicate = (error as { code?: string } | null)?.code === '23505';
  if (error && !duplicate) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Send a ₱0 code for confirmation on /pay (payments INSERT)',
      file_path: 'app/pay/[reference]/pay-code.ts',
      error_message: String(error.message),
      payload_snapshot: { orderId: payable.orderId, dbErrorCode: (error as { code?: string }).code },
    });
    refuse('unchecked');
  }

  if (!error) {
    // The bill's own empty placeholder row gives way to this one (as it does to a real receipt) — never the new row.
    const newId = (inserted as { payment_id: string } | null)?.payment_id ?? null;
    let sweep = money.from('payments').delete().eq('order_id', payable.orderId).eq('status', 'pending').is('reference_number', null).is('screenshot_url', null);
    if (newId) sweep = sweep.neq('payment_id', newId);
    const { error: sweepError } = await sweep;
    if (sweepError) console.error('[pay-code] placeholder payment row was not removed', { orderId: payable.orderId, sweepError });
    // Somebody has to be told — once (not on the duplicate press).
    await notifyAdminsPaymentProofSubmitted({ orderId: payable.orderId, eventId: payable.eventId ?? '', amountPhp: 0, channel: PAY_FREE_CHANNEL });
  }

  revalidatePath(`/pay/${reference}`);
  return redirect(`${here}?sent=1`);
}
