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
 *   ?side=couple           the couple's souvenir table › Suppliers' scans, with names
 *   ?side=couple&state=empty|unread
 */
const NUMBERS: GuestScanNumber[] = [
  { number: 42, service: 'Photo booth', shop: 'Lumina Studio', at: '2026-12-18T11:41:00Z' },
  { number: 88, service: 'Souvenir / Giveaways', shop: 'Pabaon PH', at: '2026-12-18T10:05:00Z' },
];
const CLAIMS: CoupleScanClaim[] = [
  { number: 43, guestName: 'Paolo Reyes', service: 'Photo booth', shop: 'Lumina Studio', method: 'supplier_qr', at: '2026-12-18T12:05:00Z' },
  { number: 42, guestName: 'Ana Reyes', service: 'Photo booth', shop: 'Lumina Studio', method: 'supplier_nfc', at: '2026-12-18T11:41:00Z' },
  { number: 88, guestName: 'Ana Reyes', service: 'Souvenir / Giveaways', shop: 'Pabaon PH', method: 'supplier_qr', at: '2026-12-18T10:05:00Z' },
  { number: 41, guestName: 'Lito Santos', service: 'Photo booth', shop: 'Lumina Studio', method: 'supplier_qr', at: '2026-12-18T11:36:00Z' },
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
      <YourNumberCardView numbers={q.two === '1' ? NUMBERS : NUMBERS.slice(0, 1)} className="mt-8" />
    </main>
  );
}
