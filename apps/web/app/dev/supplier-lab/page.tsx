/**
 * /dev/supplier-lab — the supplier dashboard redesign on fixture data: no
 * sign-in, no database (corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md`,
 * prototype `prototypes/supplier_dashboard_2026-10-08_fable.html`). DEV-ONLY:
 * production builds 404 this route, the same kill-switch as `/dev/home-lab`.
 * It draws the REAL supplier components, so what it shows is what ships.
 *
 *   ?s=today          Today — Next card "1 of 3", numbers, Coming up, Also waiting, Shop (frame 01)
 *   ?s=day            Today on an event day — the dark card, Run the day        (frame 02)
 *   ?s=fail           the desk and payday could not be read — said, never 0     (frame 15)
 *   ?s=datechange     the Next card is a date change — Move · Unlock            (frame 31)
 *   ?s=doors          the rules that are not a customer's ask, as rows — and two unpaid booking fees
 *   ?s=fees           one ask (the Next card) and two unpaid booking fees — the fees carry the "Also waiting" heading
 *   ?s=clear          nothing waiting
 *   &toast=1          the outcome: the shared top toast + the status line (&toast=refused · &toast=failed · &toast=note)
 *   ?thumb=people     the frosted thumb row: a search field (≥ 60 %) + Add     (frame 03)
 *   ?thumb=customer   Chat (main) · Quote · Payment · Call                     (frame 06)
 *   ?thumb=money      Log a payment — a form's submit through the button rule  (frame 05)
 *   ?s=people         Customers › People (S-PR2): segments, rows, outside clients, kept notes, search + Add (frame 03)
 *     &q=ana · &lane=outside|waiting|… · &add=1 (the Add sheet) · &toast=added|removed|failed
 *   ?s=clash          two couples holding one Saturday — the warn row above the list
 *   ?s=empty          nobody yet       ?s=fail   payday + roster could not be read — said     ?s=nopools  Add with no schedule
 *   ?s=dates          Customers › Dates (S-PR3): the month in kind 31, the picked day's rows, Block days · Waitlist ·
 *                     Capacity, QR codes (frame 04)  &open=block|waitlist|capacity · &toast=blocked|failed
 *   ?s=dates-free     one calendar, no waiting list on the plan (frame 29)   ?s=dates-empty  no calendar yet ("Not set")
 *   ?s=dates-day      one day (frame 35)   ?s=dates-dayblocked  a blocked day with a hold and a waiting list
 *   ?s=qr · qr-booked · qr-issued · qr-fail   the one QR codes page (frames 10 · 40) &open=issued
 *   ?s=money          Customers › Money (S-PR4): Received · To come in · meter, Next in ▾ rows, Setnayan fee rows,
 *                     This year, Log a payment (frame 05)  &next=next|all · &open=log
 *   ?s=money-waived   every fee waived (frame 30)   ?s=money-locked  the year on a plan without it
 *   ?s=money-empty    no payment plan yet           ?s=money-fail    nothing could be read — said, never ₱0 (frame 15)
 *
 * ⚠ The Today states mount the SHIPPED answer actions, exactly as the page
 * does — the lab adds no server action of its own. With no session every one
 * of them refuses; nothing is written from here.
 */
import { notFound } from 'next/navigation';
import { Check, MessageSquare, Phone, Plus, Send, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { SupplierTodayFirstScreen } from '@/app/vendor-dashboard/_components/supplier-today-first-screen';
import { SupplierToast } from '@/app/vendor-dashboard/_components/supplier-toast';
import { WhatsNewFeed, NothingToAnswerFeed } from '@/app/vendor-dashboard/_components/overview-sections';
import { acceptInquiry, declineInquiry } from '@/lib/chat-actions';
import {
  vendorAcknowledgeDeposit,
  vendorMarkServiceComplete,
  vendorRejectDeposit,
  vendorAgreeToLock,
  vendorDeclineLock,
  vendorAgreeToDeletion,
  vendorDeclineDeletion,
  vendorAnswerDateChange,
} from '@/app/vendor-dashboard/clients/[eventId]/actions';
import { postVendorReply } from '@/app/vendor-dashboard/reviews/actions';
import { respondAppointment } from '@/app/_components/appointments-actions';
import { cardTimestamp, type UpcomingEventRow, type WhatsNewCard } from '@/lib/vendor-overview';
import {
  eventsThisWeek,
  nextAnswerOf,
  nextLook,
  nextMeta,
  nextSecond,
  pickSupplierNext,
  supplierWaiting,
  waitingOnYou,
} from '@/lib/supplier-today';
import { splitDesk } from '@/lib/vendor-desk-disposition';
import { formatPesoCompact } from '@/lib/vendors-plan-budget';
import { todayCreditNotice } from '@/lib/vendor-credit-warning';
import { BookingFeeBills } from '@/app/_components/booking-fee-notice';
import { feeDueCopy, type DueFeeBill } from '@/lib/booking-fee-disclosure';
import { PeopleLab } from './people-lab';
import { DATES_STATES, DatesLab, type DatesState } from './dates-lab';
import { MONEY_STATES, MoneyLab, type MoneyState } from './money-lab';

const PEOPLE_STATES = ['people', 'clash', 'empty', 'fail', 'nopools'] as const;

export const dynamic = 'force-dynamic';

const ICON = { 'aria-hidden': true, strokeWidth: 1.9 } as const;

/* ── Today's fixtures — the prototype's own people and dates (frame 01). ── */
const NOW = Date.parse('2026-10-02T02:00:00Z'); // Fri Oct 2, 10:00 in Manila
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

const up = (id: string, eventName: string, date: string, place: string, inDays: number, thread = true): UpcomingEventRow => ({
  id: `up-${id}`,
  eventId: id,
  eventName,
  date,
  place,
  category: 'photo_video',
  inDays,
  href: `/vendor-dashboard/clients/${id}?tab=details`,
  threadHref: thread ? `/vendor-dashboard/messages/t-${id}` : null,
  opensCard: true,
});

const COMING = [
  up('reyes', 'Reyes debut', '2026-10-03', 'Tagaytay', 1),
  up('cruz', 'Cruz wedding', '2026-10-04', 'Makati', 2),
  up('bautista', 'Bautista christening', '2026-10-10', 'Quezon City', 8),
];

const REPLY: WhatsNewCard = {
  kind: 'message',
  id: 'msg-1',
  threadId: 't-ana',
  eventId: 'ana',
  coupleName: 'Ana & Miguel',
  excerpt: 'Are you free on March 13? About 150 guests in Tagaytay.',
  lastMessageAt: ago(2),
};
const BOOKING: WhatsNewCard = {
  kind: 'lock_request',
  id: 'ask-1',
  eventId: 'rolando',
  eventVendorId: 'ev-rolando',
  coupleName: 'Rolando & Carmen',
  eventDate: '2026-11-21',
  requestedAt: ago(20),
  expiresAt: new Date(NOW + 5 * 86_400_000).toISOString(),
};
const QUOTE: WhatsNewCard = {
  kind: 'quote_draft',
  id: 'quote-1',
  proposalId: 'p1',
  publicId: null,
  eventId: 'katrina',
  title: 'Katrina Ocampo · debut',
  totalCentavos: 4_500_000,
  createdAt: ago(40),
};
const DATE_CHANGE: WhatsNewCard = {
  kind: 'date_change',
  id: 'dc-1',
  eventId: 'cruz',
  eventVendorId: 'ev-cruz',
  coupleName: 'The Cruz wedding',
  fromDate: '2026-10-04',
  fromPrecision: 'day',
  proposedDate: '2026-10-11',
  proposedPrecision: 'day',
  askedAt: ago(20),
  dueAt: new Date(NOW + 2 * 86_400_000 - 3_600_000).toISOString(),
};
const LAPSED: WhatsNewCard = {
  kind: 'lock_request_lapsed',
  id: 'lapsed-1',
  eventId: 'old',
  eventVendorId: 'ev-old',
  coupleName: 'Jo & Sam',
  eventDate: '2026-12-05',
  requestedAt: ago(200),
  expiresAt: ago(30),
};

type TodayState = {
  whatsNew: WhatsNewCard[];
  upcoming: UpcomingEventRow[];
  deskIncomplete: boolean;
  owedPhp: number | null;
  extras?: boolean;
  /** Two unpaid booking fees, and nothing else under Also waiting. */
  bills?: boolean;
};

const TODAY: Record<string, TodayState> = {
  today: { whatsNew: [REPLY, BOOKING, QUOTE], upcoming: COMING, deskIncomplete: false, owedPhp: 48_000 },
  day: {
    whatsNew: [BOOKING],
    upcoming: [up('cruz', 'Cruz wedding', '2026-10-02', 'Makati Shangri-La', 0), COMING[2]!],
    deskIncomplete: false,
    owedPhp: 48_000,
  },
  fail: { whatsNew: [], upcoming: COMING, deskIncomplete: true, owedPhp: null },
  datechange: { whatsNew: [REPLY, DATE_CHANGE, BOOKING, LAPSED], upcoming: COMING, deskIncomplete: false, owedPhp: 48_000 },
  doors: { whatsNew: [REPLY], upcoming: COMING, deskIncomplete: false, owedPhp: 48_000, extras: true },
  fees: { whatsNew: [REPLY], upcoming: COMING, deskIncomplete: false, owedPhp: 48_000, bills: true },
  clear: { whatsNew: [], upcoming: [], deskIncomplete: false, owedPhp: 0 },
};

/* Two unpaid booking fees (`?s=doors`): the Next card shows the first, the hairline rows the second. */
const LAB_TODAY = '2026-10-02';
const FEE_BILLS: DueFeeBill[] = [
  { orderId: 'S89O-LAB0000001', amountPhp: 750, eventId: 'ana', coupleName: 'Ana & Miguel', dueOn: '2026-10-09' },
  { orderId: 'S89O-LAB0000002', amountPhp: 1200, eventId: 'rolando', coupleName: 'Rolando & Carmen', dueOn: '2026-10-01' },
];

const TOASTS: Record<string, { text: string; tone: 'ok' | 'note' | 'bad'; retry?: boolean }> = {
  '1': { text: 'Done — you told them you can move. Your held day moves with the date when they apply it.', tone: 'ok' },
  note: { text: 'You had already agreed to this one — nothing changed.', tone: 'note' },
  refused: {
    text: 'This request ran out of time before it was answered, so it has closed. If the couple still wants you, ask them to send it again.',
    tone: 'bad',
  },
  failed: { text: 'That did not go through. Nothing changed — please try again.', tone: 'bad', retry: true },
};

function TodayLab({ state, toast }: { state: TodayState; toast: string | undefined }) {
  const { answer: needsAnswer, news: nothingToAnswer } = splitDesk(state.whatsNew);
  const nextAnswer = nextAnswerOf(needsAnswer);
  const fee = state.extras ? { bill: FEE_BILLS[0]!, copy: feeDueCopy(FEE_BILLS[0]!, LAB_TODAY) } : null;
  const findability = state.extras
    ? { title: 'Couples can’t find you yet.', body: 'Your shop is approved, but it is not showing in the marketplace.', cta: { label: 'Ask us to list your shop', href: '/help#contact' } }
    : null;
  const next = pickSupplierNext({
    answer: nextAnswer,
    answerSince: nextAnswer ? cardTimestamp(nextAnswer) : null,
    deskIncomplete: state.deskIncomplete,
    upcoming: state.upcoming,
    setupStep: null,
    findability,
    fee,
    owedPhp: state.owedPhp,
    now: NOW,
  });
  const waiting = supplierWaiting({
    next,
    needsAnswer,
    since: cardTimestamp,
    setupStep: null,
    findability,
    // The shipped sentence, from the shipped rule — a credit that ends in three
    // days. The lab types no peso figure of its own (`public-price-literals`).
    credit: state.extras
      ? todayCreditNotice({ creditPhp: 2500, tierExpiresAt: new Date(NOW + 3 * 86_400_000).toISOString() }, NOW)
      : null,
    payout: state.extras
      ? { title: 'Add a payment method', body: 'You have bookings, and your couples can’t see anywhere to pay you yet.', href: '/vendor-dashboard/shop?open=payments#shop-folds' }
      : null,
    now: NOW,
  });
  const nextIsAnswer = next.kind === 'answer' ? nextAnswer : null;
  const actions = {
    acceptInquiry,
    declineInquiry,
    confirmLock: vendorAcknowledgeDeposit,
    rejectLock: vendorRejectDeposit,
    agreeLock: vendorAgreeToLock,
    declineLock: vendorDeclineLock,
    agreeDeletion: vendorAgreeToDeletion,
    declineDeletion: vendorDeclineDeletion,
    answerDateChange: vendorAnswerDateChange,
    postReviewReply: postVendorReply,
    respondMeeting: respondAppointment,
    markServiceComplete: vendorMarkServiceComplete,
  };
  return (
    <div className="min-h-screen bg-cream px-4 pb-32 pt-4" data-supplier-lab="today">
      {toast && TOASTS[toast] ? <SupplierToast {...TOASTS[toast]!} /> : null}
      <SupplierTodayFirstScreen
        next={next}
        look={nextLook(next.kind, nextIsAnswer)}
        second={nextSecond(next, nextIsAnswer, state.upcoming)}
        counter={waiting.counter}
        meta={nextMeta(nextIsAnswer, nextIsAnswer ? cardTimestamp(nextIsAnswer) : null, NOW)}
        dateChange={nextIsAnswer?.kind === 'date_change' ? { card: nextIsAnswer, answer: vendorAnswerDateChange } : null}
        numbers={{
          waiting: waitingOnYou(needsAnswer.length, state.deskIncomplete),
          waitingNow: needsAnswer.length > 0,
          thisWeek: eventsThisWeek(state.upcoming),
          toComeIn: state.owedPhp === null ? null : formatPesoCompact(state.owedPhp * 100),
        }}
        comingUp={(next.kind === 'run_day' ? state.upcoming.slice(1) : state.upcoming).slice(0, 3)}
        alsoWaitingHeaded={waiting.asks.length > 0 || state.deskIncomplete}
        doors={waiting.doors}
        hasBills={Boolean(state.extras || state.bills)}
        bills={
          state.extras || state.bills ? (
            <BookingFeeBills rows bills={next.kind === 'fee' ? FEE_BILLS.slice(1) : FEE_BILLS} copyFor={(b) => feeDueCopy(b, LAB_TODAY)} />
          ) : null
        }
        shop={{ name: 'Lumina Studio', line: 'Photo & video · Live', live: true }}
        alsoWaiting={
          <>
            <WhatsNewFeed cards={needsAnswer} asks={waiting.asks} incomplete={state.deskIncomplete} {...actions} />
            <NothingToAnswerFeed cards={nothingToAnswer} {...actions} />
          </>
        }
      />
    </div>
  );
}

export default async function SupplierLabPage({
  searchParams,
}: {
  searchParams: Promise<{ thumb?: string; s?: string; toast?: string; q?: string; lane?: string; add?: string; open?: string; next?: string; mpage?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  if (q.s && (PEOPLE_STATES as readonly string[]).includes(q.s)) {
    return <PeopleLab variant={q.s} q={q.q} lane={q.lane} toast={q.toast} add={q.add === '1'} />;
  }
  if (q.s && (DATES_STATES as readonly string[]).includes(q.s)) {
    return <DatesLab state={q.s as DatesState} toast={q.toast} open={q.open} />;
  }
  if (q.s && (MONEY_STATES as readonly string[]).includes(q.s)) {
    return <MoneyLab state={q.s as MoneyState} next={q.next} open={q.open} mpage={q.mpage} />;
  }
  const today = q.s ? TODAY[q.s] : undefined;
  if (today) return <TodayLab state={today} toast={q.toast} />;
  const thumb = q.thumb ?? 'people';
  return (
    <div className="min-h-screen bg-cream px-4 pb-40 pt-3" data-supplier-lab={thumb}>
      {/* Rows to scroll under the glass, so the frost has something to blur. */}
      <ul>
        {Array.from({ length: 14 }, (_, i) => (
          <li key={i} className="border-t border-ink/10 py-3 text-[15px] text-ink first:border-t-0">
            Customer {i + 1}
            <span className="block text-[13px] text-ink/60">Wedding · Mar 13, 2027 · Tagaytay</span>
          </li>
        ))}
      </ul>

      {thumb === 'customer' ? (
        <SupplierThumbRow name="customer" label="Customer actions">
          <ActionButton tone="brand" main icon={<MessageSquare {...ICON} />} label="Chat" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Send {...ICON} />} label="Quote" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Wallet {...ICON} />} label="Payment" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Phone {...ICON} />} label="Call" href="/dev/supplier-lab?thumb=customer" />
        </SupplierThumbRow>
      ) : thumb === 'money' ? (
        <SupplierThumbRow name="money" label="Money actions">
          {/* A GET form back to the lab: the submit is real, nothing is written. */}
          <form action="/dev/supplier-lab" className="contents">
            <input type="hidden" name="thumb" value="money" />
            <SupplierSubmit tone="brand" main icon={<Check {...ICON} />} label="Log a payment" pendingLabel="Saving…" overlay={false} />
          </form>
        </SupplierThumbRow>
      ) : (
        <SupplierThumbRow name="people" label="Customer tools">
          <input type="search" placeholder="Search a customer" aria-label="Search a customer" />
          <ActionButton tone="brand" main icon={<Plus {...ICON} />} label="Add" href="/dev/supplier-lab?thumb=people" />
        </SupplierThumbRow>
      )}
    </div>
  );
}
