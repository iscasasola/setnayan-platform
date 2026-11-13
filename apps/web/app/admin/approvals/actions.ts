'use server';

/**
 * /admin/approvals server actions — two-admin (four-eyes) approval queue.
 *
 * Security model (mirrors the other admin surfaces — see force-majeure/actions.ts):
 *   - requireAdmin() asserts the CALLER is an admin (is_internal || is_team_member
 *     || account_type==='admin') via the authenticated client, server-side.
 *   - All reads/writes then go through the service-role client (createAdminClient),
 *     which bypasses RLS; the admin_approval_requests RLS (is_admin()) is
 *     defense-in-depth.
 *   - FOUR-EYES is enforced redundantly: the atomic claim UPDATE carries a
 *     `.neq('initiated_by', me)` predicate AND the table has a CHECK
 *     (decided_by <> initiated_by). A self-decision can never land.
 *   - The claim UPDATE is gated on `status='pending'` + `expires_at > now`, so a
 *     request can be decided at most once and never after expiry (no TOCTOU /
 *     double-execute).
 *
 * Every mutation best-effort logs to admin_audit_log (failure logs to console,
 * never rolls back — the canonical pattern).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  approvalActionLabel,
  isApprovalActionType,
  type ApprovalActionType,
} from '@/lib/admin-approvals';
import { areaForApprovalAction, isAdminArea, areaHasEscalated, type AdminArea } from '@/lib/admin/areas';
import { requireAdminCan } from '@/lib/admin/can.server';
import { SELF_APPROVAL_WORD, typedWordMatches } from '@/lib/admin/self-approval';
import { startOwnerWait } from '@/lib/admin/self-approval.server';
import { emailOwnerRan } from '@/lib/admin/self-approval-email';

// Shared admin gate (require-admin.ts) — identical contract to the local
// requireAdmin this file used to duplicate (login redirect · Forbidden throw).
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
type AdminClient = ReturnType<typeof createAdminClient>;

async function audit(
  admin: AdminClient,
  row: {
    action: string;
    target_id?: string | null;
    actor_user_id: string;
    reason?: string | null;
    before_json?: unknown;
    after_json?: unknown;
    /** The admin area the act belongs to (DECISION_LOG 2026-11-13). */
    area?: AdminArea | null;
  },
) {
  const { error } = await admin.from('admin_audit_log').insert({
    action: row.action,
    area: row.area ?? null,
    target_table: 'admin_approval_requests',
    target_id: row.target_id ?? null,
    actor_user_id: row.actor_user_id,
    reason: row.reason ?? null,
    before_json: row.before_json ?? null,
    after_json: row.after_json ?? null,
  });
  if (error) console.error('[approvals audit] insert failed', error.message);
}

/**
 * Initiate a privileged-role grant request. Created in `pending`; a DIFFERENT
 * admin must approve it before it executes.
 */
export async function requestPrivilegedGrant(formData: FormData) {
  // Raising a Team request is Basic in Team — it decides nothing; deciding it
  // takes Escalated (approveRequest below), or the owner typed + 24 h.
  const { userId } = await requireAdminCan('team', 'basic');

  const actionType = formData.get('action_type');
  const targetEmail = formData.get('target_email');
  const rationale = formData.get('rationale');

  if (!isApprovalActionType(actionType)) throw new Error('Invalid action type');
  if (typeof targetEmail !== 'string' || !targetEmail.trim()) {
    throw new Error('Target email is required');
  }
  if (typeof rationale !== 'string' || rationale.trim().length < 3) {
    throw new Error('A rationale (≥3 chars) is required');
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('users')
    .select('user_id, email')
    .ilike('email', targetEmail.trim())
    .maybeSingle();
  if (!target) throw new Error('No Setnayan account with that email');
  // Hardening: an admin can't initiate a privileged grant for their OWN
  // account. Not a four-eyes bypass (a different admin still approves), but it
  // removes the self-elevation request pattern entirely.
  if (target.user_id === userId) {
    throw new Error(
      'You cannot request a privileged grant for your own account — ask another admin to initiate it.',
    );
  }

  const { error: insErr } = await admin.from('admin_approval_requests').insert({
    action_type: actionType,
    target_user_id: target.user_id,
    rationale: rationale.trim().slice(0, 2000),
    initiated_by: userId,
  });
  if (insErr) throw new Error(`Could not create request: ${insErr.message}`);

  await audit(admin, {
    action: 'approval_request_created',
    area: areaForApprovalAction(actionType),
    target_id: target.user_id,
    actor_user_id: userId,
    reason: rationale.trim(),
    after_json: { action_type: actionType, target_email: target.email },
  });

  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}

/** Areas from a payload's `scopes.escalated` (or `areas`), unknown ones dropped. */
function escalatedAreasFromPayload(payload: Record<string, unknown> | null | undefined): AdminArea[] {
  const p = (payload ?? {}) as { areas?: unknown; scopes?: { escalated?: unknown } };
  const raw = Array.isArray(p.scopes?.escalated) ? p.scopes?.escalated : Array.isArray(p.areas) ? p.areas : [];
  return [...new Set((raw as unknown[]).filter(isAdminArea))].filter(areaHasEscalated);
}

/**
 * Write the scopes a request carries: `{ scopes: { basic: [...], escalated: [...] } }`.
 * Escalated rows also write the matching Basic row, so the Team screen reads
 * the same whichever door gave it. Idempotent (the UNIQUE triple).
 */
async function writeScopesFromPayload(
  admin: AdminClient,
  userId: string,
  payload: Record<string, unknown> | null | undefined,
  grantedBy: string | null,
): Promise<void> {
  const p = (payload ?? {}) as { scopes?: { basic?: unknown; escalated?: unknown } };
  const basic = Array.isArray(p.scopes?.basic) ? (p.scopes?.basic as unknown[]).filter(isAdminArea) : [];
  const escalated = escalatedAreasFromPayload(payload);
  const rows = [
    ...new Set([...basic, ...escalated]),
  ].map((area) => ({ user_id: userId, area, level: 'basic', granted_by: grantedBy }));
  for (const area of escalated) {
    rows.push({ user_id: userId, area, level: 'escalated', granted_by: grantedBy });
  }
  if (rows.length === 0) return;
  const { error } = await admin
    .from('admin_scopes')
    .upsert(rows, { onConflict: 'user_id,area,level', ignoreDuplicates: true });
  if (error) throw new Error(`Saving the admin's areas failed: ${error.message}`);
}

/** Execute the underlying privileged-role change. Service-role only. */
async function executeApproved(
  admin: AdminClient,
  row: {
    action_type: ApprovalActionType;
    payload?: Record<string, unknown> | null;
    target_user_id: string | null;
    target_id: string | null;
    rationale: string | null;
    initiated_by: string | null;
    decided_by: string | null;
  },
): Promise<void> {
  // Anti-fraud § 5 — the irreversible wipe + ban executes ONLY here, after a
  // DIFFERENT admin has confirmed (four-eyes enforced by the atomic claim). The
  // vendor target rides in target_id (non-user target, per approve_vendor_
  // partnership precedent), NOT target_user_id.
  if (row.action_type === 'approve_fraud_wipe_ban') {
    if (!row.target_id) throw new Error('Fraud wipe request has no target supplier');
    if (!row.decided_by) throw new Error('Fraud wipe request has no confirming admin');
    const { executeFraudWipeBan } = await import('@/app/admin/fraud/actions');
    await executeFraudWipeBan(admin, {
      vendorProfileId: row.target_id,
      confirmingAdminId: row.decided_by,
      rationale: row.rationale,
    });
    return;
  }

  // ── The paid journal spotlight (register LAU-20) ─────────────────────────
  //
  // 🔑 WITHOUT THIS BRANCH A PAID PLACEMENT COULD NEVER PUBLISH. `initiateSponsored`
  // writes the pending row with `target_id` (the spotlight) and NO
  // `target_user_id`, because a spotlight is not a person — the same non-user
  // shape `approve_fraud_wipe_ban` uses above. The single-admin path refuses
  // sponsored rows on purpose, and says so: "Sponsored placements need
  // two-admin approval — use the sponsored queue." That queue is this page,
  // which lists every pending row and calls this function, which fell straight
  // through to the throw below.
  //
  // So the loop closed on itself: refused there, listed here, and thrown on
  // approve. Requesting worked, and only approving failed — which is why the
  // gap survived. Nothing in the vocabulary, the page or the CHECK was wrong;
  // the dispatcher simply had no arm for a type the rest of the system already
  // created.
  if (row.action_type === 'approve_journal_spotlight') {
    if (!row.target_id) throw new Error('Spotlight approval has no target spotlight');
    const { data: published, error } = await admin
      .from('journal_vendor_spotlights')
      .update({ admin_approved_at: new Date().toISOString() })
      .eq('spotlight_id', row.target_id)
      .select('blog_slug');
    if (error) throw new Error(`Spotlight approval failed: ${error.message}`);
    // The article is ISR for a day (app/blog/[slug]/page.tsx): the credit shows at once.
    for (const p of (published ?? []) as Array<{ blog_slug: string | null }>) {
      if (p.blog_slug) revalidatePath(`/blog/${p.blog_slug}`);
    }
    return;
  }

  // A comp is money, and money takes two admins (register LAU-19). The vendor
  // rides in target_id; the SKU and reason ride in the payload. The expiry is
  // computed HERE, at execution, so a comp approved two days later still stacks
  // from the expiry as it is then.
  if (row.action_type === 'approve_comp_grant') {
    if (!row.target_id) throw new Error('Comp approval has no target supplier');
    if (!row.decided_by) throw new Error('Comp approval has no confirming admin');
    if (!row.initiated_by) throw new Error('Comp approval has no initiating admin');
    const payload = (row.payload ?? {}) as { sku?: string; reason?: string };
    if (!payload.sku) throw new Error('Comp approval has no SKU');
    // `rationale` is nullable in the row type even though the CHECK makes it
    // 1..2000 chars — narrow it rather than assert it, so a future nullable
    // path cannot pass `null` into an audited money record.
    const compReason = payload.reason ?? row.rationale ?? '';
    if (!compReason) throw new Error('Comp approval has no reason');
    const { executeVendorSkuComp } = await import('@/app/admin/vendors/actions');
    await executeVendorSkuComp(admin, {
      vendorProfileId: row.target_id,
      sku: payload.sku,
      reason: compReason,
      initiatedByAdminId: row.initiated_by,
      confirmingAdminId: row.decided_by,
    });
    return;
  }

  // A refund over ₱25,000 is money leaving, and Vendor Agreement § 9.1 names
  // that figure. The order rides in target_id; the amount, reason and proof
  // ride in the payload. The amount is taken from the PAYLOAD, never re-read
  // from the order total — the second admin is approving the number the first
  // admin wrote down, not whatever the order says now.
  if (row.action_type === 'approve_large_refund') {
    if (!row.target_id) throw new Error('Refund approval has no target order');
    if (!row.decided_by) throw new Error('Refund approval has no confirming admin');
    if (!row.initiated_by) throw new Error('Refund approval has no initiating admin');
    const payload = (row.payload ?? {}) as {
      amount_php?: number;
      reason?: string;
      proof_url?: string | null;
    };
    const amountPhp = payload.amount_php;
    if (typeof amountPhp !== 'number' || !Number.isFinite(amountPhp) || amountPhp <= 0) {
      throw new Error('Refund approval has no usable amount');
    }
    // `rationale` is nullable in the row type even though the CHECK makes it
    // 1..2000 chars — narrow rather than assert, so no audited money record
    // can carry `null` as its reason.
    const refundReason = payload.reason ?? row.rationale ?? '';
    if (!refundReason) throw new Error('Refund approval has no reason');
    const { executeLargeRefund } = await import('@/app/admin/payments/actions');
    await executeLargeRefund(admin, {
      orderId: row.target_id,
      reason: refundReason,
      proofUrl: payload.proof_url ?? null,
      amountPhp,
      initiatedByAdminId: row.initiated_by,
      confirmingAdminId: row.decided_by,
    });
    return;
  }

  // § 9.1 — the BDO/GCash receiving account, text fields or QR image. No
  // target_user_id and no target_id: the subject is the platform's own
  // settings row, not a person or a vendor. Everything needed is in the
  // payload, which is deliberate — the second admin approves exactly the
  // destination the first one proposed, never a value re-read at execution.
  if (row.action_type === 'approve_payment_account_change') {
    if (!row.decided_by) throw new Error('Payment approval has no confirming admin');
    if (!row.initiated_by) throw new Error('Payment approval has no initiating admin');
    if (!row.payload) throw new Error('Payment approval has no payload');
    const { executePaymentAccountChange } = await import('@/app/admin/settings/actions');
    await executePaymentAccountChange(admin, {
      payload: row.payload,
      initiatedByAdminId: row.initiated_by,
      confirmingAdminId: row.decided_by,
    });
    return;
  }

  // § 9.1 — what a customer is charged. The SKU rides in target_id; the new
  // figures ride in the payload and are never re-read from a form, so the two
  // admins cannot end up agreeing to different prices.
  if (row.action_type === 'approve_retail_price_change') {
    if (!row.target_id) throw new Error('Price approval has no target SKU');
    if (!row.decided_by) throw new Error('Price approval has no confirming admin');
    if (!row.initiated_by) throw new Error('Price approval has no initiating admin');
    if (!row.payload) throw new Error('Price approval has no payload');
    const { executeRetailPriceChange } = await import('@/app/admin/pricing/actions');
    await executeRetailPriceChange(admin, {
      payload: row.payload,
      initiatedByAdminId: row.initiated_by,
      confirmingAdminId: row.decided_by,
    });
    return;
  }

  if (!row.target_user_id) throw new Error('Request has no target user');
  const t = row.target_user_id;

  if (row.action_type === 'grant_internal_account') {
    // Internal (§10a) replaces the team-member flag — clear the other one.
    const { error } = await admin
      .from('users')
      .update({ is_internal: true, is_team_member: false })
      .eq('user_id', t);
    if (error) throw new Error(`Grant internal failed: ${error.message}`);
  } else if (row.action_type === 'grant_team_member') {
    // § 9.1 — "Promote a user to any admin role". is_team_member IS admin
    // (lib/admin/admin-predicate.ts), so this is the ONLY place that turns it
    // on. Removing it stays a one-admin write in toggleTeamMember.
    //
    // 2026-11-13 · "Add an admin" from /admin/team carries the areas the new
    // admin may handle in the payload. They are written FIRST, so the moment
    // the flag turns on the person can do exactly what was approved and
    // nothing more — a new admin with no rows can open /admin and do nothing.
    await writeScopesFromPayload(admin, t, row.payload, row.decided_by);
    const { error } = await admin
      .from('users')
      .update({ is_team_member: true, updated_at: new Date().toISOString() })
      .eq('user_id', t);
    if (error) throw new Error(`Add to team failed: ${error.message}`);
  } else if (row.action_type === 'grant_admin_escalated') {
    // DECISION_LOG 2026-11-13 — giving the Escalated level. The areas ride in
    // the payload, so the second admin (or the owner, typed + 24 h) approves
    // exactly the areas that were asked for, never a value re-read later.
    const areas = escalatedAreasFromPayload(row.payload);
    if (areas.length === 0) throw new Error('Escalated grant names no areas');
    await writeScopesFromPayload(admin, t, { scopes: { escalated: areas } }, row.decided_by);
  } else if (row.action_type === 'promote_to_admin') {
    const { error } = await admin
      .from('users')
      .update({ account_type: 'admin' })
      .eq('user_id', t);
    if (error) throw new Error(`Promote to admin failed: ${error.message}`);
  } else {
    // A `grant_team_pool` request opened before its retirement (owner 2026-11-05) lands here and is refused,
    // never executed — reject it from the queue.
    throw new Error(`Unknown action type: ${row.action_type as string}`);
  }
}

type ClaimedRow = {
  approval_id: string;
  public_id?: string | null;
  action_type: ApprovalActionType;
  payload?: Record<string, unknown> | null;
  initiated_by: string | null;
  target_user_id: string | null;
  target_id: string | null;
  rationale: string | null;
  decided_by: string | null;
};

const CLAIM_COLUMNS =
  'approval_id, public_id, action_type, target_user_id, target_id, payload, rationale, initiated_by, decided_by';

/**
 * Deciding a request takes the ESCALATED level in its area (DECISION_LOG
 * 2026-11-13) — every two-admin action gives or takes something. Read the
 * action type first, check, then claim; the claim's own predicates stay the
 * guard against a double decision.
 */
async function requireDeciderFor(approvalId: string) {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('admin_approval_requests')
    .select('action_type')
    .eq('approval_id', approvalId)
    .maybeSingle();
  if (error) throw new Error(`Couldn’t read the request, so nothing was decided: ${error.message}`);
  if (!row) throw new Error('That request no longer exists.');
  const area = areaForApprovalAction(row.action_type as string);
  if (!area) throw new Error(`This kind of request has no area yet, so nobody can decide it: ${row.action_type as string}`);
  const { userId } = await requireAdminCan(area, 'escalated');
  return { userId, area, admin };
}

/** Execute a claimed row, rolling the claim back to pending on failure. */
async function executeClaimed(
  admin: AdminClient,
  claimed: ClaimedRow,
  actorUserId: string,
  area: AdminArea | null,
): Promise<void> {
  try {
    await executeApproved(admin, claimed);
  } catch (e) {
    // Execution failed AFTER the claim — roll the request back to pending so it
    // isn't stuck "approved" but unexecuted, and surface the error.
    // Status-guarded rollback: only reopen the row THIS call claimed
    // (status is still 'approved' — nobody else can have touched it, since a
    // competing claim requires status='pending'). Prevents clobbering any
    // other state. (A future hardening folds claim+execute into one
    // SECURITY DEFINER transaction so no compensating reset is needed.)
    const { error: rollbackErr } = await admin
      .from('admin_approval_requests')
      .update({ status: 'pending', decided_by: null, decided_at: null })
      .eq('approval_id', claimed.approval_id)
      .eq('status', 'approved');
    if (rollbackErr) console.error('[approvals] rollback to pending failed', rollbackErr.message);
    await audit(admin, {
      action: 'approval_execute_failed',
      area,
      target_id: claimed.target_user_id,
      actor_user_id: actorUserId,
      reason: e instanceof Error ? e.message : String(e),
      before_json: { action_type: claimed.action_type },
    });
    throw e;
  }
}

/**
 * Approve a pending request AS A SECOND ADMIN, then execute it. The atomic
 * claim (status='pending' + expires_at>now + initiated_by<>me) guarantees the
 * request is decided once, never after expiry, never by its initiator.
 */
export async function approveRequest(formData: FormData) {
  const approvalId = formData.get('approval_id');
  if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid request');
  const { userId, area, admin } = await requireDeciderFor(approvalId);

  const nowIso = new Date().toISOString();

  const { data: claimed, error: claimErr } = await admin
    .from('admin_approval_requests')
    .update({ status: 'approved', decided_by: userId, decided_at: nowIso })
    .eq('approval_id', approvalId)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .neq('initiated_by', userId)
    .select(CLAIM_COLUMNS)
    .maybeSingle();

  if (claimErr) throw new Error(`Could not approve: ${claimErr.message}`);
  if (!claimed) {
    throw new Error(
      'Could not approve — the request was already decided, has expired, you initiated it (a different admin must approve), or the admin who raised it has since been deleted, in which case it can only expire.',
    );
  }

  // Kept in step with executeApproved's parameter — a cast that omits a
  // field does not fail at the cast, it fails at the call, one line later.
  await executeClaimed(admin, claimed as ClaimedRow, userId, area);

  await audit(admin, {
    action: `approval_approved:${claimed.action_type}`,
    area,
    target_id: claimed.target_user_id,
    actor_user_id: userId,
    before_json: { initiated_by: claimed.initiated_by, status: 'pending' },
    after_json: { status: 'approved', executed: true },
  });

  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}

/**
 * Reject a pending request (second admin). No execution. Reached through
 * `adminTeamAct` (op=reject) so the slice adds no route over the action ceiling.
 */
async function rejectRequest(formData: FormData) {
  const approvalId = formData.get('approval_id');
  const reason = formData.get('reason');
  if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid request');
  const { userId, area, admin } = await requireDeciderFor(approvalId);

  const nowIso = new Date().toISOString();

  const { data: claimed, error: claimErr } = await admin
    .from('admin_approval_requests')
    .update({
      status: 'rejected',
      decided_by: userId,
      decided_at: nowIso,
      decision_reason:
        typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 2000) : null,
    })
    .eq('approval_id', approvalId)
    .eq('status', 'pending')
    .neq('initiated_by', userId)
    .select('approval_id, action_type, target_user_id, initiated_by')
    .maybeSingle();

  if (claimErr) throw new Error(`Could not reject: ${claimErr.message}`);
  if (!claimed) {
    throw new Error(
      'Could not reject — the request was already decided, you initiated it (a different admin must decide), or the admin who raised it has since been deleted, in which case it can only expire.',
    );
  }

  await audit(admin, {
    action: `approval_rejected:${claimed.action_type}`,
    area,
    target_id: claimed.target_user_id,
    actor_user_id: userId,
    reason: typeof reason === 'string' ? reason : null,
    before_json: { initiated_by: claimed.initiated_by, status: 'pending' },
    after_json: { status: 'rejected' },
  });

  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}

// ════════════════════════════════════════════════════════════════════════════
// THE OWNER APPROVES HIS OWN REQUEST — typed + 24 h (DECISION_LOG 2026-11-13)
// ════════════════════════════════════════════════════════════════════════════

/**
 * The owner types the word on his OWN pending request. The database stamps the
 * time and sets run_after = now + 24 h (guard_owner_self_approval) — the value
 * sent here is only a "please start", never the clock. He is emailed.
 */
async function confirmOwnRequest(formData: FormData) {
  const { userId } = await requireAdmin();
  const approvalId = formData.get('approval_id');
  if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid request');
  if (!typedWordMatches(formData.get('typed'))) {
    throw new Error(`Type ${SELF_APPROVAL_WORD} to start the 24-hour wait. Nothing was changed.`);
  }
  await startOwnerWait(createAdminClient(), { approvalId, ownerId: userId });
  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}

/** Cancel = withdraw. The requester only; any time before it is decided. */
async function withdrawRequest(formData: FormData) {
  const { userId } = await requireAdmin();
  const approvalId = formData.get('approval_id');
  if (typeof approvalId !== 'string' || !approvalId) throw new Error('Invalid request');

  const admin = createAdminClient();
  const { data: closed, error } = await admin
    .from('admin_approval_requests')
    .update({ status: 'withdrawn', decided_by: userId, decided_at: new Date().toISOString() })
    .eq('approval_id', approvalId)
    .eq('status', 'pending')
    .eq('initiated_by', userId)
    .select('approval_id, action_type, target_user_id')
    .maybeSingle();
  if (error) throw new Error(`Could not cancel: ${error.message}`);
  if (!closed) throw new Error('Could not cancel — it is not your request, or it was already decided.');

  await audit(admin, {
    action: `approval_withdrawn:${closed.action_type as string}`,
    area: areaForApprovalAction(closed.action_type as string),
    target_id: closed.target_user_id as string | null,
    actor_user_id: userId,
    after_json: { status: 'withdrawn' },
  });

  revalidatePath('/admin/approvals');
  revalidatePath('/admin');
}

/**
 * THE RUNNER — executes the owner's requests whose 24 hours have passed.
 * Cron-free (the project has no scheduler): fired via `after()` from `/` and
 * from the approvals and team pages, throttled per instance by the caller
 * (lib/admin/self-approval-runner.ts).
 *
 * Safe to be triggered by anyone: it takes no input and can only run rows the
 * owner himself confirmed whose wait the DATABASE agrees has passed — the
 * claim is refused by guard_owner_self_approval otherwise.
 *
 * A failed run is closed as `expired` with the reason (and the owner emailed)
 * rather than retried forever in the background.
 */
async function runDueOwnerApprovals(): Promise<{ ran: number; failed: number }> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: due, error } = await admin
    .from('admin_approval_requests')
    .select('approval_id')
    .eq('status', 'pending')
    .not('self_confirmed_at', 'is', null)
    .lte('run_after', nowIso)
    .gt('expires_at', nowIso)
    .limit(20);
  if (error) {
    console.error('[owner self-approval] due read failed', error.message);
    return { ran: 0, failed: 0 };
  }

  let ran = 0;
  let failed = 0;
  for (const { approval_id } of (due ?? []) as Array<{ approval_id: string }>) {
    const { data: row, error: readErr } = await admin
      .from('admin_approval_requests')
      .select('initiated_by')
      .eq('approval_id', approval_id)
      .maybeSingle();
    if (readErr) {
      console.error('[owner self-approval] due row read failed', readErr.message);
      continue;
    }
    if (!row?.initiated_by) {
      console.error('[owner self-approval] due row has no initiator (deleted admin) — left to expire', approval_id);
      continue;
    }
    const ownerId = row.initiated_by as string;

    // The claim: decided by its own initiator. The database refuses this for
    // anyone but the owner, and before run_after on its own clock.
    const { data: claimed, error: claimErr } = await admin
      .from('admin_approval_requests')
      .update({ status: 'approved', decided_by: ownerId, decided_at: new Date().toISOString() })
      .eq('approval_id', approval_id)
      .eq('status', 'pending')
      .eq('initiated_by', ownerId)
      .select(CLAIM_COLUMNS)
      .maybeSingle();
    if (claimErr || !claimed) {
      if (claimErr) console.error('[owner self-approval] claim refused', claimErr.message);
      continue;
    }

    const area = areaForApprovalAction(claimed.action_type as string);
    const what = approvalActionLabel(claimed.action_type as string);
    const publicId = (claimed.public_id as string | null) ?? approval_id;
    try {
      await executeClaimed(admin, claimed as ClaimedRow, ownerId, area);
    } catch (e) {
      failed += 1;
      const why = e instanceof Error ? e.message : String(e);
      const { error: closeErr } = await admin
        .from('admin_approval_requests')
        .update({ status: 'expired', decision_reason: `Did not run after the 24-hour wait: ${why}`.slice(0, 2000) })
        .eq('approval_id', approval_id)
        .eq('status', 'pending');
      if (closeErr) console.error('[owner self-approval] closing a failed run failed', closeErr.message);
      await emailOwnerRan({ what, publicId, ok: false, error: why });
      continue;
    }
    ran += 1;
    await audit(admin, {
      action: `approval_approved:${claimed.action_type as string}`,
      area,
      target_id: claimed.target_user_id as string | null,
      actor_user_id: ownerId,
      reason: 'The owner approved his own request; it ran after the 24-hour wait.',
      before_json: { initiated_by: ownerId, status: 'pending', self_approved: true },
      after_json: { status: 'approved', executed: true },
    });
    await emailOwnerRan({ what, publicId, ok: true });
  }

  if (ran + failed > 0) {
    revalidatePath('/admin/approvals');
    revalidatePath('/admin');
  }
  return { ran, failed };
}

// ════════════════════════════════════════════════════════════════════════════
// ONE DISPATCHER for everything the 2026-11-13 admin-team slice adds.
// Every exported "use server" function is a Vercel route under a hard ceiling
// (scripts/lint-server-action-budget.mjs) — so the Team screen, the owner's
// typed word, Cancel, Escalate ▸ / Mark handled and the runner share ONE
// export instead of eight. Each op runs its own gate from the SESSION; nothing
// here passes an identity in.
// ════════════════════════════════════════════════════════════════════════════
export async function adminTeamAct(formData: FormData): Promise<void> {
  const op = formData.get('op');
  switch (op) {
    case 'confirm_own':
      return confirmOwnRequest(formData);
    case 'withdraw':
      return withdrawRequest(formData);
    case 'reject':
      return rejectRequest(formData);
    case 'add': {
      const { addAdminOp } = await import('@/app/admin/team/team-ops.server');
      return addAdminOp(formData);
    }
    case 'save': {
      const { saveAdminAreasOp } = await import('@/app/admin/team/team-ops.server');
      return saveAdminAreasOp(formData);
    }
    case 'clear': {
      const { takeAllAreasAwayOp } = await import('@/app/admin/team/team-ops.server');
      return takeAllAreasAwayOp(formData);
    }
    case 'escalate': {
      const { escalateItemOp } = await import('./escalation-ops.server');
      return escalateItemOp(formData);
    }
    case 'resolve': {
      const { resolveEscalationOp } = await import('./escalation-ops.server');
      return resolveEscalationOp(formData);
    }
    case 'run_due':
      // Takes no input and can only run rows the OWNER confirmed whose wait the
      // DATABASE agrees has passed (guard_owner_self_approval refuses anything
      // else), so it is safe for the cron-free runner to fire from any traffic.
      await runDueOwnerApprovals();
      return;
    default:
      throw new Error('Unknown admin team action');
  }
}
