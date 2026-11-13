import { notFound } from 'next/navigation';
import { PageMasthead } from '@/app/_components/page-masthead';
import { BillingList } from '@/app/dashboard/(account)/billing/_components/billing-list';
import { SupplierBillingSections } from '@/app/dashboard/(account)/billing/_components/supplier-billing-sections';
import type { Purchase, PurchasesRead } from '@/lib/billing';
import { billingShowOf } from '@/lib/billing-sections';
import { rewardRowOf, type SupplierBillingRead } from '@/lib/supplier-billing';

/**
 * 🧾 THE BILLING & RECEIPTS LAB — the shipped `BillingList` with fixture purchases and no database.
 * `?state=rows|empty|unread|noreceipts` (unread = the orders read was refused; noreceipts = the receipts read was)
 * · `&supplier=1` the shop's own lists (Build 2 #39, v118) — `&show=gifts|payments|refunds|rewards|purchases` opens on
 *   one, `&supplier=unread` draws every list refused
 * · `&app=1` the store shell (unpaid event orders stop being links). Dark: add `dark` to <html> (the ready-list
 * keeps /dev Light, so the provider would take a `?dark=1` class straight back off).
 */
const ROWS: Purchase[] = [
  { orderId: 'o1', publicId: 'S89O-7K2M9QX4TB', referenceCode: 'STN-PAPIC-4821', description: 'Papic — Thank-you add-on', status: 'paid', createdAt: '2026-10-23T09:12:00Z', eventId: 'e1', eventName: 'Cale & Ice — Wedding', isSupplierBilling: false, grossPhp: 2500, receiptId: 'r1', receiptNumber: 'TXN-2026-000041' },
  { orderId: 'o2', publicId: 'S89O-3HV8D1RW6N', referenceCode: 'STN-LIVE-1190', description: 'Live Watch', status: 'awaiting_payment', createdAt: '2026-10-20T02:40:00Z', eventId: 'e1', eventName: 'Cale & Ice — Wedding', isSupplierBilling: false, grossPhp: 3000, receiptId: null, receiptNumber: null },
  { orderId: 'o3', publicId: 'S89O-9PZ4C7MK2E', referenceCode: 'STN-PLAN-0077', description: 'Supplier plan — Pro (monthly)', status: 'paid', createdAt: '2026-10-02T11:05:00Z', eventId: null, eventName: null, isSupplierBilling: true, grossPhp: 999, receiptId: 'r3', receiptNumber: 'TXN-2026-000033' },
  { orderId: 'o4', publicId: 'S89O-1QW5T8BN3V', referenceCode: 'STN-FEE-0410', description: 'Booking fee — Cale & Ice', status: 'cancelled', createdAt: '2026-09-14T06:30:00Z', eventId: 'e2', eventName: null, isSupplierBilling: true, grossPhp: 499, receiptId: null, receiptNumber: null },
  { orderId: 'o5', publicId: 'S89O-5RT2W9KD4M', referenceCode: 'STN-PRO-2207', description: 'Event Hub Pro', status: 'paid', createdAt: '2026-08-30T03:15:00Z', eventId: 'e3', eventName: "Lola Nena's 80th", isSupplierBilling: false, grossPhp: 1499, receiptId: 'r5', receiptNumber: 'TXN-2026-000019' },
];

/** The v118 sample, in the reader's shapes (`lib/supplier-billing.ts`). */
const SHOP_ROWS: Purchase[] = [
  { orderId: 's1', publicId: 'S89O-ZR5K9F1CWQ', referenceCode: 'SN-ZR5K-03', description: 'Pro · 4 weeks', status: 'awaiting_payment', createdAt: '2026-11-01T01:00:00Z', eventId: null, eventName: null, isSupplierBilling: true, grossPhp: 3000, receiptId: null, receiptNumber: null },
  { orderId: 's2', publicId: 'S89O-ZR5K9F1CWP', referenceCode: 'SN-ZR5K-02', description: 'Pro · 4 weeks', status: 'paid', createdAt: '2026-10-04T00:30:00Z', eventId: null, eventName: null, isSupplierBilling: true, grossPhp: 3000, receiptId: 'r2', receiptNumber: 'TXN-2026-000362' },
  { orderId: 's3', publicId: 'S89O-D4FJ8L2YHQ', referenceCode: 'SN-D4FJ-01', description: 'Booking fee · Ramos debut', status: 'refunded', createdAt: '2026-09-28T05:15:00Z', eventId: null, eventName: null, isSupplierBilling: true, grossPhp: 500, receiptId: 'r1', receiptNumber: 'TXN-2026-000350' },
];
const reward = (id: string, key: string, kind: 'papic' | 'event_plus' | 'fee_waiver', at: string, used: string | null = null) =>
  rewardRowOf({ reward_id: id, reward_key: key, reward_kind: kind, units: 1, granted_at: at, revoked_at: null, used_at: used, returned_at: null });
const SUPPLIER: SupplierBillingRead = {
  gifts: {
    measured: true,
    rows: [
      { lineId: 'g1', eventId: 'e1', client: 'Reyes & Santos wedding', eventDate: '2026-11-08', gift: 'Papic 150', amountPhp: 999, state: 'given', fromBadgeReward: false, createdAt: '2026-11-01T00:00:00Z' },
      { lineId: 'g2', eventId: 'e2', client: 'Lim christening', eventDate: '2026-11-14', gift: 'Event Plus', amountPhp: 2990, state: 'given', fromBadgeReward: true, createdAt: '2026-11-02T00:00:00Z' },
      { lineId: 'g3', eventId: 'e3', client: 'Uy anniversary', eventDate: '2026-11-27', gift: 'Papic 150', amountPhp: 999, state: 'held', fromBadgeReward: false, createdAt: '2026-10-30T00:00:00Z' },
      { lineId: 'g4', eventId: 'e4', client: 'Ramos debut', eventDate: '2026-11-29', gift: 'Papic 150', amountPhp: 999, state: 'refunded', fromBadgeReward: false, createdAt: '2026-11-02T00:00:00Z' },
    ],
  },
  payments: {
    measured: true,
    rows: [
      { paymentId: 'p1', eventId: 'e1', client: 'Reyes & Santos wedding', eventDate: '2026-11-08', amountPhp: 30000, paidOn: '2026-11-01', method: 'GCash', isDeposit: false, state: 'proof_to_check' },
      { paymentId: 'p2', eventId: 'e5', client: 'Villanueva debut', eventDate: '2026-11-08', amountPhp: 6000, paidOn: '2026-11-05', method: 'GCash', isDeposit: false, state: 'confirmed' },
      { paymentId: 'p3', eventId: 'e6', client: 'Cruz debut', eventDate: '2026-11-21', amountPhp: 5000, paidOn: '2026-11-03', method: 'BDO', isDeposit: true, state: 'confirmed' },
      { paymentId: 'p4', eventId: 'e2', client: 'Lim christening', eventDate: '2026-11-14', amountPhp: 5000, paidOn: '2026-11-02', method: 'GCash', isDeposit: true, state: 'confirmed' },
    ],
  },
  rewards: {
    measured: true,
    rows: [
      reward('w1', 'award:rising:2026-10-01', 'event_plus', '2026-10-15T00:00:00Z'),
      reward('w2', 'verified', 'papic', '2026-10-12T00:00:00Z'),
      reward('w3', 'first_booking', 'papic', '2026-10-21T00:00:00Z'),
    ],
  },
  // 💸 B2-E: a refund the shop gave a client.
  clientRefunds: {
    measured: true,
    rows: [{ refundId: 'x1', eventId: 'e5', client: 'Villanueva debut', amountPhp: 3000, refundedOn: '2026-11-06', reason: 'Drone coverage dropped from the package' }],
  },
};
const SUPPLIER_UNREAD: SupplierBillingRead = {
  gifts: { measured: false, rows: [] },
  payments: { measured: false, rows: [] },
  rewards: { measured: false, rows: [] },
  clientRefunds: { measured: false, rows: [] },
};

export default async function BillingLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const state = typeof sp.state === 'string' ? sp.state : 'rows';
  const read: PurchasesRead =
    state === 'empty'
      ? { measured: true, receiptsMeasured: true, rows: [] }
      : state === 'unread'
        ? { measured: false, receiptsMeasured: true, rows: [] }
        : state === 'noreceipts'
          ? { measured: true, receiptsMeasured: false, rows: ROWS.map((r) => ({ ...r, receiptId: null, receiptNumber: null })) }
          : { measured: true, receiptsMeasured: true, rows: ROWS };
  return (
    <main className="min-h-dvh bg-cream text-ink" data-billing-lab={state}>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="mb-4 font-display text-2xl">Billing &amp; receipts</p>
        <PageMasthead title="Billing & receipts" className="mb-6" />
        {sp.supplier ? (
          <SupplierBillingSections
            purchases={state === 'rows' ? { ...read, rows: SHOP_ROWS } : read}
            storeShell={sp.app === '1'}
            supplier={sp.supplier === 'unread' ? SUPPLIER_UNREAD : SUPPLIER}
            initial={billingShowOf(sp.show)}
          />
        ) : (
          <BillingList read={read} storeShell={sp.app === '1'} />
        )}
      </div>
    </main>
  );
}
