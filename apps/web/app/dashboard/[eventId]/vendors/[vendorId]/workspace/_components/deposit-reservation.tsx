'use client';

// ==========================================================================
// Deposit Reservation Lock-Free — COUPLE surface.
//
// Renders the deposit-reservation state on the workspace page:
//   • no deposit recorded → a "Record deposit" CTA that opens an inline form
//     (amount · optional method/reference · optional proof upload).
//   • recorded, not acked  → "Date held · awaiting vendor confirmation" chip.
//   • acknowledged          → "Confirmed by vendor" chip.
//   • THE VENDOR SAYS IT NEVER REACHED THEM → their words, and a way to send it
//     again. New 2026-08-27, and the reason it can exist: a refusal used to
//     DELETE the couple's amount, receipt, method and ledger row, so this card
//     fell back to "Paid a deposit off-platform? Record it" — reading as though
//     they had never recorded anything. Owner ruling: **"yes they keep their
//     record."** A supplier not seeing the money is not evidence the couple did
//     not send it; a transfer can be slow or land under another name.
//
// OFF-PLATFORM MONEY: this records a host-entered PHP figure for the couple's
// own ledger and holds the date — it is NOT a charge through Setnayan. Setnayan
// never holds funds. Recording does NOT change the order status (orthogonal).
// ==========================================================================

import { useRef, useState, useTransition } from 'react';
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react';
import { recordDeposit } from '../../../actions';
import { useSaveLoader } from '@/components/sd-loader';

type Props = {
  eventId: string;
  vendorId: string;
  vendorName: string;
  depositRecordedAt: string | null;
  depositAcknowledgedAt: string | null;
  depositProofUrl: string | null;
  /** When the supplier said the recorded deposit never reached them. */
  depositDeclinedAt: string | null;
  /** Their own words, if they gave any. */
  depositDeclineReason: string | null;
  /** Setnayan's own finding, once the team has checked it by hand. */
  depositDisputeNote: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function DepositReservation({
  eventId,
  vendorId,
  vendorName,
  depositRecordedAt,
  depositAcknowledgedAt,
  depositProofUrl,
  depositDeclinedAt,
  depositDeclineReason,
  depositDisputeNote,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useSaveLoader();

  const recorded = Boolean(depositRecordedAt);
  const acked = Boolean(depositAcknowledgedAt);
  const declined = Boolean(depositDeclinedAt);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const form = new FormData(e.currentTarget);
    form.set('event_id', eventId);
    form.set('vendor_id', vendorId);
    startTransition(async () => {
      const result = await save.run(() => recordDeposit(form), {
        steps: ['Recording the deposit'],
        hint: 'Saving',
      });
      if (result.status === 'ok') {
        setOpen(false);
      } else if (result.status === 'not_signed_in') {
        setErrorMsg('Please sign in again to record the deposit.');
      } else {
        setErrorMsg(result.message ?? 'Could not record the deposit — please try again.');
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-ink/10 bg-white/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-ink">
          <CalendarCheck aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Deposit reservation
        </p>

        {acked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success-400 bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Confirmed by vendor
          </span>
        ) : declined ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-300 bg-danger-50 px-2.5 py-1 text-[11px] font-semibold text-danger-700">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {vendorName} says it hasn&rsquo;t reached them
          </span>
        ) : recorded ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-300 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold text-warn-900">
            <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Date held · awaiting vendor confirmation
          </span>
        ) : null}
      </div>

      {recorded ? (
        <p className="text-[11px] text-ink/60">
          Deposit recorded {fmtDate(depositRecordedAt)} — your date is held on{' '}
          {vendorName}&rsquo;s schedule.{' '}
          {acked
            ? `Confirmed by ${vendorName} on ${fmtDate(depositAcknowledgedAt)}.`
            : declined
              ? `On ${fmtDate(depositDeclinedAt)} they said it hadn’t reached them. Your record here is kept — a transfer can be slow, or arrive under a different name.`
              : `${vendorName} will confirm they received it.`}
        </p>
      ) : (
        <p className="text-[11px] text-ink/60">
          Paid a deposit off-platform? Record it to hold your date on{' '}
          {vendorName}&rsquo;s schedule while they confirm. Setnayan never holds
          your money — this is your own record.
        </p>
      )}

      {declined && depositDeclineReason ? (
        <p className="rounded-md border border-danger-200 bg-danger-50 px-2.5 py-1.5 text-[11px] text-ink/75">
          {vendorName}&rsquo;s words: &ldquo;{depositDeclineReason}&rdquo;
        </p>
      ) : null}

      {/* Setnayan checked it by hand (owner 2026-08-28: "we will confirm it
          manually"). Only ever rendered beside a refusal that still stands —
          when the team finds the payment DID arrive the refusal is lifted and
          this card reads as confirmed, which says it better than a sentence. */}
      {declined && depositDisputeNote ? (
        <p className="rounded-md border border-ink/15 bg-ink/[0.03] px-2.5 py-1.5 text-[11px] text-ink/75">
          Setnayan checked this: &ldquo;{depositDisputeNote}&rdquo; Your record is still on
          file — send it to {vendorName} again below.
        </p>
      ) : null}

      {depositProofUrl ? (
        <a
          href={depositProofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-terracotta-700 underline-offset-2 hover:underline"
        >
          <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          View deposit proof
        </a>
      ) : null}

      {/* 🔑 A REFUSED CLAIM MUST REOPEN THIS FORM. The CTA used to render only
          when nothing was recorded, which worked ONLY because a refusal deleted
          the record. With the record kept, that condition alone would leave the
          couple told their payment was refused and given no way to answer — a
          fix nobody can reach. Sending again clears the refusal and puts the
          question back in front of the supplier. */}
      {(!recorded || declined) && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800"
        >
          <CalendarCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {declined ? 'Send it again' : 'Record deposit'}
        </button>
      ) : null}

      {open ? (
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label htmlFor="deposit_php" className="block text-[11px] font-medium text-ink/70">
              Deposit amount paid (₱)
            </label>
            <input
              id="deposit_php"
              name="deposit_php"
              type="number"
              min="1"
              step="0.01"
              required
              inputMode="decimal"
              placeholder="e.g. 10000"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="method" className="block text-[11px] font-medium text-ink/70">
                Method <span className="text-ink/40">(optional)</span>
              </label>
              <input
                id="method"
                name="method"
                type="text"
                maxLength={48}
                placeholder="GCash / BDO / cash"
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="reference" className="block text-[11px] font-medium text-ink/70">
                Reference <span className="text-ink/40">(optional)</span>
              </label>
              <input
                id="reference"
                name="reference"
                type="text"
                maxLength={64}
                placeholder="Txn ref"
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="proof" className="block text-[11px] font-medium text-ink/70">
              Proof of deposit <span className="text-ink/40">(optional — screenshot/receipt)</span>
            </label>
            <input
              id="proof"
              name="proof"
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="block w-full text-xs text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-cream file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-cream/80"
            />
          </div>

          {errorMsg ? (
            <p role="alert" className="text-[11px] font-medium text-danger-600">
              {errorMsg}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-terracotta bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <CalendarCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Record &amp; hold date
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setErrorMsg(null);
              }}
              disabled={pending}
              className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-cream disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
