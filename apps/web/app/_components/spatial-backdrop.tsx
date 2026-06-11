'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  SPATIAL_THEMES,
  computeLayerState,
  journeyTimeAt,
  type RsvpBackdropConfig,
  type LayerVisualState,
} from '@/lib/spatial-backdrop';

/**
 * SpatialBackdrop — the AI-generated "world" behind the RSVP page.
 *
 * TWO RENDER MODES, decided per device at runtime:
 *
 *  1. JOURNEY VIDEO (owner 2026-06-11: "the background needs to be a video
 *     that moves as we scroll") — when the theme ships a pre-rendered journey
 *     film AND the device qualifies (desktop-class viewport ≥1024px, no
 *     reduced-motion, no save-data), a fixed <video> becomes the world and
 *     SCROLL IS THE PLAYHEAD: scroll progress maps to currentTime
 *     (journeyTimeAt), lerp-smoothed so fast flicks glide instead of thrash.
 *     The video is NEVER play()ed — pure seek scrubbing on a paused element
 *     (keyframe-dense encode, g=6, makes seeks frame-accurate). The far still
 *     layers fade out once the video can play; the NEAR bokeh layers keep
 *     rendering ON TOP as live screen-blend parallax — baked camera motion
 *     below, real-time depth above. Until `canplay` (and on any device that
 *     doesn't qualify) the still layers ARE the world, so there is never a
 *     blank or a pop.
 *
 *  2. LAYERED STILLS (the v1–v3 renderer, unchanged) — per-layer push-in +
 *     parallax + cross-scene crossfade driven by the same scroll math.
 *
 * PERFORMANCE CONTRACT:
 *  - One passive scroll listener; all work rAF-coalesced; styles written
 *    IMPERATIVELY to refs — zero React re-renders per frame.
 *  - Layers animate transform/opacity only (compositor-only); the video seeks
 *    but never transforms (its camera motion is baked into the film).
 *  - `prefers-reduced-motion: reduce` → no listeners, no video; static world.
 *
 * ACCESSIBILITY: purely decorative — aria-hidden + pointer-events-none.
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
  const videoRef = useRef<HTMLVideoElement>(null);
  // Device qualifies for the journey video — decided post-mount so SSR markup
  // (stills only) never mismatches; the <video> mounts as a client-only add.
  const [wantVideo, setWantVideo] = useState(false);
  // First `canplay` fired — video crossfades in, far stills hand over.
  const [videoReady, setVideoReady] = useState(false);
  const videoReadyRef = useRef(false);

  useEffect(() => {
    if (!theme.journey) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (conn?.saveData) return;
    setWantVideo(true);
  }, [theme]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const layers = Array.from(
      root.querySelectorAll<HTMLElement>('[data-spatial-layer]'),
    );
    const sceneCount = theme.scenes.length;
    const journey = theme.journey;
    let raf = 0;
    let scrubRaf = 0;
    let targetTime = 0;

    // Lerp currentTime toward the scroll target — self-scheduling until
    // settled, so a fast flick glides through the film instead of one hard
    // seek per frame. Seeks under ~1 frame (33ms) are skipped.
    const scrub = () => {
      scrubRaf = 0;
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      const delta = targetTime - v.currentTime;
      if (Math.abs(delta) < 0.034) return;
      v.currentTime = v.currentTime + delta * 0.25;
      scrubRaf = requestAnimationFrame(scrub);
    };

    const apply = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      const videoLive = videoReadyRef.current;
      for (const el of layers) {
        const sceneIndex = Number(el.dataset.scene);
        const depth = Number(el.dataset.depth);
        // Far stills hand over to the journey video once it can play; near
        // bokeh layers (depth > 0.8) stay live on top of the film.
        if (videoLive && depth <= 0.8) {
          el.style.opacity = '0';
          continue;
        }
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
      if (journey && videoLive) {
        targetTime = journeyTimeAt(p, journey.durationS);
        if (!scrubRaf) scrubRaf = requestAnimationFrame(scrub);
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
      if (scrubRaf) cancelAnimationFrame(scrubRaf);
    };
  }, [theme, config.intensity]);

  const sceneCount = theme.scenes.length;

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-journey-state={videoReady ? 'active' : wantVideo ? 'loading' : 'off'}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ backgroundColor: BASE_BG }}
    >
      {/* Journey film — mounts only on qualifying devices, fades in over the
          stills on first canplay. Never play()ed: scroll is the playhead. */}
      {wantVideo && theme.journey ? (
        // Decorative, muted, scroll-scrubbed — no captions to convey.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          src={theme.journey.src}
          muted
          playsInline
          preload="auto"
          onCanPlay={() => {
            if (!videoReadyRef.current) {
              videoReadyRef.current = true;
              setVideoReady(true);
              // Re-run apply() so the far stills hand over immediately.
              window.dispatchEvent(new Event('scroll'));
            }
          }}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            videoReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
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
