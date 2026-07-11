import Link from 'next/link';
import { ArrowRight, AlertTriangle, ListChecks } from 'lucide-react';
import { Tile } from './_overview-tile';
import { AppleSecretReminder } from './_apple-secret-reminder';
import { KpiStatCard } from './_components/kpi-stat-card';
import { ProgressRing } from '@/app/_components/progress-ring';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import {
  getAdminQueueDigest,
  deriveQueueUrgency,
  ageShort,
  ADMIN_QUEUE_META,
  type AdminQueueDigest,
  type AdminQueueDueState,
} from '@/lib/admin/queue-counts';

export const metadata = { title: 'Overview · Setnayan HQ' };

function take(c: number | null | undefined): number | null {
  return typeof c === 'number' ? c : null;
}

/** One Action-queue tile — count + urgency + SLA-age fields for the card. */
type LaneTile = {
  label: string;
  value: number | null;
  state?: AdminQueueDueState;
  sub: string;
  href: string;
  oldestAt?: string | null;
  slaHours?: number;
};

export default async function AdminOverview() {
  // Page-level gate (council fix #1 2026-07-09) — the layout alone is not a
  // safe auth boundary in front of the RLS-bypassing service-role client below
  // (layouts don't re-run on soft navigation / crafted RSC requests).
  await requireAdmin();
  const admin = createAdminClient();

  const head = { count: 'exact', head: true } as const;
  // Stats + the one Action-queue NOT in the shared digest (taxonomy requests is
  // a Data-Structure governance queue, not a Work-nav queue), fetched alongside
  // the shared queue digest. Every OTHER queue count + its urgency now comes
  // from the ONE source (lib/admin/queue-counts.ts) — same numbers as the nav
  // badges + the /admin/work command center, by construction. This removes the
  // 3rd hand-maintained copy of the per-queue filters (which had drifted before).
  const [
    [
      usersRes,
      couplesRes,
      vendorUsersRes,
      eventsRes,
      vendorProfilesRes,
      threadsRes,
      internalRes,
      teamPoolRes,
      taxonomyReqRes,
    ],
    digest,
  ] = await Promise.all([
    Promise.all([
      admin.from('users').select('*', head),
      admin.from('users').select('*', head).eq('account_type', 'customer'),
      admin.from('users').select('*', head).eq('account_type', 'vendor'),
      admin.from('events').select('*', head),
      admin.from('vendor_profiles').select('*', head),
      admin.from('chat_threads').select('*', head),
      admin.from('users').select('*', head).eq('is_internal', true),
      admin.from('users').select('*', head).eq('is_team_member', true),
      // Taxonomy requests — vendor category/refinement proposals awaiting review.
      admin
        .from('taxonomy_category_requests')
        .select('*', head)
        .eq('status', 'pending'),
    ]),
    // Degrades to an empty digest on failure (council fix #3) — cache()
    // memoizes a REJECTED promise, so without this catch one bad fetch would
    // hard-crash the overview while the layout (which catches) still renders.
    getAdminQueueDigest().catch(() => ({}) as AdminQueueDigest),
  ]);
  const nowMs = Date.now();
  const urgency = deriveQueueUrgency(digest, nowMs);

  const users = take(usersRes.count);
  const couples = take(couplesRes.count);
  const vendors = take(vendorUsersRes.count);
  const events = take(eventsRes.count);
  const vendorProfiles = take(vendorProfilesRes.count);
  const threads = take(threadsRes.count);
  const internal = take(internalRes.count);
  const teamPool = take(teamPoolRes.count);

  // Per-queue tile builder — count + urgency + the oldest-open timestamp and
  // SLA window from the shared digest (council fix #11: a tile can now say HOW
  // late a queue is, not just that it has work). Taxonomy stays standalone —
  // it's a Data-Structure governance queue with no digest row / SLA clock.
  const taxonomy = take(taxonomyReqRes.count);
  const queueTile = (
    k: string,
    label: string,
    sub: string,
    href: string,
  ): LaneTile => ({
    label,
    sub,
    href,
    value: digest[k]?.count ?? null,
    state: urgency.states[k],
    oldestAt: digest[k]?.oldestAt ?? null,
    slaHours: ADMIN_QUEUE_META[k]?.slaHours,
  });

  // Lanes — the overview's OWN curated consequence grouping (Trust & supply /
  // Money / Recourse / Approvals & support). Deliberately more granular than,
  // and NOT identical to, the canonical ADMIN_QUEUE_META lanes (money / trust /
  // growth / support) the command center + digest tag by — the per-queue COUNTS
  // agree across surfaces; this presentational lane split is overview-only.
  const lanes: { key: string; label: string; tiles: LaneTile[] }[] = [
    {
      key: 'trust',
      label: 'Trust & supply',
      tiles: [
        queueTile('verify', 'Vendors to verify', 'Applications awaiting review', '/admin/verify'),
        queueTile(
          'vendor-partnerships',
          'Partnerships',
          'Vendor-to-vendor claims to verify',
          '/admin/vendor-partnerships',
        ),
        {
          label: 'Taxonomy requests',
          value: taxonomy,
          sub: 'New category / refinement proposals',
          href: '/admin/taxonomy',
        },
        queueTile(
          'payment-options',
          'Payment options',
          'Vendor bank/QR links to screen',
          '/admin/payment-options',
        ),
      ],
    },
    {
      key: 'money',
      label: 'Money to reconcile',
      tiles: [
        queueTile('payments', 'Payments to confirm', 'Awaiting reconciliation', '/admin/payments?filter=pending'),
        queueTile('payouts', 'Payouts to release', 'Verified T+1 schedule', '/admin/payouts'),
        queueTile('token-purchases', 'Token sales', 'Vendor packs to confirm', '/admin/token-purchases'),
        queueTile(
          'subscriptions',
          'Subscriptions',
          'Vendor Pro / Enterprise to confirm',
          '/admin/subscriptions',
        ),
      ],
    },
    {
      key: 'recourse',
      label: 'Recourse',
      tiles: [
        queueTile('disputes', 'Open disputes', 'Couple ↔ vendor conflicts', '/admin/disputes?status=open'),
        queueTile('force-majeure', 'Force majeure', 'Event-impacting flags', '/admin/force-majeure'),
        queueTile('reviews', 'Review appeals', 'Self-review claims pending', '/admin/reviews?filter=pending'),
        queueTile('concierge-abuse', 'Setnayan AI abuse', 'Trial-cycling flags', '/admin/concierge-abuse'),
        queueTile(
          'user-reports',
          'User reports',
          'Reported gallery content to moderate',
          '/admin/user-reports',
        ),
        queueTile(
          'account-deletions',
          'Account deletions',
          'Self-serve deletion requests (RA 10173)',
          '/admin/account-deletions',
        ),
        // Council fix #2: integrity-watch is in the digest (feeds totalOpen +
        // the overdue tally) but had NO tile — an open flag could render
        // "1 open · 1 past SLA" while every visible tile showed 0.
        queueTile(
          'integrity-watch',
          'Integrity watch',
          'Review-fraud + ghost-listing flags',
          '/admin/integrity-watch',
        ),
      ],
    },
    {
      key: 'support',
      label: 'Approvals & support',
      tiles: [
        queueTile(
          'approvals',
          'Two-admin approvals',
          'A colleague needs your second sign-off',
          '/admin/approvals',
        ),
        queueTile('help', 'Help tickets', 'Open · 24-hr SLA', '/admin/help'),
      ],
    },
  ];

  // Total covers EVERY digest queue (urgency.totalOpen) + taxonomy (the one
  // standalone queue). Derived from the digest, NOT the tile roster, so a tile
  // dropped from a lane can't make the "all clear" banner read false.
  const totalOpen = urgency.totalOpen + Math.max(0, taxonomy ?? 0);
  // Tell "genuinely empty" from "read failed": a null count (degraded query)
  // must NOT render a reassuring all-clear. taxonomy is the standalone queue, so
  // a null there counts as unavailable too.
  const anyUnavailable = urgency.unknownCount > 0 || taxonomy === null;
  // Cleared-queues share for the KPI ring (council fix #10) — queues whose
  // dueState is 'clear' over every canonical queue (taxonomy excluded: no SLA).
  const queueTotal = Object.keys(ADMIN_QUEUE_META).length;
  const clearedQueues = Object.values(urgency.states).filter((st) => st === 'clear').length;
  const clearedPct = queueTotal > 0 ? (clearedQueues / queueTotal) * 100 : 0;

  // Recent admin activity — the last few admin_audit_log entries (real data,
  // not a fake feed) so an admin lands and sees what teammates just did, which
  // avoids two admins working the same row. Actor names resolved in one extra
  // round trip; degrades to an empty state if the log query fails.
  const { data: auditRows } = await admin
    .from('admin_audit_log')
    .select('audit_log_id, action, target_id, reason, actor_user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  const activity = (auditRows ?? []) as Array<{
    audit_log_id: string;
    action: string;
    target_id: string | null;
    reason: string | null;
    actor_user_id: string | null;
    created_at: string;
  }>;
  const actorIds = [
    ...new Set(activity.map((a) => a.actor_user_id).filter((x): x is string => !!x)),
  ];
  const actorName = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .in('user_id', actorIds);
    for (const u of (actors ?? []) as Array<{
      user_id: string;
      email: string | null;
      display_name: string | null;
    }>) {
      actorName.set(u.user_id, u.display_name || u.email || 'An admin');
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Setnayan · Internal ops</p>
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">Overview</h1>
        <p className="text-base text-ink/65">
          Everything that needs admin action right now — requests, transactions
          awaiting approval, reports, and disputes at a glance. Tap a card to
          clear it. <strong className="text-ink">Accounts</strong> looks people
          up, <strong className="text-ink">App Performance</strong> carries the
          cockpit and platform upgrades, and{' '}
          <strong className="text-ink">Money</strong> holds the catalog and
          engine-room config.
        </p>
      </header>

      {/* One-off ops reminder · date-gated to 2026-12-08 (3 days before the
          Apple Sign-in client secret expires 2026-12-11). Renders null the
          rest of the year. See ./_apple-secret-reminder.tsx. */}
      <AppleSecretReminder />

      {/* ACTION QUEUES · every pending queue grouped by the overview's own
       *  curated consequence lanes (Trust & supply / Money / Recourse /
       *  Approvals & support — overview-only, distinct from the canonical
       *  ADMIN_QUEUE_META lanes). Ops-shaped nav redesign
       *  (Admin_Console_Nav_Redesign_2026-06-08 · owner sign-off 2026-06-08):
       *  surfaces ALL pending queues so an admin lands and sees the whole
       *  workload. The "Money to reconcile" lane is the always-visible
       *  one-stop money view (the dissolved Money group's queues, reunited).
       *  Per-queue counts come from the shared digest, so they agree with the
       *  nav badges + /admin/work + the digest email by construction. */}
      <section
        aria-label="Action queues"
        className="mb-8 rounded-2xl border border-mulberry/20 bg-gradient-to-br from-cream to-mulberry/5 p-5 sm:p-6"
      >
        {/* KPI cluster (council fix #10) — the ring is the cleared-queues
            share; the flanking stats surface all three urgency tiers,
            including due-soon, which was computed but never rendered here.
            Degraded counts are called out even when work is open (fix #3). */}
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <ProgressRing pct={clearedPct} size={64} stroke={6}>
            <span
              className="text-lg font-semibold tracking-tight tabular-nums"
              style={{ fontFamily: "var(--font-condensed), 'Saira Condensed', sans-serif", color: 'var(--m-ink)' }}
            >
              {totalOpen}
            </span>
          </ProgressRing>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold tabular-nums text-ink">
              {totalOpen} open
            </span>
            <span
              className={`tabular-nums ${
                urgency.overdue > 0 ? 'font-semibold text-red-700' : 'text-ink/70'
              }`}
            >
              {urgency.overdue} past SLA
            </span>
            <span
              className={`tabular-nums ${
                urgency.dueSoon > 0 ? 'font-semibold text-warn-700' : 'text-ink/70'
              }`}
            >
              {urgency.dueSoon} due soon
            </span>
            {anyUnavailable ? (
              <span className="text-ink/70">some counts unavailable</span>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {/* The ranked, busiest-first worklist — same data, single-screen
                triage view (overdue → due-soon → busiest). */}
            <Link
              href="/admin/work"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-mulberry hover:text-mulberry-600"
            >
              <ListChecks aria-hidden className="h-3.5 w-3.5" />
              Open the work list
            </Link>
            {/* Ongoing platform work — the owner's "things we need to upgrade"
                lives in the App Performance Action Center (AI credits, plan
                limits, renewals, rotations). Linked rather than duplicated so
                the cockpit stays the one source for those items. */}
            <Link
              href="/admin/app-performance"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-mulberry hover:text-mulberry-600"
            >
              <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
              Platform upgrades
            </Link>
          </div>
        </div>

        <div className="space-y-5">
          {lanes.map((lane) => {
            const roll = laneRollup(lane.tiles);
            return (
            <div key={lane.key}>
              {/* Lane rollup (2026-07-10) — per-lane aggregate open-count +
                  worst-urgency tone, derived from the same digest-backed tile
                  values (no new query). Lets an admin size a lane before
                  scanning its four tiles. */}
              <div className="mb-2 flex items-center gap-2">
                <p className="m-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--m-slate-2)]">
                  {lane.label}
                </p>
                {roll.open > 0 ? (
                  <span
                    className={`m-mono inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${roll.chip}`}
                  >
                    {roll.open} open
                  </span>
                ) : roll.unavailable ? (
                  <span className="m-mono text-[10px] text-ink/45">counts unavailable</span>
                ) : (
                  <span className="m-mono text-[10px] text-ink/40">clear</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {lane.tiles.map((t) => (
                  <ActionQueueTile
                    key={t.href}
                    label={t.label}
                    value={t.value}
                    dueState={t.state}
                    sub={t.sub}
                    href={t.href}
                    oldestAt={t.oldestAt}
                    slaHours={t.slaHours}
                    nowMs={nowMs}
                  />
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* MORE QUEUES · the act-now queues whose open count is COMPUTED per item
       *  (cross-table joins / severity from a jsonb array / a JS "stuck" cut)
       *  rather than a single-table head-count — so they deliberately carry NO
       *  badge in the shared digest (see lib/admin/queue-counts.ts). Without a
       *  landing entry they were undiscoverable once the Overview sidebar
       *  section defaults collapsed; these count-less tiles restore the
       *  "reachable via the page tiles" contract. No fabricated numbers —
       *  each is a plain destination. Several are time-sensitive (fraud /
       *  corrections / repost watch). */}
      <section aria-label="More queues" className="mb-8">
        <h2 className="mb-1 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          More queues
        </h2>
        <p className="mb-4 text-sm text-ink/65">
          These carry no live count — their open work is worked out per item, so
          open each to see what&rsquo;s waiting. Fraud, corrections, and repost
          watch are time-sensitive.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            href="/admin/fraud"
            icon="shield-check"
            title="Fraud queue"
            body="Vendor fraud signals + enforcement to review."
          />
          <Tile
            href="/admin/corrections"
            icon="briefcase"
            title="Profile corrections"
            body="Verified vendors requesting a locked-field fix."
          />
          <Tile
            href="/admin/repost-watch"
            icon="shield-check"
            title="Repost watch"
            body="Possible reposted / ghost listings + QR-media flags."
          />
          <Tile
            href="/admin/completions"
            icon="calendar"
            title="Completions"
            body="Stuck event-vendor completions to force-resolve."
          />
          <Tile
            href="/admin/pax-changes"
            icon="users"
            title="Pax changes"
            body="Guest-count-driven vendor cost changes to review."
          />
          <Tile
            href="/admin/pakanta"
            icon="camera"
            title="Pakanta queue"
            body="Custom-song writing + delivery to move along."
          />
          <Tile
            href="/admin/editorial-review"
            icon="message-square"
            title="Editorial review"
            body="Flagged editorial content awaiting a decision."
          />
        </div>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStatCard label="All users" value={users} />
        <KpiStatCard label="Couples" value={couples} />
        <KpiStatCard label="Vendor users" value={vendors} />
        <KpiStatCard label="Events" value={events} />
        <KpiStatCard label="Vendor profiles" value={vendorProfiles} />
        <KpiStatCard label="Chat threads" value={threads} />
        <KpiStatCard label="Internal accounts" value={internal} />
        <KpiStatCard label="Team Pool" value={teamPool} />
      </section>

      {/* Recent admin activity — real admin_audit_log entries (§3.4 of the
          redesign). Shows who-did-what so admins don't collide on the same row.
          Migrated onto the canonical `.m-card` chrome (was an ad-hoc
          rounded-2xl/bg-cream box) in the #2965 .m-card unification pass. */}
      <section className="m-card mb-8 p-5 sm:p-6">
        <h2 className="mb-3 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Recent admin activity
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-ink/70">No admin actions logged yet.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {activity.map((a) => {
              // Status chip (2026-07-10) — the audit action's OUTCOME tone,
              // derived from its real action code (no new data): a done/approved
              // action reads positive, a reject/fail/delete reads negative,
              // everything else neutral. The leading dot inherits the same tone.
              const chip = activityChip(a.action);
              return (
                <li key={a.audit_log_id} className="flex items-start gap-3 py-2.5">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${chip.dot}`}
                  />
                  <span className="min-w-0 flex-1 text-sm text-ink/80">
                    <strong className="font-semibold text-ink">
                      {a.actor_user_id ? actorName.get(a.actor_user_id) ?? 'An admin' : 'System'}
                    </strong>{' '}
                    {friendlyAction(a.action)}
                    {a.reason ? (
                      <span className="text-ink/50"> — “{a.reason.slice(0, 80)}”</span>
                    ) : null}
                  </span>
                  <span
                    className={`m-mono hidden shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] sm:inline-flex ${chip.pill}`}
                  >
                    {chip.label}
                  </span>
                  <span className="shrink-0 text-xs text-ink/70">{timeAgo(a.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile href="/admin/users" icon="users" title="Users" body="Search, filter, flag team-pool members." />
        <Tile href="/admin/events" icon="calendar" title="Events" body="All events in the system + couple-side stats." />
        <Tile href="/admin/vendors" icon="briefcase" title="Vendors" body="Every vendor_profile + published status." />
        <Tile href="/admin/patiktok" icon="camera" title="Patiktok renders" body="Client-side reel render queue + failures." />
        <Tile href="/admin/integrations" icon="layout-grid" title="Integrations" body="Turn email + integrations on without a redeploy." />
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
      </section>
    </div>
  );
}

function timeAgo(iso: string): string {
  // Floors at each unit boundary — Math.round overstated ages by up to 50%
  // (a 90-minute entry read "2h ago"), which matters in a feed whose purpose
  // is collision avoidance between admins. Council fix #15.
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Friendly past-tense phrasing for an admin_audit_log action code. Known codes
// get a hand-written phrase; everything else is humanized (strip any ":suffix",
// underscores → spaces, lowercased) so NEW action codes still read sensibly
// without needing a code change here.
const ACTION_PHRASES: Record<string, string> = {
  demo_mode_enabled: 'turned demo mode on',
  demo_mode_disabled: 'turned demo mode off',
  site_widgets_reorder: 'reordered marketing-site widgets',
  ceremony_type_set: 'set a wedding ceremony type',
  ceremony_type_updated: 'updated a wedding ceremony type',
  demo_vendors_create_start: 'started creating demo vendors',
  user_team_member_toggle: 'changed a team-pool flag',
  approval_request_created: 'requested a two-admin approval',
  approval_execute_failed: 'hit a failed two-admin action',
  taxonomy_request_promote: 'promoted a taxonomy request',
  taxonomy_request_map: 'mapped a taxonomy request',
};
function friendlyAction(action: string): string {
  const base = action.split(':')[0] ?? action;
  if (ACTION_PHRASES[base]) return ACTION_PHRASES[base];
  if (base.startsWith('approval_approved')) return 'approved a two-admin request';
  if (base.startsWith('approval_rejected')) return 'rejected a two-admin request';
  return base.replace(/_/g, ' ').toLowerCase();
}

/**
 * Per-lane rollup — aggregate open count + worst-urgency chip class, derived
 * from the lane's own tile values (already fetched; no new query). `open` sums
 * the non-null tile counts; `unavailable` flags a degraded (null) count so a
 * lane with a read failure never reads as a clean "clear".
 */
function laneRollup(tiles: LaneTile[]): {
  open: number;
  unavailable: boolean;
  chip: string;
} {
  let open = 0;
  let unavailable = false;
  let overdue = false;
  let dueSoon = false;
  for (const t of tiles) {
    if (t.value === null || t.value === undefined) {
      unavailable = true;
      continue;
    }
    open += Math.max(0, t.value);
    if (t.state === 'overdue') overdue = true;
    else if (t.state === 'due-soon') dueSoon = true;
  }
  const chip = overdue
    ? 'bg-red-100 text-red-800'
    : dueSoon
      ? 'bg-warn-100 text-warn-900'
      : open > 0
        ? 'bg-warn-50 text-warn-800'
        : 'bg-ink/5 text-ink/60';
  return { open, unavailable, chip };
}

/**
 * Status chip for an admin_audit_log row — an OUTCOME tone read straight off
 * the action code (no extra data). Done/approved reads positive, reject / fail
 * / delete / ban reads negative, everything else neutral. Drives both the small
 * pill label and the leading dot colour in the activity feed.
 */
function activityChip(action: string): { label: string; pill: string; dot: string } {
  const a = (action.split(':')[0] ?? action).toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => a.includes(n));
  if (has('reject', 'fail', 'delete', 'ban', 'decline', 'remove', 'disable', 'suspend')) {
    return { label: 'action', pill: 'bg-red-100 text-red-800', dot: 'bg-red-500/70' };
  }
  if (has('approve', 'confirm', 'promote', 'verify', 'release', 'enable', 'map', 'resolve', 'create', 'add')) {
    return { label: 'done', pill: 'bg-success-100 text-success-700', dot: 'bg-success-500/70' };
  }
  return { label: 'update', pill: 'bg-stone-100 text-stone-700', dot: 'bg-mulberry/60' };
}

/**
 * ActionQueueTile — clickable KPI card for the Action queues section.
 *
 *   1. Wraps in <Link> for one-click routing into the queue page with the
 *      matching default filter applied.
 *   2. Tone-graded on REAL urgency: red past SLA · ringed amber approaching
 *      SLA (due-soon) · amber open-but-fine · muted ink when clear. Admin's
 *      eye goes straight to the latest tile.
 *   3. SLA readout (council fix #11): oldest-open age in the sub-line + a
 *      3px pressure bar (age over the SLA window) under the count.
 *   4. Right-arrow affordance so the tile reads as a destination.
 *
 * Brand voice · concrete sub-line copy (no engineering jargon) per
 * [[feedback_setnayan_no_dev_text_post_launch]].
 */
function ActionQueueTile({
  label,
  value,
  dueState,
  sub,
  href,
  oldestAt,
  slaHours,
  nowMs,
}: {
  label: string;
  value: number | null;
  dueState?: AdminQueueDueState;
  sub: string;
  href: string;
  oldestAt?: string | null;
  slaHours?: number;
  nowMs: number;
}) {
  const hasWork = (value ?? 0) > 0;
  // Three-step tone ladder (council fix #11 added the middle rung): overdue
  // (past SLA) escalates to RED — matching the nav badges + the command
  // center; due-soon (last quarter of the SLA window) gets its own ringed
  // amber so the early-warning tier no longer collapses into generic
  // has-work amber; everything-else-with-work stays amber; clear is muted.
  const overdue = dueState === 'overdue';
  const dueSoon = dueState === 'due-soon';
  const tone = overdue
    ? {
        border: 'border-red-300/70 bg-red-50/70 hover:bg-red-50',
        icon: 'text-red-700',
        label: 'text-red-800',
        arrow: 'text-red-700',
        value: 'text-red-900',
        sub: 'text-red-800',
      }
    : dueSoon
      ? {
          border: 'border-warn-400/70 bg-warn-50 ring-1 ring-warn-300/60 hover:bg-warn-100/60',
          icon: 'text-warn-700',
          label: 'text-warn-800',
          arrow: 'text-warn-700',
          value: 'text-warn-900',
          sub: 'text-warn-800',
        }
      : hasWork
        ? {
            border: 'border-warn-300/60 bg-warn-50/60 hover:bg-warn-50',
            icon: 'text-warn-700',
            label: 'text-warn-800',
            arrow: 'text-warn-700',
            value: 'text-warn-900',
            sub: 'text-warn-800',
          }
        : {
            border: 'border-ink/10 bg-cream/80 hover:bg-ink/[0.03]',
            icon: '',
            label: 'text-ink/55',
            arrow: 'text-ink/35',
            value: 'text-ink',
            sub: 'text-ink/70',
          };

  // SLA-pressure readout (council fix #11) — the digest already carried the
  // oldest-open timestamp and the queue's SLA window; the tile now shows HOW
  // late, not just that work exists: an oldest-item age in the sub-line and a
  // 3px pressure bar (age as a share of the SLA window, capped at 100%).
  const age = hasWork && oldestAt ? ageShort(oldestAt, nowMs) : null;
  const pressurePct =
    hasWork && oldestAt && slaHours
      ? Math.min(
          100,
          ((nowMs - new Date(oldestAt).getTime()) / 3_600_000 / slaHours) * 100,
        )
      : null;

  return (
    <Link
      href={href}
      className={`block rounded-xl border p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-nav-active)] ${tone.border}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {hasWork ? (
            <AlertTriangle
              className={`h-3.5 w-3.5 shrink-0 ${tone.icon}`}
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
          <span
            className={`m-mono text-[10px] uppercase tracking-[0.15em] ${tone.label}`}
          >
            {label}
          </span>
        </div>
        <ArrowRight aria-hidden className={`h-3.5 w-3.5 shrink-0 ${tone.arrow}`} />
      </div>
      <p
        className={`text-3xl font-semibold tracking-tight tabular-nums ${tone.value}`}
        style={{ fontFamily: "var(--font-condensed), 'Saira Condensed', sans-serif" }}
      >
        {value === null ? '—' : value}
      </p>
      {pressurePct !== null ? (
        <div aria-hidden className="mt-2 h-[3px] overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full ${overdue ? 'bg-red-500' : 'bg-warn-500'}`}
            style={{ width: `${pressurePct}%` }}
          />
        </div>
      ) : null}
      <p className={`mt-1 text-xs ${tone.sub}`}>
        {sub}
        {age ? ` · oldest ${age}` : ''}
        {overdue ? ' · past SLA' : dueSoon ? ' · due soon' : ''}
      </p>
    </Link>
  );
}
