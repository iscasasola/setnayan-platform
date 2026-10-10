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
 *   ?s=folds&open=K   every answer that opens inside a Today row, with the fold of kind K open
 *                     (lock_request · lock · meeting · date_change · delete_request · inquiry ·
 *                     review · mark_complete) — S-PR1b, the button rule inside the folds
 *   &toast=1          the outcome toast (&toast=refused for a refusal)
 *   ?s=people         Customers › People — the prototype's six customers        (frame 03)
 *   ?s=people&v=more  …and every state the prototype does not draw: holding, a
 *                     booking window that closed, a flagged delay, a missed
 *                     meeting time, an outside client, kept notes, a date clash,
 *                     a read that failed (&v=unread), nobody yet (&v=empty)
 *                     (&lane= and &q= narrow it, exactly as on the page)
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
import { WhatsNewFeed } from '@/app/vendor-dashboard/_components/overview-sections';
import { CustomersRoster, type RosterRow } from '@/app/vendor-dashboard/customers/_components/customers-roster';
import { CustomersPick } from '@/app/vendor-dashboard/customers/_components/customers-pick';
import { CustomersSegments } from '@/app/vendor-dashboard/customers/_components/customers-segments';
import { PeopleThumb } from '@/app/vendor-dashboard/customers/_components/people-thumb';
import { NO_FACTS, peopleRowView, type PeopleFacts } from '@/app/vendor-dashboard/customers/people-row';
import { rosterView } from '@/app/vendor-dashboard/customers/roster-view';
import { CUSTOMER_LANES, groupByLane, holdingByDate, type PipelineCustomer } from '@/lib/vendor-customer-pipeline';
import { formatCount } from '@/lib/format-number';
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

/* ── S-PR1b · one of every answer that opens inside a row. ── */
const PAYMENT: WhatsNewCard = {
  kind: 'lock',
  id: 'pay-1',
  eventId: 'cruz',
  eventVendorId: 'ev-cruz-pay',
  coupleName: 'Jun & Liza Cruz',
  eventDate: '2026-10-04',
  proofUrl: 'https://example.com/receipt.jpg',
  recordedAt: ago(5),
};
const MEETING: WhatsNewCard = {
  kind: 'meeting',
  id: 'meet-1',
  appointmentId: 'ap-1',
  eventId: 'bautista',
  vendorProfileId: 'vp-lab',
  coupleName: 'Lourdes Bautista',
  label: 'Tasting',
  meetingKind: 'in_person',
  location: 'Quezon City',
  scheduledAt: new Date(NOW + 3 * 86_400_000).toISOString(),
  durationMin: 60,
  proposedAt: ago(6),
  passed: false,
};
const DATE_CHANGE_2: WhatsNewCard = { ...DATE_CHANGE, id: 'dc-2', eventId: 'reyes', eventVendorId: 'ev-reyes', coupleName: 'The Reyes debut', fromDate: '2026-10-03', proposedDate: '2026-10-17' };
const REMOVE: WhatsNewCard = { kind: 'delete_request', id: 'del-1', eventId: 'paolo', eventVendorId: 'ev-paolo', eventDate: '2026-08-15', requestedAt: ago(90) };
const INQUIRY = {
  kind: 'inquiry',
  id: 'inq-1',
  threadId: 't-new',
  eventId: 'new',
  descriptor: 'Cale & Ice',
  eventDate: '2027-03-13',
  category: 'Photo & video',
  paxAtInquiry: 150,
  messageExcerpt: 'Are you free on March 13?',
  createdAt: ago(3),
} as unknown as WhatsNewCard;
const REVIEW: WhatsNewCard = { kind: 'review', id: 'rev-1', reviewId: 'rv-1', coupleName: 'Paolo & Nina', quote: 'Lovely work, on time.', rating: 5, createdAt: ago(30) };
const DELIVERED: WhatsNewCard = { kind: 'mark_complete', id: 'done-1', eventVendorId: 'ev-done', eventId: 'done', eventName: 'Santos wedding', eventDate: '2026-09-20', createdAt: ago(50) };

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
  // The first date change takes the Next card (frame 31); the second is a row.
  folds: {
    whatsNew: [DATE_CHANGE, BOOKING, PAYMENT, MEETING, DATE_CHANGE_2, REMOVE, INQUIRY, REVIEW, DELIVERED],
    upcoming: COMING,
    deskIncomplete: false,
    owedPhp: 48_000,
  },
};

function TodayLab({ state, toast, open }: { state: TodayState; toast: string | undefined; open?: string }) {
  const { answer: needsAnswer } = splitDesk(state.whatsNew);
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
            <WhatsNewFeed
              cards={needsAnswer}
              // `&open=<kind>` opens that kind's row — the lab's way to picture one fold.
              asks={open ? waiting.asks.map((a) => ({ ...a, open: a.card.kind === open })) : waiting.asks}
              incomplete={state.deskIncomplete}
              {...actions}
            />
          </>
        }
      />
    </div>
  );
}

/* ── S-PR2 · Customers › People — the prototype's six (frame 03), then the rest. ── */
const person = (o: Partial<PipelineCustomer> & Pick<PipelineCustomer, 'eventId' | 'lane' | 'title'>): PipelineCustomer => ({
  waitingKind: null,
  waitingSince: null,
  expiresAt: null,
  quietDays: null,
  identityRevealed: true,
  eventDate: null,
  place: null,
  threadId: null,
  eventVendorId: null,
  ...o,
});
type LabPerson = { c: PipelineCustomer; type: string | null; asked?: string[]; facts?: Partial<PeopleFacts>; outside?: RosterRow['outside'] };
const paid = (expectedPhp: number, collectedPhp: number) => ({
  expectedPhp,
  collectedPhp,
  balancePhp: Math.max(0, expectedPhp - collectedPhp),
  fullyPaid: expectedPhp > 0 && collectedPhp >= expectedPhp,
  allUnresolved: false,
  installmentCount: 2,
});
const SIX: LabPerson[] = [
  { c: person({ eventId: 'ana', lane: 'waiting', waitingKind: 'inquiry', waitingSince: ago(2), title: 'Ana & Miguel', eventDate: '2027-03-13', place: 'Tagaytay', threadId: 't-ana' }), type: 'Wedding', asked: ['Photography', 'Videography'] },
  { c: person({ eventId: 'rolando', lane: 'waiting', waitingKind: 'booking_ask', waitingSince: ago(20), expiresAt: new Date(NOW + 28 * 3_600_000).toISOString(), title: 'Rolando & Carmen', eventDate: '2026-11-21', place: 'Makati', threadId: 't-rc', eventVendorId: 'ev-rc' }), type: 'Wedding' },
  { c: person({ eventId: 'katrina', lane: 'talking', title: 'Katrina Ocampo', eventDate: '2026-10-03', place: 'Tagaytay', threadId: 't-ko' }), type: 'Debut', facts: { quoted: true } },
  { c: person({ eventId: 'cruz', lane: 'booked', title: 'Jun & Liza Cruz', eventDate: '2026-10-04', place: 'Makati', threadId: 't-jc' }), type: 'Wedding', facts: { money: paid(85_000, 43_000), nextDue: { amountPhp: 42_000, dueDate: '2026-10-03' } } },
  { c: person({ eventId: 'bautista', lane: 'booked', title: 'Lourdes Bautista', eventDate: '2026-10-10', place: 'QC', threadId: 't-lb' }), type: 'Christening', facts: { money: paid(30_000, 30_000) } },
  { c: person({ eventId: 'paolo', lane: 'finished', title: 'Paolo & Nina', eventDate: '2026-08-15', place: 'Cebu', threadId: 't-pv' }), type: 'Wedding', facts: { money: paid(60_000, 60_000) } },
];
const MORE: LabPerson[] = [
  { c: person({ eventId: 'jo', lane: 'waiting', waitingKind: 'booking_ask', waitingSince: ago(200), expiresAt: ago(30), title: 'Jo & Sam', eventDate: '2026-12-05', place: 'Pasig', eventVendorId: 'ev-old' }), type: 'Wedding' },
  { c: person({ eventId: 'mara', lane: 'holding', quietDays: 9, title: 'Mara & Dan', eventDate: '2027-02-14', place: 'Taguig', threadId: 't-md' }), type: 'Wedding', asked: ['Photography'] },
  { c: person({ eventId: 'ivy', lane: 'holding', quietDays: 12, title: 'Ivy Santos', eventDate: '2027-02-14', place: 'Antipolo', threadId: 't-iv' }), type: 'Debut' },
  { c: person({ eventId: 'ben', lane: 'talking', title: 'Ben & Tala', eventDate: null, place: null, threadId: 't-bt' }), type: 'Wedding', facts: { quoted: false } },
  { c: person({ eventId: 'reyes', lane: 'booked', title: 'Reyes debut', eventDate: '2026-10-03', place: 'Tagaytay', threadId: 't-ry' }), type: 'Debut', facts: { delayFlagged: true, money: paid(45_000, 45_000) } },
  { c: person({ eventId: 'gina', lane: 'booked', title: 'Gina & Rob', eventDate: '2026-11-07', place: 'Batangas', threadId: 't-gr' }), type: 'Wedding', facts: { meetingPassed: true } },
  { c: person({ eventId: 'outside:b1', lane: 'booked', title: 'Dela Cruz reunion', eventDate: '2026-10-18' }), type: null, outside: { blockId: 'b1', schedule: 'Main team', contact: '0917 555 0100', note: 'Paid in cash, half-day.' } },
];

function PeopleLab({ v, lane, q }: { v: string | undefined; lane: string | undefined; q: string | undefined }) {
  const people = v === 'empty' ? [] : v === 'more' || v === 'unread' ? [...SIX, ...MORE] : SIX;
  const by = new Map(people.map((p) => [p.c.eventId, p]));
  const derived = people.map((p) => p.c);
  const lanes = groupByLane(derived);
  const picked = rosterView(lanes, { lane, q, page: undefined, decorate: (r) => r });
  const rows: RosterRow[] = picked.paged.items.map((r) => {
    const p = by.get(r.eventId)!;
    const facts: PeopleFacts = { ...NO_FACTS, quoted: v === 'unread' ? null : false, moneyRead: v !== 'unread', ...(v === 'unread' ? {} : p.facts) };
    return {
      ...r,
      outside: p.outside ?? null,
      eventType: p.type,
      askedAbout: p.asked ?? [],
      view: p.outside
        ? { pill: { label: 'Outside', tone: 'quiet' }, line: null, lineTone: null, opens: 'card', closed: null }
        : peopleRowView(r, facts, NOW),
    };
  });
  const href = (l: string | null) => `/dev/supplier-lab?s=people${v ? `&v=${v}` : ''}${l ? `&lane=${l}` : ''}`;
  const words: Record<string, string> = { waiting: 'Waiting', holding: 'Holding', talking: 'Talking', booked: 'Booked', finished: 'Done' };
  return (
    <div className="min-h-screen bg-cream px-4 pb-36 pt-3" data-supplier-lab="people">
      <CustomersSegments active="people" waiting={picked.laneCounts.waiting} />
      <CustomersRoster
        rows={rows}
        paged={{ ...picked.paged, items: rows }}
        query={q ?? ''}
        incomplete={v === 'unread'}
        closedLinesUnread={v === 'unread'}
        pagerKeepParams={`s=people${v ? `&v=${v}` : ''}`}
        clearSearchHref={href(lane ?? null)}
        counts={picked.laneCounts}
        holdingPerDate={holdingByDate(derived)}
        keptNotes={v === 'more' ? [{ noteId: 'n1', body: 'Prefers candid shots. Call the planner, not the bride.', createdAt: ago(900) }, { noteId: 'n2', body: 'Venue load-in is at the back gate.', createdAt: ago(1400) }] : []}
        filter={
          <CustomersPick
            label="Filter"
            value={picked.activeLane ?? 'all'}
            dataAttr="data-customers-filter"
            options={[
              { key: 'all', label: `Everyone · ${formatCount(CUSTOMER_LANES.reduce((n, l) => n + picked.laneCounts[l], 0))}`, href: href(null) },
              ...CUSTOMER_LANES.map((l) => ({ key: l, label: `${words[l]} · ${formatCount(picked.laneCounts[l])}`, href: href(l) })),
            ]}
          />
        }
      />
      <PeopleThumb
        query={q ?? ''}
        addForm={
          <div className="grid gap-2">
            <h2 id="people-add-title" className="pr-10 text-lg font-semibold text-ink">
              Add an outside client · free
            </h2>
            <p className="text-[13px] text-ink/60">The lab draws the sheet; the page puts the shipped form in it.</p>
          </div>
        }
      />
    </div>
  );
}

export default async function SupplierLabPage({
  searchParams,
}: {
  searchParams: Promise<{ thumb?: string; s?: string; toast?: string; open?: string; v?: string; lane?: string; q?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  if (q.s === 'people') return <PeopleLab v={q.v} lane={q.lane} q={q.q} />;
  const today = q.s ? TODAY[q.s] : undefined;
  if (today) return <TodayLab state={today} toast={q.toast} open={q.open} />;
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
