'use client';

/**
 * GuestReviewQr — the "instant reviews from guests" card on the On the Day
 * console (photo/video variant + shared footer).
 *
 * Renders the vendor's own review QR (server-rendered SVG string, passed in)
 * with two zero-dependency actions:
 *   • Print — opens a clean print sheet (QR + business name + prompt) in a new
 *     window and fires the browser print dialog. Nothing server-side.
 *   • Show fullscreen — an in-page dark overlay that blows the QR up so guests
 *     can scan it off a phone/laptop screen at the event. Esc / tap closes it.
 *
 * The QR encodes THE GUEST FORM for this shop at today's event
 * (/v/[slug]/guest-review?event=<id>, owner 6 Nov · prototype § 8 Door 1). A
 * guest the door checked in rates what they saw; anyone else is told plainly
 * they are not on the door list and offered the shop's page. The guest is
 * named by the pass in their phone — never typed.
 */

import { useCallback, useRef, useState } from 'react';
import { Maximize2, Printer, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { QrActions } from '@/app/_components/qr-actions';
import { svgDataUri } from '@/lib/qr-download';

export function GuestReviewQr({
  qrSvg,
  reviewUrl,
  businessName,
}: {
  qrSvg: string;
  reviewUrl: string;
  businessName: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  // Esc-to-close + body-scroll lock (both were here), PLUS the two halves that
  // were missing: Tab is trapped inside the overlay, and focus returns to the
  // "Show fullscreen" button on close. The overlay is shown on a screen the
  // vendor holds up to a room, so a keyboard user tabbing out of it lands on
  // controls nobody can see.
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeFullscreen = useCallback(() => setFullscreen(false), []);
  useModalA11y({ open: fullscreen, onClose: closeFullscreen, containerRef: dialogRef });

  function print() {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) return;
    const safeName = businessName.replace(/[<>&]/g, '');
    w.document.write(`<!doctype html><html><head><title>Review ${safeName}</title>
      <style>
        @page { margin: 24mm; }
        html,body { height: 100%; margin: 0; }
        body { font-family: -apple-system, system-ui, sans-serif; color: #1B1A17;
               display: flex; align-items: center; justify-content: center; }
        .sheet { text-align: center; max-width: 480px; }
        .qr { width: 340px; height: 340px; margin: 0 auto 28px; }
        .qr svg { width: 100%; height: 100%; }
        h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: -0.01em; }
        p { font-size: 15px; line-height: 1.5; color: #4F535B; margin: 0 0 6px; }
        .biz { font-weight: 600; color: #1B1A17; }
        .url { font-family: ui-monospace, monospace; font-size: 12px; color: #898D94; margin-top: 18px; word-break: break-all; }
      </style></head><body>
      <div class="sheet">
        <div class="qr">${qrSvg}</div>
        <h1>Loved working with <span class="biz">${safeName}</span>?</h1>
        <p>Were you there? Tell others what stood out.</p>
        <div class="url">${reviewUrl}</div>
      </div>
      </body></html>`);
    w.document.close();
    w.focus();
    // Give the SVG a tick to lay out before printing.
    setTimeout(() => {
      w.print();
    }, 250);
  }

  return (
    <>
      <div
        className="flex flex-col items-center gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
      >
        <div
          className="shrink-0 rounded-lg bg-white p-3"
          style={{ border: '1px solid var(--m-line)' }}
          // Server-rendered QR SVG (trusted, no user input in the markup).
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            Display it or print it at the event — guests the door checked in scan it and rate what they saw.
            No app to install.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={print}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition"
              style={{ background: 'var(--m-ink)' }}
            >
              <Printer aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Print
            </button>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3.5 py-2 text-sm font-semibold transition"
              style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
            >
              <Maximize2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Show fullscreen
            </button>
          </div>
          <QrActions
            url={reviewUrl}
            download={{ href: svgDataUri(qrSvg), filename: 'setnayan-review-qr.svg' }}
            className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start"
          />
        </div>
      </div>

      {fullscreen ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Review QR, fullscreen"
          onClick={closeFullscreen}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 p-6 focus:outline-none"
          style={{ background: 'var(--m-ink)' }}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Close fullscreen"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[min(72vw,72vh)] max-w-[560px] rounded-2xl bg-white p-6"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="max-w-md text-center text-lg font-medium text-white">
            Scan to review {businessName}
          </p>
        </div>
      ) : null}
    </>
  );
}
