/**
 * 📌 THE CHAT'S PINS — what needs an answer, how loudly, in what order (Supplier Build 3 · lane B).
 *
 * Owner rulings (DECISION_LOG 📌 2026-11-08 · 🚦 2026-11-09):
 *   · *"no topic is lost… We can only have 1 (+) at a time"* — what the app can detect is NOT a (+) row: it pops into
 *     the chat by itself and stays pinned at the top however deep the chat scrolls, until answered, oldest due first.
 *   · *"if it is something that we cannot proceed until they answer, then it should take the whole screen until they
 *     do the act"* — THREE LEVELS:
 *       1 · BLOCKER — the booking cannot move: a full-screen layer when the chat opens (`chat-blocker.tsx`).
 *       2 · DUE NOW — an amber pin with a countdown, a dot on the Chats row, Today's Next card.
 *       3 · WAITING ON THE OTHER SIDE — one quiet folded line.
 *
 * Pure: facts in, levels and order out. No React, no I/O, no clock of its own (`nowMs` is passed), so the Chats list
 * (lane A's row dot) and the chat's own pins read ONE rule — `needsYouLevel` — and cannot disagree.
 */
import type { DecisionEntry } from './thread-decisions';
import type { ChatTopic } from './topic-icons';

/** Everything that can pin itself. A (+) card is NOT here — it is the Running topic (`lib/chat-plus.ts`). */
export type PinKind =
  /** The hosts asked to book (`event_vendors.lock_requested_at`). */
  | 'booking_ask'
  /** The Setnayan booking fee is overdue (the shipped fee lock withholds the event). */
  | 'booking_fee'
  /** A coordinator / planner's payment proof needs the host's Agree (🤝 8 Nov). */
  | 'coordinator_agree'
  /** A change to the booking awaiting the reader's approval (a `proposal_amendments` row). */
  | 'change_approval'
  /** Booked, and this supplier has no call time on the Schedule yet. */
  | 'call_time'
  /** A payment on the plan is due (reminders 3 days after, then every 5 days). */
  | 'payment_due'
  /** The hosts logged a payment; the supplier confirms it reached them. */
  | 'confirm_payment'
  /** The live head count moved away from the quoted one. */
  | 'guest_count'
  /** Someone asks for access to a part of the event. */
  | 'access_ask'
  /** A sent quote the hosts never accepted ran past its Valid until (🧾⏳ 9 Nov — the sixth blocker). */
  | 'quote_expired'
  /** An open decision topic (the (+) "Decision" — "Pin a topic until it is settled"); either side closes it. */
  | 'decision'
  /**
   * 🗓 The hosts moved a chapter the supplier is on; it pins on the supplier's side until they press Seen (SCHEDULES
   * HAND-IN-HAND part (b), rule 3, 2026-11-12). A change the host applied needs no other answer — never a blocker.
   */
  | 'schedule_change';

/** The topic each pin wears (its icon is `TOPIC_ICON[topic]` — never a glyph of its own). */
export const PIN_TOPIC: Record<PinKind, ChatTopic> = {
  booking_ask: 'quote',
  booking_fee: 'payment',
  coordinator_agree: 'access',
  change_approval: 'quote',
  call_time: 'schedule',
  payment_due: 'payment',
  confirm_payment: 'payment',
  guest_count: 'details',
  access_ask: 'access',
  quote_expired: 'quote',
  decision: 'decision',
  schedule_change: 'schedule',
};

export type PinFact = {
  /** Stable within a thread (`${kind}:${id}`). */
  key: string;
  kind: PinKind;
  /** The one line the pin reads ("₱10,000 · GCash · ref 1234"). */
  title: string;
  /** Who must act — the reader, or the other side. */
  answerer: 'you' | 'them';
  /** The other side's short name, for "Waiting for Lumina". */
  themName?: string;
  /** When it was asked / logged / became true (ms). */
  sinceMs: number;
  /** When it falls due (ms), if it has a deadline. Null = due since `sinceMs`. */
  dueMs?: number | null;
  /** 🗳 A decision only: the reader opened it (the pin reads "Decision · you opened it"; otherwise "they opened it"). */
  openedByYou?: boolean;
  /** 🗳 A decision only: how many messages are filed under it ("2 filed ›"). null = the count was not read — no number. */
  filedCount?: number | null;
  /** 🗓 A schedule change only: how many OLDER changes are unanswered too ("+ 2 older changes · Seen answers them all"). */
  olderCount?: number;
};

export type NeedsYouLevel = 'blocker' | 'due' | 'waiting';

const DAY = 86_400_000;
/** Owner: a change awaiting approval / an unset call time BLOCKS within 7 days of the event; before that it is due. */
export const BLOCKS_WITHIN_DAYS = 7;

/** Whole Manila days from `nowMs` to the event day (yyyy-mm-dd), or null when there is no day. */
export function daysToEvent(eventDate: string | null | undefined, nowMs: number): number | null {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  const eventMs = Date.parse(`${eventDate}T00:00:00+08:00`);
  const today = manilaDayStartMs(nowMs);
  return Math.round((eventMs - today) / DAY);
}

function manilaDayStartMs(ms: number): number {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(ms));
  return Date.parse(`${d}T00:00:00+08:00`);
}

/**
 * 🚦 THE ONE RULE for how loudly a thing asks. Lane A's Chats-row dot and this chat's pins both read it.
 */
export function needsYouLevel(
  fact: Pick<PinFact, 'kind' | 'answerer'>,
  ctx: { nowMs: number; eventDate?: string | null },
): NeedsYouLevel {
  if (fact.answerer === 'them') return 'waiting';
  switch (fact.kind) {
    case 'booking_ask':
    case 'booking_fee':
    case 'coordinator_agree':
    case 'quote_expired':
      return 'blocker';
    case 'change_approval':
    case 'call_time': {
      const d = daysToEvent(ctx.eventDate, ctx.nowMs);
      return d != null && d <= BLOCKS_WITHIN_DAYS ? 'blocker' : 'due';
    }
    case 'payment_due':
    case 'confirm_payment':
    case 'guest_count':
    case 'access_ask':
    case 'decision':
    case 'schedule_change':
      return 'due';
  }
}

const RANK: Record<NeedsYouLevel, number> = { blocker: 3, due: 2, waiting: 1 };

/** The loudest level among a thread's facts, for the Chats row (lane A): null = nothing asks. */
export function threadNeedsYouLevel(
  facts: readonly Pick<PinFact, 'kind' | 'answerer'>[],
  ctx: { nowMs: number; eventDate?: string | null },
): NeedsYouLevel | null {
  let best: NeedsYouLevel | null = null;
  for (const f of facts) {
    const l = needsYouLevel(f, ctx);
    if (!best || RANK[l] > RANK[best]) best = l;
  }
  return best;
}

/** Oldest due first; ties by key so two renders never swap rows. */
export function pinOrder(a: PinFact, b: PinFact): number {
  const da = a.dueMs ?? a.sinceMs;
  const db = b.dueMs ?? b.sinceMs;
  return da - db || a.key.localeCompare(b.key);
}

export type PinStack = { blockers: PinFact[]; due: PinFact[]; waiting: PinFact[] };

/** The three levels, each oldest due first. Due now always draws above Waiting. */
export function stackPins(facts: readonly PinFact[], ctx: { nowMs: number; eventDate?: string | null }): PinStack {
  const out: PinStack = { blockers: [], due: [], waiting: [] };
  for (const f of facts) {
    const l = needsYouLevel(f, ctx);
    (l === 'blocker' ? out.blockers : l === 'due' ? out.due : out.waiting).push(f);
  }
  out.blockers.sort(pinOrder);
  out.due.sort(pinOrder);
  out.waiting.sort(pinOrder);
  return out;
}

/** "due in 2 days" · "due today" · "3 days overdue" — Manila days, never negative wording. */
export function countdownLabel(dueMs: number, nowMs: number): string {
  const days = Math.round((manilaDayStartMs(dueMs) - manilaDayStartMs(nowMs)) / DAY);
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days > 1) return `due in ${days} days`;
  const late = -days;
  return `${late} ${late === 1 ? 'day' : 'days'} overdue`;
}

/**
 * ⏰ PAYMENT REMINDERS, COMPUTED ON READ (no scheduler). Owner: the due card lands on the due day; if unpaid, a
 * reminder **3 days later, then every 5 days** until paid or answered. `vercel.json` has no crons, and the repo's
 * other expiries (`lock_request_expires_at`) are also read-time, so the reminder state is derived here, each render.
 *
 * Returns null before the due day (nothing pins yet). `nth` = 0 on the due day itself, 1 at +3 days, 2 at +8, 3 at +13…
 */
export function paymentReminder(
  dueDate: string,
  nowMs: number,
): { nth: number; sinceMs: number; nextMs: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const dueMs = Date.parse(`${dueDate}T00:00:00+08:00`);
  const today = manilaDayStartMs(nowMs);
  const days = Math.round((today - dueMs) / DAY);
  if (days < 0) return null;
  const nth = days < 3 ? 0 : 1 + Math.floor((days - 3) / 5);
  const sinceDays = nth === 0 ? 0 : 3 + (nth - 1) * 5;
  const nextDays = nth === 0 ? 3 : 3 + nth * 5;
  return { nth, sinceMs: dueMs + sinceDays * DAY, nextMs: dueMs + nextDays * DAY };
}

/**
 * The pins the conversation's own Decisions already know (`buildThreadDecisions`): a logged payment, a guest-count
 * change, an adjustment. Quotes and meetings are (+) cards — the Running topic, not a pin.
 */
export function pinsFromDecisions(entries: readonly DecisionEntry[], themName: string): PinFact[] {
  const out: PinFact[] = [];
  for (const e of entries) {
    const waitingOnThem = !e.now.needsYou && /waiting/i.test(e.now.text);
    if (!e.now.needsYou && !waitingOnThem) continue;
    const kind: PinKind | null =
      e.kind === 'payment' ? 'confirm_payment' : e.kind === 'guest_count' ? 'guest_count' : e.kind === 'adjustment' ? 'change_approval' : null;
    if (!kind) continue;
    out.push({
      key: e.key,
      kind,
      title: e.title,
      answerer: e.now.needsYou ? 'you' : 'them',
      themName,
      sinceMs: e.atMs,
    });
  }
  return out;
}

/** The collapsed stack's one row: "2 due now · ₱10,000 · GCash · due today". */
export function collapsedLine(due: readonly PinFact[], nowMs: number): string | null {
  const top = due[0];
  if (!top) return null;
  const when = top.dueMs != null ? ` · ${countdownLabel(top.dueMs, nowMs)}` : '';
  return `${due.length} due now · ${top.title}${when}`;
}

/** "2 waiting for Lumina" — the quiet folded line. */
export function waitingLine(waiting: readonly PinFact[]): string | null {
  if (waiting.length === 0) return null;
  const name = waiting[0]!.themName?.trim() || 'them';
  return `${waiting.length} waiting for ${name}`;
}
