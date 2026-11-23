import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { recordsMeasureClaimGapMs } from '@/lib/supplier-storage';

/**
 * 📏 THE NIGHTLY RECORDS MEASURE, CRON-FREE — what every shop's DATA weighs (migration 20271360925434,
 * `supplier_storage_measure_records(NULL)`: every shop, one pass per table).
 *
 * There is no scheduler and cron.job stays empty. This rides request traffic like every other periodic job
 * (`runClaimedJob`), carried by the homepage and the admin console (both guards list it). Its window is one Manila
 * night from 03:00 (`recordsMeasureClaimGapMs`): the first request after 03:00 runs it, so a quiet night catches up on
 * the next request, and the claim never lets it run twice in one window. The run is recorded (shops written, or the
 * failure) on /admin/data-privacy like every claimed job. Never throws.
 */
export async function maybeRunSupplierStorageMeasure(nowMs: number = Date.now()): Promise<void> {
  // The key is a literal: lib/jobs-close-what-they-claim.test.ts counts `runClaimedJob('<key>'` call sites.
  await runClaimedJob('supplier-storage-records', recordsMeasureClaimGapMs(nowMs), async () => {
    const { data, error } = await createAdminClient().rpc('supplier_storage_measure_records', { p_vendor_profile_id: null });
    if (error) throw new Error(`supplier_storage_measure_records: ${error.message}`);
    return typeof data === 'number' ? data : null;
  });
}
