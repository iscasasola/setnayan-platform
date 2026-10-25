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

  const rows = (ordersRes.data as OrderLite[]).map((o): Purchase => {
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
