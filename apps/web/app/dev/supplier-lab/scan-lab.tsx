import { YourNumberCardView } from '@/app/[slug]/_components/your-number-card';
import { SupplierScanList } from '@/app/dashboard/[eventId]/guests/souvenirs/_components/supplier-scan-list';
import type { CoupleScanClaim, GuestScanNumber } from '@/lib/supplier-scan.server';

/**
 * /dev/supplier-lab?s=scan-guest | scan-couple — 🎟 the supplier claim scanner's GUEST and COUPLE sides on fixture data
 * (approved prototype `supplier_scan_2026-10-03_fable.html`, frame E). DEV-ONLY (the lab page 404s in production). It
 * draws the REAL pieces
 * — the guest's `YourNumberCardView` and the couple's `SupplierScanList` — over lab numbers; nothing is read or written.
 * The supplier's side is `/dev/supplier-lab?s=event-hub&view=scanner&scan=on` and `/dev/supplier-lab?s=services`.
 *
 *   (side = guest for s=scan-guest, couple for s=scan-couple)
 *   ?side=guest            the guest's Live: Now, then "Your number #0042 · Photo booth · Lumina Studio"
 *   ?side=guest&two=1      two numbers (a booth and the souvenir table)
 *   ?side=guest&state=ordered|ready   Ordered → Received: "Being prepared" · "Ready — claim it now" + the guest's notice
 *   ?side=couple           the couple's souvenir table › Suppliers' scans, with names
 *   ?side=couple&state=empty|unread
 */
const NUMBERS: GuestScanNumber[] = [
  { number: 42, service: 'Photo booth', shop: 'Lumina Studio', at: '2026-12-18T11:41:00Z', state: 'received' },
  { number: 88, service: 'Souvenir / Giveaways', shop: 'Pabaon PH', at: '2026-12-18T10:05:00Z', state: 'received' },
];
/** `?side=guest&state=ordered|ready` — the Ordered → Received card (slice 2). */
const PRINT = (state: 'ordered' | 'ready'): GuestScanNumber => ({
  number: 42,
  service: 'Photo booth prints',
  shop: 'Lumina Studio',
  at: '2026-12-18T11:41:00Z',
  state,
});
const CLAIMS: CoupleScanClaim[] = [
  { state: 'ready', number: 44, guestName: 'Bea Cruz', service: 'Photo booth prints', shop: 'Lumina Studio', method: 'supplier_qr', at: '2026-12-18T12:10:00Z' },
  { state: 'received', number: 43, guestName: 'Paolo Reyes', service: 'Photo booth', shop: 'Lumina Studio', method: 'supplier_qr', at: '2026-12-18T12:05:00Z' },
  { state: 'received', number: 42, guestName: 'Ana Reyes', service: 'Photo booth', shop: 'Lumina Studio', method: 'supplier_nfc', at: '2026-12-18T11:41:00Z' },
  { state: 'received', number: 88, guestName: 'Ana Reyes', service: 'Souvenir / Giveaways', shop: 'Pabaon PH', method: 'supplier_qr', at: '2026-12-18T10:05:00Z' },
  { state: 'received', number: 41, guestName: 'Lito Santos', service: 'Photo booth', shop: 'Lumina Studio', method: 'supplier_qr', at: '2026-12-18T11:36:00Z' },
];

export function ScanLab(q: { side?: string; two?: string; state?: string }) {
  if (q.side === 'couple') {
    const claims = q.state === 'unread' ? null : q.state === 'empty' ? [] : CLAIMS;
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl bg-paper px-4 py-6 text-ink" data-lab="supplier-scan-couple">
        <h1 className="text-2xl font-semibold tracking-tight">Souvenir table</h1>
        <p className="mt-1 text-sm text-ink/60">The desk (scan · search · Mark) draws here — it reads the guest list itself.</p>
        <SupplierScanList claims={claims} />
      </main>
    );
  }
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-paper px-4 py-8 text-ink" data-lab="supplier-scan-guest">
      <p className="text-center text-[12px] uppercase tracking-[0.16em] text-ink/55">Ana &amp; Miguel · Today</p>
      <section className="mt-6 text-center" aria-label="Now">
        <span className="block text-[12px] uppercase tracking-[0.16em] text-ink/55">Now</span>
        <span className="block font-pahina text-2xl text-ink">First dance</span>
        <span className="block text-[13.5px] text-ink/60">The garden · 8:00 PM</span>
      </section>
      <YourNumberCardView
        numbers={q.state === 'ordered' || q.state === 'ready' ? [PRINT(q.state)] : q.two === '1' ? NUMBERS : NUMBERS.slice(0, 1)}
        className="mt-8"
      />
      {q.state === 'ready' ? (
        <p className="mt-6 border-y border-ink/15 px-4 py-3 text-center text-[14px] text-ink" data-lab-stand-in="announcement">
          #0042 is ready — claim it at Photo booth prints (Lumina Studio).
          <span className="block text-[12px] text-ink/55">(the Event Hub&rsquo;s announcement card, as this guest sees it)</span>
        </p>
      ) : null}
    </main>
  );
}
