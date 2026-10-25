import type { ReactNode } from 'react';
import Link from 'next/link';
import { ReceiptStamp, type ReceiptStampStatus } from './receipt-stamp';

/**
 * THE RECEIPT SLIP — a narrow paper slip on the page (owner 2026-10-25, approved from
 * `prototypes/ceremo_deltas_2026-10-25/03_account_menu.html` › "The receipt · the page a row opens": "also want it
 * to feel like a receipt" … "the rest on the receipts"). A SERVER component: it draws what the page hands it.
 *
 * Anatomy, top to bottom, as drawn: SETNAYAN wordmark · the kind ("Transaction receipt") · No. · the stamp · the amount
 * big in mono · date · time · method · a dashed tear · line items (what · ×qty · amount) and the VAT line ONLY when the
 * row carries VAT · a right-aligned Total and — again only with VAT — "VAT included" · a tear · who paid / how /
 * logged / confirmed (or, before the money moves: pay to / reference) · the references small in mono · the legal line ·
 * a zigzag bottom edge. Under the slip: the page's own actions (Save as PDF · Share, or Pay ₱X · Share).
 *
 * 🧾 A RECEIPT IS PAPER: the slip keeps its light paper and ink on a dark page (fixed colours, not tokens); only the
 * page, the back link and the buttons take the dark set. Print is the slip alone (`.screen-only` hides the rest).
 */
export type SlipLine = { what: string; qty: number | null; amount: string; detail?: string | null };
export type SlipRow = { label: string; value: string };

export function ReceiptSlip({
  kind,
  number,
  stamp,
  amount,
  when,
  lines,
  total,
  vatIncluded,
  rows,
  refs,
  legal,
}: {
  kind: string;
  number: string;
  stamp: ReceiptStampStatus | null;
  amount: string;
  when: string;
  lines: SlipLine[];
  total: string;
  /** Print "VAT included" under the total — ONLY when a VAT line was printed (the row carries VAT). */
  vatIncluded: boolean;
  rows: SlipRow[];
  refs: string[];
  legal: string;
}) {
  return (
    <article data-receipt-slip="" className="sn-slip relative mx-auto w-full max-w-[340px] px-5 pb-6 pt-[22px]">
      <style>{SLIP_CSS}</style>
      <p className="text-center text-[12.5px] font-bold tracking-[0.3em]">SETNAYAN</p>
      <p className="mt-[7px] text-center font-mono text-[9.5px] uppercase leading-none tracking-[0.22em] text-[#8A857B]">{kind}</p>
      <p className="mt-1.5 text-center font-mono text-[11px] leading-none text-[#6E6A62]">No. {number}</p>
      {stamp ? <ReceiptStamp status={stamp} /> : null}
      <p className="mb-1.5 mt-5 text-center font-mono text-[36px] font-bold leading-none tracking-[-0.02em]" data-receipt-amount="">
        {amount}
      </p>
      <p className="text-center text-[12.5px] text-[#6E6A62]">{when}</p>

      <hr className="sn-slip-tear" />
      <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 gap-y-1 text-[13px]">
        {lines.map((l) => (
          <SlipLineRow key={l.what} line={l} />
        ))}
      </div>
      <div className="mt-2 flex items-baseline justify-between border-t border-[#E6E1D8] pt-2.5">
        <b className="text-sm">Total</b>
        <span className="font-mono text-lg font-bold leading-none">{total}</span>
      </div>
      {vatIncluded ? <p className="mt-1 text-right text-[11.5px] text-[#8A857B]">VAT included</p> : null}

      <hr className="sn-slip-tear" />
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4 py-1 text-[12.5px]">
          <span>{r.label}</span>
          <span className="text-right font-mono text-xs leading-snug">{r.value}</span>
        </div>
      ))}
      <p className="mt-1 break-all font-mono text-[10px] leading-[1.7] tracking-[0.02em] text-[#8A857B]">
        {refs.map((r) => (
          <span key={r} className="block">
            {r}
          </span>
        ))}
      </p>
      <p className="mt-3 text-center text-[11px] leading-snug text-[#8A857B]">{legal}</p>
    </article>
  );
}

function SlipLineRow({ line }: { line: SlipLine }) {
  return (
    <>
      <span>{line.what}</span>
      <span className="font-mono text-[11.5px] leading-none text-[#8A857B]">{line.qty != null ? `×${line.qty}` : ''}</span>
      <span className="font-mono text-[13px] font-medium leading-none">{line.amount}</span>
      {line.detail ? <span className="col-span-3 -mt-0.5 mb-1.5 text-[11.5px] text-[#8A857B]">{line.detail}</span> : null}
    </>
  );
}

/** The page around the slip: the back link, the slip, the actions — the page takes the dark set, the slip never. */
export function ReceiptPage({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <main className="min-h-dvh bg-[var(--m-paper-2)] px-4 pb-10 pt-3.5 dark:bg-cream print:bg-white print:p-0">
      <style>{PRINT_CSS}</style>
      <div className="mx-auto w-full max-w-[340px]">
        <Link
          href="/dashboard/billing"
          className="screen-only mb-3 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-terracotta"
        >
          ‹ Billing &amp; receipts
        </Link>
        {children}
        <div className="screen-only mt-7 flex items-center justify-center gap-[18px]">{actions}</div>
      </div>
    </main>
  );
}

/** The page's actions under the slip — the gold (terracotta) primary and the quiet text link. */
export const RECEIPT_CTA =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-terracotta-700 px-[22px] text-sm font-bold text-[#FFFDF8] dark:text-cream';
export const RECEIPT_ALT = 'inline-flex min-h-[44px] items-center text-sm font-semibold text-terracotta';

const SLIP_CSS = `
.sn-slip{background:#FFFDF8;color:#2C2A29;box-shadow:0 1px 0 rgba(0,0,0,.05),0 14px 34px -18px rgba(0,0,0,.35)}
.sn-slip::after{content:"";position:absolute;left:0;right:0;bottom:-9px;height:9px;background:linear-gradient(-45deg,transparent 70%,#FFFDF8 71%) 0 0/18px 9px repeat-x,linear-gradient(45deg,transparent 70%,#FFFDF8 71%) 0 0/18px 9px repeat-x}
.sn-slip-tear{border:0;border-top:1.5px dashed #D9D3C8;margin:18px -20px}
`;

const PRINT_CSS = `
@page { size: A4 portrait; margin: 20mm; }
@media print {
  body { background: #ffffff !important; }
  .screen-only, header, nav { display: none !important; }
  .sn-slip { box-shadow: none !important; }
}
`;

const TZ = 'Asia/Manila';
/** "29 Aug 2026" — the slip's date, in Manila time. */
export function slipDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}
/** "29 Aug 2026 14:12". */
export function slipDateTime(iso: string, sep = ' '): string {
  const t = new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  return `${slipDate(iso)}${sep}${t}`;
}
/** A line amount without the peso sign: "2,231.25". */
export function slipFigure(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
