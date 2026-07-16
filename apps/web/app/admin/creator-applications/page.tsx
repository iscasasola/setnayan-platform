import { Clapperboard, Check } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { requireAdmin } from '@/lib/admin/require-admin';
import { approveApplication, rejectApplication } from './actions';

export const metadata = { title: 'Creator applications · Admin' };

/**
 * /admin/creator-applications — review queue for self-serve creator-program
 * applications (Adventure Chapter · CP-1b).
 *
 * Non-creators apply from the creator dashboard's "Become a creator" form; the
 * rows queue here as `pending`. An admin Approves (flips users.is_creator + the
 * account gains the free creator surface) or Rejects (with a required note).
 * Approving is the ONLY code path that grants is_creator. Auth is enforced by
 * requireAdmin() + the layout gate; reads go through createAdminClient()
 * (service role), matching /admin/account-deletions + /admin/users.
 */

type ApplicationRow = {
  application_id: string;
  public_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  pitch: string;
  links: string | null;
  applied_at: string;
  reviewed_at: string | null;
  note: string | null;
};

type UserLite = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  account_type: 'customer' | 'vendor' | 'admin';
};

type Props = {
  searchParams: Promise<{ actioned?: string }>;
};

export default async function AdminCreatorApplicationsPage({ searchParams }: Props) {
  await requireAdmin();
  const { actioned } = await searchParams;
  const admin = createAdminClient();

  const SELECT =
    'application_id,public_id,user_id,status,pitch,links,applied_at,reviewed_at,note';

  let pending: ApplicationRow[] = [];
  let recent: ApplicationRow[] = [];
  let queryError: string | null = null;

  const { data: pendingData, error: pendingErr } = await admin
    .from('creator_applications')
    .select(SELECT)
    .eq('status', 'pending')
    .order('applied_at', { ascending: true })
    .limit(200);
  if (pendingErr) {
    logQueryError('AdminCreatorApplicationsPage (pending)', pendingErr, {}, 'graceful_degrade');
    queryError = pendingErr.message;
  }
  pending = (pendingData ?? []) as ApplicationRow[];

  const { data: recentData, error: recentErr } = await admin
    .from('creator_applications')
    .select(SELECT)
    .neq('status', 'pending')
    .order('reviewed_at', { ascending: false })
    .limit(50);
  if (recentErr) {
    logQueryError('AdminCreatorApplicationsPage (recent)', recentErr, {}, 'graceful_degrade');
  }
  recent = (recentData ?? []) as ApplicationRow[];

  // Resolve the applicant behind each row (email / name / type) in one IN query.
  const userIds = Array.from(new Set([...pending, ...recent].map((r) => r.user_id)));
  const usersById = new Map<string, UserLite>();
  if (userIds.length > 0) {
    const { data: usersData } = await admin
      .from('users')
      .select('user_id,email,display_name,account_type')
      .in('user_id', userIds);
    for (const u of (usersData ?? []) as UserLite[]) {
      usersById.set(u.user_id, u);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Clapperboard aria-hidden className="h-6 w-6 text-ink/70" strokeWidth={1.75} />
          Creator applications
        </h1>
        <p className="text-sm text-ink/60">
          Self-serve applications to the Adventure Chapter creator program.
          Approving grants free creator access (flips <code>is_creator</code>) and
          opens the creator surface. Rejecting keeps the account as-is; the
          applicant may re-apply. Creators are free — nothing to charge.
        </p>
      </header>

      {actioned ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          Application {actioned}. The queue is updated below.
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
            No pending creator applications. New applications show up here within
            seconds of being filed.
          </p>
        ) : (
          <ul className="space-y-4">
            {pending.map((app) => {
              const u = usersById.get(app.user_id);
              return (
                <li
                  key={app.application_id}
                  className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.02] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-ink">{u?.email ?? '—'}</p>
                      <p className="text-xs text-ink/60">
                        {u?.display_name ? `${u.display_name} · ` : ''}
                        {u?.account_type === 'customer' ? 'Couple' : (u?.account_type ?? 'unknown')}
                        {' · applied '}
                        {relativeTime(app.applied_at)}
                      </p>
                      <p className="font-mono text-[11px] text-ink/45">{app.public_id}</p>
                    </div>
                  </div>

                  <div className="rounded-md border border-ink/10 bg-cream/40 p-3">
                    <p className="whitespace-pre-wrap text-sm text-ink/80">{app.pitch}</p>
                    {app.links ? (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs text-ink/60">
                        <span className="text-ink/45">Links:</span> {app.links}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Approve → grant is_creator + stamp approved. Optional note. */}
                    <ConfirmForm
                      action={approveApplication}
                      title="Approve creator application?"
                      message={`Grant creator access to ${u?.email ?? 'this account'}? This flips is_creator on and opens the free creator surface for them. Reverse via the Users surface if needed.`}
                      confirmLabel="Approve + grant"
                    >
                      <input type="hidden" name="application_id" value={app.application_id} />
                      <SubmitButton
                        className="inline-flex items-center gap-1 rounded-md bg-success-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-success-800 disabled:opacity-60"
                        pendingLabel="Granting…"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        Approve + grant
                      </SubmitButton>
                    </ConfirmForm>
                  </div>

                  {/* Reject — account stays a non-creator. Note required; it's
                      surfaced back to the applicant, so it lives in the form. */}
                  <form action={rejectApplication} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input type="hidden" name="application_id" value={app.application_id} />
                    <label className="flex-1 space-y-1">
                      <span className="block text-xs font-medium text-ink/70">
                        Rejection note (required — shown to the applicant)
                      </span>
                      <textarea
                        name="note"
                        rows={2}
                        placeholder="e.g. 'Add links to your finished work and re-apply.'"
                        className="input-field text-sm"
                      />
                    </label>
                    <SubmitButton
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
                      pendingLabel="…"
                    >
                      Reject
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
            No reviewed applications yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
                <tr>
                  <th className="px-3 py-3 font-medium">Applicant</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="hidden px-3 py-3 font-medium md:table-cell">Reviewed</th>
                  <th className="px-3 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((app) => {
                  const u = usersById.get(app.user_id);
                  return (
                    <tr key={app.application_id} className="border-t border-ink/5">
                      <td className="px-3 py-3">
                        <p className="font-medium text-ink">{u?.email ?? '—'}</p>
                        <p className="font-mono text-[11px] text-ink/45">{app.public_id}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                            app.status === 'approved'
                              ? 'bg-success-100 text-success-800'
                              : 'bg-warn-100 text-warn-900'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 md:table-cell">
                        {app.reviewed_at ? app.reviewed_at.slice(0, 10) : '—'}
                      </td>
                      <td className="px-3 py-3 text-ink/70">{app.note ?? '—'}</td>
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
