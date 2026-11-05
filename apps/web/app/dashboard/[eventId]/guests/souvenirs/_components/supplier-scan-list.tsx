import { ScanLine } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { scanNumberLabel } from '@/lib/supplier-scan';
import type { CoupleScanClaim } from '@/lib/supplier-scan.server';
import { formatWallClock } from '@/lib/schedule-datetime-local';

/**
 * 🎟 SUPPLIERS' SCANS, WITH NAMES — the couple's side of the supplier claim scanner (DECISION_LOG 2026-09-25: "the
 * couple sees names on their own side"). Every claim a booked supplier's scanner recorded at this event: the shared
 * number, the guest's name, the service and the supplier, QR or tag, and when. Souvenirs handed out at a supplier's
 * scanner are the desk's OWN rows above (one record, two desks) and are listed here too, so this list is the whole
 * story of the night's scans.
 *
 * Read-only on purpose: a supplier's claim is fixed by Setnayan (Admin › the event), never undone from here, so the
 * couple and the supplier can never be told two different things. `claims === null` = the read failed, said so —
 * never "no scans yet".
 */
export function SupplierScanList({ claims }: { claims: CoupleScanClaim[] | null }) {
  return (
    <section aria-labelledby="supplier-scans-h" className="mt-8" data-supplier-scan-list="">
      {/* The heading is for screen readers; the InfoTip's own label is the one word on screen (the Shop › Services way). */}
      <h2 id="supplier-scans-h" className="sr-only">
        Suppliers&rsquo; scans
      </h2>
      <div className="text-[12.5px] font-medium uppercase tracking-[0.06em] text-ink/55">
        <InfoTip label="Suppliers' scans" align="start">
          A supplier whose service has a scanner (a photo booth, a souvenir table, a print station) scans each guest&rsquo;s
          QR or taps their tag. Each guest gets a number — the same number shows on their Event Hub. Suppliers see the
          number and the guest&rsquo;s first name; you see full names here.
        </InfoTip>
      </div>
      {claims === null ? (
        <p role="alert" className="py-3 text-[14px] text-ink/70" data-supplier-scan-list-unread="">
          <strong className="text-ink">We couldn&rsquo;t load the suppliers&rsquo; scans just now.</strong> Reload to try again.
        </p>
      ) : claims.length === 0 ? (
        <p className="py-3 text-[14px] text-ink/60">No supplier has scanned a guest yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {claims.map((c) => (
            <li key={`${c.service}-${c.number}-${c.at}`} className="flex min-h-[56px] items-center gap-3 py-2.5">
              <ScanLine aria-hidden className="h-4 w-4 flex-none text-ink/45" strokeWidth={1.8} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">
                  <span className="tabular-nums">{scanNumberLabel(c.number)}</span> · {c.guestName}
                </span>
                <span className="block truncate text-[13px] text-ink/60">
                  {[c.service, c.shop, c.method === 'supplier_nfc' ? 'Tag' : 'QR', formatWallClock(c.at)].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
