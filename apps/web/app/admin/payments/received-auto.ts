import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { RECEIVED_AUTO_RELEASE_GAP_MS } from '@/lib/periodic-job-registry';
import { fullInvoiceOf, dueCutoffIso, holdPatch, planAutoMatches, undoIsOpen, undoPatch, type AutoOpenRow, type CountedPayment } from '@/lib/admin/received-auto-match';
import { AUTO_MATCH_ENABLED, type WaitingPayment } from '@/lib/admin/received-match';
import type { ApproveCore } from './received';

/**
 * app/admin/payments/received-auto.ts — phase 2: exact matches HOLD, then pay.
 *
 * Owner rulings (specs DECISION_LOG 2026-11-17): exact matches auto-approve;
 * the conditions are closed by the "limits APPROVED, undo 30 minutes" row; a
 * self-match is RECORDED, waits 30 minutes, an Undo inside the window cancels
 * cleanly, and only then the normal approve runs; leftovers are matched by hand.
 *
 *   holdAutoMatches     after every drop — records the exact ones, pays nothing
 *   undoAutoMatch       the Undo press — the payment was never touched, the row
 *                       goes back to the hand pile and is never auto again
 *   releaseDueHolds     the hold is over — the SAME approvePaymentCore a human
 *                       Match press runs (handed in; this file cannot reach it
 *                       any other way), with the admin who dropped the picture
 *                       as the approver of record
 *
 * Every step writes an admin_audit_log row ('payment_auto_match_*').
 *
 * 🔑 UNDO AND RELEASE CANNOT BOTH WIN. Each updates the row only
 * `WHERE released_at IS NULL` (and Undo only inside the window), so whichever
 * lands first changes it and the other changes nothing — and then does nothing.
 *
 * Not a `use server` file: the action budget is at its ceiling, and the Undo
 * press reaches here through `approvePayment`'s `intent`, like phase 1.
 */

type Admin = ReturnType<typeof createAdminClient>;

async function audit(admin: Admin, row: { action: string; target_id: string; actor_user_id: string | null; metadata: Record<string, unknown> }) {
  const { error } = await admin.from('admin_audit_log').insert({ ...row, target_table: 'admin_received_transactions' });
  // Non-fatal, as on every payment audit row: the received row and the payment are the record.
  if (error) console.error('[received-auto] audit insert failed (non-fatal):', error.message);
}

/** The unpaid payments not already under a hold — what a received row may claim. */
async function readWaiting(admin: Admin): Promise<WaitingPayment[] | null> {
  const [pays, held] = await Promise.all([
    admin
      .from('payments')
      .select('payment_id, amount_php, reference_number, order:orders(public_id, created_at)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(500),
    admin.from('admin_received_transactions').select('matched_payment_id').eq('match_kind', 'auto').is('released_at', null),
  ]);
  if (pays.error || held.error) {
    // 🪤 A refused read is not "no payments waiting" — and here it must not be
    // "match against what we have" either. No read, no automatic match.
    logQueryError('received auto: waiting payments', (pays.error ?? held.error)!);
    return null;
  }
  const heldIds = new Set(((held.data ?? []) as Array<{ matched_payment_id: string | null }>).map((h) => h.matched_payment_id));
  type Row = { payment_id: string; amount_php: number; reference_number: string | null; order: { public_id: string | null; created_at: string | null } | null };
  return ((pays.data ?? []) as unknown as Row[])
    .filter((p) => !heldIds.has(p.payment_id))
    .map((p) => ({
      payment_id: p.payment_id,
      amount_php: Number(p.amount_php),
      reference_number: p.reference_number,
      order_created_at: p.order?.created_at ?? null,
      label: p.order?.public_id ?? '—',
    }));
}

/**
 * Payments that already count as money and carry this transfer's invoice — a
 * reused screenshot would name them too. Narrowed in SQL by the invoice digits,
 * decided by the pure rule.
 */
async function readCounted(admin: Admin, open: AutoOpenRow[]): Promise<CountedPayment[] | null> {
  const invoices = [...new Set(open.map((r) => fullInvoiceOf(r.reference_norm)).filter((x): x is string => !!x))];
  if (invoices.length === 0) return [];
  const { data, error } = await admin
    .from('payments')
    .select('payment_id, reference_number')
    .eq('status', 'matched')
    .or(invoices.map((i) => `reference_number.ilike.%${i}%`).join(','))
    .limit(500);
  if (error) {
    logQueryError('received auto: counted payments', error);
    return null;
  }
  return (data ?? []) as CountedPayment[];
}

/**
 * After a drop: record every exact match as an automatic match on a 30-minute
 * hold. PAYS NOTHING — the payment stays `pending` until the release.
 * Re-reads every open row, so a row left "for the next drop" is tried again.
 * Returns how many were held.
 */
export async function holdAutoMatches(userId: string): Promise<number> {
  // The one off switch: false → every row stays with a person, as in phase 1.
  if (!AUTO_MATCH_ENABLED) return 0;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('admin_received_transactions')
    .select('received_id, reference, reference_norm, amount_php, received_at, read_status, left_reason, auto_undone_at')
    .is('matched_payment_id', null)
    .limit(200);
  if (error) {
    logQueryError('received auto: open rows', error);
    return 0;
  }
  const open = ((data ?? []) as AutoOpenRow[]).map((r) => ({ ...r, amount_php: r.amount_php == null ? null : Number(r.amount_php) }));
  const [waiting, counted] = await Promise.all([readWaiting(admin), readCounted(admin, open)]);
  if (!waiting || !counted) return 0;

  const plan = planAutoMatches({ open, waiting, counted });
  const nowIso = new Date().toISOString();
  let held = 0;
  for (const h of plan.holds) {
    // Conditional: a row somebody matched by hand a moment ago is left alone, and
    // the one-match unique index refuses a payment another row already holds.
    const { data: changed, error: e } = await admin
      .from('admin_received_transactions')
      .update(holdPatch(h.payment_id, userId, nowIso))
      .eq('received_id', h.received_id)
      .is('matched_payment_id', null)
      .is('auto_undone_at', null)
      .select('received_id, reference, amount_php');
    if (e) {
      console.error('[received-auto] hold refused', e.message);
      continue;
    }
    const row = (changed ?? [])[0] as { reference: string | null; amount_php: number | null } | undefined;
    if (!row) continue;
    held += 1;
    await audit(admin, {
      action: 'payment_auto_match_held',
      target_id: String(h.received_id),
      actor_user_id: userId,
      metadata: { payment_id: h.payment_id, reference: row.reference, amount_php: row.amount_php, matched_at: nowIso },
    });
  }
  return held;
}

/**
 * The Undo press. Inside the 30 minutes only, and only while not yet released.
 * The payment was never changed by the hold, so putting the four hold fields
 * back IS the earlier state; `auto_undone_at` keeps the next drop from redoing it.
 */
export async function undoAutoMatch(userId: string, formData: FormData): Promise<{ notice: string; warn: boolean }> {
  const receivedId = Number(formData.get('received_id'));
  if (!Number.isSafeInteger(receivedId)) return { notice: 'Pick the match to undo.', warn: true };
  const admin = createAdminClient();
  const { data: before, error: readErr } = await admin
    .from('admin_received_transactions')
    .select('received_id, matched_payment_id, match_kind, matched_at, matched_by, released_at')
    .eq('received_id', receivedId)
    .maybeSingle();
  if (readErr) return { notice: `Could not read that match: ${readErr.message}`, warn: true };
  const b = before as { matched_payment_id: string | null; match_kind: string | null; matched_at: string | null; matched_by: string | null; released_at: string | null } | null;
  if (!b || b.match_kind !== 'auto' || !b.matched_at) return { notice: 'That match is not one that happened by itself.', warn: true };
  const now = new Date();
  if (b.released_at || !undoIsOpen(b.matched_at, now)) {
    return { notice: 'The 30 minutes are over — that payment is confirmed. Open it to change it.', warn: true };
  }
  const { data: changed, error } = await admin
    .from('admin_received_transactions')
    .update(undoPatch(now.toISOString()))
    .eq('received_id', receivedId)
    .eq('match_kind', 'auto')
    .is('released_at', null)
    .gt('matched_at', dueCutoffIso(now))
    .select('received_id');
  if (error) return { notice: `Could not undo: ${error.message}`, warn: true };
  if (!changed || changed.length === 0) return { notice: 'Too late — it was confirmed a moment ago.', warn: true };
  await audit(admin, {
    action: 'payment_auto_match_undone',
    target_id: String(receivedId),
    actor_user_id: userId,
    metadata: { before: b, undone_at: now.toISOString() },
  });
  return { notice: 'Undone. It is back with the ones you match by hand.', warn: false };
}

/**
 * The hold is over: claim each due row (released_at), then run the normal
 * approve. A duplicate refusal happens BEFORE the payment flips, so that row
 * goes back to the hand pile. Any other answer means the payment is matched,
 * exactly as after a human press. Returns how many were paid.
 */
export async function releaseDueHolds(approve: ApproveCore): Promise<number> {
  const admin = createAdminClient();
  const now = new Date();
  const { data, error } = await admin
    .from('admin_received_transactions')
    .select('received_id, reference, amount_php, matched_payment_id, matched_at, matched_by, created_by')
    .eq('match_kind', 'auto')
    .is('released_at', null)
    .not('matched_payment_id', 'is', null)
    .lte('matched_at', dueCutoffIso(now))
    .order('matched_at', { ascending: true })
    .limit(50);
  // Thrown, so the job run records ok=false instead of "nothing was due".
  if (error) throw new Error(`received auto release read: ${error.message}`);
  type Due = { received_id: number; reference: string | null; amount_php: number | null; matched_payment_id: string; matched_at: string; matched_by: string | null; created_by: string | null };
  let paid = 0;
  for (const d of (data ?? []) as Due[]) {
    const nowIso = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin
      .from('admin_received_transactions')
      .update({ released_at: nowIso })
      .eq('received_id', d.received_id)
      .eq('match_kind', 'auto')
      .eq('matched_payment_id', d.matched_payment_id)
      .is('released_at', null)
      .select('received_id');
    if (claimErr) throw new Error(`received auto release claim: ${claimErr.message}`);
    if (!claimed || claimed.length === 0) continue; // Undone, or another run took it.

    const approver = d.matched_by ?? d.created_by;
    const { data: pay, error: payErr } = await admin.from('payments').select('status').eq('payment_id', d.matched_payment_id).maybeSingle();
    if (payErr) {
      // Claimed but unreadable: put the claim back so the next run tries again, and record why.
      await admin.from('admin_received_transactions').update({ released_at: null }).eq('received_id', d.received_id).then(({ error }) => {
        if (error) console.error('[received-auto] unclaim failed', error.message);
      });
      throw new Error(`received auto release payment read: ${payErr.message}`);
    }
    const status = (pay as { status: string } | null)?.status ?? null;
    if (status !== 'pending' || !approver) {
      // Settled or refused by a person during the hold. Matched → the stamp
      // stays (it IS this money). Anything else → back to the hand pile.
      if (status !== 'matched') await reopen(admin, d.received_id, nowIso);
      await audit(admin, {
        action: 'payment_auto_match_not_released',
        target_id: String(d.received_id),
        actor_user_id: null,
        metadata: { payment_id: d.matched_payment_id, payment_status: status, reason: approver ? 'payment no longer waiting' : 'no admin on record' },
      });
      continue;
    }

    const outcome = await approve({
      admin,
      userId: approver,
      paymentId: d.matched_payment_id,
      adminNotes: `Matched by itself to BDO received${d.reference ? ` ${d.reference}` : ''} (held 30 minutes, not undone).`,
      promoteOrder: true,
    });
    if (!outcome.ok && outcome.duplicate) await reopen(admin, d.received_id, nowIso);
    else paid += 1;
    await audit(admin, {
      action: outcome.ok ? 'payment_auto_match_released' : 'payment_auto_match_release_refused',
      target_id: String(d.received_id),
      actor_user_id: null,
      metadata: {
        payment_id: d.matched_payment_id,
        approver_user_id: approver,
        amount_php: d.amount_php,
        held_since: d.matched_at,
        ...(outcome.ok ? {} : { message: outcome.message, reopened: !!outcome.duplicate }),
      },
    });
  }
  return paid;
}

/** Back to the hand pile, and never automatic again. */
async function reopen(admin: Admin, receivedId: number, nowIso: string) {
  const { error } = await admin
    .from('admin_received_transactions')
    .update({ ...undoPatch(nowIso), released_at: null })
    .eq('received_id', receivedId);
  if (error) console.error('[received-auto] reopen failed', error.message);
}

/** Cron-free: rides admin traffic (app/admin/layout.tsx), like every periodic job here. */
export async function maybeReleaseReceivedHolds(approve: ApproveCore): Promise<void> {
  await runClaimedJob('received-auto-match-release', RECEIVED_AUTO_RELEASE_GAP_MS, () => releaseDueHolds(approve));
}

export type HeldRow = { received_id: number; reference: string | null; amount_php: number | null; matched_at: string; matched_payment_id: string; label: string };

/** The open holds, for the Focus list and Admin › Payments. A refused read is said, never drawn as none. */
export async function readHeld(): Promise<HeldRow[] | null> {
  const { data, error } = await createAdminClient()
    .from('admin_received_transactions')
    .select('received_id, reference, amount_php, matched_at, matched_payment_id, payment:payments!admin_received_transactions_matched_payment_id_fkey(order:orders(public_id), user:users!payments_user_id_fkey(email))')
    .eq('match_kind', 'auto')
    .is('released_at', null)
    .order('matched_at', { ascending: false })
    .limit(50);
  if (error) {
    logQueryError('received auto: held', error);
    return null;
  }
  type Row = { received_id: number; reference: string | null; amount_php: number | null; matched_at: string; matched_payment_id: string; payment: { order: { public_id: string | null } | null; user: { email: string | null } | null } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    received_id: r.received_id,
    reference: r.reference,
    amount_php: r.amount_php == null ? null : Number(r.amount_php),
    matched_at: r.matched_at,
    matched_payment_id: r.matched_payment_id,
    label: r.payment?.user?.email ?? r.payment?.order?.public_id ?? '—',
  }));
}
