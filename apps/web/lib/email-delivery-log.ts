/**
 * EVERY EMAIL SAYS WHETHER IT ARRIVED — the pure half (no server-only).
 *
 * `lib/email-delivery.server.ts` writes and reads `public.email_deliveries`;
 * everything here that can be got WRONG — what counts as delivered, what counts
 * as failed, when to stop asking Resend, what the owner is told — lives in this
 * file so `email-delivery-log.test.ts` can EXECUTE it rather than grep for it.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. The point of this module is the verdict a
 * person reads on /admin (the home strip and the Notifications tab), not the
 * row. A failed delivery that only lands in a table is a second thing nobody
 * reads.
 */

/** What our side knew at send time — mirrors the table's CHECK. */
export type DeliveryOutcome = 'accepted' | 'send_failed' | 'not_configured';

/** One row as the admin surfaces read it. */
export type DeliveryRow = {
  delivery_id: string;
  created_at: string;
  kind: string;
  recipient_masked: string;
  subject: string;
  outcome: DeliveryOutcome;
  provider_message_id: string | null;
  error: string | null;
  scheduled_for: string | null;
  last_event: string | null;
  last_event_checked_at: string | null;
};

/**
 * The verdict a person reads.
 *   delivered — Resend handed it to the recipient's mail server (not "read")
 *   failed    — it will not arrive: refused at send, bounced, marked spam,
 *               suppressed, or failed at Resend
 *   not_sent  — nothing was tried, because email is not configured
 *   cancelled — a scheduled email we cancelled on purpose
 *   waiting   — accepted, and Resend has not said what happened yet
 *   unknown   — accepted, and Resend never said, and we have stopped asking
 */
export type DeliveryVerdict =
  | 'delivered'
  | 'failed'
  | 'not_sent'
  | 'cancelled'
  | 'waiting'
  | 'unknown';

/** Resend `last_event` values that mean the message reached the mail server. */
const DELIVERED_EVENTS = new Set(['delivered', 'opened', 'clicked']);
/** Resend `last_event` values that mean it will not arrive. */
const FAILED_EVENTS = new Set(['bounced', 'complained', 'failed', 'suppressed']);

/**
 * How long we keep asking Resend about one message. A normal delivery settles in
 * seconds; `delivery_delayed` retries for up to ~72 hours on the receiving side.
 * Past this, the row is `unknown` — said out loud, never left as "waiting".
 */
export const STOP_ASKING_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Not asked again sooner than this (Resend's API allows ~2 requests/second). */
export const RECHECK_AFTER_MS = 10 * 60 * 1000;

/** The window the owner-facing summary covers. */
export const SUMMARY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function verdictOf(
  row: Pick<DeliveryRow, 'outcome' | 'last_event' | 'created_at' | 'scheduled_for'>,
  now: number = Date.now(),
): DeliveryVerdict {
  if (row.outcome === 'not_configured') return 'not_sent';
  if (row.outcome === 'send_failed') return 'failed';
  const ev = (row.last_event ?? '').toLowerCase();
  if (DELIVERED_EVENTS.has(ev)) return 'delivered';
  if (FAILED_EVENTS.has(ev)) return 'failed';
  if (ev === 'canceled' || ev === 'cancelled') return 'cancelled';
  const clockStart = Date.parse(row.scheduled_for ?? row.created_at);
  if (Number.isFinite(clockStart) && now - clockStart > STOP_ASKING_AFTER_MS) return 'unknown';
  return 'waiting';
}

/** TRUE when Resend has already given a final answer and there is nothing left to ask. */
export function isSettled(
  row: Pick<DeliveryRow, 'outcome' | 'last_event' | 'created_at' | 'scheduled_for'>,
  now: number = Date.now(),
): boolean {
  const v = verdictOf(row, now);
  return v !== 'waiting';
}

/**
 * Should the job ask Resend about this row now?
 * Only accepted messages with an id, not yet settled, not scheduled for the
 * future, and not asked within RECHECK_AFTER_MS.
 */
export function isDueForCheck(
  row: Pick<
    DeliveryRow,
    | 'outcome'
    | 'provider_message_id'
    | 'last_event'
    | 'created_at'
    | 'scheduled_for'
    | 'last_event_checked_at'
  >,
  now: number = Date.now(),
): boolean {
  if (row.outcome !== 'accepted' || !row.provider_message_id) return false;
  if (isSettled(row, now)) return false;
  if (row.scheduled_for && Date.parse(row.scheduled_for) > now) return false;
  if (row.last_event_checked_at) {
    const last = Date.parse(row.last_event_checked_at);
    if (Number.isFinite(last) && now - last < RECHECK_AFTER_MS) return false;
  }
  return true;
}

/**
 * "iscasasolaii@gmail.com" → "is•••@gmail.com". Enough for the owner to tell
 * whose email it was; not the address. An unparseable input masks to "•••".
 */
export function maskRecipient(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0 || at === address.length - 1) return '•••';
  const local = address.slice(0, at);
  const domain = address.slice(at + 1).toLowerCase();
  const keep = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${keep}•••@${domain}`;
}

export type DeliverySummary = Record<DeliveryVerdict, number> & { total: number };

export function summarize(
  rows: ReadonlyArray<Pick<DeliveryRow, 'outcome' | 'last_event' | 'created_at' | 'scheduled_for'>>,
  now: number = Date.now(),
): DeliverySummary {
  const s: DeliverySummary = {
    delivered: 0,
    failed: 0,
    not_sent: 0,
    cancelled: 0,
    waiting: 0,
    unknown: 0,
    total: 0,
  };
  for (const r of rows) {
    s[verdictOf(r, now)] += 1;
    s.total += 1;
  }
  return s;
}

/**
 * What the admin HOME says, or null when there is nothing to say.
 *
 * The home strip is for trouble only: an owner who sees it every day learns to
 * scroll past it. It speaks when (a) email is not configured at all, (b) the
 * log itself could not be read, or (c) anything in the window failed, was never
 * sent, or went unanswered. A healthy week renders nothing.
 */
export type HomeAlert = { tone: 'danger' | 'warning'; headline: string; detail: string };

export function homeAlert(input: {
  configured: boolean;
  readFailed: boolean;
  summary: DeliverySummary | null;
}): HomeAlert | null {
  if (!input.configured) {
    return {
      tone: 'danger',
      headline: 'Email is switched off — nothing is being sent',
      detail:
        'No Resend key is set, so every notification email, receipt and reminder is skipped. People still see the in-app notice.',
    };
  }
  if (input.readFailed || !input.summary) {
    return {
      tone: 'warning',
      headline: 'The email delivery log could not be read',
      detail: 'Whether emails are arriving is unknown right now. This is not the same as "all delivered".',
    };
  }
  const { failed, not_sent, unknown } = input.summary;
  const bad = failed + not_sent;
  if (bad > 0) {
    return {
      tone: 'danger',
      headline: `${bad} ${bad === 1 ? 'email' : 'emails'} did not arrive in the last 7 days`,
      detail: 'Bounced, refused, or never sent. Open the list to see who missed what.',
    };
  }
  if (unknown > 0) {
    return {
      tone: 'warning',
      headline: `${unknown} ${unknown === 1 ? 'email has' : 'emails have'} no delivery answer from Resend`,
      detail: 'Accepted, but Resend never said whether they arrived.',
    };
  }
  return null;
}

export const VERDICT_LABEL: Record<DeliveryVerdict, string> = {
  delivered: 'Delivered',
  failed: 'Did not arrive',
  not_sent: 'Not sent',
  cancelled: 'Cancelled',
  waiting: 'Waiting',
  unknown: 'No answer',
};
