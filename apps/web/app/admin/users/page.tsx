import Link from 'next/link';
import { type ReactNode } from 'react';
import { Search, ShieldCheck, Sparkle, MailCheck, Trash2, Ban, KeyRound, Undo2, Gift, ChevronDown, ChevronUp, XCircle, LogOut } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { MiniTour } from '@/app/_components/mini-tour';
import {
  blacklistUser,
  confirmUserEmail,
  deleteUser,
  forceSignOutUser,
  issueCompGrant,
  resetUserPassword,
  revokeCompGrant,
  toggleTeamMember,
  unblacklistEmail,
} from './actions';
import {
  describeScope,
  describeSource,
  fetchCompGrantsForUser,
  formatRetailValueCentavos,
  type CompGrantRow,
} from '@/lib/comp-grants';

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
    /**
     * `expand=<user_id>` opens the inline comp-grants panel below that
     * user's row. Re-rendered as a hash-anchored deep-link so a successful
     * issueCompGrant redirect lands the admin right where they were.
     */
    expand?: string;
    /**
     * Transient success/warning banner copy populated by issueCompGrant on
     * a successful redirect. Cleared on the next navigation.
     */
    grant_banner?: string;
    /** Transient flags from forceSignOutUser redirects. */
    signed_out?: string;
    error?: string;
  }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const search = await searchParams;
  const q = (search.q ?? '').trim();
  const filter = (search.filter ?? 'all') as Filter;
  const tempPassword = search.temp_password ?? null;
  const forEmail = search.for_email ?? null;
  const expandUserId = search.expand ?? null;
  const grantBanner = search.grant_banner ?? null;

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

  // Fetch comp grants for the expanded user (if the panel is open AND the
  // user shows up in the current list — protects against stale ?expand
  // params after a filter change).
  let expandedGrants: CompGrantRow[] = [];
  if (expandUserId && userRows.some((u) => u.user_id === expandUserId)) {
    try {
      expandedGrants = await fetchCompGrantsForUser(admin, expandUserId);
    } catch {
      expandedGrants = [];
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-ink/60">
          Latest 200 accounts (newest first). Filter or search to drill in.
        </p>
      </header>

      {grantBanner ? (
        <section
          role="status"
          className="mb-6 rounded-2xl border border-emerald-300/60 bg-emerald-50/80 px-5 py-4"
        >
          <p className="text-sm text-emerald-900">{grantBanner}</p>
        </section>
      ) : null}

      {search.signed_out ? (
        <section
          role="status"
          className="mb-6 rounded-2xl border border-emerald-300/60 bg-emerald-50/80 px-5 py-4"
        >
          <p className="text-sm text-emerald-900">
            Force sign-out complete — that user&rsquo;s sessions are revoked on
            every device. Audit-logged.
          </p>
        </section>
      ) : null}

      {search.error ? (
        <section
          role="alert"
          className="mb-6 rounded-2xl border border-rose-300/60 bg-rose-50/80 px-5 py-4"
        >
          <p className="text-sm text-rose-900">{search.error}</p>
        </section>
      ) : null}

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
        <UsersTable
          rows={userRows}
          q={q}
          filter={filter}
          expandUserId={expandUserId}
          expandedGrants={expandedGrants}
        />
      )}
      <MiniTour tourKey="admin_users_v1" />
    </div>
  );
}

// Build the canonical query-string for a row's expand/collapse toggle.
// Preserves q + filter so the panel can toggle without losing search context.
function buildToggleHref(opts: {
  q: string;
  filter: Filter;
  expandUserId: string | null;
  rowUserId: string;
}): string {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.filter !== 'all') params.set('filter', opts.filter);
  // Toggle: if this row is already expanded, drop the param; otherwise set it.
  if (opts.expandUserId !== opts.rowUserId) {
    params.set('expand', opts.rowUserId);
  }
  const qs = params.toString();
  return qs ? `/admin/users?${qs}#u-${opts.rowUserId}` : `/admin/users#u-${opts.rowUserId}`;
}

function UsersTable({
  rows,
  q,
  filter,
  expandUserId,
  expandedGrants,
}: {
  rows: UserRow[];
  q: string;
  filter: Filter;
  expandUserId: string | null;
  expandedGrants: CompGrantRow[];
}) {
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
            rows.flatMap((u) => {
              const isExpanded = expandUserId === u.user_id;
              const userTr = (
              <tr
                key={u.user_id}
                id={`u-${u.user_id}`}
                className="border-t border-ink/5 hover:bg-terracotta/[0.04]"
              >
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
                          action={forceSignOutUser}
                          message={`Force sign-out ${u.email ?? 'this user'}? They are signed out on EVERY device immediately — use for compromised accounts. Their data is untouched; they can log back in.`}
                        >
                          <input type="hidden" name="user_id" value={u.user_id} />
                          <SubmitButton
                            title="Revoke every session for this user (compromised-account remedy). Audit-logged."
                            className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-amber-100 hover:text-amber-900 disabled:opacity-60"
                            pendingLabel="Signing out…"
                          >
                            <LogOut className="h-3 w-3" strokeWidth={2} />
                            Force sign-out
                          </SubmitButton>
                        </ConfirmForm>
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
                        <Link
                          href={buildToggleHref({
                            q,
                            filter,
                            expandUserId,
                            rowUserId: u.user_id,
                          })}
                          title={
                            isExpanded
                              ? 'Hide comp grants'
                              : 'View + issue comp grants for this user'
                          }
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            isExpanded
                              ? 'bg-terracotta/10 text-terracotta-700 hover:bg-terracotta/15'
                              : 'bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta-700'
                          }`}
                          aria-expanded={isExpanded}
                          aria-controls={`grants-${u.user_id}`}
                        >
                          <Gift className="h-3 w-3" strokeWidth={2} />
                          Comp grants
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" strokeWidth={2} />
                          ) : (
                            <ChevronDown className="h-3 w-3" strokeWidth={2} />
                          )}
                        </Link>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              );
              const fragments: ReactNode[] = [userTr];
              if (isExpanded && !u.is_internal) {
                fragments.push(
                  <tr key={`${u.user_id}-grants`} id={`grants-${u.user_id}`}>
                    <td colSpan={6} className="border-t border-terracotta/15 bg-cream/40 px-3 py-5">
                      <CompGrantsPanel
                        userId={u.user_id}
                        userEmail={u.email}
                        grants={expandedGrants}
                      />
                    </td>
                  </tr>,
                );
              }
              if (isExpanded && u.is_internal) {
                fragments.push(
                  <tr key={`${u.user_id}-grants-locked`} id={`grants-${u.user_id}`}>
                    <td colSpan={6} className="border-t border-purple-200 bg-purple-50/40 px-3 py-4">
                      <p className="text-sm text-purple-900">
                        This is an internal account (§ 10a) — it already carries
                        a permanent grant for every Setnayan service. Per-SKU
                        comps are not allowed on top.
                      </p>
                    </td>
                  </tr>,
                );
              }
              return fragments;
            })
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

/**
 * Comp grants panel — renders inline below the target user row.
 *
 * Layout split into two columns at md+: existing grants list (left) +
 * issue form (right). On mobile they stack. The form is a plain
 * <form action={issueCompGrant}> so server-action validation errors
 * bubble through Next's built-in error UI.
 */
function CompGrantsPanel({
  userId,
  userEmail,
  grants,
}: {
  userId: string;
  userEmail: string | null;
  grants: CompGrantRow[];
}) {
  const active = grants.filter((g) => g.revoked_at === null);
  const revoked = grants.filter((g) => g.revoked_at !== null);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Comp grants for {userEmail ?? 'this user'}
        </h3>
        {grants.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink/15 px-4 py-6 text-sm text-ink/55">
            No comp grants on this account yet. Issue one with the form
            on the right to gift a service.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((g) => (
              <GrantCard key={g.grant_id} grant={g} revoked={false} />
            ))}
            {revoked.length > 0 ? (
              <>
                <p className="pt-3 text-[11px] uppercase tracking-[0.15em] text-ink/45">
                  Revoked
                </p>
                {revoked.map((g) => (
                  <GrantCard key={g.grant_id} grant={g} revoked={true} />
                ))}
              </>
            ) : null}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Issue a comp grant</h3>
        <form action={issueCompGrant} className="space-y-3 rounded-xl border border-ink/10 bg-white p-4">
          <input type="hidden" name="user_id" value={userId} />
          <div>
            <label
              htmlFor={`scope-${userId}`}
              className="mb-1 block text-xs font-medium text-ink/70"
            >
              Scope
            </label>
            <select
              id={`scope-${userId}`}
              name="scope"
              required
              defaultValue="specific_skus"
              className="input-field"
            >
              <option value="specific_skus">Specific services</option>
              <option value="all_services">Every Setnayan service</option>
            </select>
            <p className="mt-1 text-xs text-ink/55">
              &ldquo;Every service&rdquo; is broad — usually reserved for goodwill remediation.
            </p>
          </div>
          <div>
            <label
              htmlFor={`scoped-${userId}`}
              className="mb-1 block text-xs font-medium text-ink/70"
            >
              Service codes (only when scope is specific services)
            </label>
            <textarea
              id={`scoped-${userId}`}
              name="scoped_skus"
              rows={2}
              placeholder="monogram_hero_upgrade, panood_daily_broadcast, patiktok_setnayan_tiktok"
              className="input-field font-mono text-xs"
            />
            <p className="mt-1 text-xs text-ink/55">
              Comma- or newline-separated. SKU codes match{' '}
              <code className="font-mono text-[11px]">service_catalog.sku_code</code>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`retail-${userId}`}
                className="mb-1 block text-xs font-medium text-ink/70"
              >
                Retail value (₱)
              </label>
              <input
                id={`retail-${userId}`}
                name="retail_value_php"
                type="number"
                min="0"
                step="1"
                placeholder="2499"
                className="input-field"
              />
              <p className="mt-1 text-xs text-ink/55">
                Optional but recommended for audit. Grants over ₱10,000 get
                flagged for co-approval.
              </p>
            </div>
            <div>
              <label
                htmlFor={`expiry-${userId}`}
                className="mb-1 block text-xs font-medium text-ink/70"
              >
                Expires
              </label>
              <input
                id={`expiry-${userId}`}
                name="expiry_at"
                type="datetime-local"
                className="input-field"
              />
              <p className="mt-1 text-xs text-ink/55">
                Leave blank to grant lifetime access.
              </p>
            </div>
          </div>
          <div>
            <label
              htmlFor={`rationale-${userId}`}
              className="mb-1 block text-xs font-medium text-ink/70"
            >
              Rationale (min 20 characters)
            </label>
            <textarea
              id={`rationale-${userId}`}
              name="rationale"
              rows={3}
              required
              minLength={20}
              placeholder="Couple was bound to wrong test event during pilot · gifting Animated Monogram as remediation."
              className="input-field"
            />
            <p className="mt-1 text-xs text-ink/55">
              Audit-grade · shows up in admin_audit_log.metadata so any
              future review can see why the comp landed.
            </p>
          </div>
          <SubmitButton
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-mulberry px-3 py-1.5 text-sm font-medium text-cream hover:bg-mulberry-700 disabled:opacity-60"
            pendingLabel="Issuing…"
          >
            <Gift className="h-3.5 w-3.5" strokeWidth={2} />
            Issue comp grant
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

/**
 * Render a single comp_grants row as a compact card. Active grants get
 * a Revoke form (with required reason); revoked grants just render
 * their state.
 */
function GrantCard({ grant, revoked }: { grant: CompGrantRow; revoked: boolean }) {
  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        revoked
          ? 'border-ink/10 bg-ink/[0.02] text-ink/60'
          : 'border-emerald-200/70 bg-emerald-50/50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink/60">
            {grant.public_id}
          </p>
          <p className="text-sm font-medium text-ink">
            {describeScope(grant.scope, grant.scoped_skus)}
          </p>
          <p className="text-xs text-ink/60">
            {describeSource(grant.source)} ·{' '}
            {formatRetailValueCentavos(grant.retail_value_centavos)} retail value
          </p>
          {grant.scope === 'specific_skus' && grant.scoped_skus ? (
            <p className="font-mono text-[11px] text-ink/55">
              {grant.scoped_skus.join(', ')}
            </p>
          ) : null}
          {grant.rationale ? (
            <p className="text-xs text-ink/70">
              <span className="text-ink/45">Why:</span> {grant.rationale}
            </p>
          ) : null}
          <p className="text-[11px] text-ink/45">
            Issued {grant.created_at.slice(0, 10)}
            {grant.expiry ? ` · expires ${grant.expiry.slice(0, 10)}` : ' · no expiry'}
            {revoked && grant.revoked_at
              ? ` · revoked ${grant.revoked_at.slice(0, 10)}`
              : null}
          </p>
        </div>
        {!revoked ? (
          <ConfirmForm
            action={revokeCompGrant}
            message={`Revoke comp grant ${grant.public_id}? This stops future uses but doesn't refund any order that's already used it. Reason is required.`}
            className="shrink-0"
          >
            <input type="hidden" name="grant_id" value={grant.grant_id} />
            <input
              type="hidden"
              name="reason"
              value="Revoked from admin/users panel"
            />
            <SubmitButton
              title="Revoke this grant. The audit log captures it."
              className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-rose-100 hover:text-rose-900 disabled:opacity-60"
              pendingLabel="…"
            >
              <XCircle className="h-3 w-3" strokeWidth={2} />
              Revoke
            </SubmitButton>
          </ConfirmForm>
        ) : null}
      </div>
    </li>
  );
}
