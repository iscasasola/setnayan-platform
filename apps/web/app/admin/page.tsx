import Link from 'next/link';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { Tile } from './_overview-tile';
import { AppleSecretReminder } from './_apple-secret-reminder';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Overview · Setnayan HQ' };

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
    // ── Action-queue counts (command-center Home · 2026-06-09) ───────────
    // Ops-shaped nav redesign (Admin_Console_Nav_Redesign_2026-06-08): Home
    // surfaces EVERY pending queue grouped by lane, not just 4. Each fetch
    // uses head:true + count='exact' (count only, no rows) and mirrors the
    // exact filter each queue page uses so the number here matches the rows
    // the admin sees on arrival. A missing/renamed table resolves with an
    // { error } (not a throw) → take() degrades that one tile to null (—)
    // instead of 500-ing the whole page.
    //
    // Two-admin approvals are intentionally NOT surfaced yet: the
    // `admin_approval_requests` table is unbuilt (V1.x per § 9.1), so there
    // is nothing to count. It lands with the dedicated /admin/approvals PR.
    //
    // Trust & supply
    verifyQueueRes,
    taxonomyReqRes,
    paymentOptionsRes,
    // Money to reconcile
    paymentsQueueRes,
    payoutsRes,
    tokenSalesRes,
    // Recourse
    disputesQueueRes,
    forceMajeureRes,
    appealsQueueRes,
    abuseRes,
    // Approvals & support
    approvalsRes,
    helpRes,
  ] = await Promise.all([
    admin.from('users').select('*', head),
    admin.from('users').select('*', head).eq('account_type', 'customer'),
    admin.from('users').select('*', head).eq('account_type', 'vendor'),
    admin.from('events').select('*', head),
    admin.from('vendor_profiles').select('*', head),
    admin.from('chat_threads').select('*', head),
    admin.from('users').select('*', head).eq('is_internal', true),
    admin.from('users').select('*', head).eq('is_team_member', true),
    // Verification — applications awaiting review. The /admin/verify DEFAULT
    // surface is 'applications' (vendor_verification_applications · pending_review
    // tab), NOT the secondary ?surface=visibility (vendor_profiles coming_soon).
    // Count the applications queue so Home matches what the admin sees on arrival.
    // (Fixes a pre-existing mismatch where Home/Work counted coming_soon.)
    admin
      .from('vendor_verification_applications')
      .select('*', head)
      .eq('status', 'pending_review'),
    // Taxonomy requests — vendor category/refinement proposals awaiting review.
    admin
      .from('taxonomy_category_requests')
      .select('*', head)
      .eq('status', 'pending'),
    // Payment options — vendor payment destinations awaiting a fraud screen.
    admin
      .from('vendor_payment_methods')
      .select('*', head)
      .in('moderation_status', ['pending_review', 'held']),
    // Payments — order payments awaiting reconciliation.
    admin.from('payments').select('*', head).eq('status', 'pending'),
    // Payouts — vendor payouts ready to release (unpaid, not on hold).
    admin
      .from('vendor_payouts')
      .select('*', head)
      .is('paid_at', null)
      .eq('on_hold', false),
    // Token sales — vendor token-pack purchases awaiting confirmation.
    admin
      .from('vendor_token_purchases')
      .select('*', head)
      .eq('status', 'pending_payment'),
    // Disputes — open couple/vendor disputes.
    admin.from('vendor_disputes').select('*', head).eq('status', 'open'),
    // Force majeure — event-impacting flags to triage.
    admin
      .from('force_majeure_flags')
      .select('*', head)
      .in('status', ['open', 'under_review']),
    // Review appeals — self-review gate appeals awaiting a decision.
    admin.from('vendor_review_appeals').select('*', head).is('decided_at', null),
    // Setnayan AI abuse — trial-cycling flags to review.
    admin
      .from('concierge_abuse_flags')
      .select('*', head)
      .eq('status', 'pending_review'),
    // Two-admin approvals — pending requests awaiting a second admin (§9.1).
    admin
      .from('admin_approval_requests')
      .select('*', head)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString()),
    // Help — open help-center tickets.
    admin
      .from('help_messages')
      .select('*', head)
      .in('status', ['new', 'in_progress']),
  ]);

  const users = take(usersRes.count);
  const couples = take(couplesRes.count);
  const vendors = take(vendorUsersRes.count);
  const events = take(eventsRes.count);
  const vendorProfiles = take(vendorProfilesRes.count);
  const threads = take(threadsRes.count);
  const internal = take(internalRes.count);
  const teamPool = take(teamPoolRes.count);

  // Per-queue open counts.
  const q = {
    verify: take(verifyQueueRes.count),
    taxonomy: take(taxonomyReqRes.count),
    paymentOptions: take(paymentOptionsRes.count),
    payments: take(paymentsQueueRes.count),
    payouts: take(payoutsRes.count),
    tokenSales: take(tokenSalesRes.count),
    disputes: take(disputesQueueRes.count),
    forceMajeure: take(forceMajeureRes.count),
    appeals: take(appealsQueueRes.count),
    abuse: take(abuseRes.count),
    approvals: take(approvalsRes.count),
    help: take(helpRes.count),
  };

  // Lanes — mirror the Work nav grouping (Trust / Money / Recourse / Support).
  const lanes: {
    key: string;
    label: string;
    tiles: { label: string; value: number | null; sub: string; href: string }[];
  }[] = [
    {
      key: 'trust',
      label: 'Trust & supply',
      tiles: [
        {
          label: 'Vendors to verify',
          value: q.verify,
          sub: 'Coming-soon awaiting review',
          href: '/admin/verify',
        },
        {
          label: 'Taxonomy requests',
          value: q.taxonomy,
          sub: 'New category / refinement proposals',
          href: '/admin/taxonomy',
        },
        {
          label: 'Payment options',
          value: q.paymentOptions,
          sub: 'Vendor bank/QR links to screen',
          href: '/admin/payment-options',
        },
      ],
    },
    {
      key: 'money',
      label: 'Money to reconcile',
      tiles: [
        {
          label: 'Payments to confirm',
          value: q.payments,
          sub: 'Awaiting reconciliation',
          href: '/admin/payments?filter=pending',
        },
        {
          label: 'Payouts to release',
          value: q.payouts,
          sub: 'Verified T+1 schedule',
          href: '/admin/payouts',
        },
        {
          label: 'Token sales',
          value: q.tokenSales,
          sub: 'Vendor packs to confirm',
          href: '/admin/token-purchases',
        },
      ],
    },
    {
      key: 'recourse',
      label: 'Recourse',
      tiles: [
        {
          label: 'Open disputes',
          value: q.disputes,
          sub: 'Couple ↔ vendor conflicts',
          href: '/admin/disputes?status=open',
        },
        {
          label: 'Force majeure',
          value: q.forceMajeure,
          sub: 'Event-impacting flags',
          href: '/admin/force-majeure',
        },
        {
          label: 'Review appeals',
          value: q.appeals,
          sub: 'Self-review claims pending',
          href: '/admin/reviews?filter=pending',
        },
        {
          label: 'Setnayan AI abuse',
          value: q.abuse,
          sub: 'Trial-cycling flags',
          href: '/admin/concierge-abuse',
        },
      ],
    },
    {
      key: 'support',
      label: 'Approvals & support',
      tiles: [
        {
          label: 'Two-admin approvals',
          value: q.approvals,
          sub: 'A colleague needs your second sign-off',
          href: '/admin/approvals',
        },
        {
          label: 'Help tickets',
          value: q.help,
          sub: 'Open · 24-hr SLA',
          href: '/admin/help',
        },
      ],
    },
  ];

  // Total open across every queue — null counts treated as 0 so a transient
  // query error doesn't make the section read as "all clear".
  const totalOpen = Object.values(q).reduce<number>(
    (sum, v) => sum + Math.max(0, v ?? 0),
    0,
  );

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
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">Home</h1>
        <p className="text-base text-ink/65">
          What needs admin action right now — every pending queue at a glance,
          grouped the way <strong className="text-ink">Work</strong> is. Tap a
          card to clear it, or use <strong className="text-ink">Directory</strong>{' '}
          to look people up and <strong className="text-ink">More</strong> for
          money &amp; catalog config, insights, and platform settings.
        </p>
      </header>

      {/* One-off ops reminder · date-gated to 2026-12-08 (3 days before the
          Apple Sign-in client secret expires 2026-12-11). Renders null the
          rest of the year. See ./_apple-secret-reminder.tsx. */}
      <AppleSecretReminder />

      {/* COMMAND CENTER · action queues grouped by lane.
       *  Ops-shaped nav redesign (Admin_Console_Nav_Redesign_2026-06-08 ·
       *  owner sign-off 2026-06-08). Surfaces ALL pending queues — not just
       *  4 — so an admin lands and sees the whole workload without drilling.
       *  Lanes mirror the Work nav grouping; the "Money to reconcile" lane
       *  is the always-visible one-stop money view that satisfies the
       *  Money-lane sign-off condition (the dissolved Money group's queues,
       *  reunited here). */}
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
            {totalOpen === 0
              ? 'All queues clear · nothing pending.'
              : `${totalOpen} open across all queues`}
          </p>
        </div>

        <div className="space-y-5">
          {lanes.map((lane) => (
            <div key={lane.key}>
              <p className="mb-2 m-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                {lane.label}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {lane.tiles.map((t) => (
                  <ActionQueueTile
                    key={t.href}
                    label={t.label}
                    value={t.value}
                    sub={t.sub}
                    href={t.href}
                  />
                ))}
              </div>
            </div>
          ))}
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

      {/* Recent admin activity — real admin_audit_log entries (§3.4 of the
          redesign). Shows who-did-what so admins don't collide on the same row. */}
      <section className="mb-8 rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6">
        <h2 className="mb-3 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Recent admin activity
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-ink/55">No admin actions logged yet.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {activity.map((a) => (
              <li key={a.audit_log_id} className="flex items-start gap-3 py-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/60"
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
                <span className="shrink-0 text-xs text-ink/45">{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile href="/admin/users" icon="users" title="Users" body="Search, filter, flag team-pool members." />
        <Tile href="/admin/events" icon="calendar" title="Events" body="All events in the system + couple-side stats." />
        <Tile href="/admin/vendors" icon="briefcase" title="Vendors" body="Every vendor_profile + published status." />
        <Tile href="/admin/papic-sampler" icon="camera" title="Papic sampler" body="Free-sampler usage + cross-event abuse watch." />
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
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
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

function Stat({ label, value }: { label: string; value: number | null }) {
  // v2.1 KPI card — .m-card chrome + .m-mono label + tabular display number.
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
 *   1. Wraps in <Link> for one-click routing into the queue page with the
 *      matching default filter applied.
 *   2. Tone-graded · amber accent + AlertTriangle icon when value > 0, muted
 *      ink when value === 0. Admin's eye goes straight to tiles with work.
 *   3. Right-arrow affordance so the tile reads as a destination.
 *
 * Brand voice · concrete sub-line copy (no engineering jargon) per
 * [[feedback_setnayan_no_dev_text_post_launch]].
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
