'use server';

/**
 * Manual re-run for the SEO/GEO audit.
 *
 * WHY THIS EXISTS. The audit is cron-free: `app/admin/layout.tsx` fires
 * `runSeoPeriodicJobs()` inside `after()`, claim-gated to roughly once a day. That
 * has two consequences an admin cannot work around by reloading:
 *   1. `after()` runs AFTER the response is flushed, so the snapshot you are
 *      looking at is always the PREVIOUS one — your refresh lands on the next load.
 *   2. The claim gate ignores you until ~24h have elapsed, so hammering reload
 *      does nothing at all.
 * This action calls the two jobs DIRECTLY, bypassing `claimPeriodicJob`, so a
 * price edit can be confirmed in seconds instead of tomorrow.
 *
 * ⚠ SECURITY. The /admin layout gating protects the PAGE, not this action — a
 * server action is independently invocable by anyone who can guess its id, so the
 * admin check has to live here. Same shape as app/admin/songs/actions.ts.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { runSeoHealthAudit, runSeoGscPull } from '@/lib/seo/seo-cron-jobs';

// Mirrors the /admin/pricing requireAdmin gate (defense-in-depth — the /admin
// layout already 404s non-admins, but server actions re-check).
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
}

export type RerunResult = {
  ok: boolean;
  /** Human-readable outcome for the button to echo back. */
  message: string;
};

export async function rerunSeoAudit(): Promise<RerunResult> {
  await requireAdmin();

  const health = await runSeoHealthAudit();
  const gsc = await runSeoGscPull();

  // Fresh snapshot is in the table; re-render the surface so it shows THIS run
  // rather than the one before it.
  revalidatePath('/admin/app-performance');

  if (!health.ok) {
    return { ok: false, message: 'Health audit failed to write a snapshot — check server logs.' };
  }

  // Be honest about the half that did nothing. Search Console is unconfigured
  // until the owner pastes GOOGLE_SITE_VERIFICATION / the GSC credentials into
  // Vercel env, and silently reporting "done" would hide that.
  const gscNote = gsc.skipped
    ? ' Search Console skipped — not configured.'
    : gsc.ok
      ? ` Search Console: ${gsc.days ?? 0} day(s) pulled.`
      : ' Search Console pull failed — check server logs.';

  const drift = health.drift ?? 0;
  return {
    ok: true,
    message: `Audit re-run. ${drift} price-drift entr${drift === 1 ? 'y' : 'ies'}.${gscNote}`,
  };
}
