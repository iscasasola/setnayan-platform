'use client';

import { useEffect, useRef, useState } from 'react';
import { TILE_FREEZE_CSS } from '@/lib/maker-tile-preview';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { finishStreamedHtml } from './streamed-swap';
import { styleCardFit } from '@/lib/maker-stage-room';

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
 * renderer — never a copy of it here — at the phone's own width, and the card shows that part WHOLE: centred and
 * scaled to fit, never cut (`styleCardFit`, owner 2026-10-09 — `TOOLBAR-SPEC-2026-10-09.md` § STYLE; it was the
 * page at the card's width, cut at the card's foot, 2026-10-08). Script-less (`sandbox="allow-same-origin"`): a
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

/**
 * 🔎 A CARD FITTED ON ONE BLOCK OF ITS SCENE (`focus`, a selector inside the scene — the Dress code's "Our
 * colours" for a palette look, its Do's & Don'ts for theirs): the rest of the scene keeps its place but is not
 * drawn, so a look of another shape never shows a neighbour's words in its margin. Asked of the miniature only.
 */
const FOCUS_CSS =
  '[data-sn-mini-scene] *:not([data-sn-mini-focus]):not([data-sn-mini-focus] *):not(:has([data-sn-mini-focus])){visibility:hidden!important}';

/** The block a card is fitted on: the scene, one `data-el` part of it, or one `focus` block (the scene when absent). */
export function miniaturePart(section: HTMLElement | null, el: string | undefined, focus: string | null | undefined): HTMLElement | null {
  if (!section) return null;
  if (el) return section.querySelector<HTMLElement>(`[data-el="${el}"]`);
  return focus ? (section.querySelector<HTMLElement>(focus) ?? section) : section;
}

export function StylePreview({
  canvasKey,
  sceneType,
  styleId,
  current,
  focus = null,
  onDrawn,
}: {
  canvasKey: string | null;
  sceneType: string;
  styleId: string;
  current: boolean;
  focus?: string | null;
  /** Told the part's drawn shape once it is measured — a card of one long line is made wider (`styleCardIsWide`). */
  onDrawn?: (shape: { w: number; h: number }) => void;
}) {
  const canvas = useCanvasSrc();
  const src = canvas && canvasKey ? stylePreviewSrc(canvas.src, canvasKey, sceneType, styleId, window.location.origin) : null;
  const width = canvas?.width ?? 375;
  const box = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [fit, setFit] = useState<{ k: number; x: number; y: number; h: number } | null>(null);
  /** The part's box on its page, and the page's own ground — kept so the fit is worked out again when the card changes size. */
  const drawnRef = useRef<{ top: number; left: number; width: number; height: number } | null>(null);
  const [ground, setGround] = useState<string | null>(null);
  const onDrawnRef = useRef(onDrawn);
  onDrawnRef.current = onDrawn;
  const [empty, setEmpty] = useState(false);

  /* Measured once the frame has LOADED (a slow page may take many seconds) — never given up on while it loads. */
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    setFit(null);
    setEmpty(false);
    drawnRef.current = null;
  }, [src]);
  /** The picture, centred and scaled to fit the card as it is NOW. */
  const lay = () => {
    const b = box.current;
    const part = drawnRef.current;
    if (!b || !part || b.clientWidth < 1 || b.clientHeight < 1) return;
    const f = styleCardFit(part, { w: b.clientWidth, h: b.clientHeight });
    setFit((was) => (was && was.k === f.k && was.x === f.x && was.y === f.y ? was : { ...f, h: part.top + part.height + 40 }));
  };
  const layRef = useRef(lay);
  layRef.current = lay;
  /* The card changed size (a one-line look's card widened; the phone turned): fitted again, never stretched. */
  useEffect(() => {
    const b = box.current;
    if (!b || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => layRef.current());
    ro.observe(b);
    return () => ro.disconnect();
  }, []);
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
        const part = miniaturePart(section, el, focus);
        if (focus && section && part && part !== section && !d.querySelector('style[data-sn-mini-focus-css]')) {
          section.setAttribute('data-sn-mini-scene', '');
          part.setAttribute('data-sn-mini-focus', '');
          const only = d.createElement('style');
          only.setAttribute('data-sn-mini-focus-css', '');
          only.textContent = FOCUS_CSS;
          d.head.appendChild(only);
        }
        const drawn = part ? part.getBoundingClientRect() : null;
        if (!part || !drawn || drawn.width < 1 || drawn.height < 1) {
          if (n > 200) {
            window.clearInterval(id);
            setEmpty(true);
          }
          return;
        }
        window.clearInterval(id);
        drawnRef.current = { top: drawn.top + (d.defaultView?.scrollY ?? 0), left: drawn.left + (d.defaultView?.scrollX ?? 0), width: drawn.width, height: drawn.height };
        /* The card stands on the page's own ground, so the room round a small part is the page's, never a grey band. */
        const bg = getComputedStyle(d.body).backgroundColor;
        setGround(bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ? bg : '#FFFFFF');
        onDrawnRef.current?.({ w: drawn.width, h: drawn.height });
        layRef.current();
      } catch {
        window.clearInterval(id);
        setEmpty(true);
      }
    }, 60);
    return () => window.clearInterval(id);
  }, [src, canvasKey, loads, focus]);

  return (
    <span
      ref={box}
      aria-hidden
      data-style-preview={!src ? 'loading' : empty ? 'empty' : fit ? (current ? 'live' : 'render') : 'loading'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={ground ? { background: ground } : undefined}
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
