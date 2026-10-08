'use client';

import { useState, type ReactNode } from 'react';
import {
  HUB_ELEMENT_SIZE_BASE,
  HUB_ELEMENT_SIZE_BOUNDS,
  HUB_ELEMENT_SIZE_STEPS,
  hubElementSizePct,
  type HubElementKey,
} from '@/lib/element-style';
import { SP_PANE, SP_ROW, SP_ROW_LABEL } from '@/lib/maker-stage-room';
import { Swatch, SwatchMore } from './kit';

/**
 * 🔤 TEXT — Font · Colour · Size, and nothing else (DECISION_LOG "TEXT STYLING STAYS
 * THREE CONTROLS"; the prototype's `S.tool === 'text'`, three 44 px rows):
 *
 *   Font    Aa Cormorant Garamond ▾     the shipped one font dropdown (`FontPick`)
 *   Colour  ◍ ● ● ● ● ● +               colour CIRCLES (the approved gallery's kind 21): the theme's own
 *                                       (striped), the Event Hub's colours, ink, then any colour ("+" opens
 *                                       the one colour picker); the picked one wears the accent's ring
 *   Size    ━━━━●━━━━━  100%            the shipped steps (`HUB_ELEMENT_SIZE_STEPS`), inside
 *                                       the part's bounds; 100% is the theme's own
 *
 * Every pick is the part sheet's own `choose` (`element-sheet.tsx`) — the same draft
 * save, the same instant preview. The words are typed on the page; Alignment is
 * Style › Arrange's.
 */
export function StageText({
  el,
  fontPick,
  colours,
  colour,
  onColour,
  customColour,
  size,
  onSize,
  contrast = null,
  pending = false,
  extra = null,
}: {
  el: HubElementKey;
  /** The shipped Font ▾, dressed as the prototype's `.dd`. */
  fontPick: ReactNode;
  colours: readonly string[];
  colour: string | null;
  onColour: (hex: string | null) => void;
  /** "+" opens the ONE colour picker (`ColourSheet`, colour-well.tsx) — handed the way to close it. */
  customColour: (close: () => void) => ReactNode;
  size: number | null | undefined;
  onSize: (step: number | null) => void;
  /** "Hard to read here" — measured, never blocking. */
  contrast?: ReactNode;
  pending?: boolean;
  /** "Whole part / this selection" while letters are selected. */
  extra?: ReactNode;
}) {
  const [custom, setCustom] = useState(false);
  const { min, max } = HUB_ELEMENT_SIZE_BOUNDS[el];
  const steps = (HUB_ELEMENT_SIZE_STEPS as readonly number[]).filter((s) => s >= min && s <= max);
  const pct = hubElementSizePct(size) ?? HUB_ELEMENT_SIZE_BASE;
  const at = Math.max(0, steps.indexOf(pct));
  const fill = steps.length > 1 ? (at / (steps.length - 1)) * 100 : 50;
  const swatch = (key: string, on: boolean, label: string, face: ReactNode, pick: () => void) => (
    <Swatch key={key} on={on} label={label} face={face} onPick={pick} data={{ 'data-stage-text-colour': key }} />
  );
  const now = colour?.slice(0, 7).toLowerCase() ?? null;
  return (
    <div className={SP_PANE} data-stage-text="" aria-busy={pending}>
      {extra}
      <div className={SP_ROW} data-stage-text-row="font">
        <span className={SP_ROW_LABEL}>Font</span>
        {fontPick}
      </div>
      <div className={SP_ROW} data-stage-text-row="colour">
        <span className={SP_ROW_LABEL}>Colour</span>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
          {swatch('theme', now === null, 'The theme’s colour', <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#fff_0_4px,#EDE8DF_4px_8px)]" />, () => onColour(null))}
          {colours.map((c) => swatch(c, now === c.slice(0, 7).toLowerCase(), `Colour ${c}`, <span className="absolute inset-0" style={{ background: c }} />, () => onColour(c)))}
          <SwatchMore open={custom} onOpen={() => setCustom(true)} data={{ 'data-stage-text-colour': 'more' }} />
        </div>
      </div>
      {custom ? customColour(() => setCustom(false)) : null}
      {contrast}
      <div className={SP_ROW} data-stage-text-row="size">
        <span className={SP_ROW_LABEL}>Size</span>
        <span className="relative flex h-11 min-w-0 flex-1 items-center px-1">
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            step={1}
            value={at}
            aria-label="Text size"
            aria-valuetext={`${pct}%`}
            data-stage-text-size=""
            onChange={(e) => {
              const next = steps[Number(e.target.value)] ?? HUB_ELEMENT_SIZE_BASE;
              onSize(next === HUB_ELEMENT_SIZE_BASE ? null : next);
            }}
            className="sp-range h-11 w-full cursor-pointer appearance-none bg-transparent"
            style={{ ['--p' as string]: `${fill}%` }}
          />
        </span>
        <span className="flex h-[38px] min-w-[58px] shrink-0 items-center justify-center rounded-full border border-[var(--sp-line)] bg-white text-[13.5px] font-medium">
          {pct}%
        </span>
      </div>
    </div>
  );
}
