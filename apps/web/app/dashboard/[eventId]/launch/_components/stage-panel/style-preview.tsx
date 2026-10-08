'use client';

import { useEffect, useRef, useState } from 'react';
import { TILE_FREEZE_CSS } from '@/lib/maker-tile-preview';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { finishStreamedHtml } from './streamed-swap';

/**
 * 🖼 A STYLE'S TRUE MINIATURE (owner 2026-10-07: *"should be a preview of the style
 * and not text"* → *"1. all three together"*, DECISION_LOG "STAGES PANEL REDRAW
 * APPROVED (#6398); THREE FOLLOW-UPS AS ONE STEP"; prototype `fillLayouts()` — the
 * part drawn once per layout, at its width, scaled into the 104 px card).
 *
 * EVERY card, for EVERY part and style, is the GUEST PAGE ITSELF: the canvas's own
 * address (the same stage, the same draft, the same See as — the event's real
 * content), asked for that one part alone in that one style —
 *
 *     /<slug>?…&editor=1&only=<key>[.<part>]&style=<type>:<id>
 *
 * (`canvasOnlyScene` + `canvasStylePreview`, `app/[slug]/_lib/editor-canvas.ts`; both
 * host-canvas only, so a guest's `?style=` changes nothing, and a frame asking for a
 * style never mounts the editor bridge). The page draws the style with the shipped
 * renderer — never a copy of it here — and the frame is scaled to fit the part
 * into the card (contain, centred). Script-less (`sandbox="allow-same-origin"`): a
 * miniature cannot play, ask for a camera, or speak to the Maker.
 */

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';

/** The canvas's own address → the same page, one part, one style. Null: no canvas to read yet. */
export function stylePreviewSrc(canvasSrc: string, canvasKey: string, sceneType: string, styleId: string, origin: string): string | null {
  try {
    const u = new URL(canvasSrc, origin);
    if (u.origin !== origin) return null;
    u.hash = '';
    u.searchParams.delete('bars');
    u.searchParams.set('editor', '1');
    u.searchParams.set('only', canvasKey);
    u.searchParams.set('style', `${sceneType}:${styleId}`);
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

/** The canvas frame on screen — its address and width (the miniature lays out at the same width). */
function useCanvasSrc(): { src: string; width: number } | null {
  const [got, setGot] = useState<{ src: string; width: number } | null>(null);
  useEffect(() => {
    const read = () => {
      const f = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME);
      const src = f?.getAttribute('src');
      if (f && src) setGot({ src, width: Math.max(320, Math.round(f.getBoundingClientRect().width) || 375) });
    };
    read();
    const t = window.setTimeout(read, 600);
    return () => window.clearTimeout(t);
  }, []);
  return got;
}

export function StylePreview({ canvasKey, sceneType, styleId, current }: { canvasKey: string | null; sceneType: string; styleId: string; current: boolean }) {
  const canvas = useCanvasSrc();
  const src = canvas && canvasKey ? stylePreviewSrc(canvas.src, canvasKey, sceneType, styleId, window.location.origin) : null;
  const width = canvas?.width ?? 375;
  const box = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [fit, setFit] = useState<{ k: number; x: number; y: number; h: number } | null>(null);
  const [empty, setEmpty] = useState(false);

  /* Measured once the frame has LOADED (a slow page may take many seconds) — never given up on while it loads. */
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    setFit(null);
    setEmpty(false);
  }, [src]);
  useEffect(() => {
    if (!src || !canvasKey || loads === 0) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      try {
        const d = frame.current?.contentDocument;
        const b = box.current;
        if (!d || !b || !d.body || d.location.href === 'about:blank') {
          if (n > 300) {
            window.clearInterval(id);
            setEmpty(true);
          }
          return;
        }
        /* Script-less, the streamed page never moves its sections in — finish it from here. */
        finishStreamedHtml(d);
        if (!d.querySelector('style[data-sn-mini]')) {
          const css = d.createElement('style');
          css.setAttribute('data-sn-mini', '');
          css.textContent = TILE_FREEZE_CSS;
          d.head.appendChild(css);
        }
        const [key, el] = canvasKey.split('.');
        const section = findMakerSection(d, key!);
        const part = el ? (section?.querySelector<HTMLElement>(`[data-el="${el}"]`) ?? null) : section;
        const drawn = part ? part.getBoundingClientRect() : null;
        if (!part || !drawn || drawn.width < 1 || drawn.height < 1) {
          if (n > 200) {
            window.clearInterval(id);
            setEmpty(true);
          }
          return;
        }
        window.clearInterval(id);
        /* Fit the part's box into the card (contain, centred), a little room around it. */
        const r = drawn;
        const pad = el ? 12 : 4;
        const w = Math.max(1, r.width + pad * 2);
        const h = Math.max(1, r.height + pad * 2);
        const k = Math.min(b.clientWidth / w, b.clientHeight / h, el ? 1.2 : 1);
        const top = r.top + (d.defaultView?.scrollY ?? 0) - pad;
        setFit({ k, x: (b.clientWidth - w * k) / 2 - (r.left - pad) * k, y: (b.clientHeight - h * k) / 2 - top * k, h: top + h + pad });
      } catch {
        window.clearInterval(id);
        setEmpty(true);
      }
    }, 60);
    return () => window.clearInterval(id);
  }, [src, canvasKey, loads]);

  return (
    <span
      ref={box}
      aria-hidden
      data-style-preview={!src ? 'loading' : empty ? 'empty' : fit ? (current ? 'live' : 'render') : 'loading'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {src ? (
        <iframe
          ref={frame}
          title=""
          tabIndex={-1}
          aria-hidden
          sandbox="allow-same-origin"
          src={src}
          onLoad={() => setLoads((x) => x + 1)}
          data-style-preview-frame={styleId}
          className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-transparent transition-opacity duration-200 ${fit ? 'opacity-100' : 'opacity-0'}`}
          style={{
            width,
            height: Math.max(900, Math.ceil(fit?.h ?? 1600)),
            transform: fit ? `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})` : undefined,
          }}
        />
      ) : null}
      {/* Never a blank card: a quiet line while the page draws, and a plain one if it cannot. */}
      {!fit ? (
        <span data-style-preview-note="" className="absolute inset-0 grid place-items-center px-2 text-center text-[11px] leading-tight text-[var(--sp-ink2)]">
          {empty ? 'Couldn’t draw this look' : 'Drawing…'}
        </span>
      ) : null}
    </span>
  );
}
