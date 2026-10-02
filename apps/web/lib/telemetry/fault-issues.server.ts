import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { currentBuildSha } from '@/lib/telemetry/fault-log';
import { FLOWS, funnelOf, type FunnelStep } from '@/lib/telemetry/flows';
import { problemLine } from '@/lib/telemetry/problem-line';
import { formatCount } from '@/lib/format-number';
import { resolveActionName } from '@/lib/telemetry/server-fault';

/**
 * Problems · THE READ. One server-only function that answers "what is broken,
 * most-hit and newest first" — used by the admin Problems list
 * (/admin/app-performance?tab=connection-logs) and available to the
 * controller to feed the change tracker's "Fixing" section. NOT a route: no
 * public surface, nothing new to authorise. From a session with database
 * access the same answer is:
 *
 *     select kind, action, label, page, message, hit_count, day_count, first_seen,
 *            last_seen, last_build_sha, status
 *       from app_fault_issues
 *      where status = 'open'
 *      order by hit_count desc, last_seen desc;
 *
 * It runs the self-closing rule first (`close_quiet_fault_issues`: an issue is
 * closed once a newer build is live and it has not recurred for 48 h) — this
 * repo has no scheduler by design, so the list closes what is quiet each time
 * it is read, and `record_app_fault` reopens anything that recurs.
 */

export type FaultIssue = {
  id: string;
  kind: string;
  action: string;
  label: string | null;
  page: string | null;
  message: string;
  hit_count: number;
  day_count: number;
  day_date: string | null;
  first_seen: string;
  last_seen: string;
  first_build_sha: string | null;
  last_build_sha: string | null;
  status: 'open' | 'closed' | 'ignored';
  closed_at: string | null;
  reopened_count: number;
  last_trace: Record<string, unknown>;
  /** The one plain line a person reads. */
  line: string;
};

export type DropOff = {
  flow: string;
  label: string;
  steps: FunnelStep[];
  worst: FunnelStep | null;
  started: number;
  finished: number;
  /** The one plain line, like an issue's. */
  line: string;
  /** Same shape as an issue's fingerprint: kind + flow + step. */
  fingerprint: string;
};

export type FaultIssuesRead =
  | { ok: true; open: FaultIssue[]; closed: FaultIssue[]; dropOffs: DropOff[]; closedNow: number; build: string | null }
  | { ok: false };

const ISSUE_COLS =
  'id,kind,action,label,page,message,hit_count,day_count,day_date,first_seen,last_seen,first_build_sha,last_build_sha,status,closed_at,reopened_count,last_trace';

export function manilaToday(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Display name for a still-unresolved `action:<id>` key. */
function prettyAction(action: string): string {
  const m = /^action:([0-9a-f]+)$/i.exec(action);
  return (m && resolveActionName(m[1])) || action;
}

export async function readFaultIssues(opts: { limit?: number; flowDays?: number } = {}): Promise<FaultIssuesRead> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const flowDays = Math.min(Math.max(opts.flowDays ?? 14, 1), 90);
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false };
  }
  const build = currentBuildSha();
  let closedNow = 0;
  if (build) {
    const { data } = await admin.rpc('close_quiet_fault_issues', { p_current_sha: build });
    closedNow = typeof data === 'number' ? data : 0;
  }

  const today = manilaToday();
  const since = manilaToday(new Date(Date.now() - flowDays * 86400_000));
  const [openRes, closedRes, todayRes, flowRes] = await Promise.all([
    admin
      .from('app_fault_issues')
      .select(ISSUE_COLS)
      .eq('status', 'open')
      .order('hit_count', { ascending: false })
      .order('last_seen', { ascending: false })
      .limit(limit),
    admin
      .from('app_fault_issues')
      .select(ISSUE_COLS)
      .in('status', ['closed', 'ignored'])
      .order('last_seen', { ascending: false })
      .limit(30),
    admin.from('app_action_daily_counts').select('action,ok_count,fail_count').eq('day', today).limit(5000),
    admin
      .from('app_action_daily_counts')
      .select('action,ok_count')
      .gte('day', since)
      .like('action', 'flow:%')
      .limit(5000),
  ]);
  // A refused read is NOT an all-clear (the 2026-09-30 admin audit, row 9).
  if (openRes.error || closedRes.error || todayRes.error || flowRes.error) return { ok: false };

  const rates = new Map<string, { ok: number; fail: number }>();
  for (const r of (todayRes.data ?? []) as Array<{ action: string; ok_count: number; fail_count: number }>) {
    rates.set(r.action, { ok: Number(r.ok_count), fail: Number(r.fail_count) });
  }

  const shape = (row: Record<string, unknown>): FaultIssue => {
    const i = row as unknown as FaultIssue;
    const action = prettyAction(i.action);
    const rate = rates.get(i.action);
    return {
      ...i,
      action,
      hit_count: Number(i.hit_count),
      day_count: Number(i.day_count),
      line: problemLine({
        kind: i.kind,
        action,
        label: i.label,
        page: i.page,
        dayCount: Number(i.day_count),
        dayDate: i.day_date,
        today,
        failures: rate?.fail,
        successes: rate?.ok,
      }),
    };
  };

  const reached = new Map<string, Record<string, number>>();
  for (const r of (flowRes.data ?? []) as Array<{ action: string; ok_count: number }>) {
    const [, flow, step] = r.action.split(':');
    if (!flow || !step) continue;
    const m = reached.get(flow) ?? {};
    m[step] = (m[step] ?? 0) + Number(r.ok_count);
    reached.set(flow, m);
  }
  const dropOffs: DropOff[] = [];
  for (const flow of FLOWS) {
    const counts = reached.get(flow.flow);
    if (!counts) continue;
    const { steps, worst } = funnelOf(flow, counts);
    const started = steps[0]?.reached ?? 0;
    const finished = steps[steps.length - 1]?.reached ?? 0;
    if (started === 0) continue;
    dropOffs.push({
      flow: flow.flow,
      label: flow.label,
      steps,
      worst,
      started,
      finished,
      fingerprint: `DROP_OFF|${flow.flow}|${worst?.step ?? '-'}`,
      line: worst
        ? `${flow.label} — most people stop after "${worst.step.replace(/_/g, ' ')}" · ${formatCount(worst.stoppedHere)} of ${formatCount(started)} in ${flowDays} days · ${formatCount(finished)} finished`
        : `${flow.label} — nobody stops early · ${formatCount(finished)} of ${formatCount(started)} finished in ${flowDays} days`,
    });
  }
  dropOffs.sort((a, b) => (b.worst?.stoppedHere ?? 0) - (a.worst?.stoppedHere ?? 0));

  return {
    ok: true,
    open: ((openRes.data ?? []) as Record<string, unknown>[]).map(shape),
    closed: ((closedRes.data ?? []) as Record<string, unknown>[]).map(shape),
    dropOffs,
    closedNow,
    build,
  };
}
