/**
 * Insights › Overview — what the old /admin Overview carried that is a NUMBER
 * to read, not work to do: the standing totals, What you change, and Recent
 * admin activity.
 *
 * Moved here byte-for-byte from the old `app/admin/page.tsx` when Work › All
 * became the one Needs-action list (owner 13 Nov: *"we do not want the old
 * page"*). The approved drawing puts them exactly here
 * (`prototypes/admin_five_tabs_2026-11-13/insights.html` › Overview:
 * "Standing totals", "What you change · 90 days", "Recent admin activity").
 * The activity rows keep their place until the avatar's Admin log ships
 * (slice 2, #7585) — then this section can point there.
 *
 * Honest reads kept as they were: a refused count prints "—" (KpiStatCard),
 * a refused log read says "Couldn’t load this", never "No admin actions".
 */
import { KpiStatCard } from '../../_components/kpi-stat-card';
import { WhatYouChange } from '../../_components/what-you-change';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchWhatYouChange } from '@/lib/admin/what-you-change';

function take(c: number | null | undefined): number | null {
  return typeof c === 'number' ? c : null;
}

export async function AdminTotalsSurface() {
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
    // 🧪 Demo events and demo shops are not real totals (owner 2026-11-06, `lib/demo-never-counts.test.ts`).
    admin.from('events').select('*', head).eq('is_sample', false),
    admin.from('vendor_profiles').select('*', head).eq('is_demo', false),
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

  const whatYouChange = await fetchWhatYouChange(admin);
  const { data: auditRows, error: auditError } = await admin
    .from('admin_audit_log')
    .select('audit_log_id, action, target_id, reason, actor_user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  if (auditError) {
    logQueryError('InsightsOverview (admin_audit_log)', auditError, {}, 'graceful_degrade');
  }
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
    <div className="mt-8">
      <h2 className="sn-sec mb-3">Standing totals</h2>
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStatCard label="All users" value={users} />
        <KpiStatCard label="Couples" value={couples} />
        <KpiStatCard label="Supplier users" value={vendors} />
        <KpiStatCard label="Events" value={events} />
        <KpiStatCard label="Supplier profiles" value={vendorProfiles} />
        <KpiStatCard label="Chat threads" value={threads} />
        <KpiStatCard label="Internal accounts" value={internal} />
        <KpiStatCard label="Team members" value={teamPool} />
      </section>

      <WhatYouChange counts={whatYouChange} />

      {/* Recent admin activity — real admin_audit_log entries (§3.4 of the
          redesign). Shows who-did-what so admins don't collide on the same row.
          Glass PR-8: ONE glass `.sn-tile` panel (below the fold, within the blur
          budget); the audit rows stay opaque (divide-y, no per-row blur). */}
      <section className="sn-tile mb-8">
        <h2 className="sn-sec mb-3">Recent admin activity</h2>
        {auditError ? (
          <p role="alert" className="text-sm text-[color:var(--sn-ink-500)]">
            Couldn&rsquo;t load this — refresh to try again.
          </p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-[color:var(--sn-ink-500)]">No admin actions logged yet.</p>
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
                    className={`hidden shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] sm:inline-flex ${chip.pill}`}
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
  demo_vendors_create_start: 'started creating demo suppliers',
  user_team_member_toggle: 'changed a team-member flag',
  user_team_member_requested: 'asked a second admin to add a team member',
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
 * Status chip for an admin_audit_log row — an OUTCOME tone read straight off
 * the action code (no extra data). Done/approved reads positive, reject / fail
 * / delete / ban reads negative, everything else neutral. Drives both the small
 * pill label and the leading dot colour in the activity feed.
 */
function activityChip(action: string): { label: string; pill: string; dot: string } {
  const a = (action.split(':')[0] ?? action).toLowerCase();
  const has = (...needles: string[]) => needles.some((n) => a.includes(n));
  if (has('reject', 'fail', 'delete', 'ban', 'decline', 'remove', 'disable', 'suspend')) {
    return {
      label: 'action',
      pill: 'bg-[var(--sn-danger-soft)] text-[color:var(--sn-danger)]',
      dot: 'bg-[var(--sn-danger)]',
    };
  }
  if (has('approve', 'confirm', 'promote', 'verify', 'release', 'enable', 'map', 'resolve', 'create', 'add')) {
    return {
      label: 'done',
      pill: 'bg-[var(--sn-success-soft)] text-[color:var(--sn-success)]',
      dot: 'bg-[var(--sn-success)]',
    };
  }
  return {
    label: 'update',
    pill: 'bg-ink/5 text-[color:var(--sn-ink-500)]',
    dot: 'bg-[var(--sn-gold-300)]',
  };
}

