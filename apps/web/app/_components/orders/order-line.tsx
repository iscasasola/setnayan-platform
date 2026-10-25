import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, formatPhp, type OrderStatus } from '@/lib/orders';

/**
 * ONE ORDER ROW — what an order looks like in a list: what it is, its ids, the gross and its status.
 *
 * Lifted out of the event's Orders ledger (`app/dashboard/[eventId]/orders/page.tsx`) on 2026-10-25 so the
 * account's Billing & receipts page (`app/dashboard/(account)/billing`) draws the SAME row instead of a second
 * look for the same thing. The ledger's markup is unchanged; the caller owns the frame (`ORDER_ROW_CLASS`) and
 * whether the row is a link. `meta` puts a date / receipt number in front of the ids (Billing uses it).
 */
export function OrderLine({
  description,
  publicId,
  referenceCode,
  grossPhp,
  status,
  meta,
}: {
  description: string;
  publicId: string;
  referenceCode: string;
  /** The GROSS (what is paid) — the caller computes it from the effective VAT rate or the receipt. */
  grossPhp: number;
  status: OrderStatus;
  meta?: string | null;
}) {
  return (
    <>
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-1 text-sm font-semibold text-ink">{description}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          {meta ? `${meta} · ` : ''}
          {publicId} · {referenceCode}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-sm text-ink">
          {formatPhp(grossPhp)}
          <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">incl. VAT</span>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${ORDER_STATUS_TONE[status]}`}
        >
          {ORDER_STATUS_LABEL[status]}
        </span>
      </div>
    </>
  );
}

/** The row's frame — a pressable order row (both lists draw their rows as doors). */
export const ORDER_ROW_CLASS = 'sn-row group flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between';
/** …and its hover, for the rows that ARE links. */
export const ORDER_ROW_PRESS = 'transition-colors hover:border-terracotta/40 hover:bg-terracotta/5';
