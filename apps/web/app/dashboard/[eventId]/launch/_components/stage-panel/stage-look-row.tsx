'use client';

import { useEffect, useState } from 'react';
import { SLIDER_VALUE, Slider } from '@/app/_components/slider';
import { hearDraftedCanvas } from '@/lib/maker-draft-store';
import { HUB_ELEMENT_LABEL } from '@/lib/element-style';
import { SP_LOOK_ROW, SP_LOOK_ROW_LABEL } from '@/lib/maker-stage-room';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { ColourSheet } from '../../../website/editor/_components/colour-well';
import type { ElementPalette } from '../../../website/editor/_components/element-sheet';
import { Swatch } from './kit';
import { partLookFields, partLookNow, partLookSizes, type PartLookTarget } from './part-look';

/**
 * 🎨 STYLE'S LAST ROW — Colour · Size, side by side (owner 2026-10-09: *"color and size share the same row"*):
 *
 *   Colour  ◍                 ONE circle (*"Color just 1 circle…"*) wearing the part's colour — striped while it is the
 *                             theme's own — that opens the app's ONE colour picker (`ColourSheet`: the Mood Board's
 *                             colours, any colour, "Remove this colour" back to the theme's)
 *   Size    ━━━━●━━━━  100%   the app's slider (`Slider`) over the shipped steps inside the part's bounds; 100 % is
 *                             the theme's own
 *
 * No Font (Studio › Look › Elements › Font — *"there is already a universal font"*). Every pick is the part sheet's
 * own write (`part-look.ts`). A part that takes only one of the two (the logo: a size) draws only that one.
 */
const NO_BOARD: readonly string[] = [];

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
  onKeep: (field: 'color' | 'size', value: string | number | null) => Promise<{ ok: true } | { ok: false; error: string }>;
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
      return was.colour === next.colour && was.size === next.size ? was : next;
    });
    read();
    return hearDraftedCanvas((type) => {
      if (type === target.widgetType) read();
    });
  }, [target, canvas]);
  const keep = (field: 'color' | 'size', value: string | number | null) => {
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
          <span className={SP_LOOK_ROW_LABEL}>Colour</span>
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
    </div>
  );
}
