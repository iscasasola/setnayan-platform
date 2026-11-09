'use client';

/**
 * The small parts every lane-C card shares (Supplier Build 3 · lane C): the honest read states, the one plan ledger
 * strip, an equal-width choice row, a refusal line. Loaded only with a card (each card is its own lazy chunk).
 */
import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatCentavosPhp } from '@/lib/php';
import { ledgerLine, type Ledger } from '@/lib/chat-cards';

/** A read in flight, refused, or answered. A refused read says so — never an empty list dressed as "none yet". */
export type Read<T> = { at: 'loading' } | { at: 'failed' } | { at: 'ok'; data: T };

export function Loading() {
  return (
    <p className="text-[14px] text-ink/55" role="status" data-card-read="loading">
      Loading…
    </p>
  );
}

export function CouldNotLoad({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="grid gap-2" data-card-read="failed">
      <p role="alert" className="text-[15px] text-ink">
        Couldn&rsquo;t load {what}.
      </p>
      <div className="flex">
        <ActionButton tone="neutral" icon={RotateCcw} label="Try again" onClick={onRetry} />
      </div>
    </div>
  );
}

/** An honest empty state: what is missing, in one line, and (optionally) the one way forward. */
export function EmptyLine({ line, children }: { line: string; children?: ReactNode }) {
  return (
    <div className="grid gap-2" data-card-empty="">
      <p className="text-[15px] text-ink/70">{line}</p>
      {children ? <div className="flex">{children}</div> : null}
    </div>
  );
}

export function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="text-[14px] font-medium text-danger-600" data-card-problem="">
      {text}
    </p>
  );
}

/** Equal-weight choices: one row, equal widths (owner 9 Nov — "buttons uniform, rows balanced"). */
export function EqualRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2 [&>*]:w-full [&>*]:justify-center" data-equal-row="">
      {children}
    </div>
  );
}

/** THE ONE LEDGER, as every face prints it: each payment, its state, and "Plan pays all … ✓". */
export function LedgerStrip({ ledger }: { ledger: Ledger }) {
  return (
    <div className="grid gap-1.5 rounded-xl bg-ink/[0.04] px-3 py-2.5 text-[14px]" data-plan-ledger={ledger.paysInFull ? 'pays-in-full' : 'short'}>
      {ledger.rows.map((r) => (
        <div key={r.seq} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-ink/75">{r.label}</span>
          <span className="flex-none tabular-nums text-ink">
            {formatCentavosPhp(r.amountCentavos)}
            <span className="ml-1.5 text-[12px] text-ink/55">{r.state === 'paid' ? 'Paid ✓' : r.state === 'final' ? 'worked out' : 'Due'}</span>
          </span>
        </div>
      ))}
      <p className={`text-[13px] font-semibold ${ledger.paysInFull ? 'text-success-700' : 'text-danger-600'}`}>{ledgerLine(ledger)}</p>
    </div>
  );
}
