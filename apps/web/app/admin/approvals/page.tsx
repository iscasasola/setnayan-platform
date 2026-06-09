import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  APPROVAL_ACTIONS,
  approvalActionBadge,
  approvalActionLabel,
} from '@/lib/admin-approvals';
import { requestPrivilegedGrant, approveRequest, rejectRequest } from './actions';

export const metadata = { title: 'Approvals · Admin' };

type RequestRow = {
  approval_id: string;
  public_id: string;
  action_type: string;
  target_user_id: string | null;
  rationale: string;
  status: string;
  initiated_by: string;
  decided_by: string | null;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
  expires_at: string;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function AdminApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user?.id ?? '';

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const [pendingRes, decidedRes, adminCountRes] = await Promise.all([
    admin
      .from('admin_approval_requests')
      .select('*')
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true }),
    admin
      .from('admin_approval_requests')
      .select('*')
      .neq('status', 'pending')
      .order('decided_at', { ascending: false })
      .limit(10),
    admin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .or('account_type.eq.admin,is_internal.eq.true,is_team_member.eq.true'),
  ]);

  const pending = (pendingRes.data ?? []) as RequestRow[];
  const decided = (decidedRes.data ?? []) as RequestRow[];
  const adminCount = typeof adminCountRes.count === 'number' ? adminCountRes.count : null;

  // Resolve display names for target / initiator / decider in one round trip.
  const ids = new Set<string>();
  [...pending, ...decided].forEach((r) => {
    if (r.target_user_id) ids.add(r.target_user_id);
    if (r.initiated_by) ids.add(r.initiated_by);
    if (r.decided_by) ids.add(r.decided_by);
  });
  const nameMap = new Map<string, string>();
  if (ids.size > 0) {
    const { data: us } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .in('user_id', [...ids]);
    for (const u of (us ?? []) as Array<{
      user_id: string;
      email: string | null;
      display_name: string | null;
    }>) {
      nameMap.set(u.user_id, u.display_name || u.email || '—');
    }
  }
  const nameOf = (id?: string | null) => (id ? nameMap.get(id) ?? '—' : '—');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Setnayan · Internal ops · Four-eyes (§9.1)
        </p>
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">
          Two-admin approvals
        </h1>
        <p className="text-base text-ink/65">
          Major, irreversible decisions need a second admin. One admin{' '}
          <strong className="text-ink">initiates</strong> a request here; a{' '}
          <strong className="text-ink">different</strong> admin approves it before
          it executes. V1 governs privileged-role grants (Internal · Team Pool ·
          Promote-to-admin). Every decision is audit-logged.
        </p>
      </header>

      {adminCount !== null && adminCount < 2 ? (
        <div className="mb-8 rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 text-sm text-amber-900">
          <strong>Four-eyes needs at least two admins.</strong> There{' '}
          {adminCount === 1 ? 'is currently 1 admin' : 'are currently 0 admins'} on
          the platform. The first additional admin is provisioned outside this
          queue (owner bootstrap · §4.1); once two admins exist, this queue
          governs every further grant — and no admin can approve their own
          request.
        </div>
      ) : null}

      {/* NEW REQUEST */}
      <section className="mb-10 rounded-2xl border border-terracotta/20 bg-gradient-to-br from-cream to-terracotta-50/30 p-5 sm:p-6">
        <h2 className="mb-1 m-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700">
          New request
        </h2>
        <p className="mb-4 text-xs text-ink/55">
          Proposes a privileged-role grant. It stays pending until a different
          admin approves it.
        </p>
        <form action={requestPrivilegedGrant} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Action</span>
            <select
              name="action_type"
              required
              defaultValue="grant_internal_account"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              {APPROVAL_ACTIONS.map((a) => (
                <option key={a.type} value={a.type}>
                  {a.label} ({a.badge})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Target account email</span>
            <input
              type="email"
              name="target_email"
              required
              placeholder="person@example.com"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Rationale</span>
            <textarea
              name="rationale"
              required
              minLength={3}
              rows={2}
              placeholder="Why this grant is needed (recorded in the audit log)…"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
            >
              Submit for two-admin approval
            </button>
          </div>
        </form>
        <ul className="mt-4 space-y-1 text-xs text-ink/55">
          {APPROVAL_ACTIONS.map((a) => (
            <li key={a.type}>
              <strong className="text-ink/75">{a.badge}</strong> — {a.description}
            </li>
          ))}
        </ul>
      </section>

      {/* PENDING */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Pending ({pending.length})
          </h2>
          <p className="text-xs text-ink/45">
            {pending.length === 0
              ? 'Nothing waiting on a second admin.'
              : 'A different admin must decide each request.'}
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="m-card p-8 text-center text-sm text-ink/55">
            No approvals pending. Set na ’yan.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => {
              const mine = r.initiated_by === meId;
              return (
                <li key={r.approval_id} className="m-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-mulberry/10 px-2 py-0.5 text-[11px] font-bold text-mulberry">
                          {approvalActionBadge(r.action_type)}
                        </span>
                        <span className="text-sm font-semibold text-ink">
                          {approvalActionLabel(r.action_type)} → {nameOf(r.target_user_id)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink/55">
                        Requested by <strong className="text-ink/75">{nameOf(r.initiated_by)}</strong>{' '}
                        · {timeAgo(r.created_at)} · {r.public_id}
                      </p>
                      <p className="mt-2 text-sm text-ink/80">{r.rationale}</p>
                    </div>

                    <form className="flex shrink-0 flex-col items-end gap-2">
                      <input type="hidden" name="approval_id" value={r.approval_id} />
                      {mine ? (
                        <p className="max-w-[200px] text-right text-xs text-terracotta-700">
                          You initiated this — a different admin must decide it.
                        </p>
                      ) : (
                        <>
                          <button
                            type="submit"
                            formAction={approveRequest}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                          >
                            ✓ Approve &amp; execute
                          </button>
                          <input
                            type="text"
                            name="reason"
                            placeholder="reason (for reject)"
                            className="w-44 rounded-md border border-ink/15 bg-white px-2 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            formAction={rejectRequest}
                            className="rounded-md border border-terracotta/40 bg-white px-3 py-1.5 text-xs font-bold text-terracotta-700 transition-colors hover:bg-terracotta-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* RECENTLY DECIDED */}
      {decided.length > 0 ? (
        <section>
          <h2 className="mb-3 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Recently decided
          </h2>
          <div className="m-card overflow-hidden p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink/45">
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">Outcome</th>
                  <th className="px-4 py-2 font-medium">By</th>
                  <th className="px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.approval_id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-2">{approvalActionLabel(r.action_type)}</td>
                    <td className="px-4 py-2">{nameOf(r.target_user_id)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          r.status === 'approved'
                            ? 'rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700'
                            : 'rounded-md bg-terracotta-50 px-2 py-0.5 text-[11px] font-bold text-terracotta-700'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink/70">{nameOf(r.decided_by)}</td>
                    <td className="px-4 py-2 text-ink/55">
                      {r.decided_at ? timeAgo(r.decided_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
