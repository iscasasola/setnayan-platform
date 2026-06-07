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
  /** Step cadence in ms. */
  stepIntervalMs?: number;
  /** Extra classes on the root (e.g. to size an inline instance). */
  className?: string;
};

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
  stepIntervalMs = 2200,
  className = '',
}: SDLoaderProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
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
      stepIntervalMs,
    );
    return () => clearTimeout(t);
  }, [stepIndex, stepList.length, stepIntervalMs, done]);

  // Particle gathering — gold motes spawn on a ring and animate inward into
  // the mark. Skipped entirely under reduced-motion and once complete. The
  // particles are appended after the static React children so they never
  // collide with reconciliation; each self-removes on animation finish.
  useEffect(() => {
    if (reduced || done) return;
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
  }, [reduced, done]);

  return (
    <div
      className={`sd-loader ${className}`.trim()}
      data-theme={theme}
      data-done={done || undefined}
      role="status"
      aria-live="polite"
      aria-busy={!done}
    >
      <div className="sd-stage">
        <div className="sd-scene" ref={sceneRef}>
          <div className="sd-core">
            <div className="sd-glow" aria-hidden="true" />
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
