import { Search, ShieldCheck, Sparkle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { toggleTeamMember } from './actions';

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

type Filter = 'all' | 'customer' | 'vendor' | 'internal' | 'team_pool';

type Props = {
  searchParams: Promise<{ q?: string; filter?: string }>;
};

export default async function AdminUsersPage({ searchParams }: Props) {
  const search = await searchParams;
  const q = (search.q ?? '').trim();
  const filter = (search.filter ?? 'all') as Filter;

  const admin = createAdminClient();
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
    query = query.or(`email.ilike.%${q}%,display_name.ilike.%${q}%,public_id.ilike.%${q}%`);
  }

  const { data, error } = await query;
  const users = (data ?? []) as UserRow[];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-ink/60">
          Latest 200 accounts (newest first). Filter or search to drill in.
        </p>
      </header>

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
            placeholder="email · display name · S89U-…"
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
        </select>
        <button type="submit" className="button-secondary">Apply</button>
      </form>

      {error ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          {error.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-ink/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Account ID</th>
              <th className="px-3 py-3 font-medium">Created</th>
              <th className="px-3 py-3 font-medium">Flags</th>
              <th className="px-3 py-3 font-medium">Team pool</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-ink/55" colSpan={6}>
                  No users match.
                </td>
              </tr>
            ) : (
              users.map((u) => (
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
                  <td className="px-3 py-3 font-mono text-[11px] text-ink/55">
                    {u.public_id}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] text-ink/55">
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
                    {u.is_internal ? (
                      <span className="text-xs text-ink/55">Locked (internal)</span>
                    ) : (
                      <form action={toggleTeamMember}>
                        <input type="hidden" name="user_id" value={u.user_id} />
                        <input
                          type="hidden"
                          name="desired"
                          value={u.is_team_member ? 'false' : 'true'}
                        />
                        <button
                          type="submit"
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
                            u.is_team_member
                              ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                              : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                          }`}
                        >
                          {u.is_team_member ? 'Remove from pool' : 'Add to pool'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
