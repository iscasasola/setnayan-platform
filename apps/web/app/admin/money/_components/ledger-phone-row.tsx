'use client';

import { useId, useState, type ReactNode } from 'react';
import { ReceiptText, X } from 'lucide-react';

import { ActionButton, EqualRow } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { TEMPLATE_MONEY, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';

/**
 * 📐 ONE PURCHASE, ONE ROW — the design template's "Admin · Money, everything (the transaction table at 390)"
 * (owner-approved 2026-11-14). On a phone the seven-column table pushed the amount and where it stands off the
 * right edge; here who is on top, what and when under it, the amount and its chip on the right — nothing off the
 * edge. A tap opens a sheet with the columns a phone cannot fit (reference, email, receipt). ✕ or Close goes back.
 *
 * The facts arrive already drawn by the server (the reference keeps its link to the payments desk, where
 * "Record a payment received" lives — `ledger-reference-column.tsx`), so the sheet shows exactly what the table
 * column shows.
 */
export function LedgerPhoneRow({
  title,
  line,
  amount,
  chip,
  facts,
  receiptHref,
}: {
  /** Name, or email, or "Couldn't read buyer" — plus the "ours" chip. */
  title: ReactNode;
  /** What they bought · when. */
  line: string;
  amount: string;
  chip: ReactNode;
  facts: readonly { label: string; value: ReactNode }[];
  receiptHref: string | null;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <li data-ledger-phone-row="">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="sn-press flex min-h-14 w-full items-center gap-2.5 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <b className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold leading-tight text-ink">
            <span className="truncate">{title}</span>
          </b>
          <span className={`mt-0.5 block truncate ${TEMPLATE_SUBLINE}`}>{line}</span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          <span className={`text-[15px] ${TEMPLATE_MONEY}`}>{amount}</span>
          {chip}
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={titleId} rise>
        <div className="px-4 pb-5 pt-1">
          <div className="flex items-center gap-2">
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-[19px] font-extrabold text-ink">
              {title} · {amount}
            </h2>
            <ActionButton tone="neutral" icon={X} label="Close" iconOnly type="button" onClick={() => setOpen(false)} />
          </div>
          <dl className="mt-2 [&>div+div]:border-t [&>div+div]:border-[color:var(--m-line)]">
            {facts.map((f) => (
              <div key={f.label} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <dt className={TEMPLATE_SUBLINE}>{f.label}</dt>
                <dd className="min-w-0 truncate text-right text-[15px] font-semibold text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
          <EqualRow className="mt-4">
            <ActionButton tone="neutral" icon={X} label="Close" type="button" onClick={() => setOpen(false)} />
            {receiptHref ? (
              <ActionButton tone="info" icon={ReceiptText} label="View receipt" href={receiptHref} target="_blank" />
            ) : null}
          </EqualRow>
        </div>
      </Sheet>
    </li>
  );
}
