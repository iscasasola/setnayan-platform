'use client';

import type { SceneThumbBox } from '@/lib/scene-templates';
import { CUSTOM_SECTION_TYPES } from '@/lib/custom-sections';

/*
 * 🖼 A SCENE TEMPLATE'S TILE DRAWING, and the six-slot count — shared by the
 * "+ Add a scene" picker (`scene-template-picker.tsx`, first screen, which
 * re-exports both) and Post Event's lazy preset tiles
 * (`post-event-preset-tiles.tsx`, `maker-details`). Its own module on purpose:
 * the tiles importing the picker for these two made the picker (and the scene
 * inspector beside it) one more async chunk in the webpack runtime on EVERY
 * page (`scripts/check-bundle-size.mjs`, train n).
 */

/** The six scenes of their own, shared across every stage (E5). */
export const MAX_OWN_SCENES = CUSTOM_SECTION_TYPES.length;

/**
 * One tile's drawing. Every box is a percentage of the tile, so the same data
 * draws at any size; a fixed frame (16:10 desktop, 9:16 phone) keeps every
 * thumbnail the same shape, content inside it.
 */
export function Thumb({
  boxes,
  shape,
  hideMedia,
  word,
}: {
  boxes: readonly SceneThumbBox[];
  shape: 'desk' | 'phone';
  hideMedia: boolean;
  word: string;
}) {
  return (
    <span
      aria-hidden
      className={`relative block overflow-hidden rounded-sm border border-ink/10 bg-white ${
        shape === 'desk' ? 'aspect-[16/10] w-full' : 'aspect-[9/16] w-[46%] min-w-[2.5rem]'
      }`}
    >
      {boxes.map(([kind, x, y, w, h, tone], i) => {
        if (hideMedia && (kind === 'photo' || kind === 'play')) return null;
        const pos = { left: `${x}%`, top: `${y}%` } as React.CSSProperties;
        if (kind === 'play') {
          return <i key={i} className="absolute text-[0.5rem] not-italic leading-none text-white" style={pos}>▶</i>;
        }
        if (kind === 'dot') {
          return <i key={i} className="absolute h-[8%] w-[5%] rounded-full bg-terracotta/70" style={pos} />;
        }
        if (kind === 'txt') {
          return (
            <i key={i} className="absolute truncate px-0.5 text-center font-serif text-[0.85rem] not-italic leading-none text-ink/85" style={{ ...pos, width: `${w}%` }}>
              {word}
            </i>
          );
        }
        const fill =
          kind === 'photo'
            ? 'bg-gradient-to-br from-terracotta/35 to-ink/35'
            : kind === 'col'
              ? 'bg-paper-deep'
              : tone === 'a'
                ? 'bg-terracotta/55'
                : tone === 'l'
                  ? 'bg-white/85'
                  : 'bg-ink/25';
        return (
          <i
            key={i}
            className={`absolute ${kind === 'line' ? 'rounded-full' : 'rounded-sm'} ${fill}`}
            style={{ ...pos, width: `${w}%`, height: `${h}%` }}
          />
        );
      })}
    </span>
  );
}
