'use client';

import { useRef, useState } from 'react';
import { useModalA11y } from '@/lib/use-modal-a11y';

/**
 * A3 · "Show at the door" — the on-screen door pass (prototype
 * `find_your_seat_2026-09-27.html`, frame A3).
 *
 * 💰 FREE (owner 2026-09-27, "FIND YOUR SEAT, REDESIGNED" (5)): the table, the
 * room map and THIS pass ride the free 2D plan. Nothing on the way here asks
 * for CUSTOM_QR_GUEST — only the PRINTED branded QR cards stay paid, on
 * `/[slug]/seat`. Pinned by `find-seat-is-free-and-private.test.ts`.
 *
 * The code is the guest's own invitation QR (`renderInvitationQrSvg`), the one
 * the check-in desk already scans; nothing new is minted. Full screen, no bar,
 * a paper card on an ink ground so a host reads it from a metre away. It is the
 * page's ONE button; the pass itself only closes.
 */
export type DoorPassData = {
  names: string;
  dateLabel: string | null;
  tableLabel: string;
  guestName: string;
  /** "party of 2 · Ben R." or null. */
  partyLine: string | null;
  /** Inline SVG string, already rendered on the server. */
  qrSvg: string;
  /** The couple's monogram letters for the seal. */
  seal: string;
  /** "5:42 pm" once the door has scanned this guest in, else null. */
  checkedInAt: string | null;
};

/** "Table 3" → the eyebrow "Table" over a huge "3"; any other label is drawn whole. */
function splitTableLabel(label: string): { eyebrow: string | null; big: string } {
  const m = /^table\s+(.{1,4})$/i.exec(label.trim());
  return m ? { eyebrow: 'Table', big: m[1]! } : { eyebrow: null, big: label };
}

export function DoorPass({
  pass,
  big = false,
  defaultOpen = false,
}: {
  pass: DoorPassData;
  /** A2's larger thumb target, under the table. */
  big?: boolean;
  /** Render with the pass already up — for a render test or a fixture, never a page. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: dialogRef });
  const label = splitTableLabel(pass.tableLabel);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-center gap-2.5 rounded-[var(--hub-radius,0.75rem)] bg-ink px-6 text-[0.8125rem] uppercase tracking-[0.18em] text-cream shadow-[0_14px_26px_-16px_rgb(var(--color-ink)/0.75)] ${
          big ? 'min-h-[64px] text-sm' : 'min-h-[54px]'
        }`}
        data-door-pass-open
      >
        <QrGlyph />
        Show at the door
      </button>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Door pass for ${pass.guestName}, ${pass.tableLabel}`}
          className="fixed inset-0 z-[60] flex flex-col bg-ink px-[18px] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-cream"
        >
          <div className="flex items-center justify-between px-1 pb-3">
            <span className="text-xs font-extrabold tracking-[0.18em]">SETNAYAN</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the door pass"
              className="grid h-10 w-10 place-items-center rounded-full bg-cream/15 text-cream"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-between rounded-[var(--hub-radius,1rem)] bg-cream px-5 pb-5 pt-6 text-center text-ink shadow-[inset_0_0_0_6px_rgb(var(--color-cream)),inset_0_0_0_7px_rgb(var(--color-ink)/0.4)]">
            <span
              aria-hidden
              className="absolute right-3.5 top-3 grid h-[52px] w-[52px] rotate-[-8deg] place-items-center rounded-full bg-[var(--hub-accent,rgb(var(--color-ink)))] font-serif text-lg italic text-[var(--hub-accent-ink,rgb(var(--color-cream)))] shadow-md"
            >
              {pass.seal}
            </span>
            <div>
              <p className="px-11 text-[0.72rem] uppercase leading-[1.8] tracking-[0.22em] text-terracotta-700">
                {pass.names}
                {pass.dateLabel ? (
                  <>
                    <br />
                    {pass.dateLabel}
                  </>
                ) : null}
              </p>
              {label.eyebrow ? (
                <p className="mt-3 text-[0.8125rem] uppercase tracking-[0.22em] text-terracotta-700">{label.eyebrow}</p>
              ) : null}
              <p
                className={`m-0 font-serif font-medium leading-[0.92] tracking-[-0.03em] ${
                  label.eyebrow ? 'text-[min(12rem,42vw)]' : 'mt-3 text-5xl'
                }`}
              >
                {label.big}
              </p>
              <p className="mt-3.5 font-serif text-[1.625rem]">{pass.guestName}</p>
              {pass.partyLine ? (
                <p className="mt-1 text-[0.8125rem] tracking-[0.06em] text-ink/75">{pass.partyLine}</p>
              ) : null}
            </div>
            <div
              aria-label={`QR code for ${pass.guestName}`}
              role="img"
              className="qr-slot mt-4 rounded-md bg-white p-2 [&_svg]:h-auto [&_svg]:w-[min(168px,40vw)]"
              dangerouslySetInnerHTML={{ __html: pass.qrSvg }}
            />
            <span className="mt-4 inline-flex items-center gap-2 rounded-[var(--hub-radius,0.375rem)] border border-ink/50 bg-cream px-3 py-2 text-[0.6875rem] uppercase tracking-[0.16em] text-terracotta-700">
              <QrGlyph small />
              {pass.checkedInAt ? `Checked in · ${pass.checkedInAt}` : 'Show this at the door'}
            </span>
          </div>
          <p className="pt-4 text-center text-xs uppercase tracking-[0.14em] text-cream/75">
            Turn your brightness up for the scan
          </p>
        </div>
      ) : null}
    </>
  );
}

function QrGlyph({ small = false }: { small?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={small ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="7" />
      <rect x="4" y="13" width="7" height="7" />
      <path d="M13 13h3v3M20 13v3M16 20h4M13 17v3" />
    </svg>
  );
}
