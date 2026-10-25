import type { SupabaseClient } from '@supabase/supabase-js';
import { isVatInclusiveServiceKey, orderGrossOwed, type OrderStatus } from '@/lib/orders';
import { formatReceiptNumber } from '@/lib/receipts';

/**
 * BILLING & RECEIPTS — every purchase this login made, newest first (owner 2026-10-25, the account menu's
 * "Billing & receipts" row: "on the upper right, i think the billings&receipts looks nice as well").
 *
 * WHAT "A PURCHASE" IS. An `orders` row whose payer (`user_id`) is THIS login and that left `draft` — a draft is
 * a cart nobody sent. That one table already holds every kind: event orders (customer SKUs), a supplier's own
 * billing (`vendor_…` service keys — plan, booking fee, branch), a guest's Papic top-up, and App Store purchases
 * (`lib/iap/fulfil.server.ts` writes an order too). Its receipt is the `receipts` row for the order.
 *
 * 🔒 `.eq('user_id', userId)` IS NOT A BELT — IT IS THE WHOLE SCOPE FOR A TEAM ACCOUNT. `orders_owner_read` also
 * lets an admin read EVERY order and a couple/coordinator read their event's orders; without the filter the owner
 * would see the whole platform's purchases here as his own. Reads run on the person's own client, under the
 * existing RLS — no grant, no migration.
 *
 * 🔑 READS ARE HONEST (`lib/guests-read-is-honest.test.ts`, `vendor-dashboard/reads-are-honest.test.ts`).
 * PostgREST RESOLVES a refusal with `error` set and `data: null`; turned into `[]`, the page would tell somebody
 * who paid ₱2,499 last week "No purchases yet" — byte-identical to a new account. So the orders read reports
 * `measured`, and a separate `receiptsMeasured` says whether "no receipt" on a row is a fact or an unknown.
 * Held by `lib/billing-read-is-honest.test.ts`.
 */

export type Purchase = {
  orderId: string;
  publicId: string;
  referenceCode: string;
  description: string;
  status: OrderStatus;
  createdAt: string;
  eventId: string | null;
  /** The event's name for the group heading — null when there is none, it is the supplier's own bill, or the name
   *  could not be read (the group then says "An event", never a wrong name). */
  eventName: string | null;
  /** A supplier's own billing (`vendor_…`) — its pay screen is not the event's order page. */
  isSupplierBilling: boolean;
  /** What was paid (the receipt's gross) once a receipt exists; otherwise the gross owed on the order. */
  grossPhp: number;
  receiptId: string | null;
  receiptNumber: string | null;
};

export type PurchasesRead = {
  /** false = the orders read was refused — `rows` is empty and means NOTHING. Never "No purchases yet". */
  measured: boolean;
  /** false = the receipts read was refused — a row without a receipt may still have one. */
  receiptsMeasured: boolean;
  rows: Purchase[];
};

const ORDER_COLUMNS =
  'order_id,public_id,event_id,service_key,description,requested_total_php,confirmed_total_php,status,reference_code,created_at';
const RECEIPT_COLUMNS = 'receipt_id,order_id,or_serial,gross_total_php,issued_at';

/** Enough for any one person's history; a list this long is read top-down (newest first). */
export const BILLING_ROW_LIMIT = 200;

type OrderLite = {
  order_id: string;
  public_id: string;
  event_id: string | null;
  service_key: string | null;
  description: string;
  requested_total_php: number | string;
  confirmed_total_php: number | string | null;
  status: OrderStatus;
  reference_code: string;
  created_at: string;
};
type ReceiptLite = {
  receipt_id: string;
  order_id: string;
  or_serial: number;
  gross_total_php: number | string;
  issued_at: string;
};

export async function fetchMyPurchasesMeasured(
  supabase: SupabaseClient,
  userId: string,
  /** Effective rate from platform_settings (`getEffectiveVatRatePct`) — never a hardcoded 12. */
  vatRatePct = 0,
): Promise<PurchasesRead> {
  const [ordersRes, receiptsRes] = await Promise.all([
    supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('user_id', userId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(BILLING_ROW_LIMIT),
    supabase.from('receipts').select(RECEIPT_COLUMNS).eq('user_id', userId),
  ]);

  if (ordersRes.error || !Array.isArray(ordersRes.data)) {
    return { measured: false, receiptsMeasured: !receiptsRes.error, rows: [] };
  }
  const receiptsMeasured = !receiptsRes.error && Array.isArray(receiptsRes.data);
  const receiptByOrder = new Map<string, ReceiptLite>(
    receiptsMeasured ? (receiptsRes.data as ReceiptLite[]).map((r) => [r.order_id, r]) : [],
  );

  // Event names for the group headings — only for the person's own event orders (a supplier's bill carries the
  // COUPLE's event_id, which a supplier cannot and should not read). A refused read leaves the names unknown.
  const orders = ordersRes.data as OrderLite[];
  const eventIds = [
    ...new Set(orders.filter((o) => o.event_id && !isVatInclusiveServiceKey(o.service_key)).map((o) => o.event_id as string)),
  ];
  const nameOf = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: evs, error: evErr } = await supabase.from('events').select('event_id,display_name').in('event_id', eventIds);
    if (!evErr && Array.isArray(evs)) {
      for (const e of evs as Array<{ event_id: string; display_name: string | null }>) {
        if (e.display_name?.trim()) nameOf.set(e.event_id, e.display_name.trim());
      }
    }
  }

  const rows = orders.map((o): Purchase => {
    const receipt = receiptByOrder.get(o.order_id) ?? null;
    const isSupplierBilling = isVatInclusiveServiceKey(o.service_key);
    const owed = orderGrossOwed({
      requestedTotalPhp: Number(o.requested_total_php),
      confirmedTotalPhp: o.confirmed_total_php == null ? null : Number(o.confirmed_total_php),
      vatInclusive: isSupplierBilling,
      vatRatePct,
    });
    return {
      orderId: o.order_id,
      publicId: o.public_id,
      referenceCode: o.reference_code,
      description: o.description,
      status: o.status,
      createdAt: o.created_at,
      eventId: o.event_id,
      eventName: o.event_id && !isSupplierBilling ? (nameOf.get(o.event_id) ?? null) : null,
      isSupplierBilling,
      grossPhp: receipt ? Number(receipt.gross_total_php) : owed,
      receiptId: receipt?.receipt_id ?? null,
      receiptNumber: receipt ? formatReceiptNumber(receipt.or_serial, receipt.issued_at) : null,
    };
  });
  return { measured: true, receiptsMeasured, rows };
}

/**
 * Where a row opens: its receipt when there is one; otherwise the event's order page (where an unpaid order is
 * paid) — but never for a supplier's own billing (the couple's event is not theirs to open) and never in the
 * App Store shell, whose middleware refuses the order pages (`lib/store-shell.ts`). null = the row is read only.
 */
export function purchaseHref(p: Purchase, storeShell: boolean): string | null {
  if (p.receiptId) return `/receipts/${p.receiptId}`;
  if (p.eventId && !p.isSupplierBilling && !storeShell) return `/dashboard/${p.eventId}/orders/${p.orderId}`;
  return null;
}

/** Statuses that count as money paid in the summary line (a refund is not money kept; a cancel was never paid). */
const PAID: readonly OrderStatus[] = ['paid', 'fulfilled'];

export type PurchaseGroup = { key: string; label: string; rows: Purchase[] };

/**
 * The page's shape (controller direction 2026-10-25, pending the owner's OK of the prototype): ONE summary line,
 * the orders WAITING FOR PAYMENT pinned on top (each with its Pay door), then everything else grouped — one group
 * per event, and "Your shop" for a supplier's own billing — newest group first, newest row first. Pure.
 */
export function shapePurchases(rows: readonly Purchase[]): {
  paidTotalPhp: number;
  paidCount: number;
  awaiting: Purchase[];
  groups: PurchaseGroup[];
} {
  const awaiting = rows.filter((r) => r.status === 'awaiting_payment');
  const paid = rows.filter((r) => PAID.includes(r.status));
  const groups: PurchaseGroup[] = [];
  const byKey = new Map<string, PurchaseGroup>();
  for (const r of rows) {
    if (r.status === 'awaiting_payment') continue;
    const key = r.isSupplierBilling ? 'shop' : r.eventId ? `event:${r.eventId}` : 'other';
    const label = r.isSupplierBilling ? 'Your shop' : r.eventId ? (r.eventName ?? 'An event') : 'Other';
    let g = byKey.get(key);
    if (!g) {
      g = { key, label, rows: [] };
      byKey.set(key, g);
      groups.push(g); // rows arrive newest first, so groups land in order of their newest purchase
    }
    g.rows.push(r);
  }
  return {
    paidTotalPhp: Math.round(paid.reduce((n, r) => n + r.grossPhp, 0) * 100) / 100,
    paidCount: paid.length,
    awaiting,
    groups,
  };
}
