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
 * ranking; a thrown query degrades every queue to "couldn't be read" (count
 * null) rather than 500-ing — and NEVER to "all clear". Renders at every breakpoint (the feed component handles the
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
import { loadSupplierWork } from '@/lib/admin/supplier-work.server';
import { coerceSupplierWorkKind } from '@/lib/admin/supplier-work';
import { createAdminClient } from '@/lib/supabase/admin';
import { SupplierInbox } from './_components/supplier-inbox';
import { Suspense } from 'react';
import { NoticeSlot } from '@/app/_components/notices/notices';
import { AppleSecretReminder } from '../_apple-secret-reminder';
import { EmailDeliveryStrip } from '../_email-delivery-strip';
import { readPaymentLights, type PaymentLightsRead } from '@/lib/admin/green-payments.server';
import { withReceiptVerdicts } from '@/lib/admin/payment-verdicts.server';
import type { GreenBatch } from '../queues/_components/green-batch';

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

  // One round-trip per queue (count + oldest-open age). A thrown digest leaves
  // every row at `count: null`, which the feed renders as "couldn't be read" —
  // never as an all-clear (admin audit 2026-09-30, row 5).
  const digest = await getAdminQueueDigest().catch(() => ({}) as AdminQueueDigest);
  const nowMs = Date.now();
  // ➕ The green / held sort behind "Approve all N green" — read once, used by
  // the payments row's button AND (when opened) its drawer. Only when there is
  // something pending: an empty or unreadable queue needs no sort.
  const paymentLights: PaymentLightsRead | undefined =
    (digest.payments?.count ?? 0) > 0 ? await readLightsWithVerdicts() : undefined;
  const greenBatch: GreenBatch | undefined = paymentLights
    ? paymentLights.ok
      ? { ok: true, rows: paymentLights.rows }
      : { ok: false }
    : undefined;

  const rows: TriageItem[] = BASE_ROWS.map((base, index) => {
    const d = digest[base.key] ?? { count: null, oldestAt: null };
    const meta = ADMIN_QUEUE_META[base.key];
    /* 🪤 `meta?.slaHours ?? 48` turned a queue with NO CLOCK (`null`, the
       partnerships rule) back into a 48-hour promise, because `??` cannot tell
       "no clock" from "no meta". Only a queue missing from the meta defaults. */
    const slaHours = meta ? meta.slaHours : 48;
    const dueState = computeDueState(d, slaHours, nowMs);
    const age = ageShort(d.oldestAt, nowMs);

    let ageLabel: string | undefined;
    if (meta?.watchOnly) ageLabel = 'In the last 7 days — you only watch these';
    else if (age && dueState === 'overdue') ageLabel = `Oldest ${age} · past SLA`;
    else if (age && dueState === 'due-soon') ageLabel = `Oldest ${age} · due soon`;
    // ⏳ F-A-05: a queue with no promise says so — its oldest item is not "on pace", it has no clock at all.
    else if (age && dueState === 'ok' && meta?.slaHours === null) ageLabel = `Oldest ${age} · no set time`;
    else if (age && dueState === 'ok') ageLabel = `Oldest ${age}`;

    return {
      ...base,
      count: d.count,
      lane: meta?.lane,
      dueState,
      ageLabel,
      watchOnly: meta?.watchOnly === true,
      noPromise: meta?.slaHours === null,
      // ➕ "Approve all N green" lives on the payments row itself (admin slice 4).
      greenBatch: base.key === 'payments' && (d.count ?? 0) > 0 ? greenBatch : undefined,
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
    // A trail to watch is not work waiting (ADMIN_QUEUE_META `watchOnly`).
    (sum, row) => (row.watchOnly ? sum : sum + Math.max(0, row.count ?? 0)),
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
          row.key === openKey
            ? { ...row, peek: await peekQueue(row.key, viewerUserId, { paymentLights }) }
            : row,
        ),
      )
    : ordered;

  // ➕ WHAT SUPPLIERS SENT (admin supplier slice, owner 2026-10-28: "A") — every row done in place, above the queues.
  // `?kind=` is its chip, `?item=` its open row; both ride the same address as `?lane=` / `?open=`.
  const supplierKind = coerceSupplierWorkKind(sp?.kind);
  const itemRaw = sp?.item;
  const itemKey = Array.isArray(itemRaw) ? itemRaw[0] : itemRaw;
  const admin = createAdminClient();
  const [supplierRead, typesRead] = await Promise.all([
    loadSupplierWork(),
    admin.from('event_type_vocab').select('event_type, label_en, sort_order').eq('status', 'active').order('sort_order'),
  ]);
  const keep = new URLSearchParams();
  if (lane) keep.set('lane', lane);
  if (openKey) keep.set('open', openKey);
  if (supplierKind) keep.set('kind', supplierKind);
  const basePath = keep.toString() ? `/admin/work?${keep.toString()}` : '/admin/work';

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
      lead={
        <>
        {/* ➕ "ALSO WAITING" (approved drawing, work.html) — the two engine-room
            reminders that used to sit on the old /admin Overview. Each renders
            ONLY when there is something to do (the Apple secret from Dec 8; an
            email that did not arrive, an unreadable log, or email switched off),
            so a healthy day draws nothing here. The email strip streams behind
            its own Suspense so a slow log read never holds the list. */}
        {/* 🔔 The page's top for notices (ONE NOTICE SYSTEM, owner approved 14 Nov 2026): the two reminders below
            register here; at most two lines show, the rest wait in the bell. */}
        <NoticeSlot place="top" className="mb-4" />
        <AppleSecretReminder />
        <Suspense fallback={null}>
          <EmailDeliveryStrip />
        </Suspense>
        <SupplierInbox
          read={supplierRead}
          kind={supplierKind}
          itemKey={itemKey}
          basePath={basePath}
          eventTypes={((typesRead.data ?? []) as Array<{ event_type: string; label_en: string }>).map((t) => ({ key: t.event_type, label: t.label_en }))}
          nowMs={nowMs}
        />
        </>
      }
    />
  );
}

/**
 * The payments row's green / held sort, then the receipt read's line on each
 * row for DISPLAY. Two steps on purpose: the sort is what the batch re-checks
 * with, and it never sees what a model read (lib/admin/payment-verdicts.server.ts).
 */
async function readLightsWithVerdicts(): Promise<PaymentLightsRead> {
  try {
    const admin = createAdminClient();
    const lights = await readPaymentLights(admin);
    if (!lights.ok) return lights;
    return { ...lights, rows: await withReceiptVerdicts(admin, lights.rows) };
  } catch {
    return { ok: false };
  }
}
