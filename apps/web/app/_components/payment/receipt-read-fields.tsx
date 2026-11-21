'use client';

/**
 * "We read your receipt" — the four facts the buyer used to type, now READ off
 * their screenshot ON THEIR OWN PHONE and filled in for them to check.
 *
 * Owner, 17 Nov 2026: *"can we create our own in app reader so we do not need
 * ai to run?"* → *"Yes, swap it in"*; and *"the don't have to type. we detect
 * after they sent it and log the data for the admin"*.
 *
 * Mounted inside the proof form on /pay (gift store orders land there too) and
 * in the couple checkout drawer. Every value rides the surrounding `<form>`
 * under `RECEIPT_FIELDS`, so neither caller posts anything by hand.
 *
 * 🔒 THE PICTURE IS NOT SENT TO BE READ. Tesseract (lib/on-phone-reader.ts, the
 * one #7924 ships) reads it here; only the text and the four fields are posted.
 * 📦 Lazy: the reader and the parser load the moment a picture is picked, never
 * with the page.
 * ⛔ IT ONLY READS. A filled field is a lookup key for the admin. It never
 * approves, never blocks sending, and a reader that fails says so.
 */
import { useEffect, useRef, useState } from 'react';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { RECEIPT_FIELDS, type ReceiptFieldKey } from '@/lib/receipt-fields';

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'ok'; text: string; ms: number }
  | { kind: 'failed'; ms: number };

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_SHAPE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function ReceiptReadFields({
  file,
  expectedPhp,
  channel,
  onReadingChange,
}: {
  /** The picture just picked, or null before one is. */
  file: File | null;
  /** What the order owes — lets the amount pre-fill only when it is really there. */
  expectedPhp: number | null;
  channel: string | null;
  /** Told when a read starts and ends, so a caller can say "reading…" on its button. */
  onReadingChange?: (reading: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [paidTime, setPaidTime] = useState('');
  const [reference, setReference] = useState('');
  const [touched, setTouched] = useState<ReceiptFieldKey[]>([]);
  const run = useRef(0);
  const told = useRef(onReadingChange);
  told.current = onReadingChange;

  // ⏱ Warm the reader the moment the proof step is on screen: its first-use
  // download is the slow part (34 s on Slow 4G, measured), and the buyer is
  // still finding their screenshot. Nothing loads before this step exists.
  useEffect(() => {
    void import('@/lib/receipt-read-on-phone').then((m) => m.warmReceiptReader()).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!file) return;
    const mine = ++run.current;
    setPhase({ kind: 'reading' });
    setTouched([]);
    told.current?.(true);
    void (async () => {
      try {
        const { readReceiptOnThisPhone } = await import('@/lib/receipt-read-on-phone');
        const read = await readReceiptOnThisPhone(file, expectedPhp, channel);
        if (mine !== run.current) return; // a newer picture was picked meanwhile
        const p = read.prefill;
        setAmount(p.amountPhp == null ? '' : String(Math.trunc(p.amountPhp)));
        setPaidOn(p.paidOn ?? '');
        setPaidTime(p.paidTime ?? '');
        setReference(p.reference ?? '');
        setPhase(read.status === 'ok' ? { kind: 'ok', text: read.text, ms: read.ms } : { kind: 'failed', ms: read.ms });
      } catch {
        // The chunk itself would not load (offline mid-way). Same as a failed read.
        if (mine === run.current) setPhase({ kind: 'failed', ms: 0 });
      } finally {
        if (mine === run.current) told.current?.(false);
      }
    })();
  }, [file, expectedPhp, channel]);

  const touch = (k: ReceiptFieldKey) => setTouched((t) => (t.includes(k) ? t : [...t, k]));

  if (phase.kind === 'idle') return null;

  if (phase.kind === 'reading') {
    return (
      <p role="status" data-receipt-read="reading" className="text-sm text-ink/65">
        Reading your receipt on this phone&hellip;
      </p>
    );
  }

  return (
    <div data-receipt-read={phase.kind} data-receipt-read-ms={String(phase.ms)} className="space-y-2">
      <input type="hidden" name={RECEIPT_FIELDS.status} value={phase.kind} />
      {phase.kind === 'ok' && <input type="hidden" name={RECEIPT_FIELDS.text} value={phase.text} />}
      <input type="hidden" name={RECEIPT_FIELDS.touched} value={touched.join(',')} />
      <p role="status" className="text-sm text-ink/65">
        {phase.kind === 'ok'
          ? 'We read these from your receipt. Fix anything we got wrong.'
          : 'We couldn’t read your receipt on this phone. Fill in what you can, or just send it — we’ll check the picture.'}
      </p>
      <FormRows width="wide" data="receipt-read-fields">
        <TypedRow
          name="Amount sent"
          value={amount}
          amount
          empty="Not read"
          fieldName={RECEIPT_FIELDS.amount}
          onKeep={(t) => {
            setAmount(t);
            touch('amount');
          }}
          data="receipt-amount"
        />
        <TypedRow
          name="Date"
          value={paidOn}
          empty="Not read"
          placeholder="2026-11-17"
          inputMode="numeric"
          maxLength={10}
          check={(t) => (t === '' || DATE_SHAPE.test(t) ? null : 'Write the date as year-month-day, like 2026-11-17.')}
          fieldName={RECEIPT_FIELDS.paidOn}
          onKeep={(t) => {
            setPaidOn(t);
            touch('paidOn');
          }}
          data="receipt-date"
        />
        <TypedRow
          name="Time"
          value={paidTime}
          empty="Not read"
          placeholder="15:04"
          inputMode="numeric"
          maxLength={5}
          check={(t) => (t === '' || TIME_SHAPE.test(t) ? null : 'Write the time in 24 hours, like 15:04.')}
          fieldName={RECEIPT_FIELDS.paidTime}
          onKeep={(t) => {
            setPaidTime(t);
            touch('paidTime');
          }}
          data="receipt-time"
        />
        <TypedRow
          name="Reference"
          value={reference}
          empty="Not read"
          autoCapitalize="off"
          maxLength={64}
          clean={(t) => t.replace(/[^A-Za-z0-9 -]/g, '')}
          fieldName={RECEIPT_FIELDS.reference}
          onKeep={(t) => {
            setReference(t);
            touch('reference');
          }}
          data="receipt-reference"
        />
      </FormRows>
    </div>
  );
}
