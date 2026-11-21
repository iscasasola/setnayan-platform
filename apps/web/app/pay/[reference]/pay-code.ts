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
import { PAY_CODE_COVERS_ALL, PAY_CODE_UNCHECKED, payCodeOpenFor } from '@/lib/pay-code';

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
  const to = (key: 'code_error' | 'code', value: string): never =>
    redirect(`/pay/${encodeURIComponent(reference)}?${key}=${encodeURIComponent(value)}`);
  const unchecked = (): never => to('code_error', PAY_CODE_UNCHECKED);

  const codeRaw = formData.get('code');
  const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : '';
  if (!code) to('code_error', 'Type your code first.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(`/pay/${reference}`));

  const payable = await fetchPayableByReference(supabase, reference, user.id);
  if (!payable) redirect('/dashboard');
  if (payable.status === 'unchecked') unchecked();
  if (payable.status !== 'awaiting_payment') to('code_error', 'This one is already settled — a code can’t change it now.');

  // The couple's coordinator payment-permission gate — the same lock the proof and Maya presses carry.
  if (payable.eventId && payable.ownerUserId !== user.id) {
    const allowed = await coordinatorMoneyScopeAllowed(createMoneyWriterClient(), payable.eventId, user.id, 'checkout');
    if (!allowed) {
      to('code_error', 'The couple has not approved payment handling for your access — ask them to re-invite you with payment permission.');
    }
  }

  const money = createMoneyWriterClient();
  const [orderRead, paymentsRead, maya] = await Promise.all([
    money
      .from('orders')
      .select('order_id,status,service_key,requested_total_php,confirmed_total_php,voucher_code_applied')
      .eq('order_id', payable.orderId)
      .maybeSingle(),
    money.from('payments').select('payment_id').eq('order_id', payable.orderId).limit(1),
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
    hasPayment: (paymentsRead.data ?? []).length > 0,
    mayaCheckoutOpen: maya === 'open',
    codeApplied: Boolean(order.voucher_code_applied),
    quoted: order.confirmed_total_php != null,
  });
  if (!open.ok) to('code_error', open.reason);

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
    to('code_error', result.reason ?? PAY_CODE_UNCHECKED);
  }

  // ₱0 · No free-voucher route exists yet on /pay (nothing would confirm or switch on a ₱0 bill), so a code that
  // covers the whole price is refused BEFORE anything is written — the order stays exactly as it was. Open call
  // for the controller; see PAY_CODE_COVERS_ALL.
  if (result.final_centavos <= 0n) to('code_error', PAY_CODE_COVERS_ALL);

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
    to('code_error', (redemptionErr as { code?: string }).code === '23505' ? 'Looks like you’ve already used this code.' : PAY_CODE_UNCHECKED);
  }

  // 2 · Re-price the order — only while it is still exactly as checked (unpaid, unquoted, no code yet).
  const { data: repriced, error: repriceErr } = await money
    .from('orders')
    .update({ voucher_code_applied: result.code_normalized, voucher_discount_centavos: Number(result.discount_centavos) })
    .eq('order_id', payable.orderId)
    .in('status', ['draft', 'awaiting_payment'])
    .is('voucher_code_applied', null)
    .is('confirmed_total_php', null)
    .select('order_id');
  if (repriceErr || (repriced ?? []).length !== 1) {
    if (repriceErr) console.error('[pay-code] re-price refused', repriceErr.message);
    // Take the redemption back so the code is not spent on a price that never changed.
    const { error: undoErr } = await money.from('discount_code_redemptions').delete().eq('order_id', payable.orderId);
    if (undoErr) console.error('[pay-code] could not take back the redemption', payable.orderId, undoErr.message);
    unchecked();
  }

  // 3 · The counter and the ledger — best-effort, exactly as the drawer does them.
  try {
    await createAdminClient().rpc('increment_discount_uses', { p_id: result.discount_code_id });
  } catch (counterErr) {
    console.warn('[pay-code] discount_codes uses_count bump failed:', counterErr);
  }
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

  return to('code', result.code_normalized!);
}
