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
 * WHAT RUNS (in effect-chain order):
 *   · DepthOfField — focused at the room centre, easing (wall-clock damped)
 *     onto the followed walk-in when one is live (`focusRef`). Wide in-focus
 *     band; the blur only takes the far background — subtle, never a portrait.
 *   · Bloom — HDR-thresholded so ONLY the designated emissive stars glow:
 *     string-light bulbs (emissive 2.0), cold-spark cores (2.4 while firing),
 *     the LIVE lamp (2.8) and vanity-mirror bulbs (2.0) — all
 *     `toneMapped={false}` HDR materials. The composer renders un-tone-mapped
 *     into a HalfFloat buffer, so lit albedo (white cloth, the QR white, the
 *     mural, selfie faces) stays ≤ ~1 and under the 1.2 luminance threshold.
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
 * rate. TWO consecutive decline windows with no incline between them (≈5 s of
 * sustained sub-refresh fps — one compile/GC hitch can't trip it) fire
 * `onDegrade`, the call site latches Tier B OFF for the session, and the whole
 * composer unmounts → Tier A (which this pass layers on, so the fallback is
 * the already-shipped film look). One console.info, one-way latch, no thrash.
 */

import { useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import {
  EffectComposer,
  DepthOfField,
  Bloom,
  ToneMapping,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';

/** How fast the DoF focus point eases onto / off the followed walker —
 *  wall-clock exponential damp (frame-rate independent). */
const FOCUS_DAMP_PER_S = 4;

/** Bloom's HDR luminance floor. The designated stars sit at ≥ ~1.7 luminance
 *  (emissiveIntensity ≥ 2.0 warm whites; the red LIVE lamp needs 2.8 to clear
 *  this — red carries little luminance); plain lit surfaces peak ≈ 1. */
const BLOOM_LUMINANCE_THRESHOLD = 1.2;

export function CinematicPass({
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

  // ── Auto-degrade policy: 2 consecutive PerformanceMonitor declines with no
  // incline between = sustained. Log once; the parent latch guarantees the
  // one-way (no remount → no thrash → hysteresis by construction).
  const declines = useRef(0);
  const degraded = useRef(false);
  const handleDecline = useCallback(() => {
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
        {/* Emissives-only bloom (threshold doc above). mipmapBlur = the wide
            soft halo look at a fraction of the classic kernel cost. */}
        <Bloom
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
}
