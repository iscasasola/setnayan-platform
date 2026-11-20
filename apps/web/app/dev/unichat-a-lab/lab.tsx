/**
 * /dev/unichat-a-lab — Unichat part A's cards in ONE stream, so a single phone shot holds every kind (§4 proof beside
 * the drawing `UNICHAT-LIVE-2026-11-19`). The cards are the shipped ones on fixture data: no sign-in, no database.
 * DEV-ONLY: production builds 404 this route. Names and amounts are samples — nobody real (the drawing's own).
 *
 *   ?side=vendor|couple       whose chat (vendor wears the supplier look, as /vendor-dashboard does)
 *   ?scene=open|settled|failed   open cards (one is "Your turn") · every card settled to its ✓ line · reads that failed
 */
import { notFound } from 'next/navigation';
// The supplier side wears the supplier look, as every /vendor-dashboard page does (its layout imports this sheet).
import '@/app/vendor-dashboard/_components/supplier-look.css';
import { NegotiationCard } from '@/app/_components/chat/cards/negotiate-cards';
import type { ChangeAskRow, NegotiationQuote } from '@/app/_components/chat/cards/card-calls';
import { DroppedOfferCard } from '@/app/_components/chat/cards/offer-card';
import type { DroppedOffer } from '@/app/_components/chat/cards/offer-calls';
import { ScheduleChangeCard } from '@/app/_components/chat/cards/schedule-change-card';
import { FormAnswerCard } from '@/app/_components/chat/cards/form-step-card';
import { BookRequestCard } from '@/app/_components/chat/cards/book-request-card';
import { blankOffer, type Offer } from '@/lib/offers';
import { resolveSchedule } from '@/lib/proposal-payment-schedule';

const THREAD = '00000000-0000-4000-8000-00000000a11a';
const BACK = '/dev/unichat-a-lab';
const TODAY = '2026-11-20';
const C = (php: number) => php * 100; // centavos

// The drawing's deal: Lumina's v2 at ₱51,000 in two payments; the hosts ask ₱40,000, good until 24 Nov.
const LINES = [
  { key: 'l0', label: 'Lights and sound', detail: null, amountCentavos: C(36_000) },
  { key: 'l1', label: 'Extra moving heads', detail: null, amountCentavos: C(15_000) },
];
const QUOTE: NegotiationQuote = {
  proposalId: '00000000-0000-4000-8000-0000000000a2',
  title: 'Lights and sound',
  status: 'sent',
  totalCentavos: C(51_000),
  lines: LINES,
  planRows: [
    { seq: 0, label: 'Downpayment', amount_centavos: C(25_500) },
    { seq: 1, label: 'Final balance', amount_centavos: C(25_500), is_auto_balance: true },
  ],
  creditCentavos: 0,
  floorCentavos: null,
  paidSeqs: [],
  locks: { quote: false, plan: false },
};
const ASK = (over: Partial<ChangeAskRow>): ChangeAskRow => ({
  askId: 'c1', subject: 'quote', note: 'Can you meet our budget? It is tight.', askedAt: `${TODAY}T02:00:00Z`, status: 'open',
  proposalId: QUOTE.proposalId, amountCentavos: C(40_000), scopeLabel: null, goodUntil: '2026-11-24', raisedBy: 'host', ...over,
});
const PLAN_ASK = (over: Partial<ChangeAskRow>) =>
  ASK({
    askId: 'p1', subject: 'plan', amountCentavos: null, raisedBy: 'supplier', note: 'Three payments, if that helps?',
    proposedPlan: [
      { seq: 0, label: 'Downpayment', amount_centavos: C(17_000) },
      { seq: 1, label: 'Second payment', amount_centavos: C(17_000) },
      { seq: 2, label: 'Final balance', amount_centavos: C(17_000), is_auto_balance: true },
    ],
    ...over,
  });

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function UnichatALab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const side = sp.side === 'couple' ? 'couple' : 'vendor';
  const scene = sp.scene === 'settled' || sp.scene === 'failed' ? sp.scene : 'open';
  const vendor = side === 'vendor';
  const supplierName = 'Lumina Lights & Sound';

  const offer: Offer = { ...blankOffer('S89D-LAB000000A'), name: 'Book early', phpOff: 3000, untilDate: addDays(TODAY, 30) };
  const plan = resolveSchedule({
    manual: [{ label: 'Downpayment', kind: 'percent', amountPhp: null, percent: 50, due: 'on_lock', offsetDays: 0 }],
    autoBalance: { label: 'Final balance', due: 'before_event', offsetDays: 14 },
    baseCentavos: C(51_000),
    creditCentavos: 0,
  });
  const drop = (over: Partial<DroppedOffer>): DroppedOffer => ({
    messageId: '00000000-0000-4000-8000-0000000d0d0a',
    droppedAt: `${TODAY}T01:00:00Z`,
    goodUntil: '2026-11-26',
    markerPresent: true,
    offer,
    appliedIn: null,
    quote: { lines: LINES.map((l) => ({ label: l.label, detail: l.detail, amount_centavos: l.amountCentavos })), totalCentavos: C(51_000), cardIds: [], schedule: plan },
    eventDate: '2027-03-13',
    versions: [],
    ...over,
  });
  const settled = scene === 'settled';
  const posted = `${TODAY}T02:00:00Z`;

  const stream =
    scene === 'failed' ? (
      <>
        {/* No seed: each card asks the server, which a lab cannot answer — the honest failed read, never an empty card. */}
        <NegotiationCard threadId={THREAD} kind="counter" askedAt={posted} viewer={side} />
        <FormAnswerCard threadId={THREAD} title="Event day details" returnPath={BACK} />
        <ScheduleChangeCard threadId={THREAD} createdAt={posted} chapter="Reception" from="5:30 PM" to="6:00 PM" shift="+30 min" viewer={side} supplierName={vendor ? 'you' : supplierName} />
      </>
    ) : (
      <>
        <NegotiationCard
          threadId={THREAD}
          kind="counter"
          askedAt={posted}
          viewer={side}
          seed={{ ask: ASK(settled ? { status: 'accepted' } : vendor ? {} : { raisedBy: 'supplier', note: 'We can meet you halfway.', amountCentavos: C(45_000) }), quote: QUOTE, today: TODAY }}
        />
        <NegotiationCard threadId={THREAD} kind="plan" askedAt={posted} viewer={side} seed={{ ask: PLAN_ASK(settled ? { status: 'accepted' } : {}), quote: QUOTE, today: TODAY }} />
        <DroppedOfferCard messageId="lab" viewer={vendor ? 'supplier' : 'couple'} kicker={vendor ? 'You · 9:02 AM' : 'Lumina · 9:02 AM'} seed={drop(settled ? { appliedIn: 3 } : {})} />
        <ScheduleChangeCard
          threadId={THREAD}
          createdAt={posted}
          chapter="Reception"
          from="5:30 PM"
          to="6:00 PM"
          shift="+30 min"
          viewer={side}
          supplierName={vendor ? 'you' : supplierName}
          seed={{ eventId: 'lab-event', seenAt: settled ? `${TODAY}T03:00:00Z` : null }}
        />
        <BookRequestCard state={settled ? 'booked' : 'asked'} reason={null} supplierName={supplierName} at="Today 10:42" />
      </>
    );

  return (
    <main className="min-h-dvh bg-page px-4 py-6" data-lab-unichat-a={`${side}:${scene}`} {...(vendor ? { 'data-supplier-look': '' } : {})}>
      <div className="mx-auto grid max-w-3xl">{stream}</div>
    </main>
  );
}
