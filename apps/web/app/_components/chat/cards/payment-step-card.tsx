'use client';

/**
 * 💳 PAYMENT — the supplier asks for the next payment now (Supplier Build 3 · lane C; prototype v8.3 `STEPS.payask`).
 *
 * ① Which payment? (the plan's unpaid rows, or another amount) → ② How much? → ③ By when? → ④ A note? (optional) → Send.
 * The plan is drawn with THE ONE LEDGER (`planLedger`, the same rows every face prints) — pay in full: the last unpaid
 * payment is the auto "Final balance", paid rows never change. Send posts the SHIPPED ask (`askForPaymentCore`, the
 * same row and couple notice the client page's "Ask for a payment" writes), without leaving the chat.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { formatCentavosPhp } from '@/lib/php';
import { planLedger, type Ledger } from '@/lib/chat-cards';
import { manilaTodayIsoFor } from '@/lib/quote-valid-until';
import { ChatCardShell, ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { askForPaymentFromChat, loadQuoteForCard } from './card-actions';
import { CouldNotLoad, LedgerStrip, Loading, Problem, type Read } from './card-bits';

export function PaymentStepCard({
  threadId,
  eventId,
  eventDate,
  returnPath,
  onClose,
  onSent,
  seed,
}: {
  threadId: string;
  eventId: string;
  eventDate: string | null;
  returnPath: string;
  onClose?: () => void;
  onSent?: () => void;
  seed?: { ledger: Ledger | null; step?: number; pick?: string; amountPhp?: string; by?: string };
}) {
  const [read, setRead] = useState<Read<Ledger | null>>(seed ? { at: 'ok', data: seed.ledger } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadQuoteForCard(threadId).then((r) => {
      if (!r.ok) return setRead({ at: 'failed' });
      const q = r.quote;
      setRead({
        at: 'ok',
        data: q?.plan ? planLedger({ manual: q.plan.manual, autoBalance: q.plan.autoBalance, agreedCentavos: q.totalCentavos, creditCentavos: q.creditCentavos, paidSeqs: new Set(q.paidSeqs) }) : null,
      });
    });
  }, [threadId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  if (read.at !== 'ok') {
    return (
      <ChatCardShell topic="payment" kicker="You · not sent yet" title="Payment" onClose={onClose}>
        {read.at === 'loading' ? <Loading /> : <CouldNotLoad what="the payment plan" onRetry={load} />}
      </ChatCardShell>
    );
  }
  return <PaymentSteps ledger={read.data} {...{ threadId, eventId, eventDate, returnPath, onClose, onSent, seed }} />;
}

function PaymentSteps({
  ledger,
  eventId,
  eventDate,
  returnPath,
  onClose,
  onSent,
  seed,
}: {
  ledger: Ledger | null;
  threadId: string;
  eventId: string;
  eventDate: string | null;
  returnPath: string;
  onClose?: () => void;
  onSent?: () => void;
  seed?: { step?: number; pick?: string; amountPhp?: string; by?: string };
}) {
  const formId = useId();
  const [step, setStep] = useState(seed?.step ?? 0);
  const [pick, setPick] = useState<string | null>(seed?.pick ?? null);
  const [amount, setAmount] = useState(seed?.amountPhp ?? '');
  const [by, setBy] = useState<string | null>(seed?.by ?? null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const today = manilaTodayIsoFor(Date.now());
  const unpaid = (ledger?.rows ?? []).filter((r) => r.state !== 'paid');
  const options = [
    ...unpaid.map((r) => ({ key: String(r.seq), label: `${r.label} · ${formatCentavosPhp(r.amountCentavos)}` })),
    { key: 'other', label: 'Another amount' },
  ];
  const label = pick && pick !== 'other' ? unpaid.find((r) => String(r.seq) === pick)?.label ?? 'Payment' : 'Payment';
  const amountPhp = Number(amount.replace(/[^\d.]/g, '')) || 0;

  const steps: ChatCardStep[] = [
    {
      title: 'Which payment?',
      body: (
        <div className="grid gap-2">
          {ledger ? <LedgerStrip ledger={ledger} /> : <p className="text-[14px] text-ink/60">No payment plan on this quote yet — ask for another amount.</p>}
          <PickMenu
            label="Which payment?"
            value={pick}
            options={options}
            onPick={(k) => {
              setPick(k);
              const r = unpaid.find((x) => String(x.seq) === k);
              setAmount(r ? String(r.amountCentavos / 100) : '');
            }}
            buttonText={pick ? undefined : 'Pick a payment'}
            dataAttr="data-pay-pick"
          />
        </div>
      ),
      ok: !!pick,
    },
    {
      title: 'How much?',
      body: <TypedRow name="Amount" amount value={amount} empty="₱" openAsk={1} onType={setAmount} onKeep={(v) => setAmount(v)} />,
      ok: amountPhp > 0,
    },
    {
      title: 'By when?',
      body: <DateRow name="By when" value={by} today={today} min={today} max={eventDate} onKeep={(d) => setBy(d)} />,
      ok: !!by,
    },
    {
      title: 'A note? (optional)',
      sub: `${label} · ${formatCentavosPhp(Math.round(amountPhp * 100))}${by ? ` · by ${by}` : ''}`,
      body: (
        <div className="grid gap-2">
          <TypedRow name="Note" long value={note} empty="Add" placeholder="e.g. covers the second shooter" maxLength={500} onType={setNote} onKeep={(v) => setNote(v)} />
          <Problem text={problem} />
        </div>
      ),
      ok: true,
    },
  ];

  return (
    <form
      id={formId}
      action={async (fd) => {
        setSending(true);
        setProblem(null);
        const r = await askForPaymentFromChat(fd);
        setSending(false);
        if (r.ok) onSent?.();
        else setProblem(r.message);
      }}
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="amount_php" value={amountPhp > 0 ? String(amountPhp) : ''} />
      <input type="hidden" name="due_date" value={by ?? ''} />
      <input type="hidden" name="note" value={note} />
      <input type="hidden" name="return_to" value={returnPath} />
      <ChatStepCard topic="payment" kicker="You · not sent yet" title="Payment" steps={steps} step={step} onStep={setStep} sending={sending} onClose={onClose} submitForm={formId} />
    </form>
  );
}
