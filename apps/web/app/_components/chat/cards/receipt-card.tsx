'use client';

/**
 * 🧾 THE RECEIPT CARD — under the line a confirmed payment posts ("Payment confirmed · ₱9,000"), on the hosts' side
 * (Unichat part H2, 20 Nov 2026; drawing `UNICHAT-LIVE-2026-11-19.html` `c.type==='receipt'`: the amount as the hero,
 * "Receipt" beside it, method · date under it).
 *
 * Every figure is the payment ROW's (`event_vendor_payments`) and the accepted quote's total — read by `loadReceipt`
 * with the reader's own session. The line's ₱ text only finds the row. What is left is said only when an accepted
 * quote states a total; a refused read says it could not load, and a payment that cannot be found says so — the card
 * never shows another payment's figures and never ₱0.
 *
 * The supplier's side keeps its short line ("You confirmed it reached you"): the payment ledger is the hosts' own
 * table, which a supplier does not read.
 */
import { useCallback, useEffect, useState } from 'react';
import { formatCentavosPhp } from '@/lib/php';
import { formatLongDate } from '@/lib/format-date';
import type { Receipt } from '@/lib/deal-end';
import { loadReceipt } from './deal-end-calls';
import { CouldNotLoad, KindCard, Loading, MoneyBar, type Read } from './card-bits';

type Got = { receipt: Receipt | null };

export function ReceiptCard({
  threadId,
  createdAt,
  amountWords,
  first,
  viewer,
  supplierName,
  seed,
}: {
  threadId: string;
  /** When the line was posted — the confirmation's own moment. */
  createdAt: string;
  /** The ₱ text as the database printed it; it finds the row, it is never the figure shown. */
  amountWords: string;
  first: boolean;
  viewer: 'vendor' | 'couple';
  supplierName: string;
  /** Labs only: the receipt as read, so no request is made. */
  seed?: Got;
}) {
  const [read, setRead] = useState<Read<Got>>(seed ? { at: 'ok', data: seed } : { at: 'loading' });
  const load = useCallback(() => {
    setRead({ at: 'loading' });
    void loadReceipt({ threadId, lineAt: createdAt, amountWords, first }).then((r) => setRead(r.ok ? { at: 'ok', data: { receipt: r.receipt } } : { at: 'failed' }));
  }, [threadId, createdAt, amountWords, first]);
  useEffect(() => {
    if (!seed && viewer === 'couple') load();
  }, [load, seed, viewer]);

  if (viewer === 'vendor') {
    return (
      <p className="text-center text-[13px] text-ink/60" data-step-line="payment" data-receipt-line="supplier">
        You confirmed it reached you · {amountWords}
      </p>
    );
  }
  const r = read.at === 'ok' ? read.data.receipt : null;
  return (
    <KindCard
      kind="payment"
      topic="payment"
      hero={Boolean(r)}
      kicker={r ? `${r.whatFor} · confirmed by ${supplierName}` : `Confirmed by ${supplierName}`}
      title={
        r ? (
          <>
            {formatCentavosPhp(r.amountCentavos)} <small className="text-[12px] font-semibold text-ink/70">Receipt</small>
          </>
        ) : (
          'Receipt'
        )
      }
      turn="wait"
    >
      {read.at === 'loading' ? (
        <Loading />
      ) : read.at === 'failed' ? (
        <CouldNotLoad what="this receipt" onRetry={load} />
      ) : !r ? (
        <p className="text-[14px] text-ink/70" data-receipt-card="not-found">
          Couldn&rsquo;t find this payment in your records. Open Book &amp; Budget to see every payment.
        </p>
      ) : (
        <dl className="grid gap-1.5 text-[14px]" data-receipt-card="ok">
          {r.agreedCentavos != null ? (
            <MoneyBar paid={r.paidCentavos} total={r.agreedCentavos} label={`${formatCentavosPhp(r.paidCentavos)} of ${formatCentavosPhp(r.agreedCentavos)} paid`} />
          ) : null}
          <Row k="What for" v={r.whatFor} />
          {r.paidOn ? <Row k="Paid on" v={formatLongDate(r.paidOn)} /> : null}
          {r.method ? <Row k="Paid by" v={r.reference ? `${r.method} · ref ${r.reference}` : r.method} /> : null}
          {r.leftCentavos != null ? (
            <Row k="What is left" v={r.leftCentavos === 0 ? 'Nothing · paid in full ✓' : formatCentavosPhp(r.leftCentavos)} strong />
          ) : (
            // No accepted quote states a total, so what is left is not worked out — said, never guessed.
            <p className="text-[13px] text-ink/60" data-receipt-left="unknown">
              What is left shows once a quote is accepted.
            </p>
          )}
        </dl>
      )}
    </KindCard>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex-none text-ink/70">{k}</dt>
      <dd className={`min-w-0 truncate text-right tabular-nums text-ink ${strong ? 'font-bold' : ''}`}>{v}</dd>
    </div>
  );
}
