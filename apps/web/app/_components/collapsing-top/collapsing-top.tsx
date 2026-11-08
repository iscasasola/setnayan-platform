'use client';

/**
 * collapsing-top.tsx — 📌 THE ONE COLLAPSING TOP (THE ONE BUILD F2, owner v108/v110, 8 Nov 2026).
 *
 * Owner, v108: *"the TOP ITSELF scrolls up and locks"* — and *"not smooth to the pixel"* about the old row that toggled
 * into a slim layout (`use-pin-fold.ts`). This is the event Home cover band's mechanism (`home-cover-pin.tsx`, shipped
 * 2026-10-27) lifted into ONE shared part and generalised:
 *   · the block is `position: sticky` with a NEGATIVE top, T + R − H (`collapse-progress.ts`): its in-flow height never
 *     changes, so the page under it moves exactly 1 px per scrolled px — nothing ever jumps;
 *   · once stuck only its bottom R px (the 44-px pinned row, `--sn-pin-h`) stay on screen;
 *   · the big content fades out and the row fades in ONLY in the last 48 px before it locks (`--q`, 0 → 1), and the
 *     row takes the taps once `data-pinned` is on (q > 0.5);
 *   · a STACK of tops (Today: the cover, then the stats strip) locks one under the other — row 1 at 44, row 2 at 88;
 *   · the pinned top says it is above the page with the soft hairline (`--sn-hair`), never a border (v110 "No cut line");
 *   · ONE passive capture scroll listener per stack, read once per frame, writes attributes and CSS variables only —
 *     never React state, so the list under it never re-renders for a scroll;
 *   · reduced motion: no fade — the row simply shows once stuck.
 * With no script the variables are unset, the `top` is invalid and the block simply scrolls.
 *
 * ⚠ A sticky element sticks only inside its PARENT — so a stack is a React context with NO element of its own; put each
 * `CollapsingTop` straight in the page's long column.
 *
 * Use:
 *   <CollapsingTopStack>
 *     <CollapsingTop row={<PinnedRow … />}>{the cover}</CollapsingTop>
 *     <CollapsingTop row={<the stats line />}>{the stats strip}</CollapsingTop>
 *   </CollapsingTopStack>
 * 🔒 app/_components/collapsing-top/the-top-scrolls-up-and-locks.test.ts
 */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { shellBarShows } from '@/app/dashboard/[eventId]/guests/_components/use-shell-bar-offset';
import { COLLAPSE_PINNED_AT, COLLAPSE_ROW_H, collapseProgress, stackBefore } from './collapse-progress';

type Entry = { el: HTMLElement; row: number };

/** One stack: its blocks, its ONE scroll listener, its one frame. */
class CollapseStack {
  private entries: Entry[] = [];
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private mo: MutationObserver | null = null;
  private bar: HTMLElement | null = null;
  private lastQ = new WeakMap<HTMLElement, number>();
  private lastH = new WeakMap<HTMLElement, number>();
  private reduce: MediaQueryList | null = null;

  add(el: HTMLElement, row: number): () => void {
    this.entries.push({ el, row });
    // DOM order decides who stacks under whom, not mount order.
    this.entries.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    if (this.entries.length === 1) this.start();
    this.ro?.observe(el);
    this.layout();
    return () => {
      this.entries = this.entries.filter((e) => e.el !== el);
      this.ro?.unobserve(el);
      if (this.entries.length === 0) this.stop();
      else this.layout();
    };
  }

  private soon = () => {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  };

  /** Heights, the stacked tops and the bar — written only when they change (a resize, the bar sliding). */
  private layout = () => {
    const befores = stackBefore(this.entries.map((e) => e.row));
    const barVal = shellBarShows(this.bar) ? `${this.bar.getBoundingClientRect().height}px` : 'env(safe-area-inset-top, 0px)';
    this.entries.forEach((e, i) => {
      const h = e.el.offsetHeight;
      if (this.lastH.get(e.el) !== h) {
        this.lastH.set(e.el, h);
        e.el.style.setProperty('--ct-h', `${h}px`);
      }
      e.el.style.setProperty('--ct-before', `${befores[i]}px`);
      e.el.style.setProperty('--ct-row', `${e.row}px`);
      e.el.style.setProperty('--ct-bar', barVal);
    });
    this.soon();
  };

  /** One frame: read every block, then write — never a read after a write. */
  private frame = () => {
    this.raf = 0;
    const reads = this.entries.map((e) => {
      const top = parseFloat(getComputedStyle(e.el).top);
      return collapseProgress(e.el.getBoundingClientRect().top, top);
    });
    const step = this.reduce?.matches ?? false;
    this.entries.forEach((e, i) => {
      let q = Math.round(reads[i]! * 1000) / 1000;
      if (step) q = q > COLLAPSE_PINNED_AT ? 1 : 0;
      if (this.lastQ.get(e.el) === q) return;
      this.lastQ.set(e.el, q);
      e.el.style.setProperty('--q', String(q));
      const pinned = q > COLLAPSE_PINNED_AT;
      if (e.el.hasAttribute('data-pinned') !== pinned) {
        e.el.toggleAttribute('data-pinned', pinned);
        const row = e.el.querySelector<HTMLElement>(':scope > [data-ct-row]');
        row?.toggleAttribute('inert', !pinned);
      }
    });
  };

  private start() {
    this.bar = document.querySelector<HTMLElement>('.shell-topbar');
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.layout) : null;
    if (this.bar) {
      this.mo = new MutationObserver(this.layout);
      this.mo.observe(this.bar, { attributes: true, attributeFilter: ['data-hidden', 'style', 'class'] });
    }
    // Capture: the page may scroll the window or a column — one listener hears both.
    document.addEventListener('scroll', this.soon, { passive: true, capture: true });
    window.addEventListener('resize', this.layout);
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro?.disconnect();
    this.mo?.disconnect();
    this.ro = null;
    this.mo = null;
    document.removeEventListener('scroll', this.soon, { capture: true });
    window.removeEventListener('resize', this.layout);
  }
}

const StackContext = createContext<CollapseStack | null>(null);

/** A stack of collapsing tops that lock one under the other. Draws NO element (a sticky block sticks inside its parent). */
export function CollapsingTopStack({ children }: { children: ReactNode }) {
  const stack = useMemo(() => new CollapseStack(), []);
  return <StackContext.Provider value={stack}>{children}</StackContext.Provider>;
}

export function CollapsingTop({
  row,
  rowHeight = COLLAPSE_ROW_H,
  children,
  className = '',
  data,
}: {
  /** The pinned row drawn once the top has locked — usually the shared `PinnedRow`. */
  row: ReactNode;
  /** Its height (R) — 44 by default (`--sn-pin-h`); the Clients week strip keeps its own height. */
  rowHeight?: number;
  /** The full content at rest. */
  children: ReactNode;
  className?: string;
  /** Data marks for the page's own guards (`{ 'today-cover': '' }` → `data-today-cover=""`). */
  data?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shared = useContext(StackContext);
  const own = useMemo(() => (shared ? null : new CollapseStack()), [shared]);
  const stack = shared ?? own!;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return stack.add(el, rowHeight);
  }, [stack, rowHeight]);
  const marks = Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]));
  return (
    <div ref={ref} className={`sn-ct ${className}`} data-collapsing-top="" {...marks}>
      <div className="sn-ct-full" data-ct-full="">
        {children}
      </div>
      <div className="sn-ct-row" data-ct-row="" inert>
        {row}
      </div>
    </div>
  );
}
