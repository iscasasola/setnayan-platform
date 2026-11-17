import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeReceivedScreenshot } from '@/lib/payment-receipt-read.server';
import { readReceivedTranscript } from '@/lib/admin/received-match';

/**
 * app/admin/payments/received.ts — the three things the admin does with a
 * screenshot of money that ARRIVED in our BDO (owner 2026-11-17, specs
 * prototypes/admin_payment_verify_2026-11-17/):
 *   drop  — many pictures at once → one received row each, pictures discarded
 *   match — the admin presses Match on a row and a waiting payment
 *   leave — "Not now ▾": leave for the next drop, or not a Setnayan payment
 *
 * Not a `use server` file: each export would be a route, and the action budget
 * is at its ceiling. `approvePayment` in ./actions.ts dispatches here on its
 * `intent` field, exactly as it already does for 'record'.
 *
 * ⛔ NOTHING HERE APPROVES BY ITSELF. `matchReceived` only runs because a human
 * pressed Match, and it approves through the SAME `approvePaymentCore` path
 * (handed in, so this file cannot reach it any other way). Auto-match is phase 2.
 */

type Admin = ReturnType<typeof createAdminClient>;

/** Per request — the 6 MB action body limit. The client sends pictures in groups. */
export const RECEIVED_PER_DROP = 4;

export async function dropReceived(userId: string, formData: FormData): Promise<void> {
  const files = formData
    .getAll('shots')
    .filter((f): f is File => typeof f === 'object' && f !== null && 'arrayBuffer' in f && f.size > 0)
    .slice(0, RECEIVED_PER_DROP);
  if (files.length === 0) return;

  const rows = [];
  for (const file of files) {
    // The bytes exist only inside this loop. Nothing below writes them anywhere.
    const transcript = await transcribeReceivedScreenshot(new Uint8Array(await file.arrayBuffer()));
    const read = readReceivedTranscript(transcript ?? '');
    rows.push({
      channel: 'bdo',
      reference: read.reference,
      reference_norm: read.referenceNorm,
      amount_php: read.amountPhp,
      received_at: read.receivedAt,
      read_status: read.readStatus,
      created_by: userId,
    });
  }
  const { error } = await createAdminClient().from('admin_received_transactions').insert(rows);
  if (error) throw new Error(`Could not save what was read: ${error.message}`);
}

export type ApproveCore = (args: {
  admin: Admin;
  userId: string;
  paymentId: string;
  adminNotes: string | null;
  promoteOrder: boolean;
}) => Promise<{ ok: true } | { ok: false; message: string; duplicate?: true }>;

/**
 * Match one received row to one waiting payment, on the admin's press.
 * Returns a notice for the desk; `warn` when nothing was matched.
 */
export async function matchReceived(
  userId: string,
  formData: FormData,
  approve: ApproveCore,
): Promise<{ notice: string; warn: boolean }> {
  const receivedId = Number(formData.get('received_id'));
  const paymentId = formData.get('payment_id');
  if (!Number.isSafeInteger(receivedId) || typeof paymentId !== 'string' || paymentId === '') {
    return { notice: 'Pick the payment this money is for.', warn: true };
  }
  const admin = createAdminClient();
  const [{ data: rec }, { data: pay }] = await Promise.all([
    admin
      .from('admin_received_transactions')
      .select('received_id, reference, amount_php, matched_payment_id')
      .eq('received_id', receivedId)
      .maybeSingle(),
    admin.from('payments').select('payment_id, amount_php, status').eq('payment_id', paymentId).maybeSingle(),
  ]);
  const r = rec as { reference: string | null; amount_php: number | null; matched_payment_id: string | null } | null;
  const p = pay as { amount_php: number; status: string } | null;
  if (!r) return { notice: 'That received payment is gone. Refresh and try again.', warn: true };
  if (r.matched_payment_id) return { notice: 'That received payment is already matched.', warn: true };
  if (!p || p.status !== 'pending') return { notice: 'That payment is no longer waiting.', warn: true };
  // 🔒 To the centavo, re-checked here — the picker only offers equal amounts,
  // and a stale page must not approve a different sum.
  if (r.amount_php == null || Math.round(Number(r.amount_php) * 100) !== Math.round(Number(p.amount_php) * 100)) {
    return { notice: 'The amounts differ. Confirm it from the payment card instead.', warn: true };
  }

  const outcome = await approve({
    admin,
    userId,
    paymentId,
    adminNotes: `Matched to BDO received${r.reference ? ` ${r.reference}` : ''}.`,
    promoteOrder: true,
  });
  // A duplicate is refused BEFORE the payment flips — nothing was matched.
  if (!outcome.ok && outcome.duplicate) return { notice: outcome.message, warn: true };

  const { error } = await admin
    .from('admin_received_transactions')
    .update({ matched_payment_id: paymentId, match_kind: 'manual', matched_at: new Date().toISOString(), matched_by: userId, left_reason: null })
    .eq('received_id', receivedId)
    .is('matched_payment_id', null);
  if (error) console.error('received row match stamp failed', error.message);
  return outcome.ok ? { notice: 'Matched and confirmed.', warn: false } : { notice: outcome.message, warn: true };
}

export async function leaveReceived(formData: FormData): Promise<void> {
  const receivedId = Number(formData.get('received_id'));
  const reason = formData.get('reason');
  if (!Number.isSafeInteger(receivedId) || (reason !== 'later' && reason !== 'not_setnayan')) return;
  const { error } = await createAdminClient()
    .from('admin_received_transactions')
    .update({ left_reason: reason })
    .eq('received_id', receivedId)
    .is('matched_payment_id', null);
  if (error) throw new Error(`Could not set it aside: ${error.message}`);
}
