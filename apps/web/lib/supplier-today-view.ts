/**
 * lib/supplier-today-view.ts — THE SIMPLER TODAY, ASSEMBLED (pure — no I/O, no clock of its own).
 *
 * Owner APPROVE 2026-10-14 (corpus DECISION_LOG ✅ "THE SIMPLER SUPPLIER DASHBOARD"); prototype
 * `Setnayan/prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, SCREENS.today + nextCard. The page reads;
 * this decides what each part of the screen says; the component draws it. ONE function so the Today page and the
 * dev lab (`/dev/supplier-lab?easy=…`) can never draw two different Todays — the lab hands it fixtures, the page
 * hands it reads, and a guard can execute it.
 *
 * Nothing here re-decides a rule that lives elsewhere: the Next card is `pickSupplierNext` (LIVE's nine rules, in
 * order — an overdue fee never jumps ahead of a couple's ask), the queue is `supplierWaiting`, the row words are
 * `todayRowWords`, a fee row is `feeRowCopy`, the lock is `feeLockLine` (the gate's own sentence).
 */
import type { DueFeeBill, FeeDisclosure } from '@/lib/booking-fee-disclosure';
import { feeDueCopy, feeDueStage } from '@/lib/booking-fee-disclosure';
import type { PayoutReadiness } from '@/lib/deposit-pay-step';
import type { FirstStepsRail } from '@/lib/vendor-first-steps';
import type { UpcomingEventRow, WhatsNewCard } from '@/lib/vendor-overview';
import type { EventDayFacts, TodaySchedules } from '@/lib/supplier-today.server';
import { daySheetHref, daysFrom } from '@/lib/vendor-dates';
import {
  PAYOUT_DOOR_WORDS,
  businessLine,
  creditDoorWords,
  eventsThisWeek,
  feeLockLine,
  feeRowCopy,
  nextAnswerOf,
  nextLook,
  nextMeta,
  nextWho,
  owedToYouPhp,
  pickSupplierNext,
  shopPillOf,
  shopStateWords,
  shortDay,
  supplierWaiting,
  todayNextSecond,
  todayRowWords,
  waitingOnYou,
  type ShopPill,
  type SupplierIcon,
  type SupplierNext,
  type SupplierTone,
  type SupplierWaitingDoor,
  type TodayNextSecond,
  type TodayRowIcon,
  type TodayRowWords,
} from '@/lib/supplier-today';

/** The page's `cardTimestamp` — handed in so this file stays free of the overview module's server reads. */
export type CardSince = (card: WhatsNewCard) => Date;

export type SupplierTodayInput = {
  /** The desk, already split (`splitDesk`): the asks, oldest first, and the closed lines. */
  needsAnswer: readonly WhatsNewCard[];
  closed: readonly WhatsNewCard[];
  deskIncomplete: boolean;
  /** The next booked events (Setnayan), soonest first — the room read, capped at five. */
  upcoming: readonly UpcomingEventRow[];
  /** The schedules, the bookings from outside and the days off ahead (`readTodaySchedules`). */
  schedules: Pick<TodaySchedules, 'pools' | 'outside' | 'complete'>;
  /** The first-steps rail — non-null only on a shop not yet approved. */
  firstSteps: FirstStepsRail | null;
  /** Approved (`verification_state === 'verified'`). */
  verified: boolean;
  /** `shopFindability(...).findable` and the not-findable notice, when there is one. */
  findable: boolean;
  findability: { title: string; body: string; cta: { label: string; href: string } | null } | null;
  /** Unpaid booking fees (`billsForSurface(…, 'today')`), and whether the lock is enforced (`resolveFeeEnforcement`). */
  feeBills: readonly DueFeeBill[];
  feeEnforced: boolean;
  /** Payday — `fetchVendorEarningsSummary`, or null when not read (an event day does not read it). */
  earnings: { confirmedPhp: number; expectedPhp: number; paydayMeasured: boolean } | null;
  /** The credit about to expire (`todayCreditNotice` said yes), with its two figures. */
  credit: { creditPhp: number; tierExpiresAt: string | null; href: string } | null;
  payoutReadiness: PayoutReadiness;
  payoutHref: string;
  shop: {
    name: string;
    categoryWord: string | null;
    details: { done: number; total: number; complete: boolean };
    awardWord: string | null;
    milestoneWord: string | null;
  };
  /** Page views in the last 28 days (`readTodayViews`), and new inquiries in the same window. */
  views: number | null;
  inquiries28: number | null;
  /** Schedules already holding a booking on each asked day (`fetchVendorOverviewData().askDayHolds`). */
  askDayHolds?: Record<string, string[]>;
  /** The event day's own facts (`readEventDayFacts`) — only when the first booking is today. */
  dayFacts: EventDayFacts | null;
  /** `YYYY-MM-DD` in Manila, and the render instant. */
  todayIso: string;
  now: number;
  since: CardSince;
};

export type TodayAskRow = {
  card: WhatsNewCard;
  label: string;
  line: string;
  position: number;
  open: boolean;
  words: TodayRowWords;
};

export type SupplierTodayView = {
  next: SupplierNext;
  look: { tone: SupplierTone; icon: SupplierIcon };
  second: TodayNextSecond | null;
  counter: string | null;
  meta: string | null;
  who: string | null;
  eyebrow: string | null;
  nextNote: string | null;
  /** The Next card IS this booking ask — the page draws its answer ON the card. */
  askOnCard: Extract<WhatsNewCard, { kind: 'lock_request' }> | null;
  /**
   * What the supplier should know BEFORE Agree on the card's ask (prototype moments "ask" · "9 · hallask"): a hall
   * already booked that day, and an unapproved shop (its yes will be refused, `not_verified`). Facts only — the
   * refusal itself is still the RPC's, said after the press.
   */
  askNotes: Array<{ id: string; label: string; line: string; pill: { word: string; tone: 'wait' | 'no' }; icon: TodayRowIcon }>;
  /** The Next card IS this date change — Move · Unlock on the card. */
  dateChangeOnCard: Extract<WhatsNewCard, { kind: 'date_change' }> | null;
  numbers: {
    waiting: string | null;
    waitingNow: boolean;
    thisWeek: string;
    toComeInPhp: number | null;
    day: { next: string | null; checkedIn: string | null } | null;
  };
  alsoToday: Array<{ id: string; label: string; line: string | null; href: string; icon: TodayRowIcon }>;
  comingUp: Array<{ id: string; href: string; label: string; line: string | null; outside?: boolean }>;
  askRows: TodayAskRow[];
  alsoWaitingHeaded: boolean;
  doors: SupplierWaitingDoor[];
  /** The bills drawn as rows (the Next card's own bill left out), each worded, and the lock said once under them. */
  bills: DueFeeBill[];
  billCopy: (b: DueFeeBill) => FeeDisclosure;
  lockLine: string | null;
  shop: { name: string; line: string; pill: ShopPill };
  business: { line: string | null };
};

export function assembleSupplierToday(input: SupplierTodayInput): SupplierTodayView {
  const { needsAnswer, closed, upcoming, schedules, todayIso, now } = input;

  // ① THE NEXT CARD — LIVE's nine rules, unchanged.
  const setupStep = input.firstSteps?.current
    ? { title: input.firstSteps.current.title, body: input.firstSteps.current.body, cta: input.firstSteps.current.cta, href: input.firstSteps.current.href }
    : null;
  const feeRule = input.feeBills[0]
    ? { bill: input.feeBills[0], copy: feeDueCopy(input.feeBills[0], todayIso, input.feeEnforced) }
    : null;
  const nextAnswer = nextAnswerOf(needsAnswer);
  const owedPhp = owedToYouPhp(input.earnings);
  const next = pickSupplierNext({
    answer: nextAnswer,
    answerSince: nextAnswer ? input.since(nextAnswer) : null,
    deskIncomplete: input.deskIncomplete,
    upcoming,
    setupStep,
    findability: input.findability,
    fee: feeRule,
    owedPhp,
    now,
  });
  const nextIsAnswer = next.kind === 'answer' ? nextAnswer : null;

  // The queue, and its doors in the prototype's words.
  const payoutRule = payoutRuleOf(input.payoutReadiness);
  const waiting = supplierWaiting({
    next,
    needsAnswer,
    since: input.since,
    setupStep,
    findability: input.findability,
    credit: input.credit ? { ...creditDoorWords(input.credit.creditPhp, input.credit.tierExpiresAt), href: input.credit.href } : null,
    payout: payoutRule
      ? { title: PAYOUT_DOOR_WORDS.title, body: payoutRule.body, href: input.payoutHref, button: payoutRule.button }
      : null,
    now,
  });
  const askRows: TodayAskRow[] = [
    ...waiting.asks.map((a) => ({ ...a, words: todayRowWords(a.card, now) })),
    ...closed.map((card, i) => {
      const words = todayRowWords(card, now);
      return { card, label: words.label, line: words.line, position: waiting.asks.length + i + 1, open: false, words };
    }),
  ];

  // 🌑 The event day — open unless an unpaid fee keeps it locked (the day-of tools are what the lock holds back).
  const eventToday = upcoming[0] && upcoming[0].inDays <= 0 ? upcoming[0] : null;
  const dayLocked = Boolean(eventToday && input.feeEnforced && input.feeBills.some((b) => b.eventId === eventToday.eventId));
  const dayOpen = Boolean(eventToday && !dayLocked);

  // ③ COMING UP — Setnayan and outside, one list by date; a schedule's name only when there is more than one.
  const manyPools = schedules.pools.length > 1;
  const poolName = (id: string | null | undefined) => (manyPools && id ? (schedules.pools.find((p) => p.id === id)?.name ?? null) : null);
  const ahead = [
    ...(eventToday ? upcoming.slice(1) : upcoming).map((r) => ({
      date: r.date,
      row: {
        id: r.id,
        href: r.href,
        label: `${shortDay(r.date) ?? r.date} · ${r.eventName}`,
        line: [poolName(r.poolId), r.place].filter(Boolean).join(' · ') || null,
      },
    })),
    ...schedules.outside.map((o) => ({
      date: o.date,
      row: {
        id: `out-${o.blockId}`,
        href: daySheetHref(o.date),
        label: `${shortDay(o.date) ?? o.date} · ${o.clientName}`,
        line: [poolName(o.poolId), 'from outside'].filter(Boolean).join(' · '),
        outside: true,
      },
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const thisWeek = eventsThisWeek([
    ...upcoming,
    ...schedules.outside.map((o) => ({ inDays: daysFrom(todayIso, o.date) ?? 0 }) as UpcomingEventRow),
  ]);

  // ⑤ THE SHOP ROW.
  const pill = shopPillOf({ verified: input.verified, findable: input.findable });
  const docsWithSetnayan = input.firstSteps?.steps.find((st) => st.key === 'documents')?.state === 'waiting';
  const serviceWord = input.firstSteps
    ? (input.firstSteps.steps.find((st) => st.key === 'service_card')?.meter ?? 'No service yet')
    : input.shop.categoryWord;
  const shopLine = [
    serviceWord,
    shopStateWords({ pill, docsWithSetnayan }),
    input.shop.details.complete ? null : `details ${input.shop.details.done} of ${input.shop.details.total}`,
    input.shop.awardWord,
    input.shop.milestoneWord,
  ]
    .filter((p): p is string => Boolean(p))
    .join(' · ');

  const lockLine = feeLockLine(input.feeBills, todayIso, input.feeEnforced);

  // ✅ Before Agree, on the card's ask.
  const askOnCard = nextIsAnswer?.kind === 'lock_request' ? nextIsAnswer : null;
  const askNotes: SupplierTodayView['askNotes'] = [];
  if (askOnCard) {
    const day = askOnCard.eventDate;
    // How many bookings each schedule already holds that day (Setnayan + outside), against its own "how many a day"
    // (unknown → one). Only a FULL schedule is named — a church that takes two weddings a day is not "taken" by one.
    const held = new Map<string, number>();
    for (const id of [
      ...(input.askDayHolds?.[askOnCard.eventVendorId] ?? []),
      ...(day ? schedules.outside.filter((o) => o.date === day).map((o) => o.poolId) : []),
    ]) {
      held.set(id, (held.get(id) ?? 0) + 1);
    }
    const full = manyPools ? schedules.pools.filter((p) => (held.get(p.id) ?? 0) >= Math.max(1, p.cap ?? 1)) : [];
    const names = full.map((p) => p.name);
    if (names.length > 0) {
      askNotes.push({
        id: 'held',
        label: `${names.join(' and ')} ${names.length > 1 ? 'are' : 'is'} ${full.every((p) => (p.cap ?? 1) <= 1) ? 'booked' : 'full'} that day`,
        line: 'Check which of yours their booking needs before you agree',
        pill: { word: 'Taken', tone: 'no' },
        icon: 'calx',
      });
    }
    if (!input.verified) {
      askNotes.push({ id: 'verified', label: 'Not verified yet', line: 'Send your documents first — a yes is refused until then', pill: { word: 'Not yet', tone: 'wait' }, icon: 'check' });
    }
  }
  const bills = next.kind === 'fee' ? input.feeBills.slice(1) : [...input.feeBills];

  return {
    next,
    look: nextLook(next.kind, nextIsAnswer),
    second: todayNextSecond(next, nextIsAnswer, upcoming, feeRule),
    counter:
      next.kind === 'setup' && input.firstSteps?.current
        ? `${input.firstSteps.current.n} of ${input.firstSteps.actionable}`
        : waiting.counter,
    meta: nextMeta(nextIsAnswer, nextIsAnswer ? input.since(nextIsAnswer) : null, now),
    who: nextWho(next, nextIsAnswer),
    eyebrow: next.kind === 'run_day' ? `Today${dayOpen && input.dayFacts?.startedAt ? ` · live since ${input.dayFacts.startedAt}` : ''}` : null,
    // 🔒 The fee card names the lock BEFORE Pay (an overdue bill's own words already say it).
    nextNote: feeRule && next.kind === 'fee' && feeDueStage(feeRule.bill.dueOn, todayIso) !== 'overdue' ? lockLine : null,
    askOnCard,
    askNotes,
    dateChangeOnCard: nextIsAnswer?.kind === 'date_change' ? nextIsAnswer : null,
    numbers: {
      waiting: waitingOnYou(needsAnswer.length, input.deskIncomplete),
      waitingNow: needsAnswer.length > 0,
      thisWeek,
      toComeInPhp: owedPhp,
      day: dayOpen
        ? {
            next: input.dayFacts?.next?.time ?? null,
            checkedIn: input.dayFacts?.checkedIn == null ? null : String(input.dayFacts.checkedIn),
          }
        : null,
    },
    alsoToday:
      dayOpen && eventToday
        ? [
            {
              id: 'schedule',
              label: 'Schedule',
              line: input.dayFacts?.line ?? 'Their day and your call times',
              href: `/vendor-dashboard/on-the-day/live/${eventToday.eventId}`,
              icon: 'calendar',
            },
            { id: 'hub', label: 'Event Hub', line: 'Check-in · shot list · your tools for today', href: '/vendor-dashboard/on-the-day', icon: 'scan' },
          ]
        : [],
    comingUp: ahead.slice(0, 3).map((a) => a.row),
    askRows,
    alsoWaitingHeaded: askRows.length > 0 || input.deskIncomplete,
    doors: waiting.doors,
    bills,
    billCopy: (b) => feeRowCopy(b, todayIso),
    lockLine,
    shop: { name: input.shop.name, line: shopLine, pill },
    business: {
      line: input.verified ? businessLine({ views: input.views, asked: input.inquiries28 }) : 'Couples see your shop once you are live',
    },
  };
}

/** "Where couples pay you" — Set up while nothing is added; a plain line while Setnayan checks what was. */
function payoutRuleOf(r: PayoutReadiness): { body: string; button: string | null } | null {
  if (r === 'none') return { body: PAYOUT_DOOR_WORDS.body, button: 'Set up' };
  if (r === 'in_review') return { body: 'Waiting for Setnayan’s check', button: null };
  return null;
}
