import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getQueueSource } from '@/lib/admin/queue-counts';
import { classifyDuplicate, MONEY_STATUSES, type PriorPayment } from '@/lib/payment-reference-match';
import { paymentLight, type PaymentLightRow } from '@/lib/admin/green-payments';

/**
 * "APPROVE ALL N GREEN" — the reads (admin slice 4, 2026-11-13). Pure rules live
 * in `green-payments.ts`; this file only fetches what they need.
 *
 * The same two facts the payments desk reads for its clean-match badge:
 *   1. the pending payment and its order (for `isDecisivePaymentMatch`),
 *   2. every payment already counted as money (for the duplicate rule — read
 *      unbounded, as the desk and `approvePaymentCore` read it: a duplicate
 *      check with a window is a duplicate check with a blind spot).
 *
 * ⛔ THE RECEIPT READ IS NOT HERE, ON PURPOSE. This file is what the batch
 * re-checks with before it approves money, so it must not even load what a
 * model saw (`an-ai-may-not-approve-money.test.ts` lists it as a money gate).
 * The verdict line is added for DISPLAY by `payment-verdicts.server.ts`.
 *
 * ⚠ A FAILED READ OF EITHER IS `ok: false` — the row then says it could not
 * sort the payments, and offers no batch. A missing duplicate check must never
 * let a collided payment look green.
 */

/** How many pending payments one Work render sorts. The desk reads 100. */
export const GREEN_READ_CAP = 200;

const PAYMENT_COLS =
  'payment_id, order_id, amount_php, channel, reference_number, screenshot_url, created_at, ' +
  'order:orders(public_id, reference_code, requested_total_php, confirmed_total_php, voucher_discount_centavos, service_key), ' +
  'user:users!payments_user_id_fkey(email)';

type PendingJoined = {
  payment_id: string;
  order_id: string;
  amount_php: number;
  channel: string | null;
  reference_number: string | null;
  screenshot_url: string | null;
  created_at: string;
  order: {
    public_id: string | null;
    reference_code: string | null;
    requested_total_php: number | null;
    confirmed_total_php: number | null;
    voucher_discount_centavos: number | null;
    service_key: string | null;
  } | null;
  user: { email: string | null } | null;
};

export type PaymentLightsRead =
  | { ok: true; rows: PaymentLightRow[]; total: number }
  | { ok: false };

/**
 * Sort pending payments into green and amber.
 * `paymentIds` narrows the read to those ids (the server-side re-check before a
 * batch approves) — the rule applied is identical either way.
 */
export async function readPaymentLights(
  admin: SupabaseClient,
  opts: { paymentIds?: readonly string[] } = {},
): Promise<PaymentLightsRead> {
  // The badge's own "open" predicate — never re-typed here (see getQueueSource).
  const src = getQueueSource('payments');
  if (!src) return { ok: false };
  let q = src
    .filter(admin.from(src.table).select(PAYMENT_COLS, { count: 'exact' }), { nowIso: new Date().toISOString() })
    .order('created_at', { ascending: true })
    .limit(GREEN_READ_CAP);
  if (opts.paymentIds) q = q.in('payment_id', [...opts.paymentIds]);

  const [pendingRes, priorsRes] = await Promise.all([
    q,
    admin.from('payments').select('payment_id, order_id, reference_number, status').in('status', MONEY_STATUSES),
  ]);
  if (pendingRes.error || !Array.isArray(pendingRes.data)) {
    logQueryError('readPaymentLights (pending)', pendingRes.error ?? null, {}, 'graceful_degrade');
    return { ok: false };
  }
  if (priorsRes.error || !Array.isArray(priorsRes.data)) {
    logQueryError('readPaymentLights (money already counted)', priorsRes.error ?? null, {}, 'graceful_degrade');
    return { ok: false };
  }
  const pending = pendingRes.data as unknown as PendingJoined[];
  const priors: PriorPayment[] = (priorsRes.data as Array<{
    payment_id: string;
    order_id: string;
    reference_number: string | null;
    status: string;
  }>).map((r) => ({
    paymentId: r.payment_id,
    orderId: r.order_id,
    referenceNumber: r.reference_number,
    status: r.status,
  }));

  const rows: PaymentLightRow[] = pending.map((p) => {
    const dup = classifyDuplicate({
      reference: p.reference_number,
      orderId: p.order_id,
      priors: priors.filter((r) => r.paymentId !== p.payment_id),
    });
    return {
      paymentId: p.payment_id,
      amountPhp: Number(p.amount_php),
      channel: p.channel,
      referenceNumber: p.reference_number,
      who: p.user?.email ?? p.order?.public_id ?? 'a guest order',
      createdAt: p.created_at,
      // Proof means non-empty, not merely non-null — '' is what an empty field posts.
      hasProof:
        (p.reference_number != null && p.reference_number.trim() !== '') ||
        (p.screenshot_url != null && p.screenshot_url.trim() !== ''),
      light: paymentLight({
        referenceNumber: p.reference_number,
        referenceCode: p.order?.reference_code ?? null,
        amountPhp: Number(p.amount_php),
        requestedTotalPhp: p.order?.requested_total_php ?? null,
        confirmedTotalPhp: p.order?.confirmed_total_php ?? null,
        voucherDiscountPhp:
          p.order?.voucher_discount_centavos != null ? Number(p.order.voucher_discount_centavos) / 100 : 0,
        serviceKey: p.order?.service_key ?? null,
        duplicate: dup.kind !== 'clear',
        hasScreenshot: (p.screenshot_url ?? '').trim() !== '',
      }),
    };
  });
  return { ok: true, rows, total: pendingRes.count ?? rows.length };
}
