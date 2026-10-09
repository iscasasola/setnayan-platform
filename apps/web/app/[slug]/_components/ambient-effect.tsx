import type { CSSProperties } from 'react';
import { AMBIENT_EFFECT_CSS, type AmbientEffectSpec } from '@/lib/ambient-effects';

/**
 * ✨ THE EFFECT LAYER — the six effects' ONE drawing (owner 2026-10-08; `lib/ambient-effects.ts` holds the rule).
 *
 * Drawn in three places and nowhere else: the guest's Event Hub (`_lib/main-ground-layer.tsx`), Studio › Look's
 * sample screen, and each card of the Effects carousel (a miniature of the same spec).
 *
 * Plain HTML and one stylesheet: no client JavaScript, no image, no font — nothing is fetched for an effect, and
 * the page's own script budget is untouched. Decorative only: hidden from assistive tech, deaf to the pointer.
 * It wears the COUPLE's colours (the spec's own variables) and nothing of the app's.
 *
 * `className` places it (the guest page: fixed behind every scene; the sample and a card: filling the box).
 * `css={false}` where a strip of several layers draws the stylesheet once for all of them (`AmbientEffectStyle`).
 */
export function AmbientEffectLayer({ spec, className, css = true }: { spec: AmbientEffectSpec; className: string; css?: boolean }) {
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
        <i key={i} style={p as CSSProperties} />
      ))}
    </div>
  );
}

/** The effects' stylesheet, once. */
export function AmbientEffectStyle() {
  return <style data-ambient-effect-style="">{AMBIENT_EFFECT_CSS}</style>;
}
