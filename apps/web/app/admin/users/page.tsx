import { Search, ShieldCheck, Sparkle, MailCheck, Trash2, Ban, KeyRound, Undo2 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  blacklistUser,
  confirmUserEmail,
  deleteUser,
  resetUserPassword,
  toggleTeamMember,
  unblacklistEmail,
} from './actions';

export const metadata = { title: 'Users · Admin' };

type UserRow = {
  user_id: string;
  public_id: string;
  email: string | null;
  display_name: string | null;
  account_type: 'customer' | 'vendor' | 'admin';
  is_internal: boolean;
  is_team_member: boolean;
  created_at: string;
};

type BlacklistRow = {
  id: string;
  email: string;
  reason: string | null;
  blacklisted_at: string;
};

type Filter = 'all' | 'customer' | 'vendor' | 'internal' | 'team_pool' | 'blacklisted';

type Props = {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    temp_password?: string;
    for_email?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const search = await searchParams;
  const q = (search.q ?? '').trim();
  const filter = (search.filter ?? 'all') as Filter;
  const tempPassword = search.temp_password ?? null;
  const forEmail = search.for_email ?? null;

  const admin = createAdminClient();

  // Blacklisted view: pulls from `blacklisted_emails` instead of `users`.
  let blacklistRows: BlacklistRow[] = [];
  let userRows: UserRow[] = [];
  let queryError: string | null = null;

  if (filter === 'blacklisted') {
    let bq = admin
      .from('blacklisted_emails')
      .select('id,email,reason,blacklisted_at')
      .order('blacklisted_at', { ascending: false })
      .limit(200);
    if (q.length > 0) bq = bq.ilike('email', `%${q}%`);
    const { data, error } = await bq;
    blacklistRows = (data ?? []) as BlacklistRow[];
    queryError = error?.message ?? null;
  } else {
    let query = admin
      .from('users')
      .select(
        'user_id,public_id,email,display_name,account_type,is_internal,is_team_member,created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (filter === 'customer' || filter === 'vendor') {
      query = query.eq('account_type', filter);
    } else if (filter === 'internal') {
      query = query.eq('is_internal', true);
    } else if (filter === 'team_pool') {
      query = query.eq('is_team_member', true);
    }

    if (q.length > 0) {
      query = query.or(
        `email.ilike.%${q}%,display_name.ilike.%${q}%,public_id.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    userRows = (data ?? []) as UserRow[];
    queryError = error?.message ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-ink/60">
          Latest 200 accounts (newest first). Filter or search to drill in.
        </p>
      </header>

      {tempPassword ? (
        <section
          role="status"
          className="mb-6 space-y-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-5"
        >
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-900">
              Temporary password generated
            </p>
            <p className="text-sm text-amber-900">
              Share this with{' '}
              {forEmail ? (
                <span className="font-medium">{forEmail}</span>
              ) : (
                'the user'
              )}{' '}
              via a secure channel (DM, in-person, encrypted message). The
              password is shown once — refreshing this page clears it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-cream p-3">
            <code className="break-all font-mono text-lg font-semibold text-ink">
              {tempPassword}
            </code>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              Select all + copy
            </span>
          </div>
          <p className="text-xs text-amber-900/85">
            Have the user sign in with this temp password, then change it
            immediately from their Profile page (Personal info → Change
            password).
          </p>
        </section>
      ) : null}

      <form className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center" method="get">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
            strokeWidth={1.75}
          />
          <input
            name="q"
            defaultValue={q}
            placeholder={
              filter === 'blacklisted'
                ? 'email substring'
                : 'email · display name · S89U-…'
            }
            className="input-field pl-9"
          />
        </div>
        <select
          name="filter"
          defaultValue={filter}
          className="input-field min-w-[12rem]"
        >
          <option value="all">All</option>
          <option value="customer">Couples (customer)</option>
          <option value="vendor">Vendors</option>
          <option value="internal">🟣 Internal (§ 10a)</option>
          <option value="team_pool">🟢 Team Pool (§ 10b)</option>
          <option value="blacklisted">🚫 Blacklisted</option>
        </select>
        <button type="submit" className="button-secondary">Apply</button>
      </form>

      {queryError ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {queryError}
        </p>
      ) : null}

      {filter === 'blacklisted' ? (
        <BlacklistTable rows={blacklistRows} />
      ) : (
        <UsersTable rows={userRows} />
      )}
    </div>
  );
}

function UsersTable({ rows }: { rows: UserRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
          <tr>
            <th className="px-3 py-3 font-medium">Email</th>
            <th className="px-3 py-3 font-medium">Type</th>
            <th className="hidden px-3 py-3 font-medium lg:table-cell">Account ID</th>
            <th className="hidden px-3 py-3 font-medium md:table-cell">Created</th>
            <th className="px-3 py-3 font-medium">Flags</th>
            <th className="px-3 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-ink/55" colSpan={6}>
                No users match.
              </td>
            </tr>
          ) : (
            rows.map((u) => (
              <tr key={u.user_id} className="border-t border-ink/5 hover:bg-terracotta/[0.04]">
                <td className="px-3 py-3">
                  <p className="font-medium text-ink">{u.email ?? '—'}</p>
                  {u.display_name ? (
                    <p className="text-xs text-ink/60">{u.display_name}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                      u.account_type === 'vendor'
                        ? 'bg-violet-100 text-violet-800'
                        : u.account_type === 'admin'
                          ? 'bg-ink/15 text-ink'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {u.account_type === 'customer' ? 'Couple' : u.account_type}
                  </span>
                </td>
                <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 lg:table-cell">
                  {u.public_id}
                </td>
                <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 md:table-cell">
                  {u.created_at.slice(0, 10)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.is_internal ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-purple-800">
                        <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                        Internal
                      </span>
                    ) : null}
                    {u.is_team_member ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-800">
                        <Sparkle className="h-3 w-3" strokeWidth={2} />
                        Team
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {u.is_internal ? (
                      <span className="text-xs text-ink/55">Locked (internal)</span>
                    ) : (
                      <>
                        <form action={toggleTeamMember}>
                          <input type="hidden" name="user_id" value={u.user_id} />
                          <input
                            type="hidden"
                            name="desired"
                            value={u.is_team_member ? 'false' : 'true'}
                          />
                          <SubmitButton
                            className={`rounded-md px-2 py-1 text-xs font-medium disabled:opacity-60 ${
                              u.is_team_member
                                ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                            }`}
                            pendingLabel="…"
                          >
                            {u.is_team_member ? 'Remove from pool' : 'Add to pool'}
                          </SubmitButton>
                        </form>
                        <form action={confirmUserEmail}>
                          <input type="hidden" name="user_id" value={u.user_id} />
                          <SubmitButton
                            title="Force-confirm this user's email (idempotent — useful when Supabase email doesn't arrive)"
                            className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:opacity-60"
                            pendingLabel="…"
                          >
                            <MailCheck className="h-3 w-3" strokeWidth={2} />
                            Confirm email
                          </SubmitButton>
                        </form>
                        <form action={resetUserPassword}>
                          <input type="hidden" name="user_id" value={u.user_id} />
                          <SubmitButton
                            title="Generate a temporary password to share with this user. Shown once at the top of the page."
                            className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-amber-100 hover:text-amber-900 disabled:opacity-60"
                            pendingLabel="Generating…"
                          >
                            <KeyRound className="h-3 w-3" strokeWidth={2} />
                            Reset password
                          </SubmitButton>
                        </form>
                        <ConfirmForm
                          action={deleteUser}
                          message={`Hard-delete ${u.email ?? 'this user'}? Their auth identity is gone; all related data cascade-deletes; the EMAIL is freed for re-signup (e.g., switching from vendor to customer). Not reversible from this page.`}
                        >
                          <input type="hidden" name="user_id" value={u.user_id} />
                          <SubmitButton
                            title="Delete the user. The email is freed for re-signup."
                            className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-rose-100 hover:text-rose-900 disabled:opacity-60"
                            pendingLabel="Deleting…"
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={2} />
                            Delete
                          </SubmitButton>
                        </ConfirmForm>
                        <ConfirmForm
                          action={blacklistUser}
                          message={`Blacklist ${u.email ?? 'this user'}? The user is hard-deleted AND the email is permanently blocked from signing up again. Reverse via the Blacklisted filter → Unblacklist.`}
                        >
                          <input type="hidden" name="user_id" value={u.user_id} />
                          <SubmitButton
                            title="Delete the user AND permanently block this email from re-registering."
                            className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-rose-200 hover:text-rose-900 disabled:opacity-60"
                            pendingLabel="…"
                          >
                            <Ban className="h-3 w-3" strokeWidth={2} />
                            Blacklist
                          </SubmitButton>
                        </ConfirmForm>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function BlacklistTable({ rows }: { rows: BlacklistRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
          <tr>
            <th className="px-3 py-3 font-medium">Email</th>
            <th className="px-3 py-3 font-medium">Reason</th>
            <th className="hidden px-3 py-3 font-medium md:table-cell">Blacklisted</th>
            <th className="px-3 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-ink/55" colSpan={4}>
                No blacklisted emails.
              </td>
            </tr>
          ) : (
            rows.map((b) => (
              <tr key={b.id} className="border-t border-ink/5 hover:bg-terracotta/[0.04]">
                <td className="px-3 py-3 font-medium text-ink">{b.email}</td>
                <td className="px-3 py-3 text-ink/70">{b.reason ?? '—'}</td>
                <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 md:table-cell">
                  {b.blacklisted_at.slice(0, 10)}
                </td>
                <td className="px-3 py-3">
                  <ConfirmForm
                    action={unblacklistEmail}
                    message={`Remove ${b.email} from the blacklist? This email will be able to sign up again.`}
                  >
                    <input type="hidden" name="blacklist_id" value={b.id} />
                    <SubmitButton
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-200 disabled:opacity-60"
                      pendingLabel="…"
                    >
                      <Undo2 className="h-3 w-3" strokeWidth={2} />
                      Unblacklist
                    </SubmitButton>
                  </ConfirmForm>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
