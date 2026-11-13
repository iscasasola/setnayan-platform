import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { receiptVerdictLine, type PaymentLightRow, type ReceiptReadLine } from '@/lib/admin/green-payments';

/**
 * The receipt read's verdict line on each Work › Payments row — DISPLAY ONLY
 * (admin slice 4, 2026-11-13; audit Top-10 #4: "the receipt-read verdict shown
 * in the row").
 *
 * ⛔ KEPT OUT OF `green-payments.server.ts` on purpose. That file is what the
 * "Approve all N green" batch re-checks with before it approves money; this one
 * reads what a model saw. They meet only on the screen, after the sort is done
 * — the same split the payments desk keeps between `decisive` and its card.
 *
 * Newest read per payment wins (a re-read supersedes, as on the desk). A failed
 * read changes the line to say so, and nothing else.
 */
export async function withReceiptVerdicts(
  admin: SupabaseClient,
  rows: PaymentLightRow[],
): Promise<PaymentLightRow[]> {
  if (rows.length === 0) return rows;
  const reads = new Map<string, ReceiptReadLine>();
  let failed = false;
  const { data, error } = await admin
    .from('payment_receipt_reads')
    .select('payment_id, status, summary, created_at')
    .in('payment_id', rows.map((r) => r.paymentId))
    .order('created_at', { ascending: false });
  if (error || !Array.isArray(data)) {
    logQueryError('withReceiptVerdicts (payment_receipt_reads)', error ?? null, {}, 'graceful_degrade');
    failed = true;
  } else {
    for (const r of data as Array<{ payment_id: string; status: ReceiptReadLine['status']; summary: string | null }>) {
      if (!reads.has(r.payment_id)) reads.set(r.payment_id, { status: r.status, summary: r.summary });
    }
  }
  return rows.map((r) => ({ ...r, verdict: receiptVerdictLine(reads.get(r.paymentId), failed) }));
}
