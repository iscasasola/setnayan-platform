import Link from 'next/link';
import { ArrowRight, AlertTriangle } from 'lucide-react';
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
    // Action queue counts (2026-05-29 · Task #11).
    // Owner directive · surface live queue counts on Home so admin
    // sees actionable work without drilling into each queue page.
    // Each fetch uses head:true + count='exact' so we get count
    // without pulling rows. The 4 queries below match the actual
    // filters used by /admin/verify · /admin/payments · /admin/
    // disputes · /admin/reviews so the counts on Home match the
    // counts each queue page surfaces when admin opens it.
    verifyQueueRes,
    paymentsQueueRes,
    disputesQueueRes,
    appealsQueueRes,
  ] = await Promise.all([
    admin.from('users').select('*', head),
    admin.from('users').select('*', head).eq('account_type', 'customer'),
    admin.from('users').select('*', head).eq('account_type', 'vendor'),
    admin.from('events').select('*', head),
    admin.from('vendor_profiles').select('*', head),
    admin.from('chat_threads').select('*', head),
    admin.from('users').select('*', head).eq('is_internal', true),
    admin.from('users').select('*', head).eq('is_team_member', true),
    // Verification queue — vendor_profiles awaiting admin approval.
    // public_visibility='coming_soon' matches the default tab on
    // /admin/verify per parseVisibilityTab default branch.
    admin
      .from('vendor_profiles')
      .select('*', head)
      .eq('public_visibility', 'coming_soon'),
    // Payments queue — payments awaiting reconciliation.
    // status='pending' matches the filter on /admin/payments.
    admin.from('payments').select('*', head).eq('status', 'pending'),
    // Disputes queue — open disputes awaiting admin resolution.
    // status='open' matches the default filter on /admin/disputes.
    admin.from('vendor_disputes').select('*', head).eq('status', 'open'),
    // Review appeals queue — self-review appeals awaiting admin
    // decision. decided_at IS NULL matches the 'pending' filter on
    // /admin/reviews.
    admin.from('vendor_review_appeals').select('*', head).is('decided_at', null),
  ]);

  const users = take(usersRes.count);
  const couples = take(couplesRes.count);
  const vendors = take(vendorUsersRes.count);
  const events = take(eventsRes.count);
  const vendorProfiles = take(vendorProfilesRes.count);
  const threads = take(threadsRes.count);
  const internal = take(internalRes.count);
  const teamPool = take(teamPoolRes.count);
  const verifyQueueCount = take(verifyQueueRes.count);
  const paymentsQueueCount = take(paymentsQueueRes.count);
  const disputesQueueCount = take(disputesQueueRes.count);
  const appealsQueueCount = take(appealsQueueRes.count);

  // Total open action items across all 4 queues — used to flavor the
  // section subhead when there's work to do vs. when all queues are
  // clear. Treat null counts as 0 so a transient query error doesn't
  // make the action-queues section disappear.
  const totalOpenActions =
    (verifyQueueCount ?? 0) +
    (paymentsQueueCount ?? 0) +
    (disputesQueueCount ?? 0) +
    (appealsQueueCount ?? 0);

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

      {/* ACTION QUEUES · 2026-05-29 Task #11.
       *  Owner directive · surface live queue counts on Home so admin
       *  lands and sees actionable work without drilling into each
       *  queue page. Each tile shows the live count + tone-graded
       *  treatment (amber when count > 0, muted when 0). All 4 tiles
       *  route to their respective queue with the matching default
       *  filter applied so the count on Home matches the queue's
       *  visible rows when admin opens it.
       *
       *  Goes ABOVE the existing 8-tile platform-counts grid because
       *  action work is more urgent than KPI awareness · 95% of admin
       *  sessions are to clear a queue, not to monitor totals. */}
      <section
        aria-labelledby="action-queues-heading"
        className="mb-8 rounded-2xl border border-terracotta/20 bg-gradient-to-br from-cream to-terracotta-50/30 p-5 sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="action-queues-heading"
            className="m-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700"
          >
            Action queues
          </h2>
          <p className="text-xs text-ink/55">
            {totalOpenActions === 0
              ? 'All queues clear · nothing pending.'
              : `${totalOpenActions} open across all queues`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ActionQueueTile
            label="Vendors to verify"
            value={verifyQueueCount}
            sub="Coming-soon awaiting review"
            href="/admin/verify"
          />
          <ActionQueueTile
            label="Payments to review"
            value={paymentsQueueCount}
            sub="Awaiting reconciliation"
            href="/admin/payments?filter=pending"
          />
          <ActionQueueTile
            label="Open disputes"
            value={disputesQueueCount}
            sub="Vendor-couple conflicts"
            href="/admin/disputes?status=open"
          />
          <ActionQueueTile
            label="Review appeals"
            value={appealsQueueCount}
            sub="Self-review claims pending"
            href="/admin/reviews?filter=pending"
          />
        </div>
      </section>

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
        {/*
          v2.1 Nav Phase 3 cleanup — removed disabled-self-linking "Approval
          queue" tile per the Phase 3 brief audit list (CLAUDE.md decision
          log) + [[feedback_setnayan_no_dev_text_post_launch]]. Two-admin
          approvals ship in a follow-on revision; surfacing a dead tile in
          the meantime was a dev-text affordance, not a wired feature.
        */}
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

/**
 * ActionQueueTile — clickable KPI card for the Action queues section.
 *
 * Differs from <Stat> in three ways:
 *   1. Wraps in <Link> for one-click routing into the queue page with
 *      the matching default filter applied.
 *   2. Tone-graded · amber accent + AlertTriangle icon when value > 0,
 *      muted ink when value === 0. Admin's eye goes straight to the
 *      tiles with work pending.
 *   3. Right-arrow affordance on the title row so the tile reads as a
 *      destination, not just a count.
 *
 * Brand voice · sub-line uses concrete copy ("Coming-soon awaiting
 * review" / "Awaiting reconciliation" / "Vendor-couple conflicts" /
 * "Self-review claims pending") per
 * `[[feedback_setnayan_no_dev_text_post_launch]]` · no engineering
 * jargon like "pending_review_count" or "queue_size".
 */
function ActionQueueTile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: number | null;
  sub: string;
  href: string;
}) {
  const hasWork = (value ?? 0) > 0;
  return (
    <Link
      href={href}
      className={`block rounded-xl border p-4 transition-colors ${
        hasWork
          ? 'border-amber-300/60 bg-amber-50/60 hover:bg-amber-50'
          : 'border-ink/10 bg-cream/80 hover:bg-ink/[0.03]'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {hasWork ? (
            <AlertTriangle
              className="h-3.5 w-3.5 shrink-0 text-amber-700"
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
          <span
            className={`m-mono text-[10px] uppercase tracking-[0.15em] ${
              hasWork ? 'text-amber-800' : 'text-ink/55'
            }`}
          >
            {label}
          </span>
        </div>
        <ArrowRight
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 ${
            hasWork ? 'text-amber-700' : 'text-ink/35'
          }`}
        />
      </div>
      <p
        className={`text-3xl font-semibold tracking-tight tabular-nums ${
          hasWork ? 'text-amber-900' : 'text-ink'
        }`}
        style={{ fontFamily: 'var(--m-display)' }}
      >
        {value === null ? '—' : value}
      </p>
      <p className={`mt-1 text-xs ${hasWork ? 'text-amber-800/80' : 'text-ink/55'}`}>
        {sub}
      </p>
    </Link>
  );
}

