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
 *   ?s=doors          the rules that are not a customer's ask, as rows
 *   ?s=clear          nothing waiting
 *   &toast=1          the outcome toast (&toast=refused for a refusal)
 *   ?thumb=people     the frosted thumb row: a search field (≥ 60 %) + Add     (frame 03)
 *   ?thumb=customer   Chat (main) · Quote · Payment · Call                     (frame 06)
 *   ?thumb=money      Log a payment — a form's submit through the button rule  (frame 05)
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
  clear: { whatsNew: [], upcoming: [], deskIncomplete: false, owedPhp: 0 },
};

function TodayLab({ state, toast }: { state: TodayState; toast: string | undefined }) {
  const { answer: needsAnswer, news: nothingToAnswer } = splitDesk(state.whatsNew);
  const nextAnswer = nextAnswerOf(needsAnswer);
  const fee = state.extras
    ? {
        bill: { orderId: 'S89O-LAB0000001' } as never,
        copy: { headline: 'A booking fee is due', detail: 'Pay it to open this event’s Event Hub.', tone: 'due' } as never,
      }
    : null;
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
    credit: state.extras
      ? { title: 'Your ₱2,500 credit expires in 3 days', body: 'Renew your plan to keep it.', href: '/vendor-dashboard/subscription' }
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
      {toast ? (
        <SupplierToast
          text={toast === 'refused' ? 'That did not go through. Nothing changed — please try again.' : 'They are told. Your booking moves when they apply the new date.'}
          refused={toast === 'refused'}
        />
      ) : null}
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
  searchParams: Promise<{ thumb?: string; s?: string; toast?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
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
          <ActionButton tone="info" main icon={<MessageSquare {...ICON} />} label="Chat" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Send {...ICON} />} label="Quote" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Wallet {...ICON} />} label="Payment" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Phone {...ICON} />} label="Call" href="/dev/supplier-lab?thumb=customer" />
        </SupplierThumbRow>
      ) : thumb === 'money' ? (
        <SupplierThumbRow name="money" label="Money actions">
          {/* A GET form back to the lab: the submit is real, nothing is written. */}
          <form action="/dev/supplier-lab" className="contents">
            <input type="hidden" name="thumb" value="money" />
            <SupplierSubmit tone="ok" main icon={<Check {...ICON} />} label="Log a payment" pendingLabel="Saving…" overlay={false} />
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
