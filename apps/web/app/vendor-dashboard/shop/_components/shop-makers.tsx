'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, ScanLine, type LucideIcon } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import type { ScannerChoice } from '@/lib/supplier-scan';
import { BodyPanel } from '../../_components/body-panel';
import { ServiceScannerPick } from './service-scanner-pick';

/**
 * 🛠 SHOP › MAKERS — under Badges, above Services.
 *
 * Build 2 §10 #33 (owner 8 Nov: *"should share a single row… expand like pressing an event from clients… keep the navs
 * and just take up the body part"*): the Makers are ONE ROW OF TILES; a tile opens INTO THE BODY through the shared
 * in-body panel (`BodyPanel` — between the top bar and the bottom nav, both stay; 520 ms out of the tile; × shrinks it
 * back into the tile at the exact prior scroll). Pop-ups opened from inside (the Form Maker sheet) sit above it.
 *
 *   Forms Maker → C3's Form Maker, shop-wide (`ShopFormsMaker`: your forms · suggested · ＋ New form). Its reads are the
 *                 server's, drawn only while `?maker=forms` (`shop-forms-body.tsx`) — the Shop tab pays nothing for it.
 *   Scanner     → one line per service with the SHIPPED `ServiceScannerPick` (Off · Once · Ordered → Received ·
 *                 Unlimited · Group session · Roaming — `lib/supplier-scan.ts`). No sixth mode, no service the shop
 *                 does not have.
 *   Tools Maker → NOT DRAWN: v118 draws a third tile, but nothing ships behind it (spec §9 #8 — it waits on #7006 and a
 *                 ruling on what a supplier tool does on the day). A tile with no door is not drawn; the row is as wide
 *                 as the tiles it has.
 * 🔒 shop/the-shop-tab-is-v113.test.ts · _components/the-body-panel-keeps-the-navs.test.ts
 */
export type ScannerLine = { coverageId: number; label: string; choice: ScannerChoice };

type MakerKey = 'forms' | 'scanner';

export function ShopMakers({
  scanners,
  formsBody,
  formsOn = true,
}: {
  /** One line per service; null = the scanner settings could not be read (said so, never "Off"). */
  scanners: ScannerLine[] | null;
  /** The Forms Maker's body, server-drawn while `?maker=forms`; null while closed (or still on its way). */
  formsBody: ReactNode | null;
  /** The lab draws the row without the Forms tile's server body; the app always has the Forms Maker. */
  formsOn?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inUrl = params.get('maker');
  const [open, setOpen] = useState<MakerKey | null>(inUrl === 'forms' ? 'forms' : null);
  const tiles = useRef<Record<MakerKey, HTMLButtonElement | null>>({ forms: null, scanner: null });
  const frame = useRef<HTMLElement | null>(null);
  useEffect(() => {
    frame.current = (tiles.current.scanner?.closest('[data-shop-tab],[data-shop-tab-lab]') as HTMLElement | null) ?? null;
  }, []);

  // Only the Forms Maker writes the address — its body is the server's (`?maker=forms`), so a reload lands on it too. The
  // Scanner's lines are already on the page: it opens with NO request (an address change would re-draw the whole Shop
  // on the server for nothing). Closing clears the address only if it carries a maker. The page never scrolls for it.
  const go = (k: MakerKey | null) => {
    setOpen(k);
    if (k !== 'forms' && !params.get('maker')) return;
    const q = new URLSearchParams(params.toString());
    if (k === 'forms') q.set('maker', k);
    else q.delete('maker');
    const qs = q.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const on = scanners?.filter((s) => s.choice !== 'off').length ?? null;
  const scannerSub =
    scanners === null
      ? 'Couldn’t load'
      : scanners.length === 0
        ? 'Add a service first'
        : `${formatCount(on ?? 0)} of ${formatCount(scanners.length)} on`;
  const list: { k: MakerKey; title: string; sub: string; icon: LucideIcon; head: string }[] = [
    ...(formsOn ? [{ k: 'forms' as const, title: 'Forms Maker', sub: 'Sent as a chat card', icon: ClipboardList, head: 'Sent to couples as a chat card' }] : []),
    { k: 'scanner', title: 'Scanner', sub: scannerSub, icon: ScanLine, head: 'One per service · how each scan counts' },
  ];
  const cur = open ? list.find((t) => t.k === open) : undefined;

  return (
    <section aria-labelledby="shop-makers-h" data-shop-makers="" id="makers" className="scroll-mt-24">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
        <h2 id="shop-makers-h" className="sn-eye">
          Makers
        </h2>
        <span className="text-[11.5px] text-ink/50">{list.map((t) => t.title.split(' ')[0]!.toLowerCase()).join(' · ')}</span>
      </div>
      <div className="grid gap-2 px-4" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }} data-maker-row="">
        {list.map((t) => (
          <button
            key={t.k}
            ref={(el) => {
              tiles.current[t.k] = el;
            }}
            type="button"
            onClick={() => go(t.k)}
            aria-expanded={open === t.k}
            className="sn-press flex min-h-[104px] flex-col items-center justify-center gap-1 rounded-2xl border border-ink/10 bg-raised px-2 py-3 text-center" // no-card-ok: a Maker tile is a <button> (it opens the Maker into the body) — frames only on what you press
            data-maker={t.k}
          >
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
              <t.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <b className="text-[14px] font-semibold leading-tight text-ink">{t.title}</b>
            <small className="text-[12px] leading-tight text-ink/60">{t.sub}</small>
          </button>
        ))}
      </div>

      {cur ? (
        <BodyPanel
          origin={tiles.current[cur.k]}
          frame={frame.current}
          title={cur.title}
          sub={cur.head}
          lead={
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-[color-mix(in_srgb,rgb(var(--sn-accent))_12%,transparent)] text-ink/75">
              <cur.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
          }
          onClose={() => go(null)}
          data={`maker-${cur.k}`}
        >
          {cur.k === 'scanner' ? (
            <div data-scanner-sheet="">
              <p className="pb-2 text-[13px] text-ink/65">Set once per service — every event booked for it starts with it. How each scan counts:</p>
              {scanners === null ? (
                <p role="status" className="py-3 text-[13.5px] text-ink/70">
                  Couldn&rsquo;t load your scanners just now. Close and open this again.
                </p>
              ) : scanners.length === 0 ? (
                <p className="py-3 text-[13.5px] text-ink/70">Add a service first — each service has its own scanner.</p>
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
          ) : (
            (formsBody ?? (
              <p role="status" className="py-4 text-[13.5px] text-ink/60" data-shop-forms-loading="">
                Opening your forms…
              </p>
            ))
          )}
        </BodyPanel>
      ) : null}
    </section>
  );
}
