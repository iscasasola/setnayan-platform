import Link from 'next/link';
import {
  Users,
  Calendar,
  Briefcase,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  LayoutGrid,
} from 'lucide-react';
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
      <header className="mb-8 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          Iteration 0023 · Admin Console (V1 MVP)
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Overview</h1>
        <p className="text-base text-ink/65">
          Eight admin surfaces per 0023 § 1: Overview · Users · Events · Vendors ·
          Verification · Payments · Settings · Website editor. The two-admin
          approval queue + audit log shipping in a follow-on revision.
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
        <Tile href="/admin/users" Icon={Users} title="Users" body="Search, filter, flag team-pool members." />
        <Tile href="/admin/events" Icon={Calendar} title="Events" body="All events in the system + couple-side stats." />
        <Tile href="/admin/vendors" Icon={Briefcase} title="Vendors" body="Every vendor_profile + published status." />
        <Tile
          href="/admin/verify"
          Icon={ShieldCheck}
          title="Verification queue"
          body="Approve registered vendors → flip Coming soon to Verified."
        />
        <Tile
          href="/admin/website"
          Icon={LayoutGrid}
          title="Website editor"
          body="Toggle + reorder marketing-site widgets per page."
        />
        <Tile
          href="/admin"
          Icon={MessageSquare}
          title="Approval queue"
          body="Two-admin approvals · ships in a follow-on revision."
          disabled
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        {value === null ? '—' : value}
      </p>
    </div>
  );
}

function Tile({
  href,
  Icon,
  title,
  body,
  disabled = false,
}: {
  href: string;
  Icon: typeof Users;
  title: string;
  body: string;
  disabled?: boolean;
}) {
  const Inner = (
    <div
      className={`group flex h-full flex-col gap-3 rounded-xl border p-5 ${
        disabled
          ? 'cursor-not-allowed border-dashed border-ink/15 bg-cream/60 opacity-70'
          : 'border-ink/10 bg-cream transition-colors hover:border-terracotta/40 hover:bg-terracotta/5'
      }`}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      <p className="text-sm text-ink/65">{body}</p>
      {!disabled ? (
        <span className="mt-auto inline-flex items-center gap-1 text-sm text-terracotta">
          Open <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      ) : null}
    </div>
  );
  return disabled ? Inner : <Link href={href}>{Inner}</Link>;
}
