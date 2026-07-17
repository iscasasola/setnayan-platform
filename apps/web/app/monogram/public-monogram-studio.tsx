'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Download, ImageDown, ArrowRight, Loader2, UploadCloud } from 'lucide-react';
import { mountStudio } from '@/lib/monogram-studio/engine';
import { STUDIO_HTML, STUDIO_CSS } from '@/lib/monogram-studio/markup';
import { STUDIO_HTML_V2, STUDIO_CSS_V2 } from '@/lib/monogram-studio/markup-v2';
import { monogramStudioV2Enabled } from '@/lib/monogram-studio/flag';
import { sanitizeStudioSvg, type StudioConfig, type StudioAnimKind } from '@/lib/monogram-studio-shared';
import { stashMonogramDraft } from '@/lib/monogram-studio/draft';
import { StudioRevealPlayer, type StudioAnim } from '@/app/_components/studio-reveal-player';
import { fileToMarkSvg } from '@/lib/monogram-studio/upload';

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
  // Universal portal preview (benchmark §3): the same live-site player renders
  // every reveal over the canvas — the free studio previews the real thing.
  const [previewKind, setPreviewKind] = useState<StudioAnimKind | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [previewAnim, setPreviewAnim] = useState<StudioAnim | null>(null);
  const [swEl, setSwEl] = useState<HTMLElement | null>(null);
  // "Upload your own" (owner 2026-07-17): decode/trace in the browser, preview
  // reveals on the REAL uploaded mark via the same portal, download the vector.
  const [uploaded, setUploaded] = useState<{ svg: string; elements: number; traced: boolean } | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onUploadFile(file: File | undefined) {
    if (!file || uploadBusy) return;
    setUploadBusy(true);
    setUploadError(null);
    const res = await fileToMarkSvg(file);
    setUploadBusy(false);
    if (!res.ok) {
      setUploadError(res.error);
      setUploaded(null);
      return;
    }
    setUploaded(res);
    // preview immediately — the portal plays the real player on the real mark
    setPreviewKind('handwriting');
    setPreviewSvg(res.svg);
    setPreviewAnim({ kind: 'handwriting', dur: 6, smooth: 0.9, delay: 0.3 });
    track('public_monogram_uploaded', { traced: res.traced, elements: res.elements });
  }

  useEffect(() => {
    if (!previewKind || !previewAnim) return;
    const t = window.setTimeout(
      () => {
        setPreviewKind(null);
        setPreviewSvg(null);
        setPreviewAnim(null);
      },
      Math.round(previewAnim.dur * 1000) + 4500,
    );
    return () => window.clearTimeout(t);
  }, [previewKind, previewAnim]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Idempotency guard — never inject two engines into one live root.
    if (apiRef.current) return;
    let alive = true;
    let api: StudioApi | null = null;
    // The editor DOM is built imperatively here (NOT via React
    // dangerouslySetInnerHTML) so React never owns or re-touches this subtree.
    //
    // Why this matters in PRODUCTION (not just dev StrictMode): when the markup
    // was a `dangerouslySetInnerHTML={{ __html: STUDIO_HTML }}` prop, React's
    // reconciler re-applies that prop whenever its object reference changes — and
    // an inline `{{ __html }}` literal is a NEW object every render. So an
    // ordinary re-render (e.g. this effect's own setReady(true)) re-set the
    // host's innerHTML, re-creating the #cv/#load/#names nodes; the engine's
    // async font boot then resolved against the now-DETACHED nodes — leaving the
    // VISIBLE editor stuck on "Loading the typeface…" with a blank canvas.
    // Owning the markup imperatively removes the subtree from React's vdom, so no
    // re-render can clobber the engine's nodes. (The engine also self-guards its
    // async callbacks via a `destroyed` flag for the unmount-mid-fetch case.)
    // (owner 2026-06-19 "it is not loading properly".)
    // monogram_studio_v2 (council verdict §2): the flag picks which editor DOM
    // is injected — v1 stays byte-identical when OFF. Same flag as the
    // dashboard studio; the markup module is shared so both flip together.
    root.innerHTML = monogramStudioV2Enabled() ? STUDIO_HTML_V2 : STUDIO_HTML;
    setSwEl(root.querySelector<HTMLElement>('.sw2'));
    // Safety net: if the engine/typeface never finishes (a hung dynamic import or
    // font fetch — e.g. a stale cached build), don't sit on "Loading the
    // typeface…" forever. Surface a clear refresh prompt instead.
    const failTimer = window.setTimeout(() => {
      if (!alive || apiRef.current) return;
      const load = root.querySelector<HTMLElement>('#load');
      if (load) {
        load.classList.remove('off');
        load.textContent = 'Still loading — please refresh the page.';
      }
    }, 15000);
    (async () => {
      try {
        const [paperMod, offsetMod, otMod] = await Promise.all([
          import('paper'),
          import('paperjs-offset'),
          import('opentype.js'),
        ]);
        if (!alive) return;
        const paper: any = (paperMod as any).default ?? paperMod;
        const off: any = offsetMod as any;
        const PaperOffset = off.PaperOffset ?? off.default?.PaperOffset ?? off.default ?? off;
        const ot: any = otMod as any;
        const opentype = ot.parse ? ot : (ot.default ?? ot);
        api = mountStudio({
          root,
          paper,
          opentype,
          PaperOffset,
          initialConfig: null,
          portalPreview: true,
          onPreviewKind: (kind: StudioAnimKind | null, svgStr: string | null, animInfo?: StudioAnim) => {
            if (!alive) return;
            setPreviewKind(kind);
            setPreviewSvg(svgStr);
            setPreviewAnim(animInfo ?? null);
          },
        }) as StudioApi;
        apiRef.current = api;
        setReady(true);
        window.clearTimeout(failTimer);
      } catch {
        window.clearTimeout(failTimer);
        const load = root.querySelector<HTMLElement>('#load');
        if (load) load.textContent = 'Could not start the studio — please refresh.';
      }
    })();
    return () => {
      alive = false;
      window.clearTimeout(failTimer);
      try {
        api?.destroy();
      } catch {
        /* noop */
      }
      apiRef.current = null;
      root.innerHTML = '';
    };
  }, []);

  /** Sanitized export (svg + re-editable config), or null with an error set. */
  function getCleanExport(): { svg: string; config: StudioConfig } | null {
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
    return { svg: clean, config: res.config };
  }

  /** Silently stash the current design (if any) so it can follow the visitor
   *  through sign-up to their new wedding. Never surfaces an error. */
  function stashIfAny() {
    try {
      const res = apiRef.current?.getExport();
      if (res?.svg) {
        const clean = sanitizeStudioSvg(res.svg);
        if (clean) stashMonogramDraft(clean, res.config);
      }
    } catch {
      /* noop */
    }
  }

  function onDownloadSvg() {
    const exp = getCleanExport();
    if (!exp) return;
    downloadBlob(new Blob([exp.svg], { type: 'image/svg+xml' }), 'setnayan-monogram.svg');
    stashMonogramDraft(exp.svg, exp.config);
    track('public_monogram_downloaded', { format: 'svg' });
  }

  async function onDownloadPng() {
    const exp = getCleanExport();
    if (!exp || pngBusy) return;
    setPngBusy(true);
    try {
      const blob = await rasterizeToPng(exp.svg, 1600);
      if (blob) {
        downloadBlob(blob, 'setnayan-monogram.png');
        stashMonogramDraft(exp.svg, exp.config);
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
      <style dangerouslySetInnerHTML={{ __html: monogramStudioV2Enabled() ? STUDIO_CSS_V2 : STUDIO_CSS }} />
      {/* The editor markup is injected imperatively by the effect (see above), so
          React leaves this container empty and never re-touches the subtree. */}
      <div ref={rootRef} className="vs" />

      {/* Reveal preview portal — the IDENTICAL live-site player over the canvas. */}
      {swEl && previewKind
        ? createPortal(
            <div
              className="absolute inset-0 z-[5]"
              style={{
                background:
                  previewKind === 'molten' || previewKind === 'flip3d' || previewKind === 'gold'
                    ? 'radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%)'
                    : '#FBFBFA',
              }}
            >
              <div className="absolute inset-[8%]">
                <StudioRevealPlayer
                  key={`${previewKind}-${previewAnim?.dur ?? 0}-${previewAnim?.delay ?? 0}`}
                  svg={previewSvg}
                  monogram="M & J"
                  anim={previewAnim ?? { kind: previewKind, dur: 6, smooth: 0.9, delay: 0.3 }}
                  allowWebgl={false}
                />
              </div>
              <button
                type="button"
                aria-label="Close the reveal preview"
                onClick={() => {
                  setPreviewKind(null);
                  setPreviewSvg(null);
                  setPreviewAnim(null);
                }}
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-base leading-none text-[#1E2229]/70 backdrop-blur-sm transition-colors hover:bg-black/20"
              >
                ✕
              </button>
            </div>,
            swEl,
          )
        : null}

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

      {/* ── Upload your own (owner 2026-07-17): SVG/transparent-PNG in, vector
          elements out, reveals previewed on the real mark. ── */}
      <div className="mx-auto mt-6 max-w-[460px] rounded-2xl border border-dashed border-[#C5A059]/60 bg-white/60 px-5 py-4 text-center">
        <label className="inline-flex cursor-pointer flex-col items-center gap-1">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E2229]">
            <UploadCloud aria-hidden className="h-4 w-4 text-[#8C6932]" strokeWidth={2} />
            {uploadBusy ? 'Deciphering…' : 'Or upload your own mark'}
          </span>
          <span className="text-xs text-[#5F5E5A]">SVG or transparent PNG — we trace it into animatable pieces, free</span>
          <input
            type="file"
            accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
            className="sr-only"
            data-testid="public-upload-input"
            onChange={(e) => void onUploadFile(e.target.files?.[0])}
          />
        </label>
        {uploadError ? <p className="mt-2 text-xs text-[#9B3B2E]">{uploadError}</p> : null}
        {uploaded ? (
          <div className="mt-3 space-y-2" data-testid="public-upload-panel">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#8C6932]" data-testid="public-upload-elements">
              {uploaded.traced
                ? `Deciphered into ${uploaded.elements} ${uploaded.elements === 1 ? 'piece' : 'pieces'}`
                : `${uploaded.elements} vector ${uploaded.elements === 1 ? 'element' : 'elements'}`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {(['handwriting', 'droplet', 'petalfall', 'flip3d'] as StudioAnimKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setPreviewKind(k);
                    setPreviewSvg(uploaded.svg);
                    setPreviewAnim({ kind: k, dur: 6, smooth: 0.9, delay: 0.3 });
                  }}
                  className="rounded-full border border-[#1E2229]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#1E2229]/75 hover:bg-[#1E2229]/5"
                >
                  {k === 'handwriting' ? 'Handwriting' : k === 'droplet' ? 'Bloom' : k === 'petalfall' ? 'Petal Fall' : 'Medallion Turn'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => downloadBlob(new Blob([uploaded.svg], { type: 'image/svg+xml' }), 'setnayan-mark-traced.svg')}
                className="rounded-full bg-[#1E2229] px-3 py-1.5 text-xs font-semibold text-[#FBFBFA] hover:opacity-90"
              >
                Download vector
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto mt-7 max-w-[460px] rounded-2xl border border-[#C5A059]/40 bg-[#FBF6EA] px-5 py-5 text-center">
        <p className="font-serif text-lg text-[#1E2229]">Make it your wedding&rsquo;s monogram</p>
        <p className="mt-1.5 text-sm text-[#5F5E5A]">
          Start planning free and we&rsquo;ll keep this design — pick it up in the Monogram Maker to make it your
          official mark. From there it flows everywhere: your wedding website, QR invitations, and save-the-date.
        </p>
        <Link
          href="/onboarding/wedding?from=monogram"
          onClick={() => {
            stashIfAny();
            track('public_monogram_cta', { target: 'onboarding' });
          }}
          className="mt-3.5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#1E2229] px-6 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Start planning · free
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
