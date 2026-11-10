import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  MILESTONE_CAPTIONS,
  MILESTONE_METRICS,
  milestoneToCelebrate,
  parseRealCounts,
} from '@/lib/social/lane-s';

/**
 * apps/web/lib/social/milestones.ts — the flush's milestone sweep (sweep c of `lib/social/flush.ts`), moved here
 * whole for BUILD 6 · LANE S (owner 2026-11-10) so it can be tested:
 *
 *   • the numbers come from ONE call, `social_milestone_real_counts()` (migration 20271336072378), which leaves out
 *     test and sample data — internal / team / admin accounts, `is_sample` events, demo shops. Before this the events
 *     and guests counts were a bare COUNT(*) over every row, sample and test events included;
 *   • a fourth metric, `users_joined` (real users only);
 *   • its own switch, `social_publish_settings.milestone_autopost_enabled` (default ON).
 *
 * Unchanged: aggregate numbers ONLY, never names ([[project_setnayan_behavioral_data_edge]] posture); for each metric
 * only the HIGHEST freshly crossed rung is celebrated; the social_milestones UNIQUE(metric, threshold) watermark is
 * written FIRST, so a milestone is insert-once even across concurrent flushes.
 *
 * 🔑 A count that cannot be read is SKIPPED, never guessed — and there is no fallback to a raw COUNT(*): a raw count
 * includes the test data this sweep exists to leave out.
 */

type Admin = SupabaseClient | ReturnType<typeof createAdminClient>;

/** Per-type switch · default ON when unreadable (mirrors recap_autopost_enabled). */
export async function isMilestoneAutopostEnabled(admin: Admin): Promise<boolean> {
  try {
    const { data } = await admin
      .from('social_publish_settings')
      .select('milestone_autopost_enabled')
      .eq('id', true)
      .maybeSingle();
    return (data as { milestone_autopost_enabled?: boolean | null } | null)?.milestone_autopost_enabled !== false;
  } catch {
    return true;
  }
}

export async function sweepMilestones(admin: Admin): Promise<void> {
  if (!(await isMilestoneAutopostEnabled(admin))) return;

  const { data: rawCounts, error: countErr } = await admin.rpc('social_milestone_real_counts');
  if (countErr) {
    logQueryError('runSocialFlush (milestone real counts)', countErr);
    return; // never guess — and never fall back to a count that includes test data
  }
  const counts = parseRealCounts(rawCounts);

  const { data: watermarkData, error: watermarkErr } = await admin
    .from('social_milestones')
    .select('metric, threshold');
  if (watermarkErr) {
    logQueryError('runSocialFlush (milestone watermarks)', watermarkErr);
    return;
  }
  const recorded = new Set(
    ((watermarkData ?? []) as Array<{ metric: string; threshold: number }>).map((w) => `${w.metric}:${w.threshold}`),
  );

  for (const metric of MILESTONE_METRICS) {
    const highest = milestoneToCelebrate(metric, counts[metric], recorded);
    if (highest === null) continue;

    // Watermark FIRST — UNIQUE(metric, threshold) is the idempotency gate.
    const { error: insertErr } = await admin.from('social_milestones').insert({ metric, threshold: highest });
    if (insertErr) {
      if (insertErr.code !== '23505') {
        logQueryError('runSocialFlush (milestone watermark insert)', insertErr, { metric });
      }
      continue; // another flush got here first
    }

    const { data: postData, error: postErr } = await admin
      .from('social_posts')
      .insert({
        source_type: 'milestone',
        source_ref: `${metric}:${highest}`,
        title: `Milestone · ${metric.replace(/_/g, ' ')} reached ${highest.toLocaleString('en-PH')}`,
        body: MILESTONE_CAPTIONS[metric](highest),
        link_url: 'https://www.setnayan.com',
      })
      .select('post_id')
      .single();
    if (postErr) {
      if (postErr.code !== '23505') {
        logQueryError('runSocialFlush (compose milestone)', postErr, { metric });
      }
      continue;
    }

    await admin
      .from('social_milestones')
      .update({ post_id: (postData as { post_id: string }).post_id })
      .eq('metric', metric)
      .eq('threshold', highest);
  }
}
