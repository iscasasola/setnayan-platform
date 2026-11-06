'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, QrCode } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { usePromoteBridge } from '@/app/vendor-dashboard/shop/promote/_components/promote-bridge';
import type { PrintQrMode } from '@/lib/supplier-prints';

/**
 * 🔳 QR CODES, ONE LIST — Option B (owner 2026-11-06: *"The qr codes are unorganized"* · *"Seeing each kind of qr, and
 * what it does. I also do not see the booked qr"* → on the prototype: *"B"*). Prototype:
 * `scratchpad/qr-list-proto/index.html` (claude.ai/artifact/Qgh3BmXSueMLFpUwPxLQHD), copied one-for-one:
 *
 *   ONE ROW PER CODE   name · sub (· "per event") / what a scan does · a small QR · ›
 *   TAP → ITS SHEET    name · sub · ⓘ · Done / the full caption / its own options / the big code + Share · Copy link ·
 *                      Download · Write to NFC (the shipped `QrCard`) / "Put it on…" → Door print · Prints
 *
 * The list is the only place that picks a code; the sheet is the only place with buttons. A row whose sheet is not
 * drawn on this visit (Customers › QR codes reads Booked OR Crew per visit) goes to its own address, where its sheet
 * opens. "Put it on…" is Shop › Promote's only (`usePromoteBridge`): it hands THIS code to the Prints sheet — the door
 * print and the badge print are pieces INSIDE prints (6 Nov "ONE HOME FOR EVERY PROMOTE TOOL").
 */
export type QrRow = {
  key: string;
  name: string;
  /** "free" · "one-use" — drawn quiet after the name. */
  sub?: string;
  /** Booked and Crew belong to one event — the "per event" mark. */
  perEvent?: boolean;
  /** What a scan does — the row's one line (the shipped caption, cut at the dash). */
  line: string;
  /** The full caption — the sheet's quiet line and its ⓘ. */
  sheetLine: string;
  /** The code itself, drawn on the server — null when there is no code to show yet (a Booked code not issued). */
  thumb: string | null;
  /** The sheet's body (options, the card, its own rows). Null = not drawn on this visit: the row goes to `href`. */
  body: ReactNode | null;
  href?: string;
  /** This code can go onto the shop's prints (Shop › Promote's codes). */
  putOn?: PrintQrMode;
};

export function QrCodeList({ rows, openKey = null }: { rows: QrRow[]; openKey?: string | null }) {
  const drawn = (k: string | null) => (k && rows.some((r) => r.key === k && r.body) ? k : null);
  const [open, setOpen] = useState<string | null>(drawn(openKey));
  // A row whose sheet was not drawn went to its own address; arriving there (same list, new props) opens its sheet.
  const askedKey = drawn(openKey);
  useEffect(() => {
    if (askedKey) setOpen(askedKey);
  }, [askedKey]);
  const router = useRouter();
  const bridge = usePromoteBridge();
  const titleId = useId();
  const row = rows.find((r) => r.key === open) ?? null;

  return (
    <>
      <div data-qr-list={rows.map((r) => r.key).join(',')}>
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => (r.body ? setOpen(r.key) : r.href ? router.push(r.href, { scroll: false }) : undefined)}
            className="sn-press flex min-h-14 w-full items-center gap-3 border-b border-[var(--sn-hairline)] py-2.5 text-left last:border-b-0"
            data-qr-row={r.key}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium leading-tight text-ink">
                {r.name}
                {r.sub ? <span className="font-normal text-[var(--sn-ink-500)]"> · {r.sub}</span> : null}
                {r.perEvent ? (
                  <span className="ml-1.5 inline-block rounded-full bg-[var(--sn-gold-100)] px-2 py-0.5 align-[1px] text-[11px] font-semibold text-[var(--sn-gold-800)]">per event</span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[13px] text-ink/60">{r.line}</span>
            </span>
            <QrThumb svg={r.thumb} />
            <ChevronRight aria-hidden className="h-[18px] w-[18px] flex-none text-sn-accent" strokeWidth={2} />
          </button>
        ))}
      </div>

      <Sheet
        open={row !== null}
        onClose={() => setOpen(null)}
        labelledById={titleId}
        head={
          row ? (
            <div className="flex min-h-11 items-center gap-2 px-4 pt-3">
              <h2 id={titleId} className="text-[20px] font-bold leading-tight tracking-[-0.015em] text-ink">
                {row.name}
                {row.sub ? <span className="text-[16px] font-normal text-[var(--sn-ink-500)]"> · {row.sub}</span> : null}
              </h2>
              <InfoTip label="" ariaLabel={`About ${row.name}`} align="start">
                {`${row.sheetLine}${row.perEvent ? ' This code belongs to one event.' : ''} Tap the code to open it big for a scanner.`}
              </InfoTip>
              <button type="button" onClick={() => setOpen(null)} className="ml-auto min-h-11 pl-3 text-[15px] font-semibold text-sn-accent" data-qr-sheet-done="">
                Done
              </button>
            </div>
          ) : null
        }
      >
        {row ? (
          <div className="px-4 pb-6" data-qr-sheet={row.key}>
            <p className="text-[13px] text-[var(--sn-ink-500)]">{row.sheetLine}</p>
            {row.body}
            {row.putOn && bridge ? (
              <div data-qr-put-on={row.putOn}>
                <div className="my-3.5 h-px bg-[var(--sn-line)]" />
                <p className="mt-1.5 text-[15px] font-semibold text-ink">Put it on…</p>
                <PutOnRow
                  title="Door print"
                  line="We are part of Setnayan"
                  data="door"
                  onClick={() => {
                    bridge.putOn(row.putOn!, 'door');
                    setOpen(null);
                  }}
                />
                <PutOnRow
                  title="Prints"
                  line="This code on your print pieces"
                  data="prints"
                  onClick={() => {
                    bridge.putOn(row.putOn!, null);
                    setOpen(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

function PutOnRow({ title, line, data, onClick }: { title: string; line: string; data: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="sn-press flex min-h-14 w-full items-center gap-3 border-b border-[var(--sn-hairline)] py-2.5 text-left last:border-b-0" data-qr-put-on-row={data}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-tight text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] text-ink/60">{line}</span>
      </span>
      <ChevronRight aria-hidden className="h-[18px] w-[18px] flex-none text-sn-accent" strokeWidth={2} />
    </button>
  );
}

/** The small code on a row: always dark on a white plate (a scanner's rule, both themes). No code yet = the QR mark. */
function QrThumb({ svg }: { svg: string | null }) {
  return (
    <span
      aria-hidden
      className="block h-11 w-11 flex-none rounded-lg bg-white p-[3px] shadow-[0_1px_0_rgba(0,0,0,.04),0_4px_12px_-8px_rgba(0,0,0,.35)] [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
      data-qr-thumb={svg ? 'code' : 'none'}
    >
      {svg ? <span className="block h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <QrCode className="h-full w-full p-1.5 text-[#2C2A29]/40" strokeWidth={1.5} />}
    </span>
  );
}
