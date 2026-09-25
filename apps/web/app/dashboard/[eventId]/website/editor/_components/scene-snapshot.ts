/**
 * 📸 THE CANVAS HALF OF THE TILE PREVIEWS — reads each section out of the
 * Maker's same-origin canvas and makes a STATIC copy of it for its navigator
 * tile. The pure half (the document it goes into, the scale, what is kept) is
 * `lib/maker-tile-preview.ts`; its docblock says why a copy and not a
 * rasteriser or a page-per-tile.
 *
 * Runs only in the browser, only against the canvas iframe the Maker already
 * owns. Nothing is fetched: the copy points at the URLs the canvas loaded.
 */
import { findMakerSection } from '@/app/[slug]/_components/editor-bridge';
import type { TileAncestor, TileAttr, TileHead, TileSnapshot } from '@/lib/maker-tile-preview';

function attrsOf(el: Element): TileAttr[] {
  return Array.from(el.attributes, (a) => [a.name, a.value] as const);
}

/** The canvas's `<html>`/`<body>` and every stylesheet, in document order. */
export function readTileHead(doc: Document): TileHead {
  const styles: string[] = [];
  const seen = new Set<string>();
  doc.querySelectorAll('link[rel~="stylesheet"], style').forEach((node) => {
    const html = node.outerHTML;
    if (seen.has(html)) return;
    seen.add(html);
    styles.push(html);
  });
  return { htmlAttrs: attrsOf(doc.documentElement), bodyAttrs: attrsOf(doc.body), styles };
}

/**
 * A static copy of one section: no scripts, no nested frames (a map embed is a
 * page of its own), media that does not start playing, and each canvas drawn as
 * the picture it holds right now.
 */
function staticCopy(el: HTMLElement): HTMLElement {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.setAttribute('data-snm-root', '');
  copy.removeAttribute('data-setnayan-editor-bound');
  copy.style.removeProperty('cursor');
  copy.querySelectorAll('script, noscript, template').forEach((n) => n.remove());

  const liveFrames = el.querySelectorAll('iframe, object, embed');
  copy.querySelectorAll('iframe, object, embed').forEach((n, i) => {
    const live = liveFrames[i] as HTMLElement | undefined;
    const r = live?.getBoundingClientRect();
    const stand = el.ownerDocument.createElement('div');
    stand.setAttribute('data-snm-embed', '');
    if (n.getAttribute('class')) stand.setAttribute('class', n.getAttribute('class')!);
    stand.style.width = r ? `${Math.round(r.width)}px` : '100%';
    stand.style.height = r ? `${Math.round(r.height)}px` : '240px';
    n.replaceWith(stand);
  });

  copy.querySelectorAll('video').forEach((v) => {
    v.removeAttribute('autoplay');
    v.setAttribute('preload', v.getAttribute('poster') ? 'none' : 'metadata');
    v.muted = true;
    v.setAttribute('muted', '');
  });
  copy.querySelectorAll('audio').forEach((a) => a.remove());

  const liveCanvases = el.querySelectorAll('canvas');
  copy.querySelectorAll('canvas').forEach((c, i) => {
    const live = liveCanvases[i];
    try {
      const url = live?.toDataURL('image/png');
      if (!url || url.length < 64) return;
      const img = el.ownerDocument.createElement('img');
      img.src = url;
      img.alt = '';
      if (c.getAttribute('class')) img.setAttribute('class', c.getAttribute('class')!);
      if (c.getAttribute('style')) img.setAttribute('style', c.getAttribute('style')!);
      c.replaceWith(img);
    } catch {
      /* a canvas holding another origin's pixels stays an empty canvas */
    }
  });
  return copy;
}

/** From `<body>` (exclusive) down to the section's parent, outermost first. */
function chainOf(el: HTMLElement): TileAncestor[] {
  const chain: TileAncestor[] = [];
  let p = el.parentElement;
  const body = el.ownerDocument.body;
  while (p && p !== body) {
    chain.push({ tag: p.tagName.toLowerCase(), attrs: attrsOf(p) });
    p = p.parentElement;
  }
  return chain.reverse();
}

/**
 * The copy of one navigator key, or null when the canvas does not draw it (a
 * section you hid, or one this stage leaves out) — the tile then keeps its
 * words-only card, which is the honest thing to show for something not drawn.
 */
export function snapshotSection(doc: Document, key: string): TileSnapshot | null {
  let el: HTMLElement | null = null;
  try {
    el = findMakerSection(doc, key);
  } catch {
    return null;
  }
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.height < 2 || rect.width < 2) return null;
  el.setAttribute('data-maker-copying', '');
  try {
    const copy = staticCopy(el);
    copy.removeAttribute('data-maker-copying');
    return {
      key,
      section: copy.outerHTML,
      chain: chainOf(el),
      frameWidth: doc.documentElement.clientWidth,
    };
  } finally {
    el.removeAttribute('data-maker-copying');
  }
}

/** The canvas document, or null while it is loading or has left the page. */
export function canvasDocument(frame: HTMLIFrameElement | null): Document | null {
  try {
    const doc = frame?.contentDocument ?? null;
    if (!doc || !doc.body || doc.readyState === 'loading') return null;
    return doc;
  } catch {
    return null;
  }
}
