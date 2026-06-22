import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { resolveAdminTakeoverEnabled } from '@/lib/admin-takeover-config';
import { initiateTakeover, confirmTakeover, endTakeover } from '../../takeover-actions';

export const metadata = {
  title: 'Account access (takeover) · Admin',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ takeover?: string; takeover_error?: string }>;
};

/**
 * /admin/users/[userId]/takeover — Phase 3 account-takeover GOVERNANCE console.
 *
 * ⚠ FLAG-GATED OFF. When platform_settings.admin_takeover_enabled is not TRUE
 * (and ADMIN_TAKEOVER_ENABLED env isn't 'true') this page renders a "not
 * enabled" notice and exposes NO action — prod is byte-identical until the
 * owner flips the switch after reviewing the scaffold.
 *
 * When enabled it surfaces the two-admin handshake + session lifecycle:
 *   • no request, no session → "Request access" form (reason required).
 *   • pending request          → a different admin sees "Confirm access".
 *   • open session             → "End session" + the live notice.
 *
 * It does NOT perform an in-browser impersonation / session swap — that's the
 * remaining flag-gated step left for owner review (see takeover-actions.ts).
 */
export default async function AccountTakeoverPage({ params, searchParams }: Props) {
  const { userId } = await params;
  const sp = await searchParams;

  // Admin gate (mirrors the other admin surfaces).
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
    redirect('/dashboard');
  }
  const meId = user.id;

  const enabled = await resolveAdminTakeoverEnabled();
  const admin = createAdminClient();

  const { data: target } = await admin
    .from('users')
    .select('user_id, email, display_name, account_type')
    .eq('user_id', userId)
    .maybeSingle();

  const targetName = target?.display_name || target?.email || userId;
  const nowIso = new Date().toISOString();

  // Current state: any open session? any pending request?
  const { data: openSession } = await admin
    .from('admin_takeover_sessions')
    .select('session_id, public_id, admin_user_id, approved_by, started_at, expires_at, reason')
    .eq('target_user_id', userId)
    .is('ended_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();

  const { data: pending } = await admin
    .from('admin_approval_requests')
    .select('approval_id, public_id, initiated_by, rationale, created_at, expires_at')
    .eq('action_type', 'start_account_takeover')
    .eq('target_user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/admin/users"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Setnayan · Internal ops · Account-Access Model Phase 3
        </p>
        <h1 className="m-display-tight flex items-center gap-2 text-2xl text-[color:var(--m-ink)] sm:text-3xl">
          <ShieldAlert className="h-6 w-6 text-danger-600" /> Account access (takeover)
        </h1>
        <p className="text-sm text-ink/70">
          Target: <strong className="text-ink">{targetName}</strong>{' '}
          <span className="text-ink/45">({target?.account_type ?? 'unknown'})</span>
        </p>
      </header>

      {sp.takeover_error ? (
        <div className="mb-5 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {sp.takeover_error}
        </div>
      ) : null}
      {sp.takeover ? (
        <div className="mb-5 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          {sp.takeover === 'requested'
            ? 'Access requested — a different admin must confirm before the session begins.'
            : sp.takeover === 'started'
              ? 'Session started. The account holder has been notified.'
              : sp.takeover === 'ended'
                ? 'Session ended. The account holder was sent a change report.'
                : 'Done.'}
        </div>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────────
          FLAG OFF — no actions. */}
      {!enabled ? (
        <div className="m-card space-y-3 p-6">
          <h2 className="text-base font-semibold text-ink">Takeover is not enabled</h2>
          <p className="text-sm text-ink/70">
            Account takeover is the single highest-risk admin power. It ships{' '}
            <strong>OFF</strong> and stays off until the owner reviews the
            governance model and flips{' '}
            <code className="rounded bg-ink/5 px-1">
              platform_settings.admin_takeover_enabled
            </code>{' '}
            (or the <code className="rounded bg-ink/5 px-1">ADMIN_TAKEOVER_ENABLED</code> env
            var). No request, session, or impersonation can happen while it is
            off. See{' '}
            <span className="italic">Admin_Account_Access_Model_2026-06-22.md §10</span>.
          </p>
        </div>
      ) : openSession ? (
        /* ───────────────────────────────────────────────────────────────
           OPEN SESSION. */
        <div className="m-card space-y-4 p-6">
          <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
            A takeover session is <strong>open</strong> for this account
            ({openSession.public_id}). The account holder has been notified. (A
            self-service force-end from the user&apos;s own Privacy page is a
            follow-up surface; for now the session ends here or at the safety
            backstop.)
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink/45">Started</dt>
              <dd className="text-ink">{new Date(openSession.started_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-ink/45">Safety backstop</dt>
              <dd className="text-ink">{new Date(openSession.expires_at).toLocaleString()}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink/45">Reason</dt>
              <dd className="text-ink">{openSession.reason}</dd>
            </div>
          </dl>
          <p className="text-xs text-ink/55">
            In-browser impersonation (the actual session swap) is intentionally{' '}
            <strong>not</strong> wired in this scaffold — it is the remaining
            flag-gated step left for owner review. Ending the session here sends
            the account holder a change report of every audited in-session action.
          </p>
          <form>
            <input type="hidden" name="session_id" value={openSession.session_id} />
            <SubmitButton
              formAction={endTakeover}
              pendingLabel="Ending…"
              className="rounded-md bg-danger-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-danger-700"
            >
              End session &amp; send change report
            </SubmitButton>
          </form>
        </div>
      ) : pending ? (
        /* ───────────────────────────────────────────────────────────────
           PENDING REQUEST — second admin confirms. */
        <div className="m-card space-y-4 p-6">
          <h2 className="text-base font-semibold text-ink">
            Access request pending a second admin
          </h2>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <dt className="text-ink/45">Requested</dt>
              <dd className="text-ink">{new Date(pending.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-ink/45">Reason</dt>
              <dd className="text-ink">{pending.rationale}</dd>
            </div>
          </dl>
          {pending.initiated_by === meId ? (
            <p className="rounded-lg border border-warn-200 bg-warn-50 px-4 py-3 text-sm text-warn-900">
              You requested this — a <strong>different</strong> admin must confirm
              it (four-eyes). You cannot approve your own takeover request.
            </p>
          ) : (
            <form className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="approval_id" value={pending.approval_id} />
              <input type="hidden" name="target_user_id" value={userId} />
              <SubmitButton
                formAction={confirmTakeover}
                pendingLabel="Confirming…"
                className="rounded-md bg-success-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-success-700"
              >
                Confirm &amp; start session
              </SubmitButton>
              <span className="text-xs text-ink/55">
                Starting notifies the account holder immediately.
              </span>
            </form>
          )}
        </div>
      ) : (
        /* ───────────────────────────────────────────────────────────────
           NOTHING PENDING — request access (first admin). */
        <div className="m-card space-y-4 p-6">
          <h2 className="text-base font-semibold text-ink">Request account access</h2>
          <p className="text-sm text-ink/70">
            Creates a two-admin (four-eyes) request. A different admin must
            confirm before any session begins. A reason is required and is
            recorded in the audit log and shown to the account holder.
          </p>
          <form className="space-y-3">
            <input type="hidden" name="target_user_id" value={userId} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink/80">Reason (required)</span>
              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={2000}
                rows={3}
                placeholder="e.g. Verified support ticket #1234 — the couple cannot complete checkout and asked us to look."
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
              />
            </label>
            <SubmitButton
              formAction={initiateTakeover}
              pendingLabel="Requesting…"
              className="rounded-md bg-mulberry px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-mulberry/90"
            >
              Request access
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
