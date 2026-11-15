/**
 * Pure content for the admin morning digest email — the lane rollup + the
 * subject/text/html builder. No `server-only` deps (imports only the pure
 * queue-counts types/meta + the dependency-free email template), so it's unit-
 * testable in plain node. The IO (claim, fetch, send) lives in digest-flush.ts.
 */

import { renderBrandedEmail } from '@/lib/email-template';
import {
  ADMIN_QUEUE_META,
  ADMIN_QUEUE_DIGEST_LINES,
  type AdminQueueDigest,
  type QueueUrgency,
  type AdminQueueLane,
  ADMIN_LANE_ORDER,
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
/* Order comes from lib/admin/queue-counts.ts — see ADMIN_LANE_ORDER. */

export type LaneRollup = { lane: AdminQueueLane; open: number; overdue: number };

/** Per-lane open + overdue rollup, busiest-consequence lanes first, empties dropped. */
export function rollupByLane(
  digest: AdminQueueDigest,
  urgency: QueueUrgency,
): LaneRollup[] {
  const by = new Map<AdminQueueLane, LaneRollup>();
  for (const [key, meta] of Object.entries(ADMIN_QUEUE_META)) {
    // A trail to watch is not work waiting — it gets a named line, not a lane sum.
    if (meta.watchOnly) continue;
    const count = Math.max(0, digest[key]?.count ?? 0);
    if (count <= 0) continue;
    const r = by.get(meta.lane) ?? { lane: meta.lane, open: 0, overdue: 0 };
    r.open += count;
    if (urgency.states[key] === 'overdue') r.overdue += 1;
    by.set(meta.lane, r);
  }
  return ADMIN_LANE_ORDER.filter((l) => by.has(l)).map((l) => by.get(l)!);
}

/** Said in place of a number when a count could not be read — never "0". */
export const COULD_NOT_COUNT = 'couldn’t count';

/**
 * ONE LINE PER QUEUE THAT USED TO BE SILENT (admin slice 4, 2026-11-13).
 *
 * The solo-operator audit, fact 4: *"A queue the digest does not count fills
 * silently."* The lane rollup above sums them in with everything else; this
 * names each one that has something in it, in its own words ("3 auto-
 * suspended, need your look"), so a quiet-looking lane can no longer hide it.
 *
 * ⚠ A FAILED COUNT IS NAMED, NOT SKIPPED: "Fraud queue — couldn't count". A
 * skipped line reads exactly like an empty queue. Empty queues are left out.
 */
export function silentQueueLines(digest: AdminQueueDigest): string[] {
  const out: string[] = [];
  for (const q of ADMIN_QUEUE_DIGEST_LINES) {
    const count = digest[q.key]?.count;
    if (count === null || count === undefined) out.push(`${q.label} — ${COULD_NOT_COUNT}`);
    else if (count > 0) out.push(`${q.label} — ${q.say(count)}`);
  }
  return out;
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
  const namedLines = silentQueueLines(digest);

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
    ...(namedLines.length > 0 ? ['', 'Also on your list:', ...namedLines] : []),
    '',
    `Open the work list: ${workUrl}`,
  ].join('\n');

  const html = renderBrandedEmail({
    heading: 'Your morning queue digest',
    paragraphs: [
      headline + '.',
      ...laneLines,
      ...(namedLines.length > 0 ? ['Also on your list:', ...namedLines] : []),
    ],
    ctaLabel: 'Open the work list',
    ctaHref: workUrl,
    footnote: 'It sends once a morning, only when work is waiting.',
    // The admin footer, not the Papic-gallery line every mail used to inherit.
    audience: 'admin',
  });

  return { subject, text, html };
}

// ── The last send, as the owner reads it (admin audit 2026-09-30 row 38) ────

/** `email_deliveries.kind` for every digest email — what the reader asks for. */
export const DIGEST_EMAIL_KIND = 'admin_digest';

/**
 * Digests sent before 2026-10-01 were logged with no kind ('other'); their
 * subject is the only thing that names them. Both subjects built above start
 * with this.
 */
export const DIGEST_SUBJECT_PREFIX = 'Setnayan HQ · ';

export type DigestSendRow = {
  created_at: string;
  outcome: 'accepted' | 'send_failed' | 'not_configured';
  error: string | null;
};

export type LastDigest =
  /** The delivery log could not be read — say so; never "never sent". */
  | { state: 'unread' }
  /** The log was read and holds no digest email at all. */
  | { state: 'never' }
  | { state: 'sent'; at: string }
  | { state: 'failed'; at: string; reason: string; lastSentAt: string | null };

/** The emails of one morning's send land within seconds of each other. */
const ONE_SEND_MS = 10 * 60 * 1000;

/**
 * What the newest digest send did. `rows` is newest first, as read from
 * email_deliveries; `null` means the read failed. A send went out when ANY of
 * that morning's emails was accepted; it failed when none was.
 */
export function summarizeDigestSends(rows: DigestSendRow[] | null): LastDigest {
  if (rows === null) return { state: 'unread' };
  const newest = rows[0];
  if (!newest) return { state: 'never' };
  const newestMs = Date.parse(newest.created_at);
  const batch = rows.filter((r) => Math.abs(newestMs - Date.parse(r.created_at)) <= ONE_SEND_MS);
  const ok = batch.find((r) => r.outcome === 'accepted');
  if (ok) return { state: 'sent', at: ok.created_at };
  const lastOk = rows.find((r) => r.outcome === 'accepted') ?? null;
  return {
    state: 'failed',
    at: newest.created_at,
    reason:
      newest.outcome === 'not_configured'
        ? 'email is not set up (no Resend key)'
        : newest.error?.trim() || 'the email service refused it',
    lastSentAt: lastOk ? lastOk.created_at : null,
  };
}
