/**
 * /dev/chat-cards-c-lab — Supplier Build 3 · lane C's step-by-step cards on fixture data: no sign-in, no database.
 * DEV-ONLY: production builds 404 this route. Names and amounts are samples — nobody real.
 *
 *   ?m=quote|payment|logpay|form|answer|files|decision|ask|askcard|counter|countercard|plan|plancard|recount|book   the card
 *   &e=1                                                                          its honest EMPTY state
 *   &step=N                                                                       open on step N (filled up to it)
 */
import { notFound } from 'next/navigation';
import { QuoteStepCard } from '@/app/_components/chat/cards/quote-step-card';
import { PaymentStepCard } from '@/app/_components/chat/cards/payment-step-card';
import { LogPaymentCard } from '@/app/_components/chat/cards/log-payment-card';
import { FormAnswerCard, FormStepCard } from '@/app/_components/chat/cards/form-step-card';
import { FilesStepCard } from '@/app/_components/chat/cards/files-step-card';
import { DecisionStepCard } from '@/app/_components/chat/cards/decision-step-card';
import { AskChangeDoor, ChangeAskCard } from '@/app/_components/chat/cards/ask-change-card';
import { NegotiateDraft, NegotiationCard } from '@/app/_components/chat/cards/negotiate-cards';
import type { ChangeAskRow, NegotiationQuote } from '@/app/_components/chat/cards/card-calls';
import { GuestRecountCard } from '@/app/_components/chat/cards/guest-recount-card';
import { BookRequestCard } from '@/app/_components/chat/cards/book-request-card';
import type { QuoteForCard } from '@/app/_components/chat/cards/card-calls';
import { planLedger } from '@/lib/chat-cards';

const THREAD = '00000000-0000-4000-8000-00000000c0de';
const EVENT = '00000000-0000-4000-8000-0000000e0e0e';
const EVENT_DAY = '2027-03-13';
const BACK = '/dev/chat-cards-c-lab';
const C = (php: number) => php * 100; // centavos

const QUOTE: QuoteForCard = {
  proposalId: '00000000-0000-4000-8000-0000000000a1',
  publicId: 'S89P-LAB0000001',
  title: 'Full-day coverage',
  status: 'accepted',
  totalCentavos: C(60_000),
  lines: [
    { key: 'l0', label: 'Full-day coverage', detail: null, amountCentavos: C(45_000) },
    { key: 'l1', label: 'Second shooter', detail: null, amountCentavos: C(9_000) },
    { key: 'l2', label: 'Guest portrait prints', detail: `150 × 40`, amountCentavos: C(6_000) },
  ],
  validUntil: null,
  paymentMethodIds: [],
  gift: null,
  serviceCardIds: [],
  plan: {
    manual: [{ label: 'First payment', kind: 'fixed', amountPhp: 30_000, percent: null, due: 'on_lock', offsetDays: 0 }],
    autoBalance: { label: 'Final balance', due: 'before_event', offsetDays: 14 },
  },
  creditCentavos: 0,
  floorCentavos: C(60_000),
  paidSeqs: [0],
  locks: { quote: false, plan: false },
  extras: [
    { id: 'x1', label: 'Drone coverage', qty: 1, pricePhp: 5_000 },
    { id: 'x2', label: 'Same-day edit', qty: 1, pricePhp: 9_800 },
  ],
  pax: 150,
  requote: 'ok',
};

// 🤝 PR-3 negotiation fixture — ₱60,000, the first ₱30,000 paid; read against a fixed "today" so the shots are stable.
const TODAY = '2026-11-12';
const NEGO: NegotiationQuote = {
  proposalId: QUOTE.proposalId,
  title: QUOTE.title,
  status: 'sent',
  totalCentavos: C(60_000),
  lines: QUOTE.lines,
  planRows: [
    { seq: 0, label: 'First payment', amount_centavos: C(30_000) },
    { seq: 1, label: 'Final balance', amount_centavos: C(30_000), is_auto_balance: true },
  ],
  creditCentavos: 0,
  floorCentavos: C(30_000),
  paidSeqs: [0],
  locks: { quote: false, plan: false },
};
const COUNTER = (over: Partial<ChangeAskRow>): ChangeAskRow => ({
  askId: 'c1', subject: 'quote', note: 'Our budget tops out here — can we meet at this?', askedAt: `${TODAY}T02:00:00Z`, status: 'open',
  proposalId: QUOTE.proposalId, amountCentavos: C(55_000), scopeLabel: null, goodUntil: '2026-11-18', raisedBy: 'host', ...over,
});

const FORMS = [
  { formId: 'f1', title: 'Wedding day details', questions: ['Where do you get ready?', 'Who are the VIPs we must not miss?', 'Any family to keep apart in photos?'] },
  { formId: 'f2', title: 'Shot list', questions: ['Must-have shots?', 'Anything you do not want?'] },
];

export default async function LaneCLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'quote';
  const empty = sp.e === '1';
  const step = Math.max(0, (Number(sp.step ?? 1) || 1) - 1);
  const ledger = planLedger({ manual: QUOTE.plan!.manual, autoBalance: QUOTE.plan!.autoBalance, agreedCentavos: QUOTE.totalCentavos, paidSeqs: new Set([0]) });

  const card = (() => {
    switch (m) {
      case 'quote':
        return (
          <QuoteStepCard
            threadId={THREAD}
            eventDate={EVENT_DAY}
            seed={
              empty
                ? { quote: null }
                : { quote: QUOTE, step, edits: step >= 3 ? [{ op: 'add', key: 'n1', label: 'Drone coverage', amountCentavos: C(5_000) }, { op: 'edit', key: 'l1', amountCentavos: C(9_800) }] : [] }
            }
          />
        );
      case 'payment':
        return <PaymentStepCard threadId={THREAD} eventId={EVENT} eventDate={EVENT_DAY} returnPath={BACK} seed={empty ? { ledger: null } : { ledger, step, pick: step > 0 ? '1' : undefined, amountPhp: step > 0 ? '30000' : undefined }} />;
      case 'logpay':
        return (
          <LogPaymentCard
            threadId={THREAD}
            seed={
              empty
                ? { target: { eventId: EVENT, vendorId: null } }
                : { target: { eventId: EVENT, vendorId: 'v1', toCoordinator: true, supplierName: 'Araw Events' }, step, draft: { amountPhp: step > 0 ? 10_000 : null, method: step > 1 ? 'GCash' : null, reference: step > 2 ? '4471 0098' : '', paidOn: step > 3 ? '2026-11-08' : null } }
            }
          />
        );
      case 'form':
        return <FormStepCard threadId={THREAD} eventId={EVENT} returnPath={BACK} seed={empty ? { forms: [] } : { forms: FORMS, step, pick: step > 0 ? 'f1' : undefined }} />;
      case 'answer':
        return (
          <FormAnswerCard
            threadId={THREAD}
            title="Wedding day details"
            returnPath={BACK}
            seed={{
              eventId: EVENT,
              vendorProfileId: 'shop',
              formId: 'f1',
              title: 'Wedding day details',
              locked: false,
              questions: FORMS[0]!.questions.map((p, i) => ({ id: `q${i}`, prompt: p, answer: empty ? null : i === 0 ? 'At the Manila Hotel, room 1204' : null })),
            }}
          />
        );
      case 'files':
        return <FilesStepCard side={empty ? 'couple' : 'vendor'} seed={{ src: 'phone', step }} />;
      case 'decision':
        return <DecisionStepCard threadId={THREAD} />;
      case 'ask':
        return (
          <div className="grid gap-1 py-2">
            <p className="text-[15px] font-semibold">Full-day coverage · v2</p>
            <AskChangeDoor threadId={THREAD} supplierName="Lumina Studio" proposalId={QUOTE.proposalId} locks={empty ? { quote: true, plan: true } : {}} returnPath={BACK} />
          </div>
        );
      case 'askcard':
        return (
          <div className="grid gap-3">
            <ChangeAskCard threadId={THREAD} subject="quote" askedAt={new Date().toISOString()} viewer="vendor" returnPath={BACK} seed={{ askId: 'a1', subject: 'quote', note: 'Can we add a drone shot at sunset?', askedAt: new Date().toISOString(), status: empty ? 'declined' : 'open', proposalId: null }} />
            <ChangeAskCard threadId={THREAD} subject="plan" askedAt={new Date().toISOString()} viewer="couple" returnPath={BACK} seed={{ askId: 'a2', subject: 'plan', note: 'Could the second payment move to February?', askedAt: new Date().toISOString(), status: 'open', proposalId: null }} />
          </div>
        );
      case 'counter':
        return <NegotiateDraft threadId={THREAD} kind="counter" viewer="couple" supplierName="Lumina Studio" returnPath={BACK} seed={{ quote: empty ? { ...NEGO, locks: { quote: true, plan: false } } : NEGO, today: TODAY, amount: '55000' }} />;
      case 'plan':
        return <NegotiateDraft threadId={THREAD} kind="plan" viewer={empty ? 'vendor' : 'couple'} supplierName="Lumina Studio" returnPath={BACK} seed={{ quote: empty ? { ...NEGO, locks: { quote: false, plan: true } } : sp.paid === '1' ? NEGO : { ...NEGO, paidSeqs: [], floorCentavos: null }, today: TODAY }} />;
      case 'countercard':
        return (
          <div className="grid gap-3">
            <NegotiationCard threadId={THREAD} kind="counter" askedAt={`${TODAY}T02:00:00Z`} viewer="vendor" seed={{ ask: COUNTER({}), quote: NEGO, today: TODAY }} />
            <NegotiationCard threadId={THREAD} kind="counter" askedAt={`${TODAY}T02:00:00Z`} viewer="couple" seed={{ ask: COUNTER({ status: 'accepted' }), quote: NEGO, today: TODAY }} />
            <NegotiationCard threadId={THREAD} kind="counter" askedAt={`${TODAY}T02:00:00Z`} viewer="vendor" seed={{ ask: COUNTER({ goodUntil: '2026-11-10', askedAt: '2026-11-04T02:00:00Z' }), quote: NEGO, today: TODAY }} />
          </div>
        );
      case 'plancard':
        return (
          <NegotiationCard
            threadId={THREAD}
            kind="plan"
            askedAt={`${TODAY}T02:00:00Z`}
            viewer="couple"
            seed={{
              ask: COUNTER({
                amountCentavos: null, subject: 'plan', raisedBy: 'supplier', note: 'Three payments, if that helps?',
                proposedPlan: [
                  { seq: 0, label: 'First payment', amount_centavos: C(30_000) },
                  { seq: 1, label: 'Second payment', amount_centavos: C(15_000) },
                  { seq: 2, label: 'Final balance', amount_centavos: C(15_000), is_auto_balance: true },
                ],
              }),
              quote: NEGO,
              today: TODAY,
            }}
          />
        );
      case 'recount':
        return <GuestRecountCard threadId={THREAD} from={150} to={170} viewer="vendor" supplierName="Lumina Studio" eventDate={EVENT_DAY} seed={empty ? { quote: { ...QUOTE, locks: { quote: true, plan: false } }, perPax: [] } : { quote: QUOTE, perPax: [{ key: 'l2', label: 'Guest portrait prints', rateCentavos: C(40), minPax: 100 }] }} />;
      case 'book':
        return (
          <div className="grid gap-3">
            {(empty ? (['expired'] as const) : (['asked', 'booked', 'not_available'] as const)).map((s) => (
              <BookRequestCard key={s} state={s} reason={s === 'not_available' ? 'Booked that day' : null} supplierName="Lumina Studio" at="Today 10:42" />
            ))}
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <main className="min-h-dvh bg-cream px-4 py-6" data-lab-chat-cards-c={m}>
      <div className="mx-auto max-w-md">{card}</div>
    </main>
  );
}
