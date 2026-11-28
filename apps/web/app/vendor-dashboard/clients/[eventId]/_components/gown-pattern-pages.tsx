'use client';

/**
 * 👗 PATTERN PAGES — Export 1:1 from an order's cutting blocks (plan step B12; the approved drawing is the prototype
 * `gown_maker_v205.html` "Pattern pages · A4", `patExport`, ported; owner D28: A4 and US Letter).
 *
 *   · One line: how many pages, the page map, how many to tape together, any measured diagram.
 *   · A piece that would take more than 40 pages comes as a drawing with its measurements, and says so.
 *   · **Print** prints the real PDF at its true size from a hidden frame on this page (a computer), or opens the
 *     phone's share sheet (which holds Print); **Save the pages** hands that PDF over (`saveFileToDevice`: the share
 *     sheet on a phone, a download on a computer); **Plotter sheet** hands over one large SVG. Never a new page.
 *   · Every page below, page map first, each with its 5 cm test square and "Page n of N".
 *
 * The pages are built here, on the designer's tap: the page engine and pdf-lib load only then. No prices on any sheet.
 * 🔒 lib/gown-pattern/export.test.ts (the pages equal the prototype's) · lib/gown-pattern/order.test.ts (the doors)
 */
import { useEffect, useState } from 'react';
import { Printer, RotateCw, Share } from 'lucide-react';
import { saveFileToDevice } from '@/lib/save-to-device';
import { ActionButton } from '@/components/action-button';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { useToast } from '@/app/_components/toast/toast-provider';
import type { GownBlockPiece } from '@/lib/gown-pattern/skirt';
import type { GownSeamAllow } from '@/lib/gown-pattern/allowance';
import type { GownPaper, GownPatternBook } from '@/lib/gown-pattern/export';
import { gownPagesDiagramWarning, gownPagesSummary } from '@/lib/gown-pattern/words';

type Built = { s: 'building' } | { s: 'failed' } | { s: 'ok'; book: GownPatternBook; svgs: string[]; plot: string; paperName: string; pdf: File | null };

const fileName = (who: string, paper: GownPaper) => `${who.replace(/[^\w-]+/g, '-').slice(0, 30) || 'pattern'}-${paper}`;
const isTouch = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/** Prints the PDF from a hidden frame on this page: no new tab, no new page (the house rule for every print). */
function printInPlace(file: File): boolean {
  try {
    const url = URL.createObjectURL(file);
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        /* the save path below is the fallback the caller offers */
      }
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 10 * 60_000);
    };
    document.body.appendChild(frame);
    return true;
  } catch {
    return false;
  }
}

export function GownPatternPages({ pieces, sa, net, paper, who, onClose }: { pieces: readonly GownBlockPiece[]; sa: GownSeamAllow; net: boolean; paper: GownPaper; who: string; onClose: () => void }) {
  const toast = useToast();
  const [built, setBuilt] = useState<Built>({ s: 'building' });
  const [round, setRound] = useState(0);

  // The pages and their PDF are made as the screen opens, so a tap hands over a file already in hand (a share sheet
  // needs a fresh tap; a file still being drawn when the tap expires is refused by the phone).
  useEffect(() => {
    let live = true;
    setBuilt({ s: 'building' });
    import('@/lib/gown-pattern/export')
      .then(async ({ GOWN_PAPERS, gownPageSvg, gownPatternPages, gownPatternPdf }) => {
        const book = gownPatternPages(pieces.map((p) => ({ p })), { sa, net, paper, who });
        const svgs = book.pages.map((p, i) => gownPageSvg(p.ops, book.aw, book.ah, `${i + 1}. ${p.label}`));
        const plot = `<?xml version="1.0" encoding="UTF-8"?>\n${gownPageSvg(book.plot.ops, book.plot.w, book.plot.h, `${who} · cutting blocks`)}`;
        if (!live) return;
        setBuilt({ s: 'ok', book, svgs, plot, paperName: GOWN_PAPERS[paper].name, pdf: null });
        const bytes = await gownPatternPdf(book, `${who} · pattern`);
        const pdf = new File([bytes as BlobPart], `${fileName(who, paper)}.pdf`, { type: 'application/pdf' });
        if (live) setBuilt((b) => (b.s === 'ok' && b.book === book ? { ...b, pdf } : b));
      })
      .catch(() => live && setBuilt({ s: 'failed' }));
    return () => {
      live = false;
    };
  }, [pieces, sa, net, paper, who, round]);

  const hand = async (file: File) => {
    const r = await saveFileToDevice(file);
    if (r === 'failed') toast.error('Couldn’t save the file. Try again.');
    else if (r === 'expired') toast.error('Tap once more to save the file.');
  };
  const ready = built.s === 'ok' && built.pdf ? built.pdf : null;
  // On a computer Print prints right here; on a phone the share sheet holds Print, Save to Files and the printer apps.
  const print = () => {
    if (!ready) return;
    if (isTouch() || !printInPlace(ready)) void hand(ready);
  };
  const keep = () => ready && void hand(ready);
  const plotter = () => built.s === 'ok' && void hand(new File([built.plot], `${fileName(who, paper)}-plotter.svg`, { type: 'image/svg+xml' }));

  const summary = built.s === 'ok' ? gownPagesSummary(built.book, built.paperName) : null;
  const warning = built.s === 'ok' ? gownPagesDiagramWarning(built.book.diagrams) : null;
  const title = built.s === 'ok' ? `Pattern pages · ${built.paperName}` : 'Pattern pages';
  return (
    <RiseScreen title={title} onClose={onClose} data="gown-pattern-pages" kind="zoom">
      <div className="space-y-4 p-4" data-gown-pages={built.s}>
        {built.s === 'building' ? <div className="sn-frame skeleton h-64" aria-busy="true" /> : null}
        {built.s === 'failed' ? (
          <div className="sn-frame space-y-2 p-4" role="alert">
            <p className="text-sn-md font-semibold text-ink">Couldn’t make the pages for this order</p>
            <ActionButton tone="neutral" icon={RotateCw} label="Try again" onClick={() => setRound((n) => n + 1)} />
          </div>
        ) : null}
        {built.s === 'ok' ? (
          <>
            <p className="text-sn-base text-ink" data-gown-pages-sum="">
              <b>{summary!.lead}</b>
              {summary!.rest}
            </p>
            {warning ? (
              <p role="note" className="text-sn-base font-semibold text-danger-700" data-gown-pages-diagram="">
                {warning}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="brand" icon={Printer} label={ready ? 'Print' : 'Making the PDF…'} onClick={print} disabled={!ready} data-gown-pages-print="" />
              <ActionButton tone="neutral" icon={Share} label="Save the pages" onClick={keep} disabled={!ready} data-gown-pages-save="" />
              <ActionButton tone="neutral" icon={Share} label="Plotter sheet (one large SVG)" onClick={plotter} data-gown-pages-plot="" />
            </div>
            <ol className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {built.svgs.map((svg, i) => (
                <li key={i} className="space-y-1" data-gown-page={built.book.pages[i]!.kind}>
                  {/* Our own drawing of one page, true size scaled to fit; no price on any sheet (lib/gown-pattern/export.ts). */}
                  <div className="overflow-hidden shadow-sn-frame [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
                  <p className="text-sn-sm text-ink/70">
                    {i + 1}. {built.book.pages[i]!.label}
                  </p>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </RiseScreen>
  );
}
