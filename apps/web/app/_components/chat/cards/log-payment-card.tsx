'use client';

/**
 * 🧾 LOG A PAYMENT — the host's (+), one step at a time (Supplier Build 3 · lane C; prototype v8.3 host Log a payment).
 *
 * ① How much did you pay? → ② How? → ③ Reference number → ④ Date paid → ⑤ Receipt photo (+ Agree) → Send.
 * Owner, 8 Nov: a payment proof to a coordinator/planner needs **Agree — REQUIRED** ("No, Agree is required"). The box
 * shows only on a coordinator's booking, Send stays grey until it is ticked, and the server refuses without it
 * (`logPaymentFromChat` reads the booking's category itself). The write is the SHIPPED `logPayment` (budget actions)
 * with the SHIPPED private receipt upload (`FileUpload`, payment-proof bucket path) — nothing new is stored.
 */
import { useCallback, useEffect, useId, useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import { FileUpload } from '@/app/_components/file-upload';
import { logPaymentStepOk, type LogPaymentDraft } from '@/lib/chat-cards';
import { manilaTodayIsoFor } from '@/lib/quote-valid-until';
import { ChatCardShell, ChatStepCard, type ChatCardStep } from '../chat-step-card';
import { loadLogPaymentTarget, logPaymentFromChat } from './card-calls';
import { CouldNotLoad, EmptyLine, Loading, Problem, type Read } from './card-bits';

const METHODS = ['GCash', 'Maya', 'Bank transfer', 'Cash', 'Check'].map((m) => ({ key: m, label: m }));

type Target = { eventId: string; vendorId: string | null; toCoordinator?: boolean; supplierName?: string };

export function LogPaymentCard({
  threadId,
  onClose,
  onSent,
  seed,
}: {
  threadId: string;
  onClose?: () => void;
  onSent?: () => void;
  seed?: { target: Target; draft?: Partial<LogPaymentDraft>; step?: number };
}) {
  const [read, setRead] = useState<Read<Target>>(seed ? { at: 'ok', data: seed.target } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadLogPaymentTarget(threadId).then((r) => setRead(r.ok ? { at: 'ok', data: r } : { at: 'failed' }));
  }, [threadId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);
  if (read.at !== 'ok' || !read.data.vendorId) {
    return (
      <ChatCardShell topic="payment" kicker="You · not sent yet" title="Log a payment" onClose={onClose}>
        {read.at === 'loading' ? (
          <Loading />
        ) : read.at === 'failed' ? (
          <CouldNotLoad what="this booking" onRetry={load} />
        ) : (
          <EmptyLine line="Add this supplier to your Suppliers first — then a payment can be logged against them." />
        )}
      </ChatCardShell>
    );
  }
  return <LogSteps target={read.data as Required<Target> & { vendorId: string }} onClose={onClose} onSent={onSent} seed={seed} />;
}

function LogSteps({
  target,
  onClose,
  onSent,
  seed,
}: {
  target: Required<Target> & { vendorId: string };
  onClose?: () => void;
  onSent?: () => void;
  seed?: { draft?: Partial<LogPaymentDraft>; step?: number };
}) {
  const formId = useId();
  const [step, setStep] = useState(seed?.step ?? 0);
  const [d, setD] = useState<LogPaymentDraft>({ amountPhp: null, method: null, reference: '', paidOn: null, receiptRef: null, agree: false, ...seed?.draft });
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const today = manilaTodayIsoFor(Date.now());
  const ok = (i: number) => logPaymentStepOk(d, i, target.toCoordinator);

  const steps: ChatCardStep[] = [
    {
      title: 'How much did you pay?',
      body: (
        <TypedRow
          name="Amount"
          amount
          value={d.amountPhp ? String(d.amountPhp) : ''}
          empty="₱"
          openAsk={1}
          onType={(v) => setD((x) => ({ ...x, amountPhp: Number(v.replace(/[^\d.]/g, '')) || null }))}
          onKeep={(v) => setD((x) => ({ ...x, amountPhp: Number(v.replace(/[^\d.]/g, '')) || null }))}
        />
      ),
      ok: ok(0),
    },
    {
      title: 'How?',
      body: <PickMenu label="How?" value={d.method} options={METHODS} onPick={(m) => setD((x) => ({ ...x, method: m }))} buttonText={d.method ? undefined : 'Pick how you paid'} dataAttr="data-logpay-method" />,
      ok: ok(1),
    },
    {
      title: 'Reference number',
      body: <TypedRow name="Reference" value={d.reference} empty="Add" maxLength={64} openAsk={1} onType={(v) => setD((x) => ({ ...x, reference: v }))} onKeep={(v) => setD((x) => ({ ...x, reference: v }))} />,
      ok: ok(2),
    },
    {
      title: 'Date paid',
      body: <DateRow name="Date paid" value={d.paidOn} today={today} max={today} onKeep={(day) => setD((x) => ({ ...x, paidOn: day }))} />,
      ok: ok(3),
    },
    {
      title: 'Receipt photo',
      sub: `For ${target.supplierName}. They confirm it on their side.`,
      body: (
        <div className="grid gap-3">
          <FileUpload
            name="proof_r2_key"
            unsavedHint="press Send below"
            bucket="thread-files"
            pathPrefix={`payment-proof/events/${target.eventId}`}
            maxSizeMB={5}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            label="Attach receipt"
            variant="wide"
            bigPreview
            onChange={(v) => setD((x) => ({ ...x, receiptRef: typeof v === 'string' && v ? v : null }))}
          />
          {target.toCoordinator ? (
            <label className="flex min-h-11 items-start gap-3 text-[15px] text-ink" data-logpay-agree="">
              <input type="checkbox" name="agree" value="1" checked={d.agree} onChange={(e) => setD((x) => ({ ...x, agree: e.target.checked }))} className="mt-1 h-5 w-5 flex-none accent-[rgb(var(--color-mulberry))]" />
              <span>I agree: this payment is for {target.supplierName}&rsquo;s coordination of our event.</span>
            </label>
          ) : null}
          <Problem text={problem} />
        </div>
      ),
      ok: ok(4),
    },
  ];

  return (
    <form
      id={formId}
      action={async (fd) => {
        setSending(true);
        setProblem(null);
        const r = await logPaymentFromChat(fd);
        setSending(false);
        if (r.ok) onSent?.();
        else setProblem(r.message);
      }}
    >
      <input type="hidden" name="event_id" value={target.eventId} />
      <input type="hidden" name="vendor_id" value={target.vendorId} />
      <input type="hidden" name="amount_php" value={d.amountPhp ? String(d.amountPhp) : ''} />
      <input type="hidden" name="method" value={d.method ?? ''} />
      <input type="hidden" name="reference" value={d.reference} />
      <input type="hidden" name="paid_at" value={d.paidOn ?? ''} />
      <ChatStepCard topic="payment" kicker="You · not sent yet" title="Log a payment" steps={steps} step={step} onStep={setStep} sending={sending} onClose={onClose} submitForm={formId} />
    </form>
  );
}
