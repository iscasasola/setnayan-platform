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
 * PHASE 3b (this work) — the scoped SESSION SWAP, on top of the scaffold:
 *   • enterActAs        — the acting admin mints a scoped, signed, 1h-TTL
 *       "act-as" cookie bound to the OPEN session (lib/admin-actas-context.ts).
 *       It does NOT impersonate the target's Supabase JWT — the admin stays
 *       logged in as themselves; the cookie is a re-validated CLAIM that scopes
 *       a read-leaning view of the target's OWN account + the consent-to-fix
 *       correction path. Audited via recordTakeoverAction.
 *   • exitActAs         — drops the cookie (the session stays open; this just
 *       leaves the scoped view). Audited.
 *   • proposeActAsFieldFix — the in-session consent-to-fix correction: queues an
 *       account_field_edits row the TARGET must approve (or an enforcement basis
 *       applies) before it lands. No silent write to the user's own data.
 *   The cookie stops working the instant the session ends (admin end, the
 *   user's force-end from #2068, or the ~8h backstop) — resolveActAsContext
 *   re-reads session state on every request. See lib/admin-actas-context.ts.
 *
 * WHAT THIS STILL DOES NOT BUILD (deferred for owner review):
 *   • Full write-impersonation against arbitrary target tables. The act-as
 *     surface is intentionally read-leaning + consent-gated for corrections,
 *     NOT a blanket "write anything as the user" power. See the PR body.
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
import {
  mintActAsCookie,
  clearActAsCookie,
  resolveActAsContext,
} from '@/lib/admin-actas-context';
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

  // Drop any act-as cookie this admin holds — ending the session must also
  // leave the scoped view. (The cookie is already inert after the row is
  // closed, since resolveActAsContext re-reads ended_at; this just tidies up.)
  await clearActAsCookie();

  revalidatePath(`/admin/users/${ended.target_user_id}/takeover`);
  redirect(`/admin/users/${encodeURIComponent(ended.target_user_id)}/takeover?takeover=ended`);
}

// ===========================================================================
// PHASE 3b — the scoped SESSION SWAP ("act as the user")
//
// enterActAs / exitActAs manage the signed act-as cookie (lib/admin-actas-
// context.ts). proposeActAsFieldFix is the in-session consent-to-fix correction
// — it NEVER writes the user's own data silently; it queues an
// account_field_edits row the target must approve.
//
// All three assertTakeoverEnabled() first → inert with the flag off.
// ===========================================================================

/**
 * ENTER act-as. The acting admin mints a scoped, signed, 1h-TTL cookie bound to
 * the OPEN session for `target_user_id`. Hard guards before minting:
 *   • flag ON (assertTakeoverEnabled),
 *   • caller is an admin,
 *   • a session is OPEN for the target, and the CALLER is its acting admin
 *     (the four-eyes acting admin — the confirming admin does NOT get the
 *     cookie, only the initiator who was recorded as admin_user_id).
 * The mint is audited + tagged with the session id.
 */
export async function enterActAs(formData: FormData) {
  await assertTakeoverEnabled();
  const { userId } = await requireAdmin();

  const targetUserId = readString(formData, 'target_user_id');
  if (!targetUserId) throw new Error('Missing target_user_id');

  const admin = createAdminClient();

  // The session must be OPEN, not expired, for this target.
  const { data: session } = await admin
    .from('admin_takeover_sessions')
    .select('session_id, target_user_id, admin_user_id, ended_at, expires_at')
    .eq('target_user_id', targetUserId)
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!session) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'No open session for this account. Start one first (two-admin).',
      )}`,
    );
  }

  // Only the session's ACTING admin can act as the user. The confirming
  // (second) admin authorized the start; the acting admin is the one recorded
  // in admin_user_id. This keeps "who acted" unambiguous in the change report.
  if (session.admin_user_id !== userId) {
    redirect(
      `/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'Only the acting admin who initiated this session can act as the user.',
      )}`,
    );
  }

  await mintActAsCookie({
    kind: 'admin_actas',
    session_id: session.session_id,
    target_user_id: session.target_user_id,
    admin_user_id: userId,
  });

  await recordTakeoverAction({
    sessionId: session.session_id,
    action: 'actas_entered',
    targetUserId: session.target_user_id,
    actorAdminId: userId,
    reason: 'Admin entered the scoped act-as view.',
  });

  revalidatePath(`/admin/users/${targetUserId}/takeover`);
  redirect(`/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover=actas_on`);
}

/**
 * EXIT act-as. Drops the cookie and leaves the scoped view. The takeover SESSION
 * stays open (end it with endTakeover) — this only stops the admin's browser
 * from being scoped to the target. Audited if a context is resolvable.
 */
export async function exitActAs(formData: FormData) {
  await assertTakeoverEnabled();
  const { userId } = await requireAdmin();
  const targetUserId = readString(formData, 'target_user_id');

  // Best-effort audit against the live context (if still valid) before clearing.
  const ctx = await resolveActAsContext();
  if (ctx && ctx.adminUserId === userId) {
    await recordTakeoverAction({
      sessionId: ctx.sessionId,
      action: 'actas_exited',
      targetUserId: ctx.targetUserId,
      actorAdminId: userId,
      reason: 'Admin left the scoped act-as view (session still open).',
    });
  }

  await clearActAsCookie();

  if (targetUserId) {
    revalidatePath(`/admin/users/${targetUserId}/takeover`);
    redirect(`/admin/users/${encodeURIComponent(targetUserId)}/takeover?takeover=actas_off`);
  }
  redirect('/admin/users?takeover=actas_off');
}

/**
 * In-session CONSENT-TO-FIX correction (design §3 — "consent-to-fix"). This is
 * the safe shape of "fix the couple's account during a takeover": the admin
 * PROPOSES an edit to one of the target's own fields; the change is queued in
 * account_field_edits with status='awaiting_user' and lands ONLY after the
 * target approves (or, for an enforcement basis, with that basis recorded). It
 * NEVER writes the user's data directly here.
 *
 * Requires an ACTIVE, valid act-as context for the target (resolveActAsContext
 * re-validates the open session). The proposal is tagged with the session id so
 * it shows up in the change report + the user's Privacy page.
 *
 * Scoped to a small allow-list of LOW-RISK personal fields. V1 ships only
 * `display_name` (the sole personal column that exists on public.users today —
 * verified against the base schema). Money / KYC / identity-doc fields are NOT
 * proposable here — those carry their own two-admin gate per the action catalog
 * and are out of scope for this read-leaning surface (see the PR body). The set
 * is the single place to widen as more personal columns + their consent paths
 * land.
 */
const ACTAS_FIXABLE_FIELDS = new Set(['display_name']);

export async function proposeActAsFieldFix(formData: FormData) {
  await assertTakeoverEnabled();
  const { userId } = await requireAdmin();

  const ctx = await resolveActAsContext();
  if (!ctx) {
    redirect('/admin/users?takeover_error=No+active+act-as+session.');
  }
  // The acting admin in the cookie must be the caller (defense in depth).
  if (ctx.adminUserId !== userId) {
    redirect('/admin/users?takeover_error=Act-as+session+belongs+to+another+admin.');
  }

  const fieldKey = readString(formData, 'field_key');
  const afterValue = readString(formData, 'after_value');
  if (!ACTAS_FIXABLE_FIELDS.has(fieldKey)) {
    redirect(
      `/admin/users/${encodeURIComponent(ctx.targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'That field is not correctable from the act-as view.',
      )}`,
    );
  }
  if (afterValue.length === 0 || afterValue.length > 500) {
    redirect(
      `/admin/users/${encodeURIComponent(ctx.targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'Provide a corrected value (1–500 characters).',
      )}`,
    );
  }

  const admin = createAdminClient();

  // Capture the current value for a clean before/after (best-effort). Only the
  // allow-listed, non-sensitive column(s) are ever read here.
  const { data: before } = await admin
    .from('users')
    .select('display_name')
    .eq('user_id', ctx.targetUserId)
    .maybeSingle();
  const beforeValue =
    (before as Record<string, unknown> | null)?.[fieldKey] ?? null;

  // Queue the consent-to-fix edit. The account_field_edits table (design §4)
  // gates it behind the target's approval. If the table isn't present yet
  // (it lands with the Phase-2 consent-to-fix work), fail loudly rather than
  // silently writing the user's data.
  const { error: insErr } = await admin.from('account_field_edits').insert({
    target_user_id: ctx.targetUserId,
    proposed_by_admin_id: userId,
    field_key: fieldKey,
    before_value: { value: beforeValue },
    after_value: { value: afterValue },
    basis: 'user_consent',
    status: 'awaiting_user',
    takeover_session_id: ctx.sessionId,
  });
  if (insErr) {
    redirect(
      `/admin/users/${encodeURIComponent(ctx.targetUserId)}/takeover?takeover_error=${encodeURIComponent(
        'Could not queue the correction: ' + insErr.message,
      )}`,
    );
  }

  await recordTakeoverAction({
    sessionId: ctx.sessionId,
    action: 'actas_field_fix_proposed',
    targetUserId: ctx.targetUserId,
    actorAdminId: userId,
    reason: `Proposed correction to ${fieldKey} (awaiting user consent).`,
    metadata: { field_key: fieldKey },
  });

  // Notify the target that a correction is awaiting their approval.
  await emitNotification({
    userId: ctx.targetUserId,
    type: 'account_field_edit_request',
    title: 'A correction to your account is awaiting your approval',
    body: `A Setnayan team member proposed a correction to your ${fieldKey.replace(/_/g, ' ')}. Review and approve or decline it from your account.`,
    relatedUrl: '/dashboard/account-access',
  });

  revalidatePath(`/admin/users/${ctx.targetUserId}/takeover`);
  redirect(`/admin/users/${encodeURIComponent(ctx.targetUserId)}/takeover?takeover=fix_proposed`);
}
