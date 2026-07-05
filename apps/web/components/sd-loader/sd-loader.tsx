'use client';

/**
 * <SDLoader> — the shared brand "thinking / analyzing" loading screen.
 *
 * A native React port of the `Organic loaders` handoff (owner-supplied
 * 2026-06-07). The handoff shipped a dependency-free Web Component; we ported
 * it natively so the gold binds to our locked palette token (`--m-orange` =
 * Royal Champagne Gold #C5A059, NOT the handoff's #c69a4b), reuses the app's
 * `.loading-status-line` entrance fade, and inherits the global
 * `prefers-reduced-motion` freeze in globals.css instead of carrying its own.
 *
 * The visual: gold particles gather inward into the Setnayan mark, a twin
 * orbit turns, the logo "breathes", and a status line narrates the real work.
 * On `done`, the orbit fades, a ring draws around the mark, and a check is
 * stroked in (the "Ready ✓" completion the handoff specifies).
 *
 * WHERE THE COPY LIVES: per-context `steps` come from
 * `@/components/sd-loader/loader-steps.ts` — edit narration there, not here.
 *
 * Narration behaviour deliberately HOLDS on the last step instead of looping
 * (owner 2026-06-05: "a slow load never looks like it restarted") — the orbit
 * + particles carry the "still working" signal. This differs from the handoff
 * prototype, which looped; the hold is the app's documented loading-UX rule.
 *
 * Usage:
 *   <SDLoader steps={LOADER_STEPS.checkout} />            // inline / section
 *   <SDLoader steps={[...]} done doneLabel="Order sent" />// completion state
 * For app-wide blocking overlays use `useLoader()` from `./loader-overlay`.
 */

import { useEffect, useRef, useState } from 'react';
import { useLoaderConfig } from '@/app/_components/loader-config-provider';
import type { LoaderVariant } from '@/lib/loader-config';

/** Fallback narration when a caller doesn't pass `steps`. */
const DEFAULT_STEPS = [
  'Reading your preferences',
  'Analyzing your selections',
  'Mapping patterns to your profile',
  'Tailoring to your style',
  'Composing your result',
] as const;

export type SDLoaderProps = {
  /** Per-screen narration. 3–5 specific, true-to-the-work lines read best. */
  steps?: readonly string[];
  /** Enter the success state (ring draws, check, "Ready ✓"). */
  done?: boolean;
  /** Label shown on completion. */
  doneLabel?: string;
  /** Small uppercase sublabel under the status line. */
  hint?: string;
  /** App is light-locked; `dark` exists for couple landing surfaces only. */
  theme?: 'light' | 'dark';
  /** Transparent cut-out mark. Defaults to the official Setnayan SVG mark. */
  logoSrc?: string;
  /** Step cadence in ms. Defaults to the admin-configured cadence. */
  stepIntervalMs?: number;
  /**
   * Visual variant. Defaults to the admin-configured variant (via context).
   * `gather` = particles + twin orbit · `aurora` = champagne sweep ·
   * `pulse` = concentric sonar rings.
   */
  variant?: LoaderVariant;
  /** Extra classes on the root (e.g. to size an inline instance). */
  className?: string;
};

/** Champagne-gold palette for the tap-to-pop motes (locked family). */
const POP_GOLDS = ['#c5a059', '#e0cca0', '#cb9e4b', '#d3ae66'] as const;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function SDLoader({
  steps,
  done = false,
  doneLabel = 'Ready',
  hint = 'Personalizing',
  theme = 'light',
  logoSrc = '/brand/setnayan-mark.svg',
  stepIntervalMs,
  variant,
  className = '',
}: SDLoaderProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const config = useLoaderConfig();
  // Explicit props win (used by the admin live preview); otherwise fall back to
  // the admin-configured values from context.
  const resolvedVariant: LoaderVariant = variant ?? config.variant;
  const resolvedInterval = stepIntervalMs ?? config.stepIntervalMs;
  const popEnabled = config.popEnabled;
  const stepList = steps && steps.length ? steps : DEFAULT_STEPS;
  const stepsKey = stepList.join('|');
  const [stepIndex, setStepIndex] = useState(0);
  const reduced = usePrefersReducedMotion();

  // Restart narration from the top whenever the step copy changes.
  useEffect(() => {
    setStepIndex(0);
  }, [stepsKey]);

  // Advance the status line, holding on the last step (no loop). The JS timer
  // still runs under reduced-motion — text is informative, not motion (the
  // global a11y block freezes only the entrance fade). See loading-status.tsx.
  useEffect(() => {
    if (done) return;
    if (stepIndex >= stepList.length - 1) return;
    const t = setTimeout(
      () => setStepIndex((i) => Math.min(i + 1, stepList.length - 1)),
      resolvedInterval,
    );
    return () => clearTimeout(t);
  }, [stepIndex, stepList.length, resolvedInterval, done]);

  // Particle gathering — gold motes spawn on a ring and animate inward into
  // the mark. Skipped entirely under reduced-motion and once complete. The
  // particles are appended after the static React children so they never
  // collide with reconciliation; each self-removes on animation finish.
  useEffect(() => {
    // Particles are the `gather` variant's signature — the other two carry the
    // "still working" signal with their own CSS motion, so don't spawn motes.
    if (reduced || done || resolvedVariant !== 'gather') return;
    const scene = sceneRef.current;
    if (!scene) return;

    const spawn = () => {
      const p = document.createElement('div');
      p.className = 'sd-particle';
      const size = 3 + Math.random() * 4;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.opacity = '0';
      scene.appendChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 30;
      const x0 = Math.cos(a) * d;
      const y0 = Math.sin(a) * d;
      const x1 = Math.cos(a) * 7;
      const y1 = Math.sin(a) * 7;
      const anim = p.animate(
        [
          {
            transform: `translate(calc(-50% + ${x0}px),calc(-50% + ${y0}px)) scale(1)`,
            opacity: 0,
          },
          { opacity: 0.85, offset: 0.25 },
          {
            transform: `translate(calc(-50% + ${x1}px),calc(-50% + ${y1}px)) scale(.15)`,
            opacity: 0,
          },
        ],
        { duration: 1200 + Math.random() * 900, easing: 'cubic-bezier(.5,0,.3,1)' },
      );
      anim.onfinish = () => p.remove();
      anim.oncancel = () => p.remove();
    };

    spawn();
    const timer = setInterval(() => {
      spawn();
      if (Math.random() > 0.5) spawn();
    }, 360);
    return () => clearInterval(timer);
  }, [reduced, done, resolvedVariant]);

  // Tap-to-pop — a small champagne-gold mote burst + ripple ring at the pointer
  // point, plus a quick squish on the mark. Same self-removing-node / WAAPI
  // technique as the gather spawner. Gated on the admin toggle AND reduced-
  // motion. Works on every variant (it's a touch delight, not a variant trait).
  useEffect(() => {
    if (!popEnabled || reduced) return;
    const root = rootRef.current;
    if (!root) return;

    const onPointerDown = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Ripple ring.
      const ring = document.createElement('div');
      ring.className = 'sd-pop-ring';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      root.appendChild(ring);
      const rAnim = ring.animate(
        [
          { width: '0px', height: '0px', opacity: 0.55, transform: 'translate(-50%,-50%)' },
          { width: '64px', height: '64px', opacity: 0, transform: 'translate(-50%,-50%)' },
        ],
        { duration: 500, easing: 'cubic-bezier(.2,.7,.2,1)' },
      );
      rAnim.onfinish = () => ring.remove();
      rAnim.oncancel = () => ring.remove();

      // Gold mote burst.
      const count = 7 + Math.floor(Math.random() * 5); // 7–11
      for (let i = 0; i < count; i++) {
        const mote = document.createElement('div');
        mote.className = 'sd-pop-mote';
        const size = 3 + Math.random() * 3;
        mote.style.width = `${size}px`;
        mote.style.height = `${size}px`;
        mote.style.left = `${x}px`;
        mote.style.top = `${y}px`;
        mote.style.background = POP_GOLDS[i % POP_GOLDS.length] ?? POP_GOLDS[0];
        root.appendChild(mote);
        const a = Math.random() * Math.PI * 2;
        const dist = 22 + Math.random() * 26;
        const dx = Math.cos(a) * dist;
        const dy = Math.sin(a) * dist;
        const mAnim = mote.animate(
          [
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.95 },
            {
              transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.2)`,
              opacity: 0,
            },
          ],
          { duration: 420 + Math.random() * 160, easing: 'cubic-bezier(.4,0,.4,1)' },
        );
        mAnim.onfinish = () => mote.remove();
        mAnim.oncancel = () => mote.remove();
      }

      // Squish the mark.
      const core = root.querySelector('.sd-core');
      if (core) {
        core.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(.9)' },
            { transform: 'scale(1)' },
          ],
          { duration: 260, easing: 'cubic-bezier(.3,.7,.3,1)' },
        );
      }
    };

    root.addEventListener('pointerdown', onPointerDown);
    return () => root.removeEventListener('pointerdown', onPointerDown);
  }, [popEnabled, reduced]);

  return (
    <div
      ref={rootRef}
      className={`sd-loader ${className}`.trim()}
      data-theme={theme}
      data-loader-variant={resolvedVariant}
      data-done={done || undefined}
      role="status"
      aria-live="polite"
      aria-busy={!done}
    >
      <div className="sd-stage">
        <div className="sd-scene" ref={sceneRef}>
          <div className="sd-core">
            <div className="sd-glow" aria-hidden="true" />
            {/* aurora + pulse decorative layers — CSS-toggled by variant; inert
                (display:none) for `gather`. */}
            <div className="sd-aurora" aria-hidden="true" />
            <div className="sd-pulse" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <svg className="sd-ring" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="54" />
            </svg>
            <div
              className="sd-lg"
              aria-hidden="true"
              style={{ backgroundImage: `url("${logoSrc}")` }}
            />
            <div className="sd-orbit sd-orbit-a" aria-hidden="true" />
            <div className="sd-orbit sd-orbit-b" aria-hidden="true" />
          </div>
        </div>
        <div className="sd-status">
          <span
            key={done ? 'done' : stepIndex}
            className="sd-label loading-status-line"
          >
            {done ? doneLabel : (stepList[stepIndex] ?? '')}
          </span>
          <span className="sd-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <svg className="sd-check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12.5 L10 18 L20 6" />
          </svg>
        </div>
        <div className="sd-hint">{done ? 'Done' : hint}</div>
      </div>
    </div>
  );
}
