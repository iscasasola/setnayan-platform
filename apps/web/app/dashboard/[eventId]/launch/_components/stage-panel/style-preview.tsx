'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildTileDocument, type TileHead, type TileSnapshot } from '@/lib/maker-tile-preview';
import { readTileHead, snapshotSection } from '../../../website/editor/_components/scene-snapshot';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { STYLE_RENDERERS, readFacts, type Facts } from './style-renderers';

/**
 * 🖼 A STYLE'S REAL MINIATURE (owner 2026-10-07: *"should be a preview of the style
 * and not text"*; prototype `fillLayouts()` — the part cloned once per layout, at its
 * width, scaled into the 104 px card).
 *
 *   · The style the part wears NOW is the part itself: a static copy of its section out
 *     of the canvas (`scene-snapshot.ts`, the navigator tiles' own copier), in a
 *     script-less document carrying the canvas's stylesheets, theme scope and ground.
 *   · Every OTHER style is the SHIPPED style component (`app/[slug]/_components/*-styles`,
 *     imported, never copied) rendered with the part's real content read off the canvas
 *     (the countdown's own reading, the message's words), portalled into a clean copy
 *     of the canvas's document (its stylesheets, theme scope and fonts — `asMount`).
 *
 * A style with no client renderer here (`STYLE_RENDERERS`) is drawn from the canvas
 * when it is the current one, and otherwise as the part as it is now (dimmed) — see the
 * PR's deviations: a per-style canvas frame (`?only=<key>&style=<id>`) is the guest
 * route's (Builder S6), and `frameSrc` takes it the day it exists.
 */


/**
 * A clean stage for a style the part does not wear: the canvas's own document (its stylesheets, the theme
 * scope and fonts on the ancestors) holding ONLY a mount the style is portalled into — never the copied
 * section, whose frame classes (a scene's reveal-on-scroll, its pinned height, a card swapped out from
 * under it) left a style drawn into it blank on the owner's page (2026-10-07, "Big number" empty).
 */
function asMount(snap: TileSnapshot): TileSnapshot {
  return { ...snap, section: '<div data-snm-root="" style="padding:12px 14px"><div data-sn-style-mount=""></div></div>' };
}

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';

/** The canvas's head and the part's section, read once per card (and again when the part changes). */
function useLiveSection(canvasKey: string | null): { head: TileHead; snap: TileSnapshot; facts: Facts } | null {
  const [got, setGot] = useState<{ head: TileHead; snap: TileSnapshot; facts: Facts } | null>(null);
  useEffect(() => {
    if (!canvasKey) return;
    const read = () => {
      try {
        const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
        if (!doc?.body) return;
        const snap = snapshotSection(doc, canvasKey);
        if (!snap) return;
        const live = findMakerSection(doc, canvasKey);
        setGot({ head: readTileHead(doc), snap, facts: live ? readFacts(live) : { targetIso: null, bare: false, text: '', signedBy: null } });
      } catch {
        /* a canvas we cannot read draws no miniature — the card keeps its name */
      }
    };
    read();
    const t = window.setTimeout(read, 900);
    return () => window.clearTimeout(t);
  }, [canvasKey]);
  return got;
}

export function StylePreview({ canvasKey, sceneType, styleId, current }: { canvasKey: string | null; sceneType: string; styleId: string; current: boolean }) {
  const live = useLiveSection(canvasKey);
  const render = STYLE_RENDERERS[sceneType];
  const element = !current && live && render ? render(styleId, live.facts) : null;
  const mode: 'live' | 'render' | 'dim' | null = !live ? null : current ? 'live' : element ? 'render' : 'dim';
  const box = useRef<HTMLSpanElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState<{ k: number; x: number; y: number; h: number } | null>(null);
  /* The part alone, on the page's colour — the page's ground (a photo behind every scene) would fill the small card. */
  const head = live ? { ...live.head, grounds: [] } : null;
  const srcDoc = live && head && mode ? buildTileDocument(head, mode === 'render' ? asMount(live.snap) : live.snap) : null;
  const width = live?.snap.frameWidth ?? 375;

  /* Fit the copy's root into the card (contain, centred — `fillLayouts`). */
  const measure = () => {
    try {
      const d = frame.current?.contentDocument;
      const root = d?.querySelector<HTMLElement>('[data-snm-root]');
      const b = box.current;
      if (!root || !b || !d) return;
      const r = root.getBoundingClientRect();
      const top = r.top + (d.defaultView?.scrollY ?? 0);
      const h = Math.max(1, r.height);
      const k = Math.min(b.clientWidth / width, b.clientHeight / h);
      setFit({ k, x: (b.clientWidth - width * k) / 2, y: (b.clientHeight - h * k) / 2 - top * k, h: top + h });
    } catch {
      /* unmeasured: the card shows the copy's top */
    }
  };
  useLayoutEffect(() => {
    setMount(null);
    setFit(null);
  }, [srcDoc]);
  /* The copy's document is ready → mount the style (or measure the copy). A srcdoc frame can finish before
     React hears its load, so it is watched, not waited for. */
  useEffect(() => {
    if (!srcDoc) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      const d = frame.current?.contentDocument;
      const ready = d?.readyState === 'complete' && d.querySelector('[data-snm-root]');
      if (!ready && n < 80) return;
      window.clearInterval(id);
      const m = d?.querySelector<HTMLElement>('[data-sn-style-mount]') ?? null;
      if (m) setMount(m);
      else measure();
    }, 50);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcDoc]);
  useEffect(() => {
    if (!mount) return;
    /* The style draws its numbers after mount (the countdown reads its clock then) — measure once it has. */
    const t = window.setTimeout(measure, 120);
    const t2 = window.setTimeout(measure, 700);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mount]);

  return (
    <span ref={box} aria-hidden data-style-preview={mode ?? 'loading'} className="pointer-events-none absolute inset-0 overflow-hidden">
      {srcDoc ? (
        <iframe
          ref={frame}
          title=""
          tabIndex={-1}
          aria-hidden
          sandbox="allow-same-origin"
          srcDoc={srcDoc}
          className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-transparent ${mode === 'dim' ? 'opacity-40 grayscale' : ''} ${fit ? 'opacity-100' : 'opacity-0'}`}
          style={{
            width,
            height: Math.max(200, Math.ceil(fit?.h ?? 900)),
            transform: fit ? `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})` : undefined,
          }}
        />
      ) : null}
      {mount && element ? createPortal(element, mount) : null}
    </span>
  );
}
