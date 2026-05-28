import { Tile } from './_overview-tile';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Overview · Admin' };

function take(c: number | null | undefined): number | null {
  return typeof c === 'number' ? c : null;
}

export default async function AdminOverview() {
  const admin = createAdminClient();

  const head = { count: 'exact', head: true } as const;
  const [
    usersRes,
    couplesRes,
    vendorUsersRes,
    eventsRes,
    vendorProfilesRes,
    threadsRes,
    internalRes,
    teamPoolRes,
  ] = await Promise.all([
    admin.from('users').select('*', head),
    admin.from('users').select('*', head).eq('account_type', 'customer'),
    admin.from('users').select('*', head).eq('account_type', 'vendor'),
    admin.from('events').select('*', head),
    admin.from('vendor_profiles').select('*', head),
    admin.from('chat_threads').select('*', head),
    admin.from('users').select('*', head).eq('is_internal', true),
    admin.from('users').select('*', head).eq('is_team_member', true),
  ]);

  const users = take(usersRes.count);
  const couples = take(couplesRes.count);
  const vendors = take(vendorUsersRes.count);
  const events = take(eventsRes.count);
  const vendorProfiles = take(vendorProfilesRes.count);
  const threads = take(threadsRes.count);
  const internal = take(internalRes.count);
  const teamPool = take(teamPoolRes.count);

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      {/*
       * v2.1 admin chrome (overlay 2026-05-28). Eyebrow uses .m-eyebrow,
       * heading uses .m-display-tight (Saira Condensed via the foundation
       * tokens shipped in PR #566), supporting copy stays in the body sans
       * stack. Mirrors couple-dashboard (PR #576) and vendor-dashboard (PR
       * #577) overlays — same visual register across all three role surfaces.
       * Logic + nav + per-iteration pages untouched.
       */}
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Setnayan · Internal ops</p>
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">Overview</h1>
        <p className="text-base text-ink/65">
          A snapshot of the platform — counts at a glance, then jump into{' '}
          <strong className="text-ink">Queues</strong> for action work,{' '}
          <strong className="text-ink">Directory</strong> to look up people and
          events, <strong className="text-ink">Money</strong> for payouts and
          receipts, or <strong className="text-ink">Content</strong> to update
          the marketing site and taxonomy.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="All users" value={users} />
        <Stat label="Couples" value={couples} />
        <Stat label="Vendor users" value={vendors} />
        <Stat label="Events" value={events} />
        <Stat label="Vendor profiles" value={vendorProfiles} />
        <Stat label="Chat threads" value={threads} />
        <Stat label="🟣 Internal" value={internal} />
        <Stat label="🟢 Team Pool" value={teamPool} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile href="/admin/users" icon="users" title="Users" body="Search, filter, flag team-pool members." />
        <Tile href="/admin/events" icon="calendar" title="Events" body="All events in the system + couple-side stats." />
        <Tile href="/admin/vendors" icon="briefcase" title="Vendors" body="Every vendor_profile + published status." />
        <Tile
          href="/admin/verify"
          icon="shield-check"
          title="Verification queue"
          body="Approve registered vendors → flip Coming soon to Verified."
        />
        <Tile
          href="/admin/payouts"
          icon="wallet"
          title="Vendor payouts"
          body="Verified T+1 · coming-soon 20/60/20 release schedule + dispute holds."
        />
        <Tile
          href="/admin/website"
          icon="layout-grid"
          title="Website editor"
          body="Toggle + reorder marketing-site widgets per page."
        />
        <Tile
          href="/admin/moodboard-library"
          icon="layout-grid"
          title="Moodboard library"
          body="Upload + tag template photos for Visual preview pillars (0010 · locked 2026-05-21)."
        />
        <Tile
          href="/admin"
          icon="message-square"
          title="Approval queue"
          body="Two-admin approvals · ships in a follow-on revision."
          disabled
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  // v2.1 KPI card — .m-card chrome + .m-mono label + tabular display number.
  // Same shape the admin-dashboard.jsx template uses for KPI strips; matches
  // the AdminOverview template at /tmp/setnayan-keynote-template/components/
  // admin-dashboard.jsx lines 193-199.
  return (
    <div className="m-card p-4">
      <p className="m-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--m-slate-3)]">
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--m-ink)]"
        style={{ fontFamily: 'var(--m-display)', fontVariantNumeric: 'tabular-nums' }}
      >
        {value === null ? '—' : value}
      </p>
    </div>
  );
}

