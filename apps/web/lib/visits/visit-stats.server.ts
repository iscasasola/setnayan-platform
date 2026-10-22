import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { addDays, manilaDay, parseVisitSummary, type VisitStats } from '@/lib/visits/visit-stats';

/**
 * VISITS · the read the Visits tab makes — through the service role, behind
 * requireAdmin() (the surface calls that first). One aggregate RPC
 * (`site_visit_summary`, migration 20271282829207) for the visits, and two
 * exact head-counts for the funnel's other two steps: sign-ups (`users`
 * created in the window) and paid orders (`orders` paid / fulfilled, created
 * in the window — the cockpit's REALIZED_ORDER_STATUSES).
 *
 * Each of the three is measured on its own; a refusal leaves THAT one null
 * (the tab says "couldn't read"), never 0.
 */

const REALIZED_ORDER_STATUSES = ['paid', 'fulfilled'] as const;

export async function fetchVisitStats(days: number): Promise<VisitStats> {
  const untilDay = manilaDay();
  const sinceDay = addDays(untilDay, -(days - 1));
  // The window opens at Manila midnight of the first day.
  const sinceIso = new Date(`${sinceDay}T00:00:00+08:00`).toISOString();
  const admin = createAdminClient();

  const [summary, signUps, paidOrders] = await Promise.all([
    (async () => {
      try {
        const { data, error } = await admin.rpc('site_visit_summary', { p_since: sinceDay, p_until: untilDay });
        if (error) {
          logQueryError('visits (site_visit_summary)', error);
          return null;
        }
        const parsed = parseVisitSummary(data);
        if (!parsed) logQueryError('visits (site_visit_summary shape)', new Error('unexpected shape'));
        return parsed;
      } catch (e) {
        logQueryError('visits (site_visit_summary)', e);
        return null;
      }
    })(),
    (async () => {
      try {
        const { count, error } = await admin
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', sinceIso);
        if (error || count === null) {
          logQueryError('visits (sign-ups)', error ?? new Error('no count'));
          return null;
        }
        return count;
      } catch (e) {
        logQueryError('visits (sign-ups)', e);
        return null;
      }
    })(),
    (async () => {
      try {
        const { count, error } = await admin
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', [...REALIZED_ORDER_STATUSES])
          .gte('created_at', sinceIso);
        if (error || count === null) {
          logQueryError('visits (paid orders)', error ?? new Error('no count'));
          return null;
        }
        return count;
      } catch (e) {
        logQueryError('visits (paid orders)', e);
        return null;
      }
    })(),
  ]);

  return { sinceDay, untilDay, summary, signUps, paidOrders };
}
