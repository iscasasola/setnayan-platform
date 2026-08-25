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
  compareQueuePriority,
  ageShort,
  ADMIN_QUEUE_META,
  ADMIN_LANE_ORDER,
  type AdminQueueDigest,
  type AdminQueueLane,
} from '@/lib/admin/queue-counts';
import { BASE_ROWS } from '@/lib/admin/work-rows';
import { requireAdmin } from '@/lib/admin/require-admin';
import { peekQueue } from '@/lib/admin/queue-peek';

export const metadata = { title: 'Work · Admin' };

// Worklist priority: overdue first, then due-soon, then open work (busiest),
// then unknown, then clear — from the SHARED comparator in
// lib/admin/queue-counts.ts, which the /admin Overview's busiest-queues preview
// now reads too. It used to be a private table here while the Overview sorted
// on volume alone, so the two screens disagreed about what was most urgent.
// BASE_ROWS order breaks ties within a band.

/* 🔑 A THIRD PRIVATE COPY OF THE LANE LIST, found by the new guard rather than
   by the finding that started this — which said "two admin screens". This one is
   a MEMBERSHIP set, not an order, so it never disagreed about ranking; it would
   simply have refused `?lane=<a fifth lane>` the day a fifth lane was added,
   silently, on a stale bookmark. One list now. */
const LANES = ADMIN_LANE_ORDER;

/** `?lane=` → a known lane, or undefined. An unknown value shows everything
 *  rather than 404-ing: a stale bookmark should degrade to the full list. */
function coerceLane(v: string | string[] | undefined): AdminQueueLane | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return (LANES as readonly string[]).includes(s ?? '')
    ? (s as AdminQueueLane)
    : undefined;
}

export default async function AdminWorkLanding({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Page-level gate (council fix #1 2026-07-09) — the admin layout alone is not
  // a safe auth boundary in front of the RLS-bypassing service-role client
  // getAdminQueueDigest() reaches below (layouts don't re-run on soft
  // navigation / crafted RSC requests), so a crafted RSC request from an
  // authenticated non-admin could otherwise leak per-queue open counts +
  // timestamps. MUST be the first statement, before any service-role read —
  // matches app/admin/page.tsx.
  const { userId: viewerUserId } = await requireAdmin();

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
    .sort(
      (a, b) =>
        compareQueuePriority(a, b) ||
        // Full tie ⇒ BASE_ROWS declaration order.
        a._index - b._index,
    )
    .map(({ _index, ...row }) => row as TriageItem);

  const totalOpen = rows.reduce(
    (sum, row) => sum + Math.max(0, row.count ?? 0),
    0,
  );

  // ?open=<queue> expands ONE row in place — URL-driven, same convention as
  // ?lane=, so the feed stays a Server Component, works with JS off, and an
  // opened queue is bookmarkable. Only the named row pays for a peek query.
  const sp = await searchParams;
  const lane = coerceLane(sp?.lane);
  const openRaw = sp?.open;
  const openKey = Array.isArray(openRaw) ? openRaw[0] : openRaw;

  // 🚨 THE REFUSALS WERE INVISIBLE. Every settle action writes `settle=` and
  // `why=` into this URL on a refusal — and nothing read them. The page redrew
  // identically to a success, and because the payment row had ALREADY flipped
  // to matched before the shortfall was detected, the row dropped out of the
  // list and the count ticked down. Every signal on screen said "done" while
  // the order sat unpaid with no receipt and nothing switched on.
  // 🔑 A GUARD THAT REFUSES IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT
  // PASSED. The payments page has shown this correctly all along; the work
  // list copied the message and never built the place to show it.
  const settleRaw = sp?.settle;
  const settle = Array.isArray(settleRaw) ? settleRaw[0] : settleRaw;
  const whyRaw = sp?.why;
  const why = Array.isArray(whyRaw) ? whyRaw[0] : whyRaw;
  const withPeek: TriageItem[] = openKey
    ? await Promise.all(
        ordered.map(async (row) =>
          row.key === openKey ? { ...row, peek: await peekQueue(row.key, viewerUserId) } : row,
        ),
      )
    : ordered;

  // `totalOpen` stays the FULL total even when a lane is chosen — the subtitle
  // and the triage strip describe the whole day; only the rows below narrow.
  return (
    <QueuesTriageFeed
      settle={settle}
      why={why}
      title="Work"
      items={withPeek}
      totalOpen={totalOpen}
      lane={lane}
      basePath="/admin/work"
      openKey={openKey}
    />
  );
}
