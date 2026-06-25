'use client';

/**
 * Premium-UI motion primitives (GSAP) — the motion engine adopted 2026-06-25.
 * See corpus `Premium_UI_Standard_2026-06-25.md`. GSAP is isolated in THIS file so
 * the deliberately zero-dependency `_motion.tsx` (Reveal/Blob) stays untouched for
 * incidental fades.
 *
 * Doctrine (frontend-design governs premium-frontend-ui): spend boldness in ONE
 * orchestrated moment per surface, never scattered. The hero already owns the big
 * scroll moment, so here the signature is quiet:
 *   • a champagne THREAD that stitches each feature panel — one thread through the
 *     whole day ("Set na 'yan"), drawn in as the panel arrives;
 *   • a deliberate serif LINE-REVEAL on each panel headline (the type moment).
 *
 * Rules honored: transform/opacity only · honors prefers-reduced-motion · useGSAP
 * (gsap.context auto-cleanup, SSR-safe under Next 15 / React 19) · the entrance is
 * gated by IntersectionObserver so it fires when the panel is actually on screen —
 * which is correct under the gated post-hero reveal AND the per-step remount alike
 * (and matches the repo's existing IO convention). ScrollTrigger is intentionally
 * NOT used here: the hero owns scrub, and tying a trigger into the collapsing
 * PostHeroReveal container would need refresh-coordination we don't want on the
 * homepage. GSAP still does all the motion.
 */

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(SplitText);
}

/**
 * usePanelIntro — attach the returned ref to a panel root. Inside that scope it
 * orchestrates the entrance for any `[data-premium-headline]`, `[data-premium-item]`,
 * and `[data-premium-thread]` it finds. Returns the scope ref.
 */
export function usePanelIntro() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const items = gsap.utils.toArray<HTMLElement>('[data-premium-item]', root);
      const path = root.querySelector<SVGPathElement>('[data-premium-thread]');
      const headline = root.querySelector<HTMLElement>('[data-premium-headline]');

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Thread draw length.
      let len = 0;
      if (path) {
        len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: reduce ? 0 : len });
      }

      // Reduced motion: everything rests in its final state, no animation.
      if (reduce) return;

      // Pre-reveal states, set synchronously so nothing flashes. Use opacity
      // (NOT autoAlpha) so elements stay in the accessibility tree: these panels
      // sit inside an aria-live region, and autoAlpha's visibility:hidden would
      // drop the heading + content from the screen-reader announcement on every
      // step advance. The visual line-rise comes from SplitText's mask, not from
      // hiding the <h2>.
      gsap.set(items, { opacity: 0, y: 18 });
      if (headline) gsap.set(headline, { opacity: 0 });

      let split: SplitText | null = null;
      let played = false;

      const play = () => {
        if (played) return;
        played = true;

        // 1 · Headline — serif line-reveal. Runs after fonts settle so the line
        //     breaks are correct; never leaves the headline hidden on failure.
        if (headline) {
          const revealHeadline = () => {
            if (!scope.current) return;
            try {
              split = new SplitText(headline, { type: 'lines', mask: 'lines' });
              gsap.set(headline, { opacity: 1 });
              gsap.from(split.lines, {
                yPercent: 120,
                duration: 0.9,
                ease: 'power4.out',
                stagger: 0.12,
              });
            } catch {
              gsap.set(headline, { opacity: 1 });
            }
          };
          if (typeof document !== 'undefined' && document.fonts && document.fonts.status !== 'loaded') {
            document.fonts.ready.then(revealHeadline);
          } else {
            revealHeadline();
          }
        }

        // 2 · Supporting content — quiet staggered rise.
        if (items.length) {
          gsap.to(items, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.06,
            delay: 0.15,
            // Drop the inline transform afterward so cards' CSS hover-lift survives.
            clearProps: 'transform',
          });
        }

        // 3 · The champagne thread draws through the panel.
        if (path && len) {
          gsap.to(path, {
            strokeDashoffset: 0,
            duration: 1.7,
            ease: 'power2.inOut',
            delay: 0.2,
          });
        }
      };

      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            play();
            io.disconnect();
          }
        },
        { threshold: 0.18 },
      );
      io.observe(root);

      return () => {
        io.disconnect();
        split?.revert();
      };
    },
    { scope },
  );

  return scope;
}

/**
 * PanelThread — the champagne stitch down a panel's left gutter. Decorative; drawn
 * by usePanelIntro via the `[data-premium-thread]` path. Hidden on small screens
 * (kept uncluttered) via the `.sn-thread` rule in globals.css.
 */
export function PanelThread({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const stroke = tone === 'dark' ? 'var(--m-orange-3)' : 'var(--m-orange-2)';
  return (
    <svg
      className="sn-thread"
      aria-hidden
      viewBox="0 0 48 1000"
      preserveAspectRatio="none"
      style={{ left: 'clamp(10px, 4vw, 76px)' }}
    >
      <path
        data-premium-thread
        d="M24 -12 C 4 150, 44 320, 24 500 C 8 660, 40 820, 24 1012"
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.6}
      />
    </svg>
  );
}
