'use client';

import { useEffect, useState } from 'react';
import { SLIDER_VALUE, Slider } from '@/app/_components/slider';
import { hearDraftedCanvas } from '@/lib/maker-draft-store';
import { HUB_ELEMENT_LABEL, HUB_ELEMENT_WIDTH_CHOICES, type HubElementWidth } from '@/lib/element-style';
import { SP_LOOK_ROW, SP_LOOK_ROW_DD, SP_LOOK_ROW_LABEL } from '@/lib/maker-stage-room';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { PickOption } from '../../../website/editor/_components/pick-menu-types';
import { ColourSheet } from '../../../website/editor/_components/colour-well';
import type { ElementPalette } from '../../../website/editor/_components/element-sheet';
import { Dd, Swatch } from './kit';
import { partLookFields, partLookNow, partLookSizes, type PartLookField, type PartLookTarget } from './part-look';

/**
 * 🎨 STYLE'S LAST ROW — Colour · Size · Width, side by side (owner 2026-10-09: *"color and size share the same row"*;
 * 2026-10-14, Width: *"what if there is a part where we want to have the text take up more width?"*):
 *
 *   ◍                         ONE circle (*"Color just 1 circle…"*) wearing the part's colour — striped while it is the
 *                             theme's own — that opens the app's ONE colour picker (`ColourSheet`: the Mood Board's
 *                             colours, any colour, "Remove this colour" back to the theme's). The written word
 *                             "Colour" stands before it from `sm` only (owner 2026-10-14, Q1: at phone width the circle
 *                             stands alone — it keeps "Colour" as its accessible name, and its sheet is titled)
 *   Size    ━━━━●━━━━  100%   the app's slider (`Slider`) over the shipped steps inside the part's bounds; 100 % is
 *                             the theme's own
 *   [WIDTH  Normal ▾]         the house two-line dropdown (`Dd stacked`), short: Narrow · Normal · Wide · Full —
 *                             Normal the theme's own (`HUB_ELEMENT_WIDTH_BOX`); only on the parts that take a width
 *
 * No Font (Studio › Look › Elements › Font — *"there is already a universal font"*). Every pick is the part sheet's
 * own write (`part-look.ts`). A part that takes only some of the three (the logo: a size) draws only those.
 */
const NO_BOARD: readonly string[] = [];

/** ↔ The four widths as the dropdown lists them — a small bar showing each one's share (Normal's dashed: the theme's). */
const WIDTH_BAR: Readonly<Record<HubElementWidth | 'normal', number>> = { narrow: 45, normal: 60, wide: 80, full: 100 };
const WIDTH_OPTIONS: readonly PickOption[] = HUB_ELEMENT_WIDTH_CHOICES.map((c) => ({
  key: c.key,
  label: c.label,
  hint: c.hint,
  preview: (
    <span className="grid h-[26px] w-11 place-items-center rounded-md bg-[rgba(44,42,41,.07)]">
      <i
        className={`block h-1 rounded-sm opacity-75 ${c.key === 'normal' ? 'bg-[repeating-linear-gradient(90deg,currentColor_0_3px,transparent_3px_6px)]' : 'bg-current'}`}
        style={{ width: `${WIDTH_BAR[c.key]}%` }}
      />
    </span>
  ),
}));

export function StageLookRow({
  target,
  canvas,
  palette,
  onKeep,
  onRefused,
}: {
  target: PartLookTarget;
  /** The part's scene canvas as the last render drew it — the Maker's own copy is laid over it. */
  canvas: HubSectionCanvas | null;
  /** The Event Hub's colours: what the theme's own colour is shown as, the Mood Board's shelf, the ground words sit on. */
  palette: ElementPalette | null;
  onKeep: (field: PartLookField, value: string | number | null) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** A pick that did not save — said, never silent. */
  onRefused: (words: string) => void;
}) {
  const can = partLookFields(target);
  const [now, setNow] = useState(() => partLookNow(target, canvas));
  const [picking, setPicking] = useState(false);
  /* Another part, a render, or another writer of this canvas (words typed in Edit): the row shows what is there. */
  useEffect(() => {
    const read = () => setNow((was) => {
      const next = partLookNow(target, canvas);
      return was.colour === next.colour && was.size === next.size && was.width === next.width ? was : next;
    });
    read();
    return hearDraftedCanvas((type) => {
      if (type === target.widgetType) read();
    });
  }, [target, canvas]);
  const keep = (field: PartLookField, value: string | number | null) => {
    void onKeep(field, value).then((r) => {
      if (!r.ok) onRefused(r.error);
      setNow(partLookNow(target, canvas));
    });
  };
  const sizes = partLookSizes(target.el);
  const at = Math.max(0, sizes.indexOf(now.size));
  const what = HUB_ELEMENT_LABEL[target.el].toLowerCase();
  return (
    <div className={SP_LOOK_ROW} data-stage-look-row={target.el}>
      {can.colour ? (
        <>
          <span className={`${SP_LOOK_ROW_LABEL} hidden sm:inline`} aria-hidden>
            Colour
          </span>
          <Swatch
            on
            label={now.colour ? `Colour ${now.colour} — change it` : 'The theme’s colour — change it'}
            face={
              now.colour ? (
                <span className="absolute inset-0" style={{ background: now.colour }} />
              ) : (
                <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#fff_0_4px,#EDE8DF_4px_8px)]" />
              )
            }
            onPick={() => setPicking(true)}
            data={{ 'data-stage-look-colour': now.colour ?? 'theme' }}
          />
          {picking ? (
            <ColourSheet
              value={now.colour}
              shown={palette?.ink ?? '#2C2A29'}
              what={`the ${what}`}
              palette={palette?.board ?? NO_BOARD}
              slots={Boolean(palette?.board)}
              readsOn={palette?.surface}
              onPick={(hex) => keep('color', hex)}
              onUnset={() => keep('color', null)}
              onClose={() => setPicking(false)}
            />
          ) : null}
        </>
      ) : null}
      {can.size ? (
        <>
          <span className={SP_LOOK_ROW_LABEL}>Size</span>
          <span className="relative flex h-11 min-w-0 flex-1 items-center px-1" data-stage-look-size="">
            <Slider label="Text size" data="look-size" min={0} max={sizes.length - 1} step={1} value={at} valueText={`${now.size}%`} onChange={(i) => keep('size', sizes[i] ?? 100)} />
          </span>
          <span className={`${SLIDER_VALUE} w-[40px]`}>{now.size}%</span>
        </>
      ) : null}
      {can.width ? (
        /* 🤫 `Dd` saves nothing for the width already worn — no write, no ↺ step. */
        <Dd
          stacked
          small="Width"
          label={`Width of the ${what}`}
          data="look-width"
          value={now.width ?? 'normal'}
          options={WIDTH_OPTIONS}
          onPick={(k) => keep('width', k === 'normal' ? null : k)}
          className={SP_LOOK_ROW_DD}
        />
      ) : null}
    </div>
  );
}
