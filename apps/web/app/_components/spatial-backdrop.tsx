'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import {
  SPATIAL_THEMES,
  computeLayerState,
  type RsvpBackdropConfig,
  type LayerVisualState,
} from '@/lib/spatial-backdrop';

/**
 * SpatialBackdrop — the AI-generated "world" behind the RSVP page.
 *
 * Renders the configured theme's scene layers FIXED behind the page content
 * and maps scroll progress → per-layer transform via the pure math in
 * lib/spatial-backdrop.ts (push-in scale + parallax rise + the cross-scene
 * seam). The page content floats above on the InvitationShell vellum panel.
 *
 * PERFORMANCE CONTRACT (the reason this looks the way it does):
 *  - Scroll work is rAF-coalesced off a passive listener, and writes styles
 *    IMPERATIVELY to layer refs — zero React re-renders per frame.
 *  - Only `transform` + `opacity` are animated (compositor-only, no layout /
 *    paint), with `willChange` hints. Layer wrappers over-bleed the viewport
 *    (inset -8%) so translate/scale never reveals an edge.
 *  - Scene 0's far image loads eagerly (it IS the first paint of the world);
 *    everything else lazy-loads. Near glow layers composite with
 *    `mix-blend-mode: screen` over the scene — the alpha-free layering trick
 *    (assets are lights-on-black WebP).
 *  - `prefers-reduced-motion: reduce` → no listener at all; the world renders
 *    as a static backdrop at its p=0 state (WCAG 2.3.3, house rule from
 *    animated-monogram-hero.tsx).
 *
 * ACCESSIBILITY: purely decorative — aria-hidden + pointer-events-none; all
 * meaning stays in the page content above.
 */

/** Base under-color so the seam between scenes can never flash the page bg. */
const BASE_BG = '#12121a';

function layerStyle(s: LayerVisualState): React.CSSProperties {
  return {
    transform: `translate3d(0, ${s.translateYvh.toFixed(3)}vh, 0) scale(${s.scale.toFixed(4)})`,
    opacity: s.opacity.toFixed(3),
  };
}

export function SpatialBackdrop({ config }: { config: RsvpBackdropConfig }) {
  const theme = SPATIAL_THEMES[config.theme];
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const layers = Array.from(
      root.querySelectorAll<HTMLElement>('[data-spatial-layer]'),
    );
    const sceneCount = theme.scenes.length;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      for (const el of layers) {
        const sceneIndex = Number(el.dataset.scene);
        const depth = Number(el.dataset.depth);
        const s = computeLayerState({
          p,
          sceneIndex,
          sceneCount,
          depth,
          intensity: config.intensity,
        });
        el.style.transform = `translate3d(0, ${s.translateYvh.toFixed(3)}vh, 0) scale(${s.scale.toFixed(4)})`;
        el.style.opacity = s.opacity.toFixed(3);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [theme, config.intensity]);

  const sceneCount = theme.scenes.length;

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ backgroundColor: BASE_BG }}
    >
      {theme.scenes.map((scene, sceneIndex) =>
        scene.layers.map((layer, layerIndex) => {
          // SSR-correct first paint: inline the p=0 state so there's no
          // hydration jump before the first rAF tick.
          const initial = computeLayerState({
            p: 0,
            sceneIndex,
            sceneCount,
            depth: layer.depth,
            intensity: config.intensity,
          });
          const eager = sceneIndex === 0 && layerIndex === 0;
          return (
            <div
              key={`${sceneIndex}-${layerIndex}`}
              data-spatial-layer
              data-scene={sceneIndex}
              data-depth={layer.depth}
              className="absolute inset-[-8%]"
              style={{
                ...layerStyle(initial),
                mixBlendMode: layer.blend === 'screen' ? 'screen' : undefined,
                willChange: 'transform, opacity',
              }}
            >
              <Image
                src={layer.src}
                alt=""
                fill
                sizes="100vw"
                priority={eager}
                loading={eager ? undefined : 'lazy'}
                className="object-cover"
              />
            </div>
          );
        }),
      )}
      {/* Soft ink vignette top + bottom so the fixed header/footer chrome
          always sits on a calmed band of the world, whatever the art does. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(10,10,16,0.55), transparent 18%, transparent 82%, rgba(10,10,16,0.6))',
        }}
      />
      {/* Light column v3 — barely-there luminance lift behind the content
          column. The v2 wash at /35 still read as a milky white veil (owner
          screenshot feedback); at /12 the world shows through the middle and
          loose-text legibility is carried by the cream text-halo the
          InvitationShell content column applies instead (inherited
          text-shadow — invisible on the cards' own cream surfaces). */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-full max-w-[860px] -translate-x-1/2 bg-cream/[0.12] blur-3xl"
      />
    </div>
  );
}
