import type { CSSProperties } from 'react';
import { COVER_SCENE_FRAMED, COVER_SCENE_FULL } from '@/lib/cover-scene';
import type { CoverSceneLayer } from '../_lib/cover-scene-layer';
import { SceneClip } from './scene-clip';

/** The cover's words in the paper ink over a dark ground (`--color-ink` is what every `text-ink/…` word reads). */
export const COVER_SCENE_CREAM_VARS = { '--color-ink': '251 250 247' } as CSSProperties;

/**
 * 🖼 THE COVER SCENE'S BACKGROUND, DRAWN — behind the cover's words, the whole first screen tall (the header is
 * `min-h-[100svh]`, `lib/cover-scene.ts`). Framed: inset with a rounded margin, the page colour round it; Full width:
 * edge to edge (the layer is as wide as the screen, whatever column the words sit in). A ready-made loop plays through
 * the shipped `SceneClip` (muted · inline · only while on screen; its still first and whenever it cannot play).
 */
export function CoverSceneGround({ layer }: { layer: CoverSceneLayer }) {
  return (
    <div aria-hidden data-cover-scene-ground={layer.shape} className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen max-w-[100vw] -translate-x-1/2">
      <div className={`absolute inset-0 ${layer.shape === 'full' ? COVER_SCENE_FULL : COVER_SCENE_FRAMED}`} style={layer.css ? { background: layer.css } : undefined}>
        {layer.still ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(layer.still)})` }}
            {...(layer.parallax ? { 'data-pahina-parallax': 'page' } : {})}
          />
        ) : null}
        {layer.clip ? <SceneClip src={layer.clip} poster={layer.still} play="loop" open="inplace" label="" className="absolute inset-0 h-full w-full object-cover" revealOnPlay /> : null}
        {layer.veil ? <div data-cover-scene-shade="" className="absolute inset-0" style={{ backgroundColor: layer.veil.color, opacity: layer.veil.opacity }} /> : null}
        {layer.scrim.opacity > 0 ? <div data-cover-scene-scrim="" className="absolute inset-0" style={{ backgroundColor: layer.scrim.color, opacity: layer.scrim.opacity }} /> : null}
      </div>
    </div>
  );
}
