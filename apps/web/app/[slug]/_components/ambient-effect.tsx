import { useId, type CSSProperties } from 'react';
import { AMBIENT_EFFECT_CSS, AMBIENT_GRAIN_NOISE, AMBIENT_GRAIN_SEEDS, type AmbientEffectSpec } from '@/lib/ambient-effects';

/**
 * ✨ THE EFFECT LAYER — the eight effects' ONE drawing (owner 2026-10-08, redrawn 2026-10-14; `lib/ambient-effects.ts`
 * holds the rule).
 *
 * Drawn in three places and nowhere else: the guest's Event Hub (`_lib/main-ground-layer.tsx`), Studio › Look's
 * sample screen, and each card of the Effects carousel (a miniature of the same spec).
 *
 * Plain HTML and one stylesheet: no client JavaScript, no image, no font — nothing is fetched for an effect, and
 * the page's own script budget is untouched. Decorative only: hidden from assistive tech, deaf to the pointer.
 * It wears the COUPLE's colours (the spec's own variables) and nothing of the app's.
 *
 * 🎞 Film grain is the one drawn with markup inside its shape: three small SVGs, each one noise filter referenced by
 * an id IN THIS PAGE (`useId` keeps two layers' ids apart — a card strip and the sample draw several). No address.
 *
 * `className` places it (the guest page: fixed behind every scene; the sample and a card: filling the box).
 * `css={false}` where a strip of several layers draws the stylesheet once for all of them (`AmbientEffectStyle`).
 */
export function AmbientEffectLayer({ spec, className, css = true }: { spec: AmbientEffectSpec; className: string; css?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <div
      aria-hidden
      data-ambient-effect={spec.kind}
      data-ambient-ground={spec.ground}
      data-ambient-mini={spec.mini ? '' : undefined}
      className={className}
      style={spec.vars as CSSProperties}
    >
      {css ? <AmbientEffectStyle /> : null}
      {spec.particles.map((p, i) => (
        <i key={i} style={p as CSSProperties}>
          {spec.kind === 'grain' ? AMBIENT_GRAIN_SEEDS.map((seed) => <GrainFrame key={seed} id={`sn-grain-${id}-${seed}`} seed={seed} />) : null}
        </i>
      ))}
    </div>
  );
}

/** One still frame of film grain — noise in a filter, painted over a rectangle the size of the layer. */
function GrainFrame({ id, seed }: { id: string; seed: number }) {
  return (
    <svg focusable="false">
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={AMBIENT_GRAIN_NOISE.baseFrequency} numOctaves={AMBIENT_GRAIN_NOISE.numOctaves} seed={seed} stitchTiles="stitch" />
        <feColorMatrix values={AMBIENT_GRAIN_NOISE.matrix} />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/** The effects' stylesheet, once. */
export function AmbientEffectStyle() {
  return <style data-ambient-effect-style="">{AMBIENT_EFFECT_CSS}</style>;
}
