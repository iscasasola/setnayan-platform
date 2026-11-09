/**
 * 📌 THE PINS THE PAGE READS — the real facts behind each pin kind, turned into `PinFact`s (Supplier Build 3 · lane B,
 * round 2). Pure: the server reader (`chat-pin-facts.server.ts`) does the reads; this decides what pins, for which
 * side, in whose words — and masks money for a reader who may not see it.
 *
 *   payment_due        the booking's next money step (`readBookedMoney`), reminders by `paymentReminder`
 *   call_time          booked, and `chat_call_time_for()` found no timed Schedule moment for this supplier
 *   access_ask         a pending `event_access_requests` row from this shop
 *   booking_fee        the shop's own Setnayan fee bill for this event, past its day (supplier only)
 *   coordinator_agree  a booked coordinator / planner the hosts have not agreed to yet (🤝 8 Nov)
 *   quote_expired      the newest quote is `expired` (🧾⏳ 9 Nov)
 *   decision           an open `chat_decision_topics` row
 *
 * 🔒 MONEY: a coordinator without "Budget & payments" = View reads **"₱ — hosts only"** for every amount (FINAL RULINGS
 * 2026-11-09). The strip happens HERE, on the server's facts, before anything reaches the browser.
 */
import type { MoneyStep, QuoteScheduleRow } from './accepted-quote-terms';
import { pesoFromCentavos } from './accepted-quote-terms';
import { paymentReminder, stackPins, type PinFact } from './chat-pins';
import { formatPhp } from './php';
import type { BlockerKind } from '@/app/_components/chat/blocker-show';

import { HOSTS_ONLY, maskPesos } from './money-mask';

export { HOSTS_ONLY, maskPesos };

export type PinFactInputs = {
  side: 'vendor' | 'couple';
  /** The other side's short name — "Lumina" for a host, "Maria & Jose" for the supplier. */
  themName: string;
  /** The supplier's own name, for the host's "Lumina is sending a new one". */
  supplierName: string;
  nowMs: number;
  /** May this reader see the money? False only for a delegate refused Budget & payments. */
  mayReadMoney: boolean;
  /** `readBookedMoney().step` + its schedule; null = not read. */
  money: { step: MoneyStep; schedule: readonly QuoteScheduleRow[] } | null;
  /** Booked + the call time read: `at` null = none set. Null = not booked or not read. */
  callTime: { at: string | null } | null;
  /** This shop's pending access asks on the event. */
  accessAsks: readonly { requestId: string; createdAt: string }[] | null;
  /** The shop's fee bills for THIS event (supplier side only). */
  feeBills: readonly { orderId: string; amountPhp: number; dueOn: string | null }[] | null;
  /** A booked coordinator / planner with no Agree yet. Null = not one, or agreed. */
  coordinatorAgree: { since: string | null } | null;
  /** The newest non-draft quote. */
  quote: { proposalId: string; status: string; title: string | null; validUntil: string | null; updatedAt: string | null } | null;
  /** Open decision topics. */
  decisions: readonly { topicId: string; title: string; openedAt: string }[] | null;
  /**
   * Changes the OTHER side asked for and this reader must answer (`proposal_amendments` status 'proposed', raised by
   * them, in this thread). Derived on the SERVER so the change-approval blocker has a stable key
   * (`adjustment:<amendment_id>` — the same key the stream's Decisions use) and its shows count like every blocker.
   */
  changes?: readonly { amendmentId: string; createdAt: string; deltaPhp: number | null }[] | null;
  /** Manila today, 'YYYY-MM-DD'. */
  todayPh: string;
};

const ms = (iso: string | null | undefined, fallback: number) => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

function dayMs(isoDay: string): number {
  return Date.parse(`${isoDay}T00:00:00+08:00`);
}

/** "Feb 27, 2027" from 'YYYY-MM-DD' (Manila), for the expired line. */
function dayWords(isoDay: string): string {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(
    new Date(dayMs(isoDay)),
  );
}

function paymentDuePin(i: PinFactInputs): PinFact | null {
  if (!i.money) return null;
  const step = i.money.step;
  const payer = i.side === 'couple' ? 'you' : 'them';
  if (step.kind === 'first_payment_due') {
    const amount = step.amountCentavos ?? step.minimumCentavos;
    return {
      key: 'payment_due:first',
      kind: 'payment_due',
      title: `${step.label}${amount != null ? ` · ${pesoFromCentavos(amount)}` : ''}`,
      answerer: payer,
      themName: i.themName,
      sinceMs: i.nowMs,
      dueMs: null,
    };
  }
  if (step.kind === 'installment_due') {
    const row = i.money.schedule.find((r) => r.label === step.installmentLabel && r.dueOnISO);
    const due = row?.dueOnISO ?? null;
    const reminder = due ? paymentReminder(due, i.nowMs) : null;
    // A dated installment pins on its day; reminders (3 days after, then every 5) re-date it. Undated = due now.
    if (due && !reminder) return null;
    return {
      key: `payment_due:${step.installmentLabel}:${reminder?.nth ?? 0}`,
      kind: 'payment_due',
      title: `${step.installmentLabel}${step.amountCentavos != null ? ` · ${pesoFromCentavos(step.amountCentavos)}` : ''}`,
      answerer: payer,
      themName: i.themName,
      sinceMs: reminder?.sinceMs ?? i.nowMs,
      dueMs: due ? dayMs(due) : null,
    };
  }
  return null;
}

/** The facts, both sides' words. Money masked for a reader who may not see it. */
export function buildPinFacts(i: PinFactInputs): PinFact[] {
  const out: PinFact[] = [];
  const push = (f: PinFact | null) => {
    if (f) out.push(i.mayReadMoney ? f : { ...f, title: maskPesos(f.title) });
  };

  push(paymentDuePin(i));

  if (i.callTime && i.callTime.at == null) {
    push({
      key: 'call_time:unset',
      kind: 'call_time',
      title: i.side === 'vendor' ? 'Set your call time on their Schedule' : `${i.supplierName} has no call time yet`,
      // The supplier proposes their part of the day; the hosts tap OK.
      answerer: i.side === 'vendor' ? 'you' : 'them',
      themName: i.themName,
      sinceMs: i.nowMs,
      dueMs: null,
    });
  }

  for (const a of i.accessAsks ?? []) {
    push({
      key: `access_ask:${a.requestId}`,
      kind: 'access_ask',
      title: i.side === 'couple' ? `${i.supplierName} asks to open part of your event` : 'You asked to open part of their event',
      answerer: i.side === 'couple' ? 'you' : 'them',
      themName: i.themName,
      sinceMs: ms(a.createdAt, i.nowMs),
    });
  }

  if (i.side === 'vendor') {
    for (const b of i.feeBills ?? []) {
      if (!b.dueOn || b.dueOn >= i.todayPh) continue; // overdue only — before that it is Today's card, not a blocker
      push({
        key: `booking_fee:${b.orderId}`,
        kind: 'booking_fee',
        title: `Setnayan booking fee · ${formatPhp(b.amountPhp)} · overdue`,
        answerer: 'you',
        sinceMs: dayMs(b.dueOn),
        dueMs: dayMs(b.dueOn),
      });
    }
  }

  // 🤝 "Agree at proof" (8 Nov): the Agree rides the payment proof (Lane C's Log a payment), so it pins only once a
  // payment is on record without one — never before the hosts have paid anything.
  const proofLogged = Boolean(i.money && ['first_payment_sent', 'installment_due', 'installment_not_due_yet', 'paid_in_full'].includes(i.money.step.kind));
  if (i.coordinatorAgree && proofLogged) {
    push({
      key: 'coordinator_agree',
      kind: 'coordinator_agree',
      title: i.side === 'couple' ? `Agree that ${i.supplierName} can open your event` : 'Waiting for the hosts to agree to your access',
      answerer: i.side === 'couple' ? 'you' : 'them',
      themName: i.themName,
      sinceMs: ms(i.coordinatorAgree.since, i.nowMs),
    });
  }

  const q = i.quote;
  if (q && q.status === 'expired') {
    const until = q.validUntil ? ` · valid until ${dayWords(q.validUntil)}` : '';
    push({
      key: `quote_expired:${q.proposalId}`,
      kind: 'quote_expired',
      title: i.side === 'vendor' ? `Your quotation expired${until}` : `Quotation expired · ${i.supplierName} is sending a new one`,
      // The supplier acts (Send a new quotation); the hosts wait — "Accepted never expires", so they cannot accept it.
      answerer: i.side === 'vendor' ? 'you' : 'them',
      themName: i.themName,
      sinceMs: ms(q.updatedAt, i.nowMs),
    });
  }

  for (const c of i.changes ?? []) {
    const delta = c.deltaPhp != null && c.deltaPhp !== 0 ? ` · ${c.deltaPhp > 0 ? '+' : '−'}₱${Math.abs(c.deltaPhp).toLocaleString('en-PH')}` : '';
    push({
      key: `adjustment:${c.amendmentId}`,
      kind: 'change_approval',
      title: `${i.side === 'vendor' ? 'They asked for a change' : `${i.supplierName} asked for a change`}${delta}`,
      answerer: 'you',
      themName: i.themName,
      sinceMs: ms(c.createdAt, i.nowMs),
    });
  }

  for (const d of i.decisions ?? []) {
    push({
      key: `decision:${d.topicId}`,
      kind: 'decision',
      title: d.title,
      answerer: 'you',
      themName: i.themName,
      sinceMs: ms(d.openedAt, i.nowMs),
    });
  }
  return out;
}

/** The blocker each blocking pin kind opens — the server's word for its show count. */
export const BLOCKER_OF: Partial<Record<PinFact['kind'], BlockerKind>> = {
  booking_ask: 'booking_ask',
  booking_fee: 'booking_fee_overdue',
  coordinator_agree: 'coordinator_agree',
  change_approval: 'change_approval',
  call_time: 'call_time_unset',
  quote_expired: 'quote_expired',
};

/**
 * The ONE blocker that takes the screen when the chat opens: the oldest-due blocking fact among `facts` (the same
 * `stackPins` order the red pins draw in), limited to the kinds this page can answer (`answerable`). Null = none.
 */
export function firstBlocker(
  facts: readonly PinFact[],
  ctx: { nowMs: number; eventDate?: string | null },
  answerable: readonly PinFact['kind'][],
): PinFact | null {
  return stackPins(facts, ctx).blockers.find((f) => answerable.includes(f.kind)) ?? null;
}
