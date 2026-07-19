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

/* ───────────────────────────────────────────────────────────────────────────
   Shared marketing primitives (Phase A foundation).
   Same proven contract as usePanelIntro: opacity (never autoAlpha/visibility) so
   content stays in the a11y tree · prefers-reduced-motion rests in the FINAL state ·
   IO-gated so entrances fire when actually on screen · useGSAP/gsap.context
   auto-cleanup (SSR-safe, Next 15 / React 19). No page consumes these in this PR.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * useReveal — the shared quiet entrance. Attach the returned ref to a container;
 * every `[data-reveal-item]` inside rises (opacity 0→1, y→0) in a stagger, once, on
 * IntersectionObserver enter. If no children are marked, the ref element itself is
 * revealed. `data-reveal-order` overrides DOM order. clearProps:transform on finish
 * so CSS hover-lift survives. Reduced-motion / no-IO = visible at rest.
 */
export function useReveal(
  opts: { stagger?: number; y?: number; threshold?: number; duration?: number } = {},
) {
  const { stagger = 0.06, y = 16, threshold = 0.15, duration = 0.7 } = opts;
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      let items = gsap.utils.toArray<HTMLElement>('[data-reveal-item]', root);
      if (items.length === 0) items = [root];

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      items = items
        .slice()
        .sort((a, b) => Number(a.dataset.revealOrder ?? 0) - Number(b.dataset.revealOrder ?? 0));

      gsap.set(items, { opacity: 0, y });

      let played = false;
      const play = () => {
        if (played) return;
        played = true;
        gsap.to(items, {
          opacity: 1,
          y: 0,
          duration,
          ease: 'power3.out',
          stagger,
          clearProps: 'transform',
        });
      };

      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            play();
            io.disconnect();
          }
        },
        { threshold },
      );
      io.observe(root);

      return () => io.disconnect();
    },
    { scope },
  );

  return scope;
}

/**
 * useLineReveal — the serif line-reveal, decoupled from usePanelIntro's panel scope
 * so any single `<h1>`/`<h2>` can get the type moment (multiple per page are fine —
 * each owns its own element). Attach the ref to the heading itself. `trigger:'view'`
 * (default) fires IO-gated; `trigger:'mount'` fires immediately after fonts settle
 * (above-the-fold heroes). Uses opacity (never autoAlpha) so the heading stays in the
 * a11y tree, runs only after document.fonts.ready so line breaks are correct, and
 * try/catch → opacity:1 so a SplitText failure never strands the heading hidden.
 * Reduced-motion = heading rests fully visible.
 *
 * NOTE (LCP): the heading starts at opacity:0 until reveal, which delays paint of that
 * element. Don't point trigger:'mount' at a page's LCP hero headline unless the page's
 * plan cleared it; prefer it on below-the-fold section headings.
 */
export function useLineReveal(
  opts: { trigger?: 'view' | 'mount'; threshold?: number; stagger?: number; duration?: number } = {},
) {
  const { trigger = 'view', threshold = 0.18, stagger = 0.12, duration = 0.9 } = opts;
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      gsap.set(el, { opacity: 0 });

      let split: SplitText | null = null;
      let played = false;

      const reveal = () => {
        if (played || !scope.current) return;
        played = true;
        const run = () => {
          if (!scope.current) return;
          try {
            split = new SplitText(el, { type: 'lines', mask: 'lines' });
            gsap.set(el, { opacity: 1 });
            gsap.from(split.lines, {
              yPercent: 120,
              duration,
              ease: 'power4.out',
              stagger,
            });
          } catch {
            gsap.set(el, { opacity: 1 });
          }
        };
        if (typeof document !== 'undefined' && document.fonts && document.fonts.status !== 'loaded') {
          document.fonts.ready.then(run);
        } else {
          run();
        }
      };

      if (trigger === 'mount') {
        reveal();
        return () => {
          split?.revert();
        };
      }

      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            reveal();
            io.disconnect();
          }
        },
        { threshold },
      );
      io.observe(el);

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
 * useSettle — the "scattered fragments resolve into one clean layout" gesture.
 * Attach the ref to a container; each `[data-settle-item]` declares its START
 * offset via `data-settle-x` / `data-settle-y` / `data-settle-rotate` (px/px/deg,
 * default 0) + optional `data-settle-opacity` (start opacity, default 1). On
 * IntersectionObserver enter the hook transforms every item from its offset to
 * identity (x/y/rotation→0, opacity→1); the final resting position is the natural
 * CSS layout, so no layout math is needed. Start state is set synchronously before
 * paint (no flash). clearProps:transform on finish so CSS hover survives.
 * transform/opacity only; reduced-motion = items rest already-settled (no offset);
 * SSR-safe useGSAP cleanup. Covers /why-setnayan's card converge + /papic's tile settle.
 */
export function useSettle(
  opts: { duration?: number; ease?: string; threshold?: number; stagger?: number } = {},
) {
  const { duration = 1, ease = 'power3.out', threshold = 0.3, stagger = 0.05 } = opts;
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const items = gsap.utils.toArray<HTMLElement>('[data-settle-item]', root);
      if (items.length === 0) return;

      // Reduced motion: leave everything at its natural (settled) CSS position.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      // Declared start offsets → set synchronously before paint (no flash).
      items.forEach((el) => {
        gsap.set(el, {
          x: Number(el.dataset.settleX ?? 0),
          y: Number(el.dataset.settleY ?? 0),
          rotation: Number(el.dataset.settleRotate ?? 0),
          opacity: Number(el.dataset.settleOpacity ?? 1),
        });
      });

      let played = false;
      const play = () => {
        if (played) return;
        played = true;
        gsap.to(items, {
          x: 0,
          y: 0,
          rotation: 0,
          opacity: 1,
          duration,
          ease,
          stagger,
          clearProps: 'transform',
        });
      };

      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            play();
            io.disconnect();
          }
        },
        { threshold },
      );
      io.observe(root);

      return () => io.disconnect();
    },
    { scope },
  );

  return scope;
}

/**
 * useProvision — a card-scoped "signed artifact assembles itself" entrance. Attach
 * the ref to a card; on IntersectionObserver enter (once) every `[data-provision-item]`
 * row staggers up (opacity/y), and a single optional `[data-provision-rule]` (an SVG
 * <line>/<path>) draws left-to-right via strokeDashoffset as the rows land — the one
 * gold gesture. opacity-only (a11y tree intact), clearProps:transform so card hover
 * survives, prefers-reduced-motion rests in the final state, SSR-safe useGSAP cleanup.
 */
export function useProvision(
  opts: { stagger?: number; y?: number; threshold?: number; duration?: number } = {},
) {
  const { stagger = 0.08, y = 14, threshold = 0.3, duration = 0.6 } = opts;
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const items = gsap.utils.toArray<HTMLElement>('[data-provision-item]', root);
      const rule = root.querySelector<SVGGeometryElement>('[data-provision-rule]');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      if (items.length) gsap.set(items, { opacity: 0, y });
      let ruleLen = 0;
      if (rule) {
        ruleLen = rule.getTotalLength();
        gsap.set(rule, { strokeDasharray: ruleLen, strokeDashoffset: ruleLen });
      }

      let played = false;
      const play = () => {
        if (played) return;
        played = true;
        if (items.length) {
          gsap.to(items, {
            opacity: 1,
            y: 0,
            duration,
            ease: 'power3.out',
            stagger,
            delay: 0.1,
            clearProps: 'transform',
          });
        }
        if (rule && ruleLen) {
          gsap.to(rule, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', delay: 0.15 });
        }
      };

      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            play();
            io.disconnect();
          }
        },
        { threshold },
      );
      io.observe(root);

      return () => io.disconnect();
    },
    { scope },
  );

  return scope;
}

/**
 * useMagnetic — a desktop-only pointer-follow pull on a single element (a CTA). Attach
 * the ref to the element; while the cursor is over it the element eases toward the
 * pointer (transform only, via gsap.quickTo), snapping back on leave. No-ops entirely
 * on coarse pointers / touch and under prefers-reduced-motion (matchMedia read inside
 * the effect, never during render, so no hydration mismatch), and never intercepts the
 * click. Degrades to a plain, fully-clickable element.
 */
export function useMagnetic(opts: { strength?: number } = {}) {
  const { strength = 0.25 } = opts;
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });

      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      return () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    },
    { scope: ref },
  );

  return ref;
}
