'use client';

/**
 * StdBackgroundLayer — renders the couple's chosen Save-the-Date background
 * (Step 1) as a full-bleed layer BEHIND the content film. Shared by the builder
 * preview and the live couple page.
 *
 * Four kinds (lib/std-backgrounds.ts):
 *   - plain     → a solid colour
 *   - paper     → a procedural CSS texture (grain + tint), recolourable + seamless
 *   - realistic → a generated photoreal scene (imageUrl from the scene id)
 *   - upload    → the couple's own photo (imageUrl = presigned R2 url)
 *
 * Parallax (this build): a SUBTLE whole-image lean on pointer / phone-tilt, inside
 * an overscan so the shift never reveals an edge. The content film floats above
 * this layer, so even a single image reads as 2-layer depth. Per-pixel depth
 * (Depth Anything) is a later upgrade. Honors prefers-reduced-motion.
 */

import { useEffect, useRef, type CSSProperties } from 'react';
import { paperBackgroundStyle, type StdBackground } from '@/lib/std-backgrounds';

type Props = {
  background: StdBackground;
  /** Resolved image URL for kind 'realistic' (scene src) or 'upload' (presigned). */
  imageUrl?: string | null;
  /** Subtle pointer/tilt parallax. Default on; auto-off under reduced-motion. */
  parallax?: boolean;
  className?: string;
};

export function StdBackgroundLayer({ background, imageUrl, parallax = true, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!parallax || reduce) {
      el.style.transform = 'scale(1.06)';
      return;
    }
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return;
      tx = Math.max(-1, Math.min(1, e.gamma / 30));
      ty = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 30));
    };
    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.transform = `scale(1.08) translate(${(-cx * 14).toFixed(1)}px, ${(-cy * 14).toFixed(1)}px)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('deviceorientation', onTilt, true);
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt, true);
    };
  }, [parallax]);

  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: 'scale(1.08)',
    willChange: 'transform',
  };
  if (background.kind === 'plain') {
    style.backgroundColor = background.value;
  } else if (background.kind === 'paper') {
    Object.assign(style, paperBackgroundStyle(background.value));
  } else if (imageUrl) {
    style.backgroundImage = `url("${imageUrl}")`;
    style.backgroundSize = 'cover';
    style.backgroundPosition = 'center';
  } else {
    style.backgroundColor = '#f3ece1';
  }

  // Photo backgrounds (realistic / upload) get a faint scrim so the names + dates
  // stay legible over a busy image. Plain / paper are calm enough to skip it.
  const needsScrim = background.kind === 'realistic' || background.kind === 'upload';

  return (
    <>
      <div ref={ref} aria-hidden className={className} style={style} />
      {needsScrim ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0.12) 70%, rgba(0,0,0,0.34) 100%)',
          }}
        />
      ) : null}
    </>
  );
}
