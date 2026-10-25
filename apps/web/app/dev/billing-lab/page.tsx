import { notFound } from 'next/navigation';
import { PageMasthead } from '@/app/_components/page-masthead';
import { BillingList } from '@/app/dashboard/(account)/billing/_components/billing-list';
import type { Purchase, PurchasesRead } from '@/lib/billing';

/**
 * 🧾 THE BILLING & RECEIPTS LAB — the shipped `BillingList` with fixture purchases and no database.
 * `?state=rows|empty|unread|noreceipts` (unread = the orders read was refused; noreceipts = the receipts read was)
 * · `&app=1` the store shell (unpaid event orders stop being links). Dark: add `dark` to <html> (the ready-list
 * keeps /dev Light, so the provider would take a `?dark=1` class straight back off).
 */
const ROWS: Purchase[] = [
  { orderId: 'o1', publicId: 'S89O-7K2M9QX4TB', referenceCode: 'STN-PAPIC-4821', description: 'Papic — Thank-you add-on', status: 'paid', createdAt: '2026-10-23T09:12:00Z', eventId: 'e1', eventName: 'Cale & Ice — Wedding', isSupplierBilling: false, grossPhp: 2500, receiptId: 'r1', receiptNumber: 'TXN-2026-000041' },
  { orderId: 'o2', publicId: 'S89O-3HV8D1RW6N', referenceCode: 'STN-LIVE-1190', description: 'Live Studio', status: 'awaiting_payment', createdAt: '2026-10-20T02:40:00Z', eventId: 'e1', eventName: 'Cale & Ice — Wedding', isSupplierBilling: false, grossPhp: 3000, receiptId: null, receiptNumber: null },
  { orderId: 'o3', publicId: 'S89O-9PZ4C7MK2E', referenceCode: 'STN-PLAN-0077', description: 'Supplier plan — Pro (monthly)', status: 'paid', createdAt: '2026-10-02T11:05:00Z', eventId: null, eventName: null, isSupplierBilling: true, grossPhp: 999, receiptId: 'r3', receiptNumber: 'TXN-2026-000033' },
  { orderId: 'o4', publicId: 'S89O-1QW5T8BN3V', referenceCode: 'STN-FEE-0410', description: 'Booking fee — Cale & Ice', status: 'cancelled', createdAt: '2026-09-14T06:30:00Z', eventId: 'e2', eventName: null, isSupplierBilling: true, grossPhp: 499, receiptId: null, receiptNumber: null },
  { orderId: 'o5', publicId: 'S89O-5RT2W9KD4M', referenceCode: 'STN-PRO-2207', description: 'Event Hub Pro', status: 'paid', createdAt: '2026-08-30T03:15:00Z', eventId: 'e3', eventName: "Lola Nena's 80th", isSupplierBilling: false, grossPhp: 1499, receiptId: 'r5', receiptNumber: 'TXN-2026-000019' },
];

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
        <BillingList read={read} storeShell={sp.app === '1'} />
      </div>
    </main>
  );
}
