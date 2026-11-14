import type { SupabaseClient } from '@supabase/supabase-js';
import { pageName } from '@/lib/telemetry/problem-line';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * Problems · how rows become the list a person reads, and how many there are. Pure of `server-only` on purpose: the
 * Problems page (`fault-issues.server.ts`) and the Work count (`lib/admin/queue-counts.ts`) both use it, so the two
 * numbers come from one rule.
 */

/**
 * 🔁 ONE ROW PER PROBLEM A PERSON CAN TELL APART (admin walk 13 Nov 2026, F-A-16: Problems listed the same sentence
 * twice). Two fingerprints can differ only in a detail the line does not show — two event ids on one route, two
 * messages from one button — and they then read as identical rows. Rows with the same kind, action, label and named
 * page merge: their counts add up, the newest one's trace and dates lead. Order is kept (first row of each group).
 */
export function mergeSameProblem(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const groups = new Map<string, Record<string, unknown>>();
  const order: string[] = [];
  for (const row of rows) {
    const key = [row.kind, row.action, row.label ?? '', pageName(row.page as string | null) ?? ''].join('|');
    const had = groups.get(key);
    if (!had) {
      groups.set(key, { ...row });
      order.push(key);
      continue;
    }
    const newer = String(row.last_seen ?? '') > String(had.last_seen ?? '');
    const merged = newer ? { ...row } : { ...had };
    merged.hit_count = Number(had.hit_count ?? 0) + Number(row.hit_count ?? 0);
    merged.day_count = Number(had.day_count ?? 0) + Number(row.day_count ?? 0);
    merged.reopened_count = Math.max(Number(had.reopened_count ?? 0), Number(row.reopened_count ?? 0));
    merged.first_seen = String(had.first_seen ?? '') < String(row.first_seen ?? '') ? had.first_seen : row.first_seen;
    merged.id = had.id;
    groups.set(key, merged);
  }
  return order.map((k) => groups.get(k)!);
}

/**
 * 🔢 RW-285e (live walk, 14 Nov 2026): Work said "71 problems" while Problems listed 67. Work counted raw open rows;
 * the page shows them after `mergeSameProblem` folds rows a person cannot tell apart. ONE count now: this reads the
 * same open rows the page reads and merges them the same way, so the number on Work is the number of rows on Problems.
 * A refused read is `null` — not measured, never zero.
 */
export async function countOpenProblems(
  admin: SupabaseClient,
): Promise<{ count: number | null; oldestAt: string | null }> {
  const { data, error } = await admin
    .from('app_fault_issues')
    .select('kind,action,label,page,hit_count,day_count,reopened_count,first_seen,last_seen,id')
    .eq('status', 'open')
    .limit(5000);
  if (error) {
    logQueryError('countOpenProblems: app_fault_issues', error, {}, 'graceful_degrade');
    return { count: null, oldestAt: null };
  }
  const merged = mergeSameProblem((data ?? []) as Record<string, unknown>[]);
  const oldestAt = merged.reduce<string | null>((o, r) => {
    const f = (r.first_seen as string | null) ?? null;
    return f && (!o || f < o) ? f : o;
  }, null);
  return { count: merged.length, oldestAt };
}
