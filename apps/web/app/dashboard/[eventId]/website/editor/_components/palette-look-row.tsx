'use client';

/**
 * 🎨 THE PALETTE'S LOOK — ONE dropdown, under the Dress code scene's Style.
 *
 * Owner, 2026-09-29 (DECISION_LOG "APPROVED — FIVE PALETTE STYLES, PICKED ON
 * THE TOOLBAR"): *"palette. yes · Style on toolbar yes"*. The couple taps the
 * palette → the scene's panel → **Palette**, the shared PickMenu showing the
 * current look; a tap lists the five, each with a tiny picture of THIS couple's
 * own colours drawn in that look (`prototypes/palette_styles_2026-09-29.html`,
 * Maker frames). Every look is FREE — no ◆ — and never changes a colour or a
 * word. Any set of choices is a dropdown (owner 2026-09-28), never a pill row.
 *
 * It saves through the Style row's own draft door (`SceneStyleCanvasRow` →
 * `useSceneCanvas`), so a Style pick and a Palette pick made one after the other
 * can never overwrite each other from two stale copies of the canvas.
 *
 * ⚡ Loaded with the Style row, inside the existing `maker-details` chunk
 * (`scene-styles-lazy.tsx`) — never in the Maker's first load.
 */

import type { CSSProperties, ReactNode } from 'react';
import { PALETTE_LOOKS, type PaletteLookId } from '@/lib/palette-looks';
import { IRow } from './inspector-kit';
import { PickMenu } from './pick-menu';

export function PaletteLookRow({
  value,
  picked = true,
  colours,
  onPick,
  pending = false,
}: {
  /** The look the palette is drawn in now (absent resolves to Tags). */
  value: PaletteLookId;
  /** Whether the couple has chosen a look yet. Until they have, choosing the shown
   *  default (Tags) on purpose is still a choice — it is stored, and it plays. */
  picked?: boolean;
  /** The couple's own colours, for the thumbnails — the first three are drawn. */
  colours: readonly string[];
  onPick: (id: PaletteLookId) => void;
  pending?: boolean;
}) {
  const three = colours.slice(0, 3);
  return (
    <IRow label="Palette" data="palette-look">
      <PickMenu
        label="How your colours are shown"
        value={value}
        dataAttr="data-palette-look"
        options={PALETTE_LOOKS.map((o) => ({
          key: o.id,
          label: o.name,
          hint: o.line,
          preview: <PaletteLookThumb look={o.id} colours={three} />,
        }))}
        onPick={(id) => {
          const look = PALETTE_LOOKS.find((o) => o.id === id)?.id;
          if (look && !pending && (look !== value || !picked)) onPick(look);
        }}
      />
    </IRow>
  );
}

/* The zigzag of pinking shears, at thumbnail size. */
const PINKED =
  'polygon(0 12%,12% 0,25% 12%,38% 0,50% 12%,62% 0,75% 12%,88% 0,100% 12%,88% 25%,100% 38%,88% 50%,100% 62%,88% 75%,100% 88%,88% 100%,75% 88%,62% 100%,50% 88%,38% 100%,25% 88%,12% 100%,0 88%,12% 75%,0 62%,12% 50%,0 38%,12% 25%)';

/** A tiny picture of the couple's colours in one look — the prototype's `.th`. */
export function PaletteLookThumb({ look, colours }: { look: PaletteLookId; colours: readonly string[] }) {
  const bg = (hex: string, extra?: CSSProperties): CSSProperties => ({ backgroundColor: hex, ...extra });
  const last = colours.length - 1;
  let inner: ReactNode;
  if (look === 'tags') {
    inner = (
      <span className="flex items-end gap-[2px]">
        {colours.map((hex, i) => (
          <i key={i} className="block h-[13px] w-[7px] rounded-b-[4px] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,.15)]" style={bg(hex)} />
        ))}
      </span>
    );
  } else if (look === 'fabric') {
    inner = (
      <span className="flex items-end gap-[2px]">
        {colours.map((hex, i) => (
          <i key={i} className="block h-[10px] w-[10px]" style={bg(hex, { clipPath: PINKED })} />
        ))}
      </span>
    );
  } else if (look === 'chips') {
    inner = (
      <span className="flex flex-col gap-px rounded-[2px] bg-white p-[2px] shadow-[0_0_0_0.5px_rgba(0,0,0,.12)]">
        {colours.map((hex, i) => (
          <i key={i} className="block h-[6px] w-[26px]" style={bg(hex)} />
        ))}
      </span>
    );
  } else if (look === 'circles') {
    inner = (
      <span className="flex items-end pl-[4px]">
        {colours.map((hex, i) => (
          <i key={i} className="-ml-[4px] block h-[13px] w-[13px] rounded-full shadow-[0_0_0_1.5px_#f6f1e7]" style={bg(hex)} />
        ))}
      </span>
    );
  } else {
    inner = (
      <span className="flex items-end gap-px">
        {colours.map((hex, i) => (
          <i
            key={i}
            className="block h-[7px] w-[11px]"
            style={bg(hex, {
              clipPath:
                i === 0 && i === last
                  ? 'polygon(0 0,100% 0,calc(100% - 3px) 50%,100% 100%,0 100%,3px 50%)'
                  : i === 0
                    ? 'polygon(0 0,100% 0,100% 100%,0 100%,3px 50%)'
                    : i === last
                      ? 'polygon(0 0,100% 0,calc(100% - 3px) 50%,100% 100%,0 100%)'
                      : undefined,
            })}
          />
        ))}
      </span>
    );
  }
  return (
    <span data-palette-thumb={look} className="grid h-11 w-[3.25rem] place-items-center rounded-[5px] bg-[#f6f1e7] shadow-[0_0_0_1px_rgba(43,36,28,.1)]">
      {inner}
    </span>
  );
}
