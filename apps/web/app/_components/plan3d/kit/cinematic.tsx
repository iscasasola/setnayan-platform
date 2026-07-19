'use client';

/**
 * CinematicPass — cinematic Play-mode Tier B: TRUE postprocessing (Fable §3.5,
 * 2026-07-08). Bloom on the designated emissive stars + a subtle depth-of-field
 * + film grain + the vignette (promoted from Tier A's DOM gradient into the
 * composer). Owner-approved as the Fable program's ONLY new dependency:
 * `postprocessing` + `@react-three/postprocessing`.
 *
 * BUNDLE LAW — this module is the ONLY place the postprocessing dep may be
 * imported, and it must ONLY ever be reached through a dynamic import
 * (React.lazy / next/dynamic) from a Play-mode branch. It is deliberately NOT
 * exported from the kit barrel (`kit/index.ts`) — a barrel export would weld
 * the dep onto every kit consumer's chunk, including the phone-walk chunk.
 * The dep must never enter the main bundle, the phone guest walk (`quality
 * 'low'` never mounts this), or SSR.
 *
 * GATING lives at the call site: Play mode && quality 'high' && NOT
 * prefers-reduced-motion (house law: reduced = static grade — Tier A's light
 * knobs still apply, but no composer, no grain). Plus the auto-degrade below.
 *
 * MEMOIZED (React.memo) — this is load-bearing, not an optimization nicety.
 * The r-p-p EffectComposer rebuilds its EffectPasses (full merged-shader
 * reassembly, a multi-ms hitch) whenever its `children` JSX identity changes,
 * i.e. on EVERY re-render of this component. The lab re-renders on each Play
 * state change (walk-in start/arrival, toasts, movers, booth sheets) — exactly
 * the beats the mascot-smooth law protects — so the memo (all props are
 * referentially stable at the call site) must keep this subtree render-free.
 *
 * WHAT RUNS (in effect-chain order):
 *   · DepthOfField — focused at the room centre, easing (wall-clock damped)
 *     onto the followed walk-in when one is live (`focusRef`). Wide in-focus
 *     band; the blur only takes the far background — subtle, never a portrait.
 *   · SelectiveBloom — depth-masked to CINEMATIC_BLOOM_LAYER so ONLY the
 *     designated emissive stars glow: string-light bulbs, cold-spark cores
 *     (while firing), the LIVE lamp and vanity-mirror bulbs — every star mesh
 *     enrols itself on the layer via CINEMATIC_BLOOM_LAYERS_MASK. A plain
 *     luminance threshold canNOT do this selection: the play-grade key panel
 *     bakes at 2.45 into the un-tone-mapped HalfFloat buffer, so grazing-angle
 *     Fresnel env reflections on the glossy white mannequins (roughness 0.18)
 *     and the chrome/glass booth props throw SPECULAR radiance past any floor
 *     the stars could also clear — non-emissive geometry would halo. The depth
 *     mask keeps the luminance pass to star pixels only; the threshold's only
 *     remaining job is gating a star's own dim texels (idle spark cores, the
 *     LIVE plate's dark field) — low enough that the red lamp's small
 *     luminance (0.2126·r) finally blooms as designed.
 *   · ToneMapping (ACES) — the composer takes over tone mapping from the
 *     renderer (it forces `gl.toneMapping = NoToneMapping` while mounted and
 *     restores it on unmount), so the shared RECOMMENDED_TONEMAP ACES curve is
 *     re-applied HERE, after bloom, using the renderer's own
 *     `toneMappingExposure` (1.08). Unmount = bit-identical Tier A pipeline.
 *   · Noise — light premultiplied film grain (display-space, after tone map).
 *   · Vignette — replaces Tier A's DOM radial-gradient div on this tier (the
 *     call site hides the div while the composer owns the vignette).
 *
 * AUTO-DEGRADE (mascot-smooth): a drei <PerformanceMonitor> watches the frame
 * rate. TWO decline windows within DECLINE_ADJACENT_MS of each other (≈5 s of
 * sustained sub-refresh fps — one compile/GC hitch can't trip it, and neither
 * can two UNRELATED stalls minutes apart: a steady mid-band fps never inclines
 * at drei's upper bound, so the wall-clock window — not the incline reset —
 * is what enforces "consecutive") fire `onDegrade`, the call site latches
 * Tier B OFF for the session, and the whole composer unmounts → Tier A (which
 * this pass layers on, so the fallback is the already-shipped film look). One
 * console.info, one-way latch, no thrash.
 */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import {
  EffectComposer,
  DepthOfField,
  SelectiveBloom,
  ToneMapping,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { CINEMATIC_BLOOM_LAYER } from '@/app/_components/plan3d/scene-lighting';
import { setBoothBloomStarsHDR } from './booth-props';

/** How fast the DoF focus point eases onto / off the followed walker —
 *  wall-clock exponential damp (frame-rate independent). */
const FOCUS_DAMP_PER_S = 4;

/** Bloom's luminance floor WITHIN the depth-masked star pixels (the layer mask
 *  does the star/not-star selection — see the header). Gates a star's own dim
 *  texels: idle spark cores sit at ≈0.43 luminance (2.4 × idle 0.18) and the
 *  LIVE plate's dark field ≈0.05 — both stay out; the firing cores (→ ~2.2),
 *  the ≥2.0-emissive warm bulbs (≥ ~1.4) and the red LIVE dot/text (≈0.69 —
 *  red carries little luminance, 0.2126·r) all clear it. */
const BLOOM_LUMINANCE_THRESHOLD = 0.55;

/** Two decline rounds only count as "consecutive" when they land within this
 *  wall-clock window (each PerformanceMonitor round is ~2.5 s, so a genuine
 *  sustained decline fires back-to-back rounds well inside it). Without the
 *  window, a machine whose steady fps sits BETWEEN drei's bounds (never
 *  inclines → the counter never resets) would latch Tier B off from two
 *  unrelated one-off stalls minutes apart. */
const DECLINE_ADJACENT_MS = 8000;

export const CinematicPass = memo(function CinematicPass({
  room,
  focusRef,
  onDegrade,
}: {
  /** Room footprint in metres — sizes the DoF's in-focus band. */
  room: { w: number; d: number };
  /** Live world position of the followed walk-in (written by the Walker's
   *  frame loop, nulled when no walker) — the DoF eases onto it when set. */
  focusRef?: { current: THREE.Vector3 | null };
  /** Fired ONCE on sustained fps decline — the call site must latch Tier B
   *  off (this component assumes it gets unmounted in response). */
  onDegrade: () => void;
}) {
  const span = Math.max(room.w, room.d);

  // ── Bloom-star material grade: the booth kit's shared star singletons (the
  // vanity-mirror bulbs + LIVE lamp) hold SDR tone-mapped values so Build, the
  // phone walk and the Tier A fallbacks keep their shipped warm read; the HDR
  // bloom values only mean anything under THIS composer's un-tone-mapped
  // pipeline, so they exist exactly while it is mounted.
  useEffect(() => {
    setBoothBloomStarsHDR(true);
    return () => setBoothBloomStarsHDR(false);
  }, []);

  // The r-p-p SelectiveBloom wrapper warns when `lights` is empty (a legacy of
  // its v2 lights-darkening implementation — the v3 effect masks by DEPTH and
  // never touches lights). One inert off-scene object silences it.
  const silencerLights = useMemo(() => [new THREE.Object3D()], []);

  // ── DepthOfField focus: room centre at seated-head height by default,
  // damped onto the walker while one is live. The effect's `target` Vector3 is
  // mutated in place each frame (postprocessing recomputes focusDistance from
  // it in update()) — no React re-render, MASCOT-SMOOTH.
  const dofRef = useRef<DepthOfFieldEffect>(null);
  const desired = useMemo(() => new THREE.Vector3(0, 1.05, 0), []);
  useFrame((_, delta) => {
    const eff = dofRef.current;
    if (!eff || !eff.target) return;
    const walker = focusRef?.current;
    if (walker) {
      desired.set(walker.x, walker.y + 1.0, walker.z); // chest height on the figure root
    } else {
      desired.set(0, 1.05, 0);
    }
    // Wall-clock damp (law): identical convergence at 30 fps and 120 fps.
    eff.target.lerp(desired, 1 - Math.exp(-FOCUS_DAMP_PER_S * Math.min(delta, 0.1)));
  });

  // ── Auto-degrade policy: 2 PerformanceMonitor declines within the adjacency
  // window = sustained. Log once; the parent latch guarantees the one-way (no
  // remount → no thrash → hysteresis by construction). The wall-clock window
  // (not just the incline callback) resets the counter — incline needs fps AT
  // the refresh-rate bound, which a healthy-but-mid-band machine never hits.
  const declines = useRef(0);
  const lastDeclineAt = useRef(0);
  const degraded = useRef(false);
  const handleDecline = useCallback(() => {
    const now = performance.now();
    if (now - lastDeclineAt.current > DECLINE_ADJACENT_MS) declines.current = 0;
    lastDeclineAt.current = now;
    declines.current += 1;
    if (declines.current < 2 || degraded.current) return;
    degraded.current = true;
    // eslint-disable-next-line no-console
    console.info(
      '[plan3d] cinematic Tier B disabled after sustained fps decline — falling back to Tier A for this session',
    );
    onDegrade();
  }, [onDegrade]);
  const handleIncline = useCallback(() => {
    declines.current = 0;
  }, []);

  return (
    <>
      <PerformanceMonitor onDecline={handleDecline} onIncline={handleIncline} />
      {/* HalfFloat frame buffer (the composer default) keeps the HDR emissives
          >1 for the bloom threshold; multisampling 4 halves the default MSAA
          memory while keeping geometry edges clean under the grain. */}
      <EffectComposer multisampling={4}>
        {/* Subtle DoF: a wide in-focus band around the focus point — only the
            far background softens. Convolution effect → its own pass. */}
        {/* focusRange is WORLD metres in postprocessing ≥6.36 (worldFocusRange
            is its deprecated alias); focusDistance is auto-recomputed from
            `target` every update(), which is what the per-frame mutation
            above drives. */}
        <DepthOfField
          ref={dofRef}
          target={[0, 1.05, 0]}
          focusRange={span * 0.6}
          bokehScale={2.2}
        />
        {/* Stars-only bloom: depth-masked to the bloom layer (header doc) so
            specular on glossy non-stars can never halo; ignoreBackground
            drops the max-depth (sky/fog) pixels from the mask. mipmapBlur =
            the wide soft halo look at a fraction of the classic kernel cost.
            Costs one small depth render of the star meshes + one fullscreen
            mask pass — the star set is a handful of instanced draws. */}
        <SelectiveBloom
          selectionLayer={CINEMATIC_BLOOM_LAYER}
          lights={silencerLights}
          ignoreBackground
          mipmapBlur
          intensity={0.55}
          luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
          luminanceSmoothing={0.1}
          radius={0.72}
        />
        {/* ACES back on, post-bloom — the renderer's curve, same exposure. */}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        {/* Light film grain, display-space; premultiply keeps shadows clean. */}
        <Noise premultiply opacity={0.25} />
        {/* The Tier A DOM vignette, promoted into the composer on this tier —
            same read: clear centre, gentle darkening into the corners. */}
        <Vignette eskil={false} offset={0.3} darkness={0.55} />
      </EffectComposer>
    </>
  );
});
