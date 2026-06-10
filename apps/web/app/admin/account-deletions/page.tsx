import { UserX, Trash2, Ban } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  approveAndBlacklist,
  approveAndDelete,
  rejectRequest,
} from './actions';

export const metadata = { title: 'Account deletions · Admin' };

/**
 * /admin/account-deletions — review queue for self-serve account-deletion
 * requests (App Store guideline 5.1.1(v) + Google Play data-deletion).
 *
 * Couples + vendors file deletion requests from Profile → Privacy & data; they
 * queue here as `pending`. An admin Approves (running the existing hard-delete
 * or delete-and-blacklist on the user) or Rejects within the 24h SLA. Auth is
 * enforced at the layout level (apps/web/app/admin/layout.tsx notFound()s
 * non-admins); this page is reached only by admins. Reads go through
 * createAdminClient() (service role), matching /admin/users + /admin/disputes.
 */

type RequestRow = {
  request_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  admin_note: string | null;
};

type UserLite = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  account_type: 'customer' | 'vendor' | 'admin';
  is_internal: boolean;
};

type Props = {
  searchParams: Promise<{ actioned?: string }>;
};

export default async function AdminAccountDeletionsPage({ searchParams }: Props) {
  const { actioned } = await searchParams;
  const admin = createAdminClient();

  let pending: RequestRow[] = [];
  let recent: RequestRow[] = [];
  let queryError: string | null = null;

  const { data: pendingData, error: pendingErr } = await admin
    .from('account_deletion_requests')
    .select('request_id,user_id,status,reason,created_at,reviewed_at,admin_note')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200);
  if (pendingErr) {
    logQueryError('AdminAccountDeletionsPage (pending)', pendingErr, {}, 'graceful_degrade');
    queryError = pendingErr.message;
  }
  pending = (pendingData ?? []) as RequestRow[];

  const { data: recentData, error: recentErr } = await admin
    .from('account_deletion_requests')
    .select('request_id,user_id,status,reason,created_at,reviewed_at,admin_note')
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);
  if (recentErr) {
    logQueryError('AdminAccountDeletionsPage (recent)', recentErr, {}, 'graceful_degrade');
  }
  recent = (recentData ?? []) as RequestRow[];

  // Resolve the user behind each request (email / type / internal-guard) in a
  // single IN query — matches the lookup style on /admin/users.
  const userIds = Array.from(
    new Set([...pending, ...recent].map((r) => r.user_id)),
  );
  const usersById = new Map<string, UserLite>();
  if (userIds.length > 0) {
    const { data: usersData } = await admin
      .from('users')
      .select('user_id,email,display_name,account_type,is_internal')
      .in('user_id', userIds);
    for (const u of (usersData ?? []) as UserLite[]) {
      usersById.set(u.user_id, u);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <UserX aria-hidden className="h-6 w-6 text-ink/70" strokeWidth={1.75} />
          Account deletions
        </h1>
        <p className="text-sm text-ink/60">
          Self-serve deletion requests from Profile &rarr; Privacy &amp; data. Review within 24
          hours. Approving runs the same hard-delete (or delete + blacklist) as the Users surface,
          after you&rsquo;ve checked for active events, bookings, or an outstanding balance.
        </p>
      </header>

      {actioned ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Request {actioned}. The queue is updated below.
        </p>
      ) : null}

      {queryError ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {queryError}
        </p>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/55">
            No pending deletion requests. New requests show up here within seconds of being filed.
          </p>
        ) : (
          <ul className="space-y-4">
            {pending.map((req) => {
              const u = usersById.get(req.user_id);
              return (
                <li
                  key={req.request_id}
                  className="space-y-3 rounded-xl border border-rose-200/60 bg-rose-50/40 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-ink">{u?.email ?? '—'}</p>
                      <p className="text-xs text-ink/60">
                        {u?.display_name ? `${u.display_name} · ` : ''}
                        {u?.account_type === 'customer' ? 'Couple' : (u?.account_type ?? 'unknown')}
                        {' · filed '}
                        {relativeTime(req.created_at)}
                      </p>
                      <p className="font-mono text-[11px] text-ink/45">{req.request_id}</p>
                      {req.reason ? (
                        <p className="mt-1 text-sm text-ink/70">
                          <span className="text-ink/45">Reason given:</span> {req.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {u?.is_internal ? (
                    <p className="rounded-md border border-purple-200 bg-purple-50/60 px-3 py-2 text-xs text-purple-900">
                      This is an internal account (§ 10a) — the delete actions block internal
                      accounts. Reject this request or clear the internal flag first via the Users
                      surface.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Approve → hard-delete (email freed for re-signup). */}
                    <ConfirmForm
                      action={approveAndDelete}
                      title="Approve and delete?"
                      message={`Approve deletion of ${u?.email ?? 'this account'}? This hard-deletes the account now — the auth identity is gone, related data cascade-deletes, and the email is freed for re-signup. Make sure there are no active events, bookings, or unpaid balances first. Not reversible.`}
                      confirmLabel="Approve + delete"
                    >
                      <input type="hidden" name="request_id" value={req.request_id} />
                      <SubmitButton
                        className="inline-flex items-center gap-1 rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-rose-800 disabled:opacity-60"
                        pendingLabel="Deleting…"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        Approve + delete
                      </SubmitButton>
                    </ConfirmForm>

                    {/* Approve → delete AND blacklist the email permanently. */}
                    <ConfirmForm
                      action={approveAndBlacklist}
                      title="Approve, delete and blacklist?"
                      message={`Approve deletion of ${u?.email ?? 'this account'} AND permanently block this email from re-registering? Use this for abusive accounts. Reverse via Users → Blacklisted → Unblacklist.`}
                      confirmLabel="Approve + blacklist"
                    >
                      <input type="hidden" name="request_id" value={req.request_id} />
                      <SubmitButton
                        className="inline-flex items-center gap-1 rounded-md bg-ink/10 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-rose-200 hover:text-rose-900 disabled:opacity-60"
                        pendingLabel="…"
                      >
                        <Ban className="h-3.5 w-3.5" strokeWidth={2} />
                        Approve + blacklist
                      </SubmitButton>
                    </ConfirmForm>
                  </div>

                  {/* Reject — account stays active. The note is required and
                      becomes the audit reason, so it lives inside the reject
                      form (approve doesn't need a note). */}
                  <form action={rejectRequest} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input type="hidden" name="request_id" value={req.request_id} />
                    <label className="flex-1 space-y-1">
                      <span className="block text-xs font-medium text-ink/70">
                        Rejection note (required)
                      </span>
                      <textarea
                        name="admin_note"
                        rows={2}
                        placeholder="e.g. 'Active booking — asked the couple to settle the balance before we delete.'"
                        className="input-field text-sm"
                      />
                    </label>
                    <SubmitButton
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
                      pendingLabel="…"
                    >
                      Reject (keep account)
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Recently reviewed
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/55">
            No reviewed requests yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
                <tr>
                  <th className="px-3 py-3 font-medium">Account</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="hidden px-3 py-3 font-medium md:table-cell">Reviewed</th>
                  <th className="px-3 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((req) => {
                  const u = usersById.get(req.user_id);
                  return (
                    <tr key={req.request_id} className="border-t border-ink/5">
                      <td className="px-3 py-3">
                        <p className="font-medium text-ink">{u?.email ?? '—'}</p>
                        <p className="font-mono text-[11px] text-ink/45">{req.request_id}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                            req.status === 'approved'
                              ? 'bg-rose-100 text-rose-800'
                              : req.status === 'rejected'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-ink/10 text-ink/60'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 md:table-cell">
                        {req.reviewed_at ? req.reviewed_at.slice(0, 10) : '—'}
                      </td>
                      <td className="px-3 py-3 text-ink/70">{req.admin_note ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
