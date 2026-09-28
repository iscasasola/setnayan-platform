/**
 * apps/web/lib/maker-preload.ts
 *
 * 🔥 THE MAKER LOADS WHAT A PICK WILL NEED, BEFORE THE PICK (owner 2026-09-28:
 * *"is it possible to load everything so it runs smoothly?"*).
 *
 *   · FONTS — every face in the Font dropdown (`HUB_FONTS`). A font picked for
 *     a part is drawn on the canvas at once (the bridge), but the canvas then
 *     had to DOWNLOAD the face (every face past the first-paint three is
 *     `preload: false` — `fonts-preload-only-the-first-paint.test.ts`), so the
 *     words sat in the fallback serif before snapping. Asking the Maker's own
 *     document for each face (`document.fonts.load`) fetches the same file the
 *     canvas's `@font-face` names (same origin, same hashed URL), so the pick
 *     is a cache hit. ⛔ MAKER ONLY: it runs from the Maker's shell, never on a
 *     guest page, and it adds no `preload` to any face — a guest's phone still
 *     downloads exactly the faces its page sets.
 *   · IMAGES — the couple's own photos the Maker offers as backgrounds, so a
 *     photo picked as a background paints from cache.
 *
 * Both wait for an idle moment, and neither runs on a device the warm canvas
 * budget refuses (a small-memory phone, save-data) — the same gate
 * (`warmCanvasBudget`).
 */
import { HUB_FONTS } from './hub-fonts';

/**
 * Each dropdown face's family, as the page's CSS variables name it (next/font
 * hashes the family name, so the variable is the only honest source). A face
 * whose variable is not on the page is skipped, never guessed.
 */
export function makerFontFamilies(readVar: (cssVar: string) => string): string[] {
  const out: string[] = [];
  for (const f of HUB_FONTS) {
    const family = readVar(f.cssVar).trim();
    if (family && !out.includes(family)) out.push(family);
  }
  return out;
}

/** Ask the document for every dropdown face — each fetch lands in the shared HTTP cache. */
export function preloadMakerFonts(doc: Document): number {
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof fonts.load !== 'function') return 0;
  const style = doc.defaultView?.getComputedStyle(doc.documentElement);
  if (!style) return 0;
  const families = makerFontFamilies((v) => style.getPropertyValue(v));
  for (const family of families) {
    fonts.load(`1em ${family}`).catch(() => {
      /* a face that fails here fails on the canvas the same way — nothing to do */
    });
  }
  return families.length;
}

/** Warm the browser's image cache for the couple's own photos. */
export function preloadMakerImages(urls: readonly string[]): number {
  const seen = new Set<string>();
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const img = new Image();
    img.decoding = 'async';
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low';
    img.src = url;
  }
  return seen.size;
}

/** Run `fn` once the tab is idle (or after `ms` on a browser without idle callbacks). */
export function whenIdle(fn: () => void, ms = 1_500): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: ms * 3 });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(fn, ms);
  return () => window.clearTimeout(t);
}
