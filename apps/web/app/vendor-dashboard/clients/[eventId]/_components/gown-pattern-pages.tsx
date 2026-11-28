'use client';

/**
 * 👗 PATTERN PAGES — Export 1:1 from an order's cutting blocks (plan step B12; the approved drawing is the prototype
 * `gown_maker_v205.html` "Pattern pages · A4", `patExport`, ported; owner D28: A4 and US Letter).
 *
 *   · One line: how many pages, the page map, how many to tape together, any measured diagram.
 *   · A piece that would take more than 40 pages comes as a drawing with its measurements, and says so.
 *   · **Print** opens the real PDF (the browser prints it at its true size); **Save the pages** keeps that PDF;
 *     **Plotter sheet** keeps one large SVG with every piece at full size.
 *   · Every page below, page map first, each with its 5 cm test square and "Page n of N".
 *
 * The pages are built here, on the designer's tap: the page engine and pdf-lib load only then. No prices on any sheet.
 * 🔒 lib/gown-pattern/export.test.ts (the pages equal the prototype's) · lib/gown-pattern/order.test.ts (the doors)
 */
import { useEffect, useState } from 'react';
import { Download, Printer, RotateCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { useToast } from '@/app/_components/toast/toast-provider';
import type { GownBlockPiece } from '@/lib/gown-pattern/skirt';
import type { GownSeamAllow } from '@/lib/gown-pattern/allowance';
import type { GownPaper, GownPatternBook } from '@/lib/gown-pattern/export';

type Built = { s: 'building' } | { s: 'failed' } | { s: 'ok'; book: GownPatternBook; svgs: string[]; plot: string; paperName: string };

const fileName = (who: string, paper: GownPaper) => `${who.replace(/[^\w-]+/g, '-').slice(0, 30) || 'pattern'}-${paper}`;

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function GownPatternPages({ pieces, sa, net, paper, who, onClose }: { pieces: readonly GownBlockPiece[]; sa: GownSeamAllow; net: boolean; paper: GownPaper; who: string; onClose: () => void }) {
  const toast = useToast();
  const [built, setBuilt] = useState<Built>({ s: 'building' });
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    setBuilt({ s: 'building' });
    import('@/lib/gown-pattern/export')
      .then(({ GOWN_PAPERS, gownPageSvg, gownPatternPages }) => {
        const book = gownPatternPages(pieces.map((p) => ({ p })), { sa, net, paper, who });
        const svgs = book.pages.map((p, i) => gownPageSvg(p.ops, book.aw, book.ah, `${i + 1}. ${p.label}`));
        const plot = `<?xml version="1.0" encoding="UTF-8"?>\n${gownPageSvg(book.plot.ops, book.plot.w, book.plot.h, `${who} · cutting blocks`)}`;
        if (live) setBuilt({ s: 'ok', book, svgs, plot, paperName: GOWN_PAPERS[paper].name });
      })
      .catch(() => live && setBuilt({ s: 'failed' }));
    return () => {
      live = false;
    };
  }, [pieces, sa, net, paper, who, round]);

  const pdf = async (): Promise<Blob | null> => {
    if (built.s !== 'ok') return null;
    const { gownPatternPdf } = await import('@/lib/gown-pattern/export');
    const bytes = await gownPatternPdf(built.book, `${who} · pattern`);
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
  };
  const print = async () => {
    setBusy(true);
    try {
      const b = await pdf();
      if (!b) return;
      const url = URL.createObjectURL(b);
      const w = window.open(url, '_blank');
      if (!w) toast.error('Printing is blocked here: use “Save the pages” and print the file.');
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
    } catch {
      toast.error('Couldn’t make the pages. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const keep = async () => {
    setBusy(true);
    try {
      const b = await pdf();
      if (b) save(b, `${fileName(who, paper)}.pdf`);
    } catch {
      toast.error('Couldn’t make the pages. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const plotter = () => {
    if (built.s === 'ok') save(new Blob([built.plot], { type: 'image/svg+xml' }), `${fileName(who, paper)}-plotter.svg`);
  };

  const title = built.s === 'ok' ? `Pattern pages · ${built.paperName}` : 'Pattern pages';
  return (
    <RiseScreen title={title} onClose={onClose} busy={busy} data="gown-pattern-pages" kind="zoom">
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
              <b>
                {built.book.total} page{built.book.total > 1 ? 's' : ''}
              </b>{' '}
              on {built.paperName}: the page map, {built.book.tiles} page{built.book.tiles === 1 ? '' : 's'} to tape together
              {built.book.diagrams.length ? `, and ${built.book.diagrams.length} measured diagram${built.book.diagrams.length > 1 ? 's' : ''}` : ''}. Print at 100 %, then check the 5 cm square.
            </p>
            {built.book.diagrams.length ? (
              <p role="note" className="text-sn-base font-semibold text-danger-700" data-gown-pages-diagram="">
                {built.book.diagrams.map((d) => `${d.piece} would take ${d.pages} pages`).join('; ')}: too many to tape together, so {built.book.diagrams.length > 1 ? 'they come' : 'it comes'} as a
                drawing with its measurements. The plotter sheet still has {built.book.diagrams.length > 1 ? 'them' : 'it'} at full size.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="brand" icon={Printer} label="Print" onClick={print} disabled={busy} data-gown-pages-print="" />
              <ActionButton tone="neutral" icon={Download} label="Save the pages" onClick={keep} disabled={busy} data-gown-pages-save="" />
              <ActionButton tone="neutral" icon={Download} label="Plotter sheet (one large SVG)" onClick={plotter} disabled={busy} data-gown-pages-plot="" />
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
