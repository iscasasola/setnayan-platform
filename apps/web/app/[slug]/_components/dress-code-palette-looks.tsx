import type { CSSProperties } from 'react';
import type { PaletteLookId } from '@/lib/palette-looks';
import { paletteInkOn } from '@/lib/palette-ink';

/**
 * 🎨 FOUR MORE WAYS TO DRAW THE COUPLE'S COLOURS — Fabric swatches · Paint
 * chips · Circles · Ribbon (prototype `palette_styles_2026-09-29.html` B–E).
 * The first look, Tags, is the shipped `.pahina-swatch` markup and stays in
 * `dress-code-widget.tsx` exactly as it was, so a page that never picked
 * cannot change.
 *
 * 🧵 ONE MARKUP, FOUR LOOKS. Every look is the same list — one `<li>` per
 * colour, in the order given, carrying the colour (`--c`) and the ink that
 * reads on it (`--k`, by contrast — `lib/palette-ink.ts`) — and the shapes are
 * globals.css ("THE FIVE PALETTE LOOKS"). Circles overlap, so their names move
 * into one line under the row.
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
  /** One of the four drawn here — never `tags` (the widget draws that itself). */
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
          <li key={`${it.hex}-${i}`} title={it.name || it.hex} style={swatchVars(it.hex)}>
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
          <li key={`${it.hex}-${i}`} title={it.name || it.hex} style={swatchVars(it.hex)}>
            <i aria-hidden />
            {circles ? (
              <span className="sr-only">{it.name ? `${it.name} ${it.hex}` : it.hex}</span>
            ) : look === 'chips' ? (
              <>
                <b className="font-pahina text-[1.2rem] font-light leading-none tracking-tight">{it.name || it.hex}</b>
                {it.name ? <small className="font-mono text-[0.6rem] uppercase tracking-[0.1em] opacity-80">{it.hex}</small> : null}
              </>
            ) : (
              <>
                {it.name ? (
                  <b className="mt-2 block text-center font-mono text-[0.6rem] font-normal uppercase leading-tight tracking-[0.12em] text-ink/60">
                    {it.name}
                  </b>
                ) : null}
                <small className={`${it.name ? 'mt-0.5' : 'mt-2'} block text-center font-mono text-[0.55rem] uppercase leading-tight tracking-[0.06em] text-ink/45`}>
                  {it.hex}
                </small>
              </>
            )}
          </li>
        ))}
      </ul>
      {circles ? (
        /* The names, in the same order, one line under the buttons — they
           overlap, so a word under each would collide. Hidden from a screen
           reader: each button already says its own name. */
        <p aria-hidden className="sn-pal-legend font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink/60">
          {items.map((it, i) => (
            <span key={`${it.hex}-${i}`} style={swatchVars(it.hex)}>
              {it.name || it.hex}
              {it.name ? <small className="text-[0.55rem] tracking-[0.06em] text-ink/45">{it.hex}</small> : null}
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}

/** The colour and the ink that reads on it, as the two custom properties the CSS draws with. */
function swatchVars(hex: string): CSSProperties {
  return { ['--c' as string]: hex, ['--k' as string]: paletteInkOn(hex) } as CSSProperties;
}
