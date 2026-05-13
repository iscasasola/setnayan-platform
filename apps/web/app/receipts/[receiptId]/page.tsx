import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  fetchReceiptById,
  formatOrNumber,
  formatPhpFromString,
} from '@/lib/receipts';

export const metadata = { title: 'Official Receipt · Setnayan' };

type Props = { params: Promise<{ receiptId: string }> };

export default async function ReceiptPage({ params }: Props) {
  const { receiptId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const receipt = await fetchReceiptById(supabase, receiptId);
  if (!receipt) notFound();

  // RLS allows only the owner to SELECT — defense in depth at the route layer
  // in case the policy changes.
  if (receipt.user_id !== user.id) notFound();

  const orNumber = formatOrNumber(receipt.or_serial, receipt.issued_at);

  return (
    <>
      <style>{PRINT_STYLES}</style>
      <main className="mx-auto w-full max-w-2xl px-6 py-10 print:px-0 print:py-0">
        <div className="print-toolbar screen-only mb-6 rounded-md border border-ink/10 bg-cream p-3 text-sm text-ink/70">
          <p>
            Press{' '}
            <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">⌘P</kbd>
            {' '}or{' '}
            <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px]">Ctrl+P</kbd>
            {' '}to print or save as PDF. Setnayan tax info is at the bottom.
          </p>
        </div>

        <article className="space-y-6 rounded-2xl border border-ink/15 bg-cream p-8 print:rounded-none print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-4 border-b border-ink/10 pb-6">
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-terracotta">
                Setnayan · setnayan.com
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
                BIR-Registered · TIN: 000-000-000-000
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/55">
                Official Receipt
              </p>
              <p className="font-mono text-base font-semibold text-ink">{orNumber}</p>
            </div>
          </header>

          <section className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Issued to
            </p>
            <p className="text-base font-semibold text-ink">
              {receipt.issued_to_name ?? receipt.issued_to_email}
            </p>
            <p className="text-sm text-ink/65">{receipt.issued_to_email}</p>
            {receipt.issued_to_tin ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                TIN {receipt.issued_to_tin}
              </p>
            ) : null}
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              Issued {new Date(receipt.issued_at).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </section>

          <section className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              For
            </p>
            <p className="text-sm text-ink">
              Setnayan services rendered — see linked order for details.
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              Order · {receipt.order_id}
            </p>
          </section>

          <section className="space-y-2 border-t border-ink/10 pt-4">
            <dl className="space-y-1 text-sm">
              <Line
                label="Sales (VAT-exclusive)"
                value={formatPhpFromString(receipt.pre_vat_php)}
              />
              <Line
                label={`VAT @ ${receipt.vat_rate_pct}%`}
                value={formatPhpFromString(receipt.vat_amount_php)}
              />
              <Line
                label="Total amount paid"
                value={formatPhpFromString(receipt.gross_total_php)}
                bold
              />
            </dl>
          </section>

          <footer className="space-y-2 border-t border-ink/10 pt-4 text-xs text-ink/55">
            <p>
              This is a system-generated Official Receipt issued in accordance with BIR
              Revenue Regulations on electronic receipting. No signature is required.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em]">
              Sequence · {receipt.or_serial.toString().padStart(6, '0')}
            </p>
          </footer>
        </article>
      </main>
    </>
  );
}

function Line({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${bold ? 'pt-2' : ''}`}>
      <dt
        className={`text-sm ${
          bold ? 'font-semibold text-ink' : 'text-ink/65'
        }`}
      >
        {label}
      </dt>
      <dd
        className={`font-mono text-sm ${
          bold ? 'text-lg font-semibold text-ink' : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 20mm; }
  @media print {
    body { background: #ffffff !important; }
    .screen-only { display: none !important; }
    header, nav { display: none !important; }
    main { padding: 0 !important; }
  }
`;
