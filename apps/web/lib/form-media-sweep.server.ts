import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2List } from '@/lib/r2';
import { cleanupDelete } from '@/lib/cleanup-delete';
import { vendorFormMediaScope } from '@/lib/cleanup-delete-scope';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { DAILY_GAP_MS } from '@/lib/periodic-job-registry';
import { FORM_MEDIA_BUCKET, formMediaFolder, formMediaOrphans } from '@/lib/form-media-sweep-core';

const SHOPS_PER_RUN = 200;

/**
 * 🧹 The form-media sweep (cron-free, `claim_periodic_job`): once a day, for each shop with forms, deletes the uploads
 * in its `forms/` folder that NO item references (live or retired) and that are older than the grace window —
 * `lib/form-media-sweep-core.ts` decides. Fired after the supplier's Forms page renders. Never throws past the runner;
 * a refused read throws so the run records a failure instead of a confident `0`.
 * rows_affected = objects deleted.
 */
export async function maybeRunFormMediaSweep(): Promise<void> {
  if (!isR2Configured()) return;
  await runClaimedJob('form-media-sweep', DAILY_GAP_MS, async () => {
    const admin = createAdminClient();
    const { data: shops, error } = await admin.from('vendor_forms').select('vendor_profile_id').limit(5000);
    if (error) throw new Error(`form shops read failed: ${error.message}`);
    const ids = [...new Set(((shops ?? []) as { vendor_profile_id: string }[]).map((s) => s.vendor_profile_id))].slice(0, SHOPS_PER_RUN);
    let deleted = 0;
    for (const shop of ids) {
      const { data: rows, error: qErr } = await admin
        .from('vendor_questions')
        .select('media_keys')
        .eq('vendor_profile_id', shop)
        .not('form_id', 'is', null)
        .eq('item_kind', 'media');
      if (qErr) throw new Error(`form media read failed: ${qErr.message}`);
      const refs = ((rows ?? []) as { media_keys: string[] | null }[]).flatMap((r) => r.media_keys ?? []);
      const folder = formMediaFolder(shop);
      const listed = await r2List({ bucket: FORM_MEDIA_BUCKET, prefix: folder });
      // Through the ONE delete choke point, pinned to this shop's forms folder (lib/cleanup-delete-scope.ts).
      const scope = vendorFormMediaScope(shop);
      for (const key of formMediaOrphans(listed.objects, refs, folder, Date.now())) {
        if ((await cleanupDelete(`r2://${FORM_MEDIA_BUCKET}/${key}`, scope)) === 'deleted') deleted += 1;
      }
    }
    return deleted;
  });
}
