import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { lastDropOf, readReceivedTranscript, type WaitingPayment } from '@/lib/admin/received-match';
import type { ReceivedOpenRow, ReceivedPileRead } from './_components/received-pile';
import { holdAutoMatches, readHeld, type HeldRow } from './received-auto';

/**
 * app/admin/payments/received.ts — the three things the admin does with a
 * screenshot of money that ARRIVED in our BDO (owner 2026-11-17, specs
 * prototypes/admin_payment_verify_2026-11-17/):
 *   drop  — many pictures at once, READ ON THE ADMIN'S PHONE (Tesseract, no
 *           outside service, owner 2026-11-17 "Yes, swap it in"); only the
 *           text arrives here → one received row each. No picture is sent.
 *   match — the admin presses Match on a row and a waiting payment
 *   not   — "Not received ▾" on a Buyer-says-paid card: reject or ask again,
 *           through the shipped rejectPayment / requestPaymentResubmit
 *   leave — "Set aside ▾": leave for the next drop, or not a Setnayan payment
 *
 * Not a `use server` file: each export would be a route, and the action budget
 * is at its ceiling. `approvePayment` in ./actions.ts dispatches here on its
 * `intent` field, exactly as it already does for 'record'.
 *
 * ⛔ NOTHING HERE APPROVES BY ITSELF. `matchReceived` only runs because a human
 * pressed Match, and it approves through the SAME `approvePaymentCore` path
 * (handed in, so this file cannot reach it any other way). Phase 2's exact
 * matches live in ./received-auto.ts: a drop HOLDS them 30 minutes, pays nothing.
 */

type Admin = ReturnType<typeof createAdminClient>;

/** Per request. The client sends the text of each picture, never the picture. */
export const RECEIVED_PER_DROP = 25;
/** A received screen is a few hundred characters; anything longer is not one. */
const MAX_TEXT = 4000;

export async function dropReceived(userId: string, formData: FormData): Promise<void> {
  const texts = formData
    .getAll('texts')
    .filter((t): t is string => typeof t === 'string')
    .slice(0, RECEIVED_PER_DROP);
  if (texts.length === 0) return;

  const rows = texts.map((text) => {
    // An empty text is a picture the phone could not read — kept as an
    // "unreadable" row so it is counted, never silently dropped.
    const read = readReceivedTranscript(text.slice(0, MAX_TEXT));
    return {
      channel: 'bdo',
      reference: read.reference,
      reference_norm: read.referenceNorm,
      amount_php: read.amountPhp,
      received_at: read.receivedAt,
      read_status: read.readStatus,
      created_by: userId,
    };
  });
  const { error } = await createAdminClient().from('admin_received_transactions').insert(rows);
  if (error) throw new Error(`Could not save what was read: ${error.message}`);
  // Phase 2: the exact ones are recorded on a 30-minute hold. Nothing pays here.
  await holdAutoMatches(userId);
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
): Promise<{ notice: string; warn: boolean; openPaymentId?: string }> {
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
  // Phase 2: a payment another BDO row is holding (matched by itself, Undo
  // window open) is not offered here — Undo that one first.
  const { data: holding } = await admin
    .from('admin_received_transactions')
    .select('received_id')
    .eq('matched_payment_id', paymentId)
    .limit(1);
  if (holding && holding.length > 0) {
    return { notice: 'That payment already matched by itself and is on its 30-minute hold. Undo it first.', warn: true };
  }
  // 🔒 To the centavo, re-checked here — the picker only offers equal amounts,
  // and a stale page must not approve a different sum.
  //    A reference match at a different amount ("₱50 short") is LISTED on the
  //    card, and picking it opens that payment's own card, where the shipped
  //    shortfall guard decides. Nothing is approved from here.
  if (r.amount_php == null || Math.round(Number(r.amount_php) * 100) !== Math.round(Number(p.amount_php) * 100)) {
    const diff = r.amount_php == null ? null : Math.round((Number(r.amount_php) - Number(p.amount_php)) * 100) / 100;
    const words =
      diff == null
        ? 'The amount on the screenshot was not read.'
        : `₱${Math.abs(diff).toLocaleString('en-PH', { maximumFractionDigits: 2 })} ${diff < 0 ? 'short' : 'over'}.`;
    return { notice: `${words} Confirm the amount on their payment.`, warn: true, openPaymentId: paymentId };
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

/** The reasons on "Not received ▾", and what each one does. */
export const NOT_RECEIVED_REASONS = {
  no_money: { label: 'No money arrived', notes: 'No money arrived in our BDO for this payment.' },
  wrong_amount: { label: 'Wrong amount', notes: 'The amount that arrived in our BDO does not match this payment.' },
  unreadable: {
    label: 'Photo unreadable — ask again',
    notes: 'Your receipt photo could not be read. Please send a clearer screenshot that shows the amount and the reference number.',
  },
  wrong_account: { label: 'Paid to the wrong account', notes: 'This payment did not go to Setnayan’s BDO account.' },
} as const;
export type NotReceivedReason = keyof typeof NOT_RECEIVED_REASONS;

export function isNotReceivedReason(v: unknown): v is NotReceivedReason {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(NOT_RECEIVED_REASONS, v);
}

/**
 * What Focus needs to draw the BDO pile: the open received rows, the buyers
 * who say they paid, and the last drop. Each read that is refused is SAID —
 * a failed read is never drawn as "nothing received".
 */
/** `withWaiting: false` on Admin › Payments, which already reads the pending payments. */
export async function readReceivedDesk({ withWaiting = true }: { withWaiting?: boolean } = {}): Promise<{
  read: ReceivedPileRead;
  waiting: WaitingPayment[] | null;
  lastDrop: { count: number; at: string } | null;
  /** Phase 2: matched by themselves, Undo window open. NULL = the read was refused. */
  held: HeldRow[] | null;
}> {
  const admin = createAdminClient();
  const [rec, last, pays, held] = await Promise.all([
    admin
      .from('admin_received_transactions')
      .select('received_id, reference, reference_norm, amount_php, received_at, read_status, left_reason')
      .is('matched_payment_id', null)
      .or('left_reason.is.null,left_reason.eq.later')
      .order('created_at', { ascending: true })
      .limit(100),
    // One drop is at most RECEIVED_PER_DROP rows per insert, all sharing created_at.
    admin.from('admin_received_transactions').select('created_at').order('created_at', { ascending: false }).limit(RECEIVED_PER_DROP),
    withWaiting
      ? admin
          .from('payments')
          .select('payment_id, amount_php, reference_number, created_at, order:orders(public_id, created_at), user:users!payments_user_id_fkey(email)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    readHeld(),
  ]);
  // A held payment is no longer "buyer says paid" — its money is on the hold list.
  const heldIds = new Set((held ?? []).map((h) => h.matched_payment_id));
  if (rec.error) logQueryError('admin focus: received pile', rec.error);
  if (last.error) logQueryError('admin focus: last drop', last.error);
  if (pays.error) logQueryError('admin focus: waiting payments', pays.error);
  type PayRow = {
    payment_id: string;
    amount_php: number;
    reference_number: string | null;
    order: { public_id: string | null; created_at: string | null } | null;
    user: { email: string | null } | null;
  };
  return {
    read: rec.error ? { kind: 'failed' } : { kind: 'ok', rows: (rec.data ?? []) as ReceivedOpenRow[] },
    waiting: pays.error
      ? null
      : ((pays.data ?? []) as unknown as PayRow[]).filter((p) => !heldIds.has(p.payment_id)).map((p) => ({
          payment_id: p.payment_id,
          amount_php: Number(p.amount_php),
          reference_number: p.reference_number,
          order_created_at: p.order?.created_at ?? null,
          label: p.user?.email ?? p.order?.public_id ?? '—',
        })),
    lastDrop: last.error ? null : lastDropOf((last.data ?? []) as Array<{ created_at: string }>),
    held,
  };
}
