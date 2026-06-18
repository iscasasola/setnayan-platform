'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, ImageDown, ArrowRight, Loader2 } from 'lucide-react';
import { mountStudio } from '@/lib/monogram-studio/engine';
import { STUDIO_HTML, STUDIO_CSS } from '@/lib/monogram-studio/markup';
import { sanitizeStudioSvg, type StudioConfig } from '@/lib/monogram-studio-shared';

/**
 * PublicMonogramStudio — the FREE, no-login Vector Monogram Studio on
 * www.setnayan.com/monogram. It reuses the exact same engine + editor markup as
 * the couple-facing dashboard studio (lib/monogram-studio/*), but a public
 * visitor has no wedding to save into — so it ends in DOWNLOAD (crisp vector SVG
 * + transparent PNG) plus a "start planning free" CTA into the sign-up funnel,
 * never a server write. Pure client: paper.js/opentype.js load only after a
 * dynamic import, so the public route's server render never touches them.
 */

type StudioApi = { getExport: () => { svg: string; config: StudioConfig } | null; destroy: () => void };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the navigation/download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Rasterize the studio's pure-paths SVG to a transparent PNG client-side. The
 * sanitized SVG has a viewBox but no fixed width/height (CSS owns display size),
 * so we inject explicit pixel dims sized from the viewBox aspect — an <img> of a
 * dimensionless SVG renders at an unreliable intrinsic size otherwise. Alpha is
 * preserved (no fillRect): the mark stays transparent, exactly like the SVG.
 */
async function rasterizeToPng(svg: string, longEdge = 1600): Promise<Blob | null> {
  const vb = svg.match(/viewBox="\s*-?[\d.]+\s+-?[\d.]+\s+([\d.]+)\s+([\d.]+)/i);
  const vw = vb ? parseFloat(vb[1] ?? '1') : 1;
  const vh = vb ? parseFloat(vb[2] ?? '1') : 1;
  const ratio = vh > 0 && vw > 0 ? vh / vw : 1;
  let w = longEdge;
  let h = Math.round(longEdge * ratio);
  if (h > longEdge) {
    h = longEdge;
    w = Math.round(longEdge / ratio);
  }
  const sized = svg.replace(/^<svg /i, `<svg width="${w}" height="${h}" `);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  const img = new Image();
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('raster'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Fire-and-forget analytics — no PII, never blocks the download. */
function track(event: string, props?: Record<string, unknown>) {
  try {
    void import('posthog-js')
      .then((m) => {
        const ph = (m as { default?: { capture?: (e: string, p?: Record<string, unknown>) => void } }).default;
        ph?.capture?.(event, props);
      })
      .catch(() => {});
  } catch {
    /* noop */
  }
}

export function PublicMonogramStudio() {
  const rootRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<StudioApi | null>(null);
  const [ready, setReady] = useState(false);
  const [pngBusy, setPngBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let api: StudioApi | null = null;
    (async () => {
      try {
        const [paperMod, offsetMod, otMod] = await Promise.all([
          import('paper'),
          import('paperjs-offset'),
          import('opentype.js'),
        ]);
        if (!alive || !rootRef.current) return;
        const paper: any = (paperMod as any).default ?? paperMod;
        const off: any = offsetMod as any;
        const PaperOffset = off.PaperOffset ?? off.default?.PaperOffset ?? off.default ?? off;
        const ot: any = otMod as any;
        const opentype = ot.parse ? ot : (ot.default ?? ot);
        api = mountStudio({ root: rootRef.current, paper, opentype, PaperOffset, initialConfig: null }) as StudioApi;
        apiRef.current = api;
        setReady(true);
      } catch {
        if (rootRef.current) {
          const load = rootRef.current.querySelector<HTMLElement>('#load');
          if (load) load.textContent = 'Could not start the studio.';
        }
      }
    })();
    return () => {
      alive = false;
      try {
        api?.destroy();
      } catch {
        /* noop */
      }
      apiRef.current = null;
    };
  }, []);

  function exportSvg(): string | null {
    const res = apiRef.current?.getExport();
    if (!res || !res.svg) {
      setError('Add at least one initial before downloading.');
      return null;
    }
    const clean = sanitizeStudioSvg(res.svg);
    if (!clean) {
      setError('Could not prepare that design — adjust it and try again.');
      return null;
    }
    setError(null);
    return clean;
  }

  function onDownloadSvg() {
    const svg = exportSvg();
    if (!svg) return;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'setnayan-monogram.svg');
    track('public_monogram_downloaded', { format: 'svg' });
  }

  async function onDownloadPng() {
    const svg = exportSvg();
    if (!svg || pngBusy) return;
    setPngBusy(true);
    try {
      const blob = await rasterizeToPng(svg, 1600);
      if (blob) {
        downloadBlob(blob, 'setnayan-monogram.png');
        track('public_monogram_downloaded', { format: 'png' });
      } else {
        setError('Could not render the PNG — the SVG download still works.');
      }
    } catch {
      setError('Could not render the PNG — the SVG download still works.');
    } finally {
      setPngBusy(false);
    }
  }

  return (
    <div className="vsroot">
      <style dangerouslySetInnerHTML={{ __html: STUDIO_CSS }} />
      <div ref={rootRef} className="vs" dangerouslySetInnerHTML={{ __html: STUDIO_HTML }} />

      {error ? <p className="mt-3 text-center text-sm text-[#9B3B2E]">{error}</p> : null}

      <div className="mx-auto mt-4 flex max-w-[430px] flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onDownloadSvg}
          disabled={!ready}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#1E2229] px-5 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download aria-hidden className="h-4 w-4" strokeWidth={2} />
          Download SVG
        </button>
        <button
          type="button"
          onClick={onDownloadPng}
          disabled={!ready || pngBusy}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#1E2229]/20 bg-white px-5 py-3 text-sm font-semibold text-[#1E2229] transition-colors hover:bg-[#1E2229]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pngBusy ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
          ) : (
            <ImageDown aria-hidden className="h-4 w-4" strokeWidth={2} />
          )}
          {pngBusy ? 'Preparing PNG…' : 'Download PNG'}
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-[#5F5E5A]">
        Free to download — crisp vector SVG or a transparent PNG, both scale to any size.
      </p>

      <div className="mx-auto mt-7 max-w-[460px] rounded-2xl border border-[#C5A059]/40 bg-[#FBF6EA] px-5 py-5 text-center">
        <p className="font-serif text-lg text-[#1E2229]">Make it your wedding&rsquo;s monogram</p>
        <p className="mt-1.5 text-sm text-[#5F5E5A]">
          Start planning free and your mark flows everywhere — your wedding website, QR invitations,
          save-the-date, and signage.
        </p>
        <Link
          href="/onboarding/wedding?from=monogram"
          onClick={() => track('public_monogram_cta', { target: 'onboarding' })}
          className="mt-3.5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#5C2542] px-6 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Start planning · free
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
