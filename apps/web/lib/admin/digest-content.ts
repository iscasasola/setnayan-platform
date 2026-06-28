/**
 * Pure content for the admin morning digest email — the lane rollup + the
 * subject/text/html builder. No `server-only` deps (imports only the pure
 * queue-counts types/meta + the dependency-free email template), so it's unit-
 * testable in plain node. The IO (claim, fetch, send) lives in digest-flush.ts.
 */

import { renderBrandedEmail } from '@/lib/email-template';
import {
  ADMIN_QUEUE_META,
  type AdminQueueDigest,
  type QueueUrgency,
  type AdminQueueLane,
} from '@/lib/admin/queue-counts';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com';

/** Local hour (Asia/Manila) the daily digest may first go out. */
export const SEND_HOUR_MANILA = 8;
const MANILA_OFFSET = '+08:00'; // PH has no DST.

/**
 * Today's send-window start (SEND_HOUR_MANILA, Manila) as a UTC instant (ms).
 * Pure (clock passed in) so the flush's daily-claim boundary is unit-testable
 * without the flush's server-only deps.
 */
export function sendThresholdMs(nowMs: number): number {
  const manilaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
  }).format(new Date(nowMs)); // YYYY-MM-DD
  const hh = String(SEND_HOUR_MANILA).padStart(2, '0');
  return Date.parse(`${manilaDate}T${hh}:00:00${MANILA_OFFSET}`);
}

const LANE_LABEL: Record<AdminQueueLane, string> = {
  money: 'Money',
  trust: 'Trust & recourse',
  growth: 'Growth',
  support: 'Support',
};
const LANE_ORDER: AdminQueueLane[] = ['trust', 'money', 'growth', 'support'];

export type LaneRollup = { lane: AdminQueueLane; open: number; overdue: number };

/** Per-lane open + overdue rollup, busiest-consequence lanes first, empties dropped. */
export function rollupByLane(
  digest: AdminQueueDigest,
  urgency: QueueUrgency,
): LaneRollup[] {
  const by = new Map<AdminQueueLane, LaneRollup>();
  for (const [key, meta] of Object.entries(ADMIN_QUEUE_META)) {
    const count = Math.max(0, digest[key]?.count ?? 0);
    if (count <= 0) continue;
    const r = by.get(meta.lane) ?? { lane: meta.lane, open: 0, overdue: 0 };
    r.open += count;
    if (urgency.states[key] === 'overdue') r.overdue += 1;
    by.set(meta.lane, r);
  }
  return LANE_ORDER.filter((l) => by.has(l)).map((l) => by.get(l)!);
}

export type DigestEmail = { subject: string; text: string; html: string };

export function buildDigestEmail(
  digest: AdminQueueDigest,
  urgency: QueueUrgency,
): DigestEmail {
  const lanes = rollupByLane(digest, urgency);
  const workUrl = `${APP_URL}/admin/work`;

  const headline =
    urgency.overdue > 0
      ? `${urgency.totalOpen} ${urgency.totalOpen === 1 ? 'item' : 'items'} waiting · ${urgency.overdue} past SLA`
      : `${urgency.totalOpen} ${urgency.totalOpen === 1 ? 'item' : 'items'} waiting across your queues`;

  const laneLines = lanes.map((l) => {
    const od = l.overdue > 0 ? ` · ${l.overdue} overdue` : '';
    return `${LANE_LABEL[l.lane]} — ${l.open} open${od}`;
  });

  const subject =
    urgency.overdue > 0
      ? `Setnayan HQ · ${urgency.overdue} overdue, ${urgency.totalOpen} waiting`
      : `Setnayan HQ · ${urgency.totalOpen} waiting in your queues`;

  const text = [
    'Good morning from Setnayan HQ.',
    '',
    headline + '.',
    '',
    ...laneLines,
    '',
    `Open the work list: ${workUrl}`,
  ].join('\n');

  const html = renderBrandedEmail({
    heading: 'Your morning queue digest',
    paragraphs: [headline + '.', ...laneLines],
    ctaLabel: 'Open the work list',
    ctaHref: workUrl,
    footnote:
      'You receive this because you are a Setnayan HQ admin. It sends once a morning, only when work is waiting.',
  });

  return { subject, text, html };
}
