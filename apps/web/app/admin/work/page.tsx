/**
 * /admin/work — the admin command center: every act-now queue in ONE ranked
 * worklist, most-urgent first, each row one click into the work.
 *
 * WHY: ~95% of admin sessions are "clear a queue." Instead of remembering to
 * check 14 separate pages, the admin lands on a single list that already knows
 * what needs them and in what order — overdue first (past its SLA window),
 * then due-soon, then busiest. Ranking + the per-queue "open" filters come from
 * the shared lib/admin/queue-counts.ts helpers, so this feed, the nav badges,
 * and the /admin overview all agree by construction.
 *
 * Urgency = the oldest open item's age vs the queue's slaHours (ADMIN_QUEUE_META
 * — owner-tunable). A queue whose timestamp is unavailable degrades to volume
 * ranking; a thrown query fails the whole feed open to "all clear" rather than
 * 500-ing. Renders at every breakpoint (the feed component handles the
 * responsive layout) — it's the desktop home as well as the mobile Work tab.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] all copy is brand-voice;
 * no schema names leak into the UI.
 */

import {
  QueuesTriageFeed,
  type TriageItem,
} from '../queues/_components/queues-triage-feed';
import {
  getAdminQueueDigest,
  computeDueState,
  ageShort,
  ADMIN_QUEUE_META,
  type AdminQueueDigest,
} from '@/lib/admin/queue-counts';
import { BASE_ROWS } from '@/lib/admin/work-rows';
import { requireAdmin } from '@/lib/admin/require-admin';

export const metadata = { title: 'Work · Admin' };

// Worklist priority: overdue first, then due-soon, then open work (busiest),
// then unknown, then clear — canonical order breaks ties within a band.
const DUE_RANK: Record<string, number> = {
  overdue: 0,
  'due-soon': 1,
  ok: 2,
  unknown: 3,
  clear: 4,
};

export default async function AdminWorkLanding() {
  // Page-level gate (council fix #1 2026-07-09) — the admin layout alone is not
  // a safe auth boundary in front of the RLS-bypassing service-role client
  // getAdminQueueDigest() reaches below (layouts don't re-run on soft
  // navigation / crafted RSC requests), so a crafted RSC request from an
  // authenticated non-admin could otherwise leak per-queue open counts +
  // timestamps. MUST be the first statement, before any service-role read —
  // matches app/admin/page.tsx.
  await requireAdmin();

  // One round-trip per queue (count + oldest-open age). Fails open: a thrown
  // query degrades the whole feed to "all clear" rather than 500-ing.
  const digest = await getAdminQueueDigest().catch(() => ({}) as AdminQueueDigest);
  const nowMs = Date.now();

  const rows: TriageItem[] = BASE_ROWS.map((base, index) => {
    const d = digest[base.key] ?? { count: null, oldestAt: null };
    const meta = ADMIN_QUEUE_META[base.key];
    const slaHours = meta?.slaHours ?? 48;
    const dueState = computeDueState(d, slaHours, nowMs);
    const age = ageShort(d.oldestAt, nowMs);

    let ageLabel: string | undefined;
    if (age && dueState === 'overdue') ageLabel = `Oldest ${age} · past SLA`;
    else if (age && dueState === 'due-soon') ageLabel = `Oldest ${age} · due soon`;
    else if (age && dueState === 'ok') ageLabel = `Oldest ${age}`;

    return {
      ...base,
      count: d.count,
      lane: meta?.lane,
      dueState,
      ageLabel,
      _index: index,
    } as TriageItem & { _index: number };
  });

  const ordered = (rows as (TriageItem & { _index: number })[])
    .slice()
    .sort((a, b) => {
      const ra = DUE_RANK[a.dueState ?? 'unknown'] ?? 3;
      const rb = DUE_RANK[b.dueState ?? 'unknown'] ?? 3;
      if (ra !== rb) return ra - rb;
      const ca = a.count ?? 0;
      const cb = b.count ?? 0;
      if (cb !== ca) return cb - ca;
      return a._index - b._index;
    })
    .map(({ _index, ...row }) => row as TriageItem);

  const totalOpen = rows.reduce(
    (sum, row) => sum + Math.max(0, row.count ?? 0),
    0,
  );

  return <QueuesTriageFeed title="Work" items={ordered} totalOpen={totalOpen} />;
}
