'use server';

/**
 * Admin Account-Access Model — PHASE 3 (account takeover) server actions.
 *
 * ⚠ FLAG-GATED OFF. Every action here calls assertTakeoverEnabled() FIRST. With
 * the master switch OFF (platform_settings.admin_takeover_enabled NULL +
 * ADMIN_TAKEOVER_ENABLED env unset — the default), every action throws before
 * touching any data. Prod is byte-identical until the owner flips it after
 * reviewing this scaffold (Admin_Account_Access_Model_2026-06-22.md §10).
 *
 * WHAT THIS BUILDS (the safe governance scaffold — design §4/§5):
 *   • initiateTakeover  — first admin requests a takeover of a target user.
 *       Creates a four-eyes admin_approval_requests row
 *       (action_type='start_account_takeover'). REASON IS REQUIRED.
 *   • confirmTakeover   — a DIFFERENT second admin approves the request, which
 *       OPENS the admin_takeover_sessions row, NOTIFIES the target user ("a
 *       Setnayan team member is accessing your account"), and audits the start.
 *   • endTakeover       — closes the session and sends the target user a CHANGE
 *       REPORT (every audited action tagged with this session id), in-app +
 *       email. Audits the end.
 *   • recordTakeoverAction — the helper every in-session admin mutation calls to
 *       tag its audit row with takeover_session_id (design §5.3). Exported so a
 *       future impersonation surface can wire it.
 *
 * WHAT THIS DOES NOT BUILD (the remaining flag-gated step for owner review):
 *   • The actual in-browser SESSION SWAP (issuing a scoped impersonation JWT /
 *     cookie so the admin sees the app AS the user). That is the single
 *     highest-risk piece and a Supabase-auth-config concern (short admin JWT
 *     TTL + a session-revocation path) — deliberately left for owner review.
 *     `startedTakeoverSessionFor()` returns the open session so the swap can be
 *     layered on top WITHOUT changing any of the governance guarantees here.
 *
 * PRIVACY INVARIANT (must-fix #7, enforced by lint-admin-chat-guard): NOTHING
 * here reads chat message bodies, thread attachments, raw behavioral data, or
 * raw face vectors. A takeover does not unlock them. This file contains no such
 * reader and must never gain one.
 *
 * Security model mirrors the four-eyes precedent in
 * app/admin/vendor-partnerships/actions.ts:
 *   - requireAdmin() asserts the CALLER is an admin server-side.
 *   - All reads/writes go through the service-role client (createAdminClient).
 *   - FOUR-EYES on START: the atomic claim UPDATE on admin_approval_requests
 *     carries `.neq('initiated_by', me)` + status/expiry guards; the DB CHECK
 *     (decided_by <> initiated_by) is the backstop.
 *   - Every mutation best-effort logs to admin_audit_log (failure logs to
 *     console, never rolls back the primary write).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertTakeoverEnabled } from '@/lib/admin-takeover-config';
import { emitNotification } from '@/lib/notification-emit';

type AdminClient = ReturnType<typeof createAdminClient>;

const TAKEOVER_APPROVAL_TYPE = 'start_account_takeover';

// ---------------------------------------------------------------------------
// Auth guard + small helpers
// ---------------------------------------------------------------------------

async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id };
}

function readString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Best-effort audit insert. `takeoverSessionId` tags the row to a session
 * (design §5.3); null for the initiate/approve handshake rows that precede the
 * session opening.
 */
async function audit(
  admin: AdminClient,
  opts: {
    action: string;
    targetId: string;
    actorUserId: string;
    takeoverSessionId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from('admin_audit_log').insert({
    action: opts.action,
    target_table: 'admin_takeover_sessions',
    target_id: opts.targetId,
    actor_user_id: opts.actorUserId,
    takeover_session_id: opts.takeoverSessionId ?? null,
    reason: opts.reason ?? null,
    metadata: opts.metadata ?? {},
  });
  if (error) console.error('[takeover audit]', error.message);
}

// ---------------------------------------------------------------------------
// recordTakeoverAction — tag an in-session admin action's audit row.
//
// Exported for the future impersonation surface: any mutation performed AS the
// user during an open session calls this so the change report + the user's
// Privacy page can reconstruct exactly what happened. Validates the session is
// real + still open before tagging.
// ---------------------------------------------------------------------------

export async function recordTakeoverAction(opts: {
  sessionId: string;
  action: string;
  targetUserId: string;
  actorAdminId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: session } = await admin
    .from('admin_takeover_sessions')
    .select('session_id, target_user_id, ended_at, expires_at')
    .eq('session_id', opts.sessionId)
    .maybeSingle();
  // Only tag against a real, open, not-yet-expired session for the right target.
  if (
    !session ||
    session.ended_at ||
    session.target_user_id !== opts.targetUserId ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    // Still audit the action, but un-tagged + flagged — never silently drop it.
    await audit(admin, {
      action: `${opts.action}__orphaned_takeover`,
      targetId: opts.targetUserId,
      actorUserId: opts.actorAdminId,
      reason: opts.reason ?? 'session not open/valid',
      metadata: { attempted_session_id: opts.sessionId, ...(opts.metadata ?? {}) },
    });
    return;
  }
  await audit(admin, {
    action: opts.action,
    targetId: opts.targetUserId,
    actorUserId: opts.actorAdminId,
    takeoverSessionId: opts.sessionId,
    reason: opts.reason ?? null,
    metadata: opts.metadata ?? {},
  });
}

/** Read the open (not-ended) session for a target, if any. */
export async function startedTakeoverSessionFor(targetUserId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from('admin_takeover_sessions')
    .select('*')
    .eq('target_user_id', targetUserId)
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// ACTION 1 — initiateTakeover (first admin)
//
// Creates the four-eyes request. REASON REQUIRED. A different admin must
// confirm before any session opens.
// ---------------------------------------------------------------------------

export async function initiateTakeover(formData: FormData) {
  await assertTakeoverEnabled();
  const { userId } = await requireAdmin();

  const targetUserId = readString(formData, 'target_user_id');
  const reason = readString(formData, 'reason');

  if (!targetUserId) throw new Error('Missing target_user_id');
  if (reason.length < 3) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'A reason (≥3 characters) is required before requesting account access.',
      )}`,
    );
  }

  const admin = createAdminClient();

  // Target must exist; an admin can never take over their own account.
  const { data: target } = await admin
    .from('users')
    .select('user_id, email')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!target) {
    redirect('/admin/users?takeover_error=No+Setnayan+account+with+that+id.');
  }
  if (target.user_id === userId) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'You cannot take over your own account.',
      )}`,
    );
  }

  // There must not already be an open session for this target.
  const { data: openSession } = await admin
    .from('admin_takeover_sessions')
    .select('session_id')
    .eq('target_user_id', targetUserId)
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (openSession) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'A takeover session is already open for this account.',
      )}`,
    );
  }

  // Avoid duplicate pending requests for the same target.
  const { data: alreadyPending } = await admin
    .from('admin_approval_requests')
    .select('approval_id, initiated_by')
    .eq('action_type', TAKEOVER_APPROVAL_TYPE)
    .eq('target_user_id', targetUserId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (alreadyPending) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        alreadyPending.initiated_by === userId
          ? 'You already requested access to this account — a different admin must confirm.'
          : 'A takeover request for this account is already pending a second admin.',
      )}`,
    );
  }

  const { error: insErr } = await admin.from('admin_approval_requests').insert({
    action_type: TAKEOVER_APPROVAL_TYPE,
    target_user_id: targetUserId,
    rationale: reason.slice(0, 2000),
    initiated_by: userId,
    // Takeover requests time out fast — a stale authorization is dangerous.
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (insErr) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'Could not create the request: ' + insErr.message,
      )}`,
    );
  }

  await audit(admin, {
    action: 'takeover_requested',
    targetId: targetUserId,
    actorUserId: userId,
    reason: reason,
    metadata: { target_email: target.email },
  });

  revalidatePath(`/admin/users/${targetUserId}/takeover`);
  revalidatePath('/admin/approvals');
  redirect(`/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover=requested`);
}

// ---------------------------------------------------------------------------
// ACTION 2 — confirmTakeover (second admin)
//
// The DIFFERENT second admin approves the pending request. Atomic four-eyes
// claim, then OPEN the session, NOTIFY the target user, audit the start.
// ---------------------------------------------------------------------------

export async function confirmTakeover(formData: FormData) {
  await assertTakeoverEnabled();
  const { userId } = await requireAdmin();

  const approvalId = readString(formData, 'approval_id');
  const targetUserId = readString(formData, 'target_user_id');
  if (!approvalId || !targetUserId) throw new Error('Missing ids');

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Atomic four-eyes claim — pending + not expired + NOT the initiator + the
  // right action type + the right target.
  const { data: claimed, error: claimErr } = await admin
    .from('admin_approval_requests')
    .update({ status: 'approved', decided_by: userId, decided_at: nowIso })
    .eq('approval_id', approvalId)
    .eq('action_type', TAKEOVER_APPROVAL_TYPE)
    .eq('target_user_id', targetUserId)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .neq('initiated_by', userId)
    .select('approval_id, initiated_by, target_user_id, rationale')
    .maybeSingle();

  if (claimErr) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(claimErr.message)}`,
    );
  }
  if (!claimed) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'Could not confirm — the request was already decided, expired, or you initiated it. A different admin must confirm.',
      )}`,
    );
  }

  // Open the session. The original (initiating) admin is the one who ACTS in
  // the session; the confirming admin is recorded as approved_by.
  const { data: session, error: sessErr } = await admin
    .from('admin_takeover_sessions')
    .insert({
      target_user_id: targetUserId,
      admin_user_id: claimed.initiated_by,
      approved_by: userId,
      approval_request_id: approvalId,
      reason: (claimed.rationale ?? '').slice(0, 2000) || 'See approval request.',
    })
    .select('session_id, public_id, expires_at')
    .single();

  if (sessErr || !session) {
    // Roll the claim back so it isn't stranded "approved" with no session.
    await admin
      .from('admin_approval_requests')
      .update({ status: 'pending', decided_by: null, decided_at: null })
      .eq('approval_id', approvalId)
      .eq('status', 'approved');
    await audit(admin, {
      action: 'takeover_open_failed',
      targetId: targetUserId,
      actorUserId: userId,
      reason: sessErr?.message ?? 'unknown',
    });
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'Could not open the session: ' + (sessErr?.message ?? 'unknown'),
      )}`,
    );
  }

  // NOTIFY THE TARGET USER (must-fix #4) — in-app + email (admin_takeover_started
  // is on EMAIL_ENABLED_TYPES). Best-effort: a failed notice never blocks the
  // session, but it IS the trust promise, so it fires immediately.
  await emitNotification({
    userId: targetUserId,
    type: 'admin_takeover_started',
    title: 'A Setnayan team member is accessing your account',
    body:
      'For support or a verified issue, a Setnayan team member has started a logged, time-limited session on your account. You will get a full report of any changes when it ends. If you did not expect this, contact support right away.',
    // Deep-link to the account home. The dedicated Privacy page (the
    // self-service "Force end" + full activity log of who accessed your
    // account) is the RA-10173 Phase-1 surface in the access model and is a
    // follow-up — it does not exist yet, and /dashboard/privacy would collide
    // with the /dashboard/[eventId] dynamic route, so we point at /profile.
    relatedUrl: '/dashboard/profile',
  });

  await audit(admin, {
    action: 'takeover_started',
    targetId: targetUserId,
    actorUserId: userId,
    takeoverSessionId: session.session_id,
    reason: claimed.rationale,
    metadata: {
      acting_admin_id: claimed.initiated_by,
      approved_by: userId,
      public_id: session.public_id,
      expires_at: session.expires_at,
    },
  });

  revalidatePath(`/admin/users/${targetUserId}/takeover`);
  revalidatePath('/admin/approvals');
  redirect(`/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover=started`);
}

// ---------------------------------------------------------------------------
// ACTION 3 — endTakeover
//
// Closes the session and sends the target user a CHANGE REPORT (must-fix #5):
// every audited action tagged with this session id. In-app + email.
// ---------------------------------------------------------------------------

export async function endTakeover(formData: FormData) {
  await assertTakeoverEnabled();
  const { userId } = await requireAdmin();

  const sessionId = readString(formData, 'session_id');
  if (!sessionId) throw new Error('Missing session_id');

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Atomic close — only an OPEN session can be ended (status-guarded so a
  // double-submit / backstop race can't double-report).
  const { data: ended, error: endErr } = await admin
    .from('admin_takeover_sessions')
    .update({ ended_at: nowIso, ended_by: 'admin' })
    .eq('session_id', sessionId)
    .is('ended_at', null)
    .select('session_id, target_user_id, admin_user_id, started_at')
    .maybeSingle();

  if (endErr) {
    redirect(`/admin/users?takeover_error=${encodeURIComponent(endErr.message)}`);
  }
  if (!ended) {
    // Already ended (admin double-click, or the backstop got there first).
    redirect(`/admin/users?takeover=already_ended`);
  }

  // Build the CHANGE REPORT from every audit row tagged with this session.
  const { data: actions } = await admin
    .from('admin_audit_log')
    .select('action, created_at, reason')
    .eq('takeover_session_id', sessionId)
    .neq('action', 'takeover_started') // exclude the start marker itself
    .order('created_at', { ascending: true });

  const changeLines = (actions ?? []).map(
    (a: { action: string; created_at: string }) =>
      `• ${new Date(a.created_at).toLocaleString()} — ${a.action.replace(/_/g, ' ')}`,
  );
  const reportBody =
    changeLines.length > 0
      ? `The session that accessed your account has ended. Changes made during it:\n\n${changeLines.join(
          '\n',
        )}\n\nIf anything here looks wrong, contact support.`
      : 'The session that accessed your account has ended. No changes were made to your account during it.';

  // NOTIFY THE TARGET USER — in-app + email (admin_takeover_change_report is on
  // EMAIL_ENABLED_TYPES).
  await emitNotification({
    userId: ended.target_user_id,
    type: 'admin_takeover_change_report',
    title: 'Account access ended — here is what happened',
    body: reportBody,
    relatedUrl: '/dashboard/profile',
  });

  await audit(admin, {
    action: 'takeover_ended',
    targetId: ended.target_user_id,
    actorUserId: userId,
    takeoverSessionId: sessionId,
    metadata: {
      change_count: changeLines.length,
      acting_admin_id: ended.admin_user_id,
      started_at: ended.started_at,
    },
  });

  revalidatePath(`/admin/users/${ended.target_user_id}/takeover`);
  redirect(`/admin/users/${encodeURIComponent(ended.target_user_id)}/takeover?takeover=ended`);
}
