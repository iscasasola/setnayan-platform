'use client';

/**
 * Client motion island for /papic — the page itself (page.tsx) stays a
 * force-static Server Component. It still owns ALL copy, routes, metadata, and
 * the two JSON-LD blocks; this file adds NOTHING to the information architecture.
 * Every wrapper renders the server-passed children verbatim and only attaches a
 * reveal / panel / settle ref. GSAP is isolated to this 'use client' leaf island
 * so the page stays server + force-static.
 *
 * Signature (the page's ONE bold moment): on step 02 of "How it works" — "Every
 * photo finds its people" — a small cluster of abstract photo tiles begins loosely
 * scattered/overlapped and SETTLES each tile into its own tidy grid slot via
 * useSettle as the step scrolls in. "Your photos find you" made literal in one
 * ~1s move. No real images, no faces — token-coloured rounded rects only.
 *
 * Two-IO discipline: the "How it works" SECTION is wrapped in usePanelIntro (one
 * champagne PanelThread stitches the three steps). The settle is scoped to step
 * 02's OWN ref (SettleTiles' useSettle), SEPARATE from the panel root — so the two
 * IntersectionObserver entrances don't double-fire on the same element.
 *
 * a11y / SSR contract (same proven foundation as /pricing + /about):
 *   • Client components still SSR, so all copy ships in the static HTML and stays
 *     in the DOM / a11y tree. Reveals are opacity-only (never visibility/display).
 *   • prefers-reduced-motion → foundation hooks rest everything visible; the
 *     settle tiles rest already-settled (no offset); the thread draws to full.
 *   • No new colour: the thread reuses --m-orange-2 (PanelThread tone="light");
 *     the tiles use --m-ivory / --m-paper-2. Gold stays well under the budget.
 */

import type { ReactNode } from 'react';
import {
  useReveal,
  useLineReveal,
  usePanelIntro,
  useSettle,
  PanelThread,
} from '@/app/_components/marketing/_premium';

/**
 * LineRevealHeading — the serif line-reveal on a single text element. The ref sits
 * on the REAL element so the copy ships in SSR HTML and stays in the a11y tree
 * (opacity-only, fonts.ready-guarded, try/catch → visible). `as` preserves the
 * page's existing semantics (h1 for the hero, h2 for section headings).
 * `trigger:'mount'` is for the above-the-fold hero <h1>; everything else stays
 * IO-gated 'view'.
 */
export function LineRevealHeading({
  children,
  className,
  as = 'h2',
  trigger = 'view',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h1' | 'h2';
  trigger?: 'view' | 'mount';
}) {
  const ref = useLineReveal({ trigger });
  if (as === 'h1') {
    return (
      <h1 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
        {children}
      </h1>
    );
  }
  return (
    <h2 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
      {children}
    </h2>
  );
}

/**
 * RevealBand — a whole-group quiet rise with a short stagger across the marked
 * children. Each child carries `data-reveal-item` in the server markup; the
 * foundation hook does clearProps:transform on finish so any CSS hover-lift
 * survives. Used for the hero subhead/CTAs, the VS list rows, and the two
 * "ways to run it" cards. `stagger`/`y` tunable per band.
 */
export function RevealBand({
  children,
  className,
  stagger = 0.06,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
}) {
  const ref = useReveal({ stagger, y });
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}

/**
 * RevealList — same as RevealBand but renders a `<ul>` so the VS differentiator
 * rows stay valid `<ul>`/`<li>` (preserves the page's existing list semantics —
 * additive-only, no IA change). Children carry `data-reveal-item`.
 */
export function RevealList({
  children,
  className,
  stagger = 0.06,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
}) {
  const ref = useReveal({ stagger, y });
  return (
    <ul ref={ref as React.RefObject<HTMLUListElement>} className={className}>
      {children}
    </ul>
  );
}

/**
 * HowItWorksPanel — wraps the WHOLE "How it works" SECTION in a usePanelIntro
 * scope and renders one PanelThread inside it. The single thread STRETCHES to the
 * scope's full height (PanelThread is preserveAspectRatio="none" + height:100%)
 * and stitches all three steps as one continuous champagne line. The H2 carries
 * `data-premium-headline` (serif line-reveal) and the three step <li>s carry
 * `data-premium-item` (staggered rise) — all orchestrated off this one scope.
 *
 * Structure rules (so the thread spans correctly): scope root is position:relative
 * (the thread is absolute + height:100%); children render in a relative z-1 layer
 * so the cards sit above the decorative thread.
 */
export function HowItWorksPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const scope = usePanelIntro();
  return (
    <div ref={scope} className={className} style={{ position: 'relative' }}>
      <PanelThread tone="light" />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

/**
 * SettleTiles — THE signature. A presentational cluster of six abstract photo
 * tiles (token-coloured rounded rects, NO real images, NO faces) that begin
 * loosely scattered/overlapped and settle into a neat 3×2 grid via useSettle as
 * step 02 scrolls into view.
 *
 * Each tile is a `[data-settle-item]` whose START offset (data-settle-x/y/rotate)
 * is its scattered position relative to its OWN tidy grid slot; useSettle animates
 * x/y/rotation → 0, landing it in the natural CSS grid cell. No layout math: the
 * grid is the resting layout, the offsets are the only thing the hook moves.
 *
 * This component owns its OWN useSettle ref (scoped to this cluster), separate
 * from the HowItWorksPanel's usePanelIntro root — so the two IO entrances don't
 * double-fire. threshold 0.4 so the settle reads as deliberate once the step is
 * comfortably on screen. reduced-motion = tiles rest already-settled.
 */
const TILES: ReadonlyArray<{
  x: number;
  y: number;
  rotate: number;
  tone: 'ivory' | 'paper-2';
}> = [
  { x: -54, y: -30, rotate: -9, tone: 'ivory' },
  { x: 48, y: -42, rotate: 7, tone: 'paper-2' },
  { x: -38, y: 26, rotate: 11, tone: 'paper-2' },
  { x: 60, y: 18, rotate: -6, tone: 'ivory' },
  { x: -16, y: 48, rotate: 5, tone: 'ivory' },
  { x: 30, y: -14, rotate: -12, tone: 'paper-2' },
];

export function SettleTiles() {
  const ref = useSettle({ duration: 1, threshold: 0.4, stagger: 0.06 });
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      aria-hidden
      className="mt-5 grid grid-cols-3 gap-2.5"
    >
      {TILES.map((tile, i) => (
        <span
          key={i}
          data-settle-item
          data-settle-x={tile.x}
          data-settle-y={tile.y}
          data-settle-rotate={tile.rotate}
          data-settle-opacity={0.85}
          className="block aspect-[4/5] rounded-lg border border-[var(--m-ink)]/[0.06] shadow-sm"
          style={{
            background:
              tile.tone === 'ivory' ? 'var(--m-ivory)' : 'var(--m-paper-2)',
          }}
        />
      ))}
    </div>
  );
}
