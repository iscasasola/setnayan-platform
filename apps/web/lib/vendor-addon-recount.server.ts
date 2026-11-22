import 'server-only';

/**
 * ⏳ A "+1" ADD-ON'S 28 DAYS END EVEN WHEN NOTHING HAPPENS TO ITS ORDER (review 2026-11-19: "one payment keeps the
 * add-on forever").
 *
 * The four "+1" add-ons (category · service card · wait list · booking per date) and the single extra seat
 * (`extra_agent_seats` — controller ruling on PR #8019, 22 Nov) keep a STORED count on
 * `vendor_profiles`, recomputed by the activation hook from the paid orders whose window covers now. A window that
 * lapses with no refund and no new payment fires no hook — so without this run the stored count would keep granting
 * room nobody is paying for. `recount_vendor_count_addons()` re-counts every shop that holds one and writes the live
 * number (it only ever lowers a count to what is still paid for). Hourly, request-driven like every job here
 * (`claim_periodic_job`); `rows_affected` = shops whose count changed.
 *
 * The Ultra Add-on needs no run: it has no stored count (`vendor_live_ultra_addons` reads the windows live).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { COUNT_ADDON_RECOUNT_GAP_MS } from '@/lib/periodic-job-registry';

export async function maybeRecountLapsedAddOns(): Promise<void> {
  await runClaimedJob('count-addon-recount', COUNT_ADDON_RECOUNT_GAP_MS, async () => {
    const { data, error } = await createAdminClient().rpc('recount_vendor_count_addons');
    if (error) throw new Error(`recount_vendor_count_addons failed: ${error.message}`);
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  });
}
