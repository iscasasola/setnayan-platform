import type { CSSProperties } from 'react';
import { COVER_SCENE_FULL } from '@/lib/cover-scene';
import type { CoverSceneLayer } from '../_lib/cover-scene-layer';
import { SceneClip } from './scene-clip';

/**
 * The cover's words in the paper ink over a dark ground — EVERY colour a cover word reads, not only `--color-ink`
 * (`text-ink/…`). Batch 8 tester R4, 2026-10-15: on a `#3a4a5a` ground every word flipped except the scroll cue
 * "the day, the place ↓" (`text-mulberry`, ~1.9:1) and the "and" joiner (`text-gild`, ~2.6:1), which kept their
 * light-page colours. Held by `lib/the-cover-scene-is-one-group.test.ts` (13): a `text-<colour>` on a cover word
 * that this does not repaint fails it.
 */
const COVER_PAPER_CHANNELS = '251 250 247';
export const COVER_SCENE_CREAM_VARS = {
  '--color-ink': COVER_PAPER_CHANNELS,
  '--color-mulberry': COVER_PAPER_CHANNELS,
  '--color-mulberry-600': COVER_PAPER_CHANNELS,
  '--color-gild-text': COVER_PAPER_CHANNELS,
} as CSSProperties;

/**
 * 🖼 THE COVER SCENE'S BACKGROUND, DRAWN — behind the cover's words, the whole first screen tall (the header is
 * `min-h-[100svh]`, `lib/cover-scene.ts`), ALWAYS edge to edge (owner 2026-10-16, "THE COVER SCENE IS ALWAYS FULL
 * SCREEN" — Framed is gone): the layer is as wide as the screen, whatever column the words sit in, and runs up through
 * the column's top padding (`--cover-scene-pad`), so it starts right under the top bar. A ready-made loop plays through
 * the shipped `SceneClip` (muted · inline · only while on screen; its still first and whenever it cannot play).
 */
export function CoverSceneGround({ layer }: { layer: CoverSceneLayer }) {
  return (
    <div aria-hidden data-cover-scene-ground={layer.shape} className="pointer-events-none absolute -top-[var(--cover-scene-pad,0px)] bottom-0 left-1/2 -z-10 w-screen max-w-[100vw] -translate-x-1/2">
      <div className={`absolute inset-0 ${COVER_SCENE_FULL}`} style={layer.css ? { background: layer.css } : undefined}>
        {layer.still ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(layer.still)})` }}
            {...(layer.parallax ? { 'data-pahina-parallax': 'page' } : {})}
          />
        ) : null}
        {/* 🎞 The clip's OWN first frame is what shows behind the veil (owner 2026-10-19), never a separate poster — the
            still above stays only for a clip that cannot be drawn at all. */}
        {layer.clip ? <SceneClip src={layer.clip} play="loop" open="inplace" label="" className="absolute inset-0 h-full w-full object-cover" firstFrame /> : null}
        {layer.veil ? <div data-cover-scene-shade="" className="absolute inset-0" style={{ backgroundColor: layer.veil.color, opacity: layer.veil.opacity }} /> : null}
        {layer.scrim.opacity > 0 ? <div data-cover-scene-scrim="" className="absolute inset-0" style={{ backgroundColor: layer.scrim.color, opacity: layer.scrim.opacity }} /> : null}
      </div>
    </div>
  );
}
