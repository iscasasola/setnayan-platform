/**
 * 🎚 SCRUB — keeping the host's place as the Maker's whole-page preview opens and closes (▶ held).
 *
 * Arming the hand-overs changes the page's length under the host (a hold IS length, and an arrival is drawn where
 * the scene before it stood), so the scene they were looking at would be somewhere else. This puts it back: the
 * scene that was at the middle of the screen is scrolled to where it was — and, because it may now be an arrival
 * that is not on screen until the scene before it has left, on until it can be READ. A few steps, one a frame (the
 * engine answers the scroll in between), then it lets go: nothing here follows the thumb.
 *
 * ⛔ THE MAKER'S CANVAS ONLY. `hub-scrub.tsx` fetches this file only on a page that carries the Maker's section
 * markers; a guest's page never loads it and is never moved by script (`hub-scrub-engine.ts` sets no scroll
 * position at all — `lib/scrub-is-a-held-hand-over.test.ts` (4)).
 */
const STEPS = 8;

export function keepScenePlace(change: () => void): void {
  const mid = window.innerHeight / 2;
  let scene: HTMLElement | null = null;
  let near = Infinity;
  for (const el of document.querySelectorAll<HTMLElement>('.hub-scenes .hub-scene')) {
    const r = el.getBoundingClientRect();
    const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
    if (d < near) [near, scene] = [d, el];
  }
  const kept = scene;
  const was = kept?.getBoundingClientRect().top ?? 0;
  change();
  if (!kept) return;
  const shown = (el: Element | null) => {
    if (!el) return true;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.95;
  };
  const step = (left: number, before: number | null) => {
    const top = kept.getBoundingClientRect().top;
    const off = top - was;
    const readable = shown(kept) && shown(kept.querySelector('.hub-canvas-body'));
    /* There (and readable) — or held where it is, readable: done. */
    if (readable && (Math.abs(off) < 2 || (before !== null && Math.abs(top - before) < 1))) return;
    if (left === 0 || Math.abs(off) < 2) return;
    const y = window.scrollY;
    window.scrollBy(0, off);
    if (window.scrollY === y) return;
    requestAnimationFrame(() => requestAnimationFrame(() => step(left - 1, top)));
  };
  step(STEPS, null);
}
