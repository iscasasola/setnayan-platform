'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ClipboardList, ScanLine } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { RowIcon } from '../../_components/row-icon';
import type { ScannerChoice } from '@/lib/supplier-scan';
import { ServiceScannerPick } from './service-scanner-pick';

/**
 * 🛠 SHOP › MAKERS — under Badges, above Services (owner v110; spec §1 "Makers"; THE ONE BUILD A3 W11 as cut by spec §9
 * #8: Scanner + the Forms door, NO Tools Maker — it waits on #7006 and a ruling on what a supplier tool does on the day).
 *
 *   Forms Maker → the Form Maker C3 builds (one door; the row is drawn only once its address exists — no dead door).
 *   Scanner     → a sheet: one line per service with the SHIPPED `ServiceScannerPick` (Off · Once · Ordered → Received ·
 *                 Unlimited · Group session · Roaming — `lib/supplier-scan.ts`), moved here from each service row. No
 *                 sixth "Session" mode, no "After a scan" (the admin tool maker's), no service the shop does not have.
 * 🔒 shop/the-shop-tab-is-v113.test.ts
 */
export type ScannerLine = { coverageId: number; label: string; choice: ScannerChoice };

export function ShopMakers({
  scanners,
  formsHref,
  formsLine,
}: {
  /** One line per service; null = the scanner settings could not be read (said so, never "Off"). */
  scanners: ScannerLine[] | null;
  /** The Form Maker's address, once C3's lands; null = not drawn. */
  formsHref: string | null;
  formsLine?: string;
}) {
  const [open, setOpen] = useState(false);
  const hid = useId();
  const on = scanners?.filter((s) => s.choice !== 'off').length ?? null;
  return (
    <section aria-labelledby="shop-makers-h" data-shop-makers="" id="makers" className="scroll-mt-24">
      <div className="flex items-baseline justify-between px-4 pb-1 pt-5">
        <h2 id="shop-makers-h" className="sn-eye">
          Makers
        </h2>
        <span className="text-[11.5px] text-ink/50">{formsHref ? 'forms · scanner' : 'scanner'}</span>
      </div>
      <ul className="divide-y divide-ink/10 px-4">
        {formsHref ? (
          <li>
            <Link href={formsHref} className="sn-press flex min-h-[60px] items-center gap-3 py-2.5" data-maker="forms">
              <RowIcon icon={ClipboardList} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-ink">Forms Maker</span>
                <span className="block truncate text-[13px] text-ink/60">{formsLine ?? 'Questions couples answer, sent as a chat card'}</span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={2} />
            </Link>
          </li>
        ) : null}
        <li>
          <button type="button" onClick={() => setOpen(true)} className="sn-press flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left" data-maker="scanner">
            <RowIcon icon={ScanLine} />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink">Scanner</span>
              <span className="block truncate text-[13px] text-ink/60">
                {scanners === null
                  ? 'Couldn’t load your scanners'
                  : scanners.length === 0
                    ? 'Add a service first — each service has its own scanner'
                    : `One scanner set up per service · ${on} of ${scanners.length} on`}
              </span>
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={2} />
          </button>
        </li>
      </ul>
      {open ? (
        <Sheet open onClose={() => setOpen(false)} labelledById={hid} title="Scanner" rise>
          <div className="px-4 pb-6" data-scanner-sheet="">
            <h2 id={hid} className="sr-only">
              Scanner
            </h2>
            <p className="pb-2 text-[13px] text-ink/65">Set once per service — every event booked for it starts with it. How each scan counts:</p>
            {scanners === null ? (
              <p role="status" className="py-3 text-[13.5px] text-ink/70">
                Couldn&rsquo;t load your scanners just now. Close and open this again.
              </p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {scanners.map((s) => (
                  <li key={s.coverageId} className="py-1" data-scanner-line={s.coverageId}>
                    <ServiceScannerPick coverageId={s.coverageId} serviceLabel={s.label} initial={s.choice} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Sheet>
      ) : null}
    </section>
  );
}
