import { UserX, Trash2, Ban, Inbox } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { PageMasthead } from '@/app/_components/page-masthead';
import { EmptyState } from '@/app/_components/states/empty-state';
import { ErrorState } from '@/app/_components/states/error-state';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import {
  approveAndBlacklist,
  approveAndDelete,
  rejectRequest,
} from './actions';

import { requireAdmin } from '@/lib/admin/require-admin';
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

/**
 * Both reads cap. The recent list passes its own number to ConsoleTable as
 * `cap`; the pending queue discloses its own below. Two hand-typed copies of a
 * number is not a guard — these are the constants the queries use.
 */
const PENDING_LIMIT = 200;
const RECENT_LIMIT = 50;

export default async function AdminAccountDeletionsPage({ searchParams }: Props) {
  await requireAdmin();
  const { actioned } = await searchParams;
  const admin = createAdminClient();

  const { data: pendingData, error: pendingErr } = await admin
    .from('account_deletion_requests')
    .select('request_id,user_id,status,reason,created_at,reviewed_at,admin_note')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(PENDING_LIMIT);
  if (pendingErr) {
    logQueryError('AdminAccountDeletionsPage (pending)', pendingErr, {}, 'graceful_degrade');
  }
  // NULL, not []: a refused read must stay distinguishable from a real zero all
  // the way to the render. `?? []` here is what printed "No pending deletion
  // requests" on a queue with a 24-hour SLA.
  const pending = pendingData as RequestRow[] | null;

  const { data: recentData, error: recentErr } = await admin
    .from('account_deletion_requests')
    .select('request_id,user_id,status,reason,created_at,reviewed_at,admin_note')
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);
  if (recentErr) {
    logQueryError('AdminAccountDeletionsPage (recent)', recentErr, {}, 'graceful_degrade');
  }
  const recent = recentData as RequestRow[] | null;

  // Resolve the user behind each request (email / type / internal-guard) in a
  // single IN query — matches the lookup style on /admin/users.
  const userIds = Array.from(
    new Set([...(pending ?? []), ...(recent ?? [])].map((r) => r.user_id)),
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
      <PageMasthead
        className="mb-6"
        title="Account deletions"
        lede="Self-serve deletion requests from Profile → Privacy & data. Review within 24 hours. Approving runs the same hard-delete (or delete + blacklist) as the Users surface, after you’ve checked for active events, bookings, or an outstanding balance."
      />

      {actioned ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          Request {actioned}. The queue is updated below.
        </p>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70">
          Pending {pending ? `(${pending.length})` : '(not measured)'}
        </h2>
        {/* The pending queue is a card list, not a table — ConsoleTable does not
            apply — but it owes the same distinction, so it resolves against the
            same two primitives by hand: a refused read reports, and only a read
            that actually completed may say the queue is clear. */}
        {pending === null ? (
          <ErrorState
            title="Couldn’t read the pending deletion queue"
            broke={
              pendingErr?.message
                ? `The read was refused: ${pendingErr.message}`
                : 'The read did not complete.'
            }
            survived="Nothing loaded, so this is NOT a statement that there are no pending requests — it is a statement that we do not know. Any request filed is still filed, and its 24-hour clock is still running."
            todo="Reload. If it repeats, the query is being rejected rather than returning nothing, and the column, value or migration it names is the thing to check."
          />
        ) : pending.length === 0 ? (
          <EmptyState
            Icon={Inbox}
            readPermitted
            title="No pending deletion requests"
            blurb="New requests show up here within seconds of someone filing one from Profile → Privacy & data."
          />
        ) : (
          <>
            {pending.length >= PENDING_LIMIT ? (
              <p className="mb-3 text-xs text-ink/70">
                Showing the first {PENDING_LIMIT.toLocaleString()}. There are more — this is not
                the whole queue.
              </p>
            ) : null}
          <ul className="space-y-4">
            {pending.map((req) => {
              const u = usersById.get(req.user_id);
              return (
                <li
                  key={req.request_id}
                  className="space-y-3 rounded-xl border border-danger-200/60 bg-danger-50/40 p-4"
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
                    <p className="rounded-md border border-[color:var(--sn-info)]/30 bg-[var(--sn-info-soft)] px-3 py-2 text-xs text-[color:var(--sn-info)]">
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
                        className="inline-flex items-center gap-1 rounded-md bg-danger-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-danger-800 disabled:opacity-60"
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
                        className="inline-flex items-center gap-1 rounded-md bg-ink/10 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-danger-200 hover:text-danger-900 disabled:opacity-60"
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
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/70">
          Recently reviewed
        </h2>
        <ConsoleTable
          rows={recent}
          readPermitted
          readError={recentErr}
          reads="the reviewed deletion requests"
          cap={RECENT_LIMIT}
          label="Recently reviewed deletion requests"
          minWidth="44rem"
          rowKey={(req) => req.request_id}
          empty={{
            Icon: UserX,
            title: 'No reviewed requests yet',
            blurb:
              'Every request you approve or reject above lands here, with the note you left, so the decision stays readable months later.',
          }}
          columns={[
            {
              header: 'Account',
              cell: (req) => {
                const u = usersById.get(req.user_id);
                return (
                  <>
                    <p className="font-medium text-ink">{u?.email ?? '—'}</p>
                    <p className="font-mono text-[11px] text-ink/70">{req.request_id}</p>
                  </>
                );
              },
            },
            {
              header: 'Status',
              cell: (req) => (
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    req.status === 'approved'
                      ? 'bg-danger-100 text-danger-800'
                      : req.status === 'rejected'
                        ? 'bg-warn-100 text-warn-900'
                        : 'bg-ink/10 text-ink/70'
                  }`}
                >
                  {req.status}
                </span>
              ),
            },
            {
              header: 'Reviewed',
              hideBelow: 'md',
              mono: true,
              cell: (req) => (
                <span className="whitespace-nowrap text-ink/70">
                  {req.reviewed_at ? req.reviewed_at.slice(0, 10) : '—'}
                </span>
              ),
            },
            {
              header: 'Note',
              hideBelow: 'lg',
              cell: (req) => <span className="text-ink/70">{req.admin_note ?? '—'}</span>,
            },
          ]}
        />
      </section>
    </div>
  );
}
