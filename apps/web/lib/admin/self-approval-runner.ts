/**
 * maybeRunOwnerApprovals — the cron-free trigger for the owner's own requests
 * whose 24-hour wait has passed (DECISION_LOG 2026-11-13). This project has no
 * scheduler ([[project_setnayan_cron_free]]): like the morning digest, it rides
 * page traffic via `after()` — from `/` (public, so it still runs when the
 * owner is away from the console) and from the approvals and team pages.
 *
 * Throttled per instance so the after() hooks cost ~nothing; the real guard
 * against running a row twice is the atomic claim inside the runner, and the
 * guard against running it EARLY is the database's own clock
 * (guard_owner_self_approval). A request runs shortly after its 24 hours, when
 * the next visitor arrives — never before.
 */

const CHECK_THROTTLE_MS = 5 * 60 * 1000;
let lastCheckMs = 0;

export async function maybeRunOwnerApprovals(opts: { force?: boolean } = {}): Promise<void> {
  const nowMs = Date.now();
  if (!opts.force && nowMs - lastCheckMs < CHECK_THROTTLE_MS) return;
  lastCheckMs = nowMs;
  try {
    const { adminTeamAct } = await import('@/app/admin/approvals/actions');
    const fd = new FormData();
    fd.set('op', 'run_due');
    await adminTeamAct(fd);
  } catch (e) {
    console.error('[owner self-approval] runner failed', e instanceof Error ? e.message : e);
  }
}
