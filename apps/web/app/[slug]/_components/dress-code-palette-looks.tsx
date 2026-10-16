import type { CSSProperties } from 'react';
import type { PaletteLookId } from '@/lib/palette-looks';
import { paletteInkStep } from '@/lib/palette-ink';
import { HUB_SCENE_WORDS_CLASS } from '@/lib/scene-words-class';

/**
 * 🎨 SEVEN MORE WAYS TO DRAW THE COUPLE'S COLOURS — Silk swatches (`fabric`) ·
 * Paint chips · Circles · Ribbon (prototype `palette_styles_2026-09-29.html`
 * B–E), then Arch tabs · Watercolour dots · Paint strokes (owner 2026-10-15,
 * DECISION_LOG "SIX OWNER ANSWERS" (2); `palette_styles_2026-10-15_fable.html`
 * styles 2, 3 and 5 — and its style 4 is the redraw of `fabric`).
 * The first look, Tags, is the shipped `.pahina-swatch` markup and stays in
 * `dress-code-widget.tsx` exactly as it was, so a page that never picked
 * cannot change.
 *
 * 🧵 ONE MARKUP, FOUR LOOKS. Every look is the same list — one `<li>` per
 * colour, in the order given, carrying the colour (`--c`) and the ink that
 * reads on it (`--k`, by contrast — `lib/palette-ink.ts`) — and the shapes are
 * globals.css ("THE FIVE PALETTE LOOKS"). Circles overlap, so their names move
 * into one line under the row. Paint strokes also carry their place (`--i`) for
 * the cascade; Arch tabs carry a sprig inside the swatch and NO hex (owner,
 * 2026-10-15: "no hex"). Watercolour dots' rough edge is ONE SVG filter
 * (`WatercolourEdge`), drawn beside the list that uses it.
 *
 * Where a word sits ON a colour and neither fixed ink reaches 4.5 : 1, the ink
 * falls to the third step (`lib/palette-ink.ts`) and the swatch says so —
 * `data-ink="fallback"`.
 *
 * ✂ STILL. The approved design gave each look an entrance; the owner cut
 * palette animation on 2026-09-30 ("THE MAKER RE-PLAN IS CUT TO ITS CORE").
 * A server component, CSS only — no client JavaScript.
 *
 * Row size (`size="row"`) is the same look shrunk for a role's row, with no words.
 */

export type PaletteLookItem = { hex: string; name?: string };

export function PaletteLookList({
  look,
  items,
  size = 'full',
  label,
}: {
  /** One of the looks drawn here — never `tags` (the widget draws that itself). */
  look: Exclude<PaletteLookId, 'tags'>;
  /** `#rrggbb` only — the widget has already refused anything else. */
  items: readonly PaletteLookItem[];
  size?: 'full' | 'row';
  /** What the list is, for a screen reader. */
  label?: string;
}) {
  if (items.length === 0) return null;
  if (size === 'row') {
    return (
      <ul className={`sn-pal sn-pal-row sn-pal-${look}`} data-pal-row={look} aria-label={label}>
        {items.map((it, i) => (
          <li key={`${it.hex}-${i}`} title={it.name || it.hex} {...swatchAttrs(it.hex, i)}>
            <i aria-hidden />
          </li>
        ))}
      </ul>
    );
  }
  const circles = look === 'circles';
  return (
    <>
      <ul className={`sn-pal sn-pal-${look}`} data-pal-look={look} aria-label={label}>
        {items.map((it, i) => (
          <li key={`${it.hex}-${i}`} title={it.name || it.hex} {...swatchAttrs(it.hex, i)}>
            {look === 'arch' ? (
              <i aria-hidden>
                <Sprig />
              </i>
            ) : (
              <i aria-hidden />
            )}
            {circles ? (
              <span className="sr-only">{it.name ? `${it.name} ${it.hex}` : it.hex}</span>
            ) : look === 'chips' ? (
              <>
                <b className={`font-pahina text-[1.2rem] font-light leading-none tracking-tight ${HUB_SCENE_WORDS_CLASS}`}>{it.name || it.hex}</b>
                {it.name ? <small className={`font-mono text-[0.6rem] uppercase tracking-[0.1em] opacity-80 ${HUB_SCENE_WORDS_CLASS}`}>{it.hex}</small> : null}
              </>
            ) : look === 'arch' || look === 'watercolour' || look === 'strokes' || look === 'fabric' ? (
              /* The name alone — never the hex (2026-09-30 "a colour is said by name"; owner 2026-10-15 "no
                 hex"). Its type and place are the look's own (globals.css): on the colour in the colour's ink
                 for Arch tabs and Paint strokes, in the page's ink under (Watercolour) or above (Silk). */
              it.name ? <b className={HUB_SCENE_WORDS_CLASS}>{it.name}</b> : <span className="sr-only">{it.hex}</span>
            ) : (
              <>
                {it.name ? (
                  <b className={`mt-2 block text-center font-mono text-[0.6rem] font-normal uppercase leading-tight tracking-[0.12em] text-ink/70 ${HUB_SCENE_WORDS_CLASS}`}>
                    {it.name}
                  </b>
                ) : null}
                <small className={`${it.name ? 'mt-0.5' : 'mt-2'} ${HUB_SCENE_WORDS_CLASS} block text-center font-mono text-[0.55rem] uppercase leading-tight tracking-[0.06em] text-ink/70`}>
                  {it.hex}
                </small>
              </>
            )}
          </li>
        ))}
      </ul>
      {look === 'watercolour' ? <WatercolourEdge /> : null}
      {circles ? (
        /* The names, in the same order, one line under the buttons — they
           overlap, so a word under each would collide. Hidden from a screen
           reader: each button already says its own name. */
        <p aria-hidden className="sn-pal-legend font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink/70">
          {items.map((it, i) => (
            <span key={`${it.hex}-${i}`} style={swatchVars(it.hex)}>
              {it.name || it.hex}
              {it.name ? <small className="text-[0.55rem] tracking-[0.06em] text-ink/70">{it.hex}</small> : null}
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}

/** The colour and the ink that reads on it, as the two custom properties the CSS draws with. */
function swatchVars(hex: string): CSSProperties {
  return { ['--c' as string]: hex, ['--k' as string]: paletteInkStep(hex).ink } as CSSProperties;
}

/** A list item's colour, its ink, its place in the list (`--i`, Paint strokes' cascade), and the fallback mark. */
function swatchAttrs(hex: string, i: number): { style: CSSProperties; 'data-ink'?: 'fallback' } {
  const step = paletteInkStep(hex);
  const style = { ['--c' as string]: hex, ['--k' as string]: step.ink, ['--i' as string]: i } as CSSProperties;
  return step.fallback ? { style, 'data-ink': 'fallback' } : { style };
}

/** 🌿 Arch tabs' sprig — a line-drawn stem with three pairs of leaves, in the colour's ink (`currentColor`). */
function Sprig() {
  return (
    <svg viewBox="0 0 24 44" aria-hidden focusable="false">
      <path d="M12 42V6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path
        d="M12 12c-5-1-8-5-7-9 4 1 7 4 7 9zM12 12c5-1 8-5 7-9-4 1-7 4-7 9zM12 21c-5-1-8-5-7-9 4 1 7 4 7 9zM12 21c5-1 8-5 7-9-4 1-7 4-7 9zM12 30c-5-1-8-5-7-9 4 1 7 4 7 9zM12 30c5-1 8-5 7-9-4 1-7 4-7 9z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * 💧 THE WATERCOLOUR EDGE — fractal noise displaces each dot's outline by a few pixels, so it reads as paint
 * that bled into the paper. ONE filter, no image; globals.css points the dots at it (`url(#sn-pal-wc)`). Row
 * size never uses it (a filter on a 20 px dot costs paint for nothing — an uneven radius does the job). The
 * widget draws "Our colours" OR the reader's own colours, never both, so the id is drawn once per scene.
 */
export const WATERCOLOUR_FILTER_ID = 'sn-pal-wc';
function WatercolourEdge() {
  return (
    <svg width="0" height="0" aria-hidden focusable="false" className="pointer-events-none absolute">
      <filter id={WATERCOLOUR_FILTER_ID} x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves={3} seed={11} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={8} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
