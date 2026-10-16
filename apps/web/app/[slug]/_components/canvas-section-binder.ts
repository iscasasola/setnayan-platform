/**
 * canvas-section-binder.ts — 👆 WHICH SECTIONS OF THE MAKER'S CANVAS TAKE A TAP (the bridge's half that decides it;
 * `editor-bridge.tsx` supplies what a tap does).
 *
 * 🔴 2026-10-16, live on the owner's event: *"cannot select on maker preview screen anymore"*. A Style card's pick is
 * laid on the canvas at the tap (`lib/maker-scene-look.ts` → `scene-look-lay.ts`): a COPY of the card's section, cut
 * from the card's own frame — a page another bridge had bound. The copy arrived wearing that page's
 * `data-setnayan-editor-bound="1"` with no listener behind it. The bridge read the mark as "already bound" and never
 * listened to it, and its stray-tap check read the same mark as "a section has this tap" — so a tap on the scene
 * that was just styled went NOWHERE: no selection, no "tapped outside", no message at all.
 *
 * ✅ So what is bound is what THIS binder bound (its own map) — never a mark read off the node. The mark is still
 *    written (CSS and the Maker's lookups read it), but it decides nothing here. And the page is swept again whenever
 *    it may hold a section nobody listens to: a picture just laid over one, and every in-place redraw (a style is a
 *    different component, so the server's render can bring a NEW node where the bound one stood).
 *
 * Pure DOM, no React: the guard drives this very code (`a-styled-scene-still-takes-a-tap.test.ts`).
 */
import { findMakerSection, sectionAfter } from './maker-section-find';

/** The bridge's mark on a section it listens to — for CSS and lookups only; it is never read back here. */
export const EDITOR_BOUND_ATTR = 'data-setnayan-editor-bound';

/** Sections found by their region's id rather than a marker (`SECTION_IDS`), bound after every marked one. */
const ID_SECTIONS = ['f:entourage', 'f:story'] as const;
/** The legacy rows — bound last, so a tap bubbling from a section inside one stops at that section first. */
const LEGACY_ROWS = ['home', 'details', 'gallery', 'me'] as const;

export type SectionBinder = {
  /** Listen to `el` as the section `key` — once per node. */
  bind: (el: HTMLElement, key: string) => void;
  /** Every section on the page now: the ones nobody listens to yet are bound; the ones gone from the page let go. */
  sweep: () => void;
  /** Did THIS binder bind `el`? */
  isBound: (el: Element) => boolean;
  /** Is `target` inside a section this binder listens to? (A tap that is not is a stray one — the page's ground.) */
  holds: (target: EventTarget | null) => boolean;
  /** Let every section go. */
  dispose: () => void;
};

/**
 * @param listen what a tap on a section does — returns how to stop.
 * @param stamp a scene's parts keyed (`data-el`) before it is listened to.
 */
export function createSectionBinder(
  doc: Document,
  listen: (el: HTMLElement, key: string) => () => void,
  stamp: (el: HTMLElement, key: string) => void = () => {},
): SectionBinder {
  const bound = new Map<HTMLElement, () => void>();
  const bind = (el: HTMLElement, key: string) => {
    if (bound.has(el)) return;
    el.setAttribute(EDITOR_BOUND_ATTR, '1');
    const stop = listen(el, key);
    bound.set(el, () => {
      stop();
      el.removeAttribute(EDITOR_BOUND_ATTR);
    });
  };
  const sweep = () => {
    /* A node the page no longer holds (a picture taken off, a section a redraw replaced) is let go. */
    for (const [el, stop] of bound) {
      if (el.isConnected === false) {
        stop();
        bound.delete(el);
      }
    }
    doc.querySelectorAll('[data-maker-section]').forEach((m) => {
      const el = sectionAfter(m);
      if (!el) return;
      const key = m.getAttribute('data-maker-section')!;
      stamp(el, key);
      bind(el, key);
    });
    for (const key of [...ID_SECTIONS, ...LEGACY_ROWS]) {
      const el = findMakerSection(doc, key);
      if (el) bind(el, key);
    }
  };
  return {
    bind,
    sweep,
    isBound: (el) => bound.has(el as HTMLElement),
    holds: (target) => {
      for (let n = target as Element | null; n; n = n.parentElement) if (bound.has(n as HTMLElement)) return true;
      return false;
    },
    dispose: () => {
      for (const stop of bound.values()) stop();
      bound.clear();
    },
  };
}
