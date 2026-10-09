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
import { PALETTE_LOOKS, PALETTE_LOOK_CARD_FOCUS, PALETTE_LOOK_PREVIEW_TYPE, type PaletteLookId } from '@/lib/palette-looks';
import { DOS_LOOKS, DOS_LOOK_CARD_FOCUS, DOS_LOOK_PREVIEW_TYPE, type DosLookId } from '@/lib/dress-code-looks';
import { SP_DD_LABEL, SP_PALETTE_PICK, SP_PALETTE_ROW } from '@/lib/maker-stage-room';
import { IRow } from './inspector-kit';
import { PickMenu } from './pick-menu';
import { StyleCards } from '../../../launch/_components/stage-panel/style-carousel';

/**
 * 🖼 THE PALETTE'S LOOKS, AS PICTURES — the Stages panel's Dress code part (owner's preview check, 08 Oct:
 * *"palette should show the actual previews like the other styles"*). The SAME five looks (`PALETTE_LOOKS`)
 * and the same save as the dropdown below, drawn by the shared look-card renderer (`StyleCards`): each card is
 * the couple's own page, asked for the Dress code scene with its colours in that look
 * (`?style=dress_code_palette:<id>` → `canvas.palette`, `app/[slug]/_lib/style-preview.ts`), fitted on "Our
 * colours" and sized by its shape like every other look card. A tap applies at once. No dropdown here.
 */
export function PaletteLookCards({ value, onPick, pending = false }: { value: PaletteLookId; onPick: (id: PaletteLookId) => void; pending?: boolean }) {
  return (
    <>
      <p className={`${SP_DD_LABEL} !max-w-none shrink-0 px-1 pt-1`} data-palette-look-label="">
        Palette look
      </p>
      <StyleCards
        label="Palette look"
        data="palette"
        options={PALETTE_LOOKS}
        value={value}
        pending={pending}
        canvasKey="w:dress_code"
        sceneType={PALETTE_LOOK_PREVIEW_TYPE}
        focus={PALETTE_LOOK_CARD_FOCUS}
        onPick={(id) => {
          const look = PALETTE_LOOKS.find((o) => o.id === id)?.id;
          if (look && look !== value) onPick(look);
        }}
      />
    </>
  );
}

/**
 * 🎨 THE DRESS CODE'S PALETTE ROW IN THE TOOLBAR — Style's row 3 (owner 2026-10-09, verbatim: *"row 3 is palette
 * style"*; `TOOLBAR-SPEC-2026-10-09.md` § STYLE; the prototype's `palStrip`): the five looks as five equal buttons
 * in ONE row, each the couple's own colours drawn in that look (`PaletteLookThumb`, the dropdown's own thumbnails).
 * It was a second carousel of full miniatures (2026-10-08), which with the layouts and the Do's & Don'ts made
 * Style three carousels tall. A tap applies at once; the page above is the full preview.
 */
export function PaletteLookStrip({ value, colours, onPick, pending = false }: { value: PaletteLookId; colours: readonly string[]; onPick: (id: PaletteLookId) => void; pending?: boolean }) {
  /* The couple's colours — or, before they have any, quiet stand-ins, so the five shapes still read. */
  const shown = colours.length > 0 ? colours.slice(0, 5) : PALETTE_STAND_INS;
  return (
    <div role="radiogroup" aria-label="Palette style" data-look-row="palette" data-palette-strip="" className={SP_PALETTE_ROW}>
      {PALETTE_LOOKS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          aria-label={`Palette style: ${o.name}`}
          title={o.name}
          data-palette-pick={o.id}
          onClick={() => {
            if (!pending && o.id !== value) onPick(o.id);
          }}
          className={SP_PALETTE_PICK}
        >
          <PaletteLookThumb look={o.id} colours={shown} />
        </button>
      ))}
    </div>
  );
}
/** Shown only while the event has no colours yet: greys, never a colour the couple did not choose. */
const PALETTE_STAND_INS: readonly string[] = ['#8A8580', '#B8B2A8', '#D9D3C8'];

export function PaletteLookRow({
  value,
  colours,
  onPick,
  pending = false,
}: {
  /** The look the palette is drawn in now (absent resolves to Tags). */
  value: PaletteLookId;
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
          if (look && !pending && look !== value) onPick(look);
        }}
      />
    </IRow>
  );
}

/**
 * 🧾 THE DO'S & DON'TS' LOOKS, AS PICTURES (owner 08 Oct: *"the presentation of do's and don'ts doesn't look
 * good with the rest of the website"* — `lib/dress-code-looks.ts`). The same shared look-card carousel: each
 * card is the couple's own page asked for the Dress code scene with its two lists in that look
 * (`?style=dress_code_dos:<id>` → `canvas.dos`), fitted on the lists. A tap applies at once.
 */
export function DosLookCards({ value, onPick, pending = false }: { value: DosLookId; onPick: (id: DosLookId) => void; pending?: boolean }) {
  return (
    <>
      <p className={`${SP_DD_LABEL} !max-w-none shrink-0 px-1 pt-1`} data-dos-look-label="">
        Do&rsquo;s &amp; Don&rsquo;ts
      </p>
      <StyleCards
        label="Do’s & Don’ts"
        data="dos"
        options={DOS_LOOKS}
        value={value}
        pending={pending}
        canvasKey="w:dress_code"
        sceneType={DOS_LOOK_PREVIEW_TYPE}
        focus={DOS_LOOK_CARD_FOCUS}
        onPick={(id) => {
          const look = DOS_LOOKS.find((o) => o.id === id)?.id;
          if (look && look !== value) onPick(look);
        }}
      />
    </>
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
          <i key={i} className="block h-[13px] w-[7px] rounded-b-sm shadow-[inset_0_0_0_0.5px_rgba(0,0,0,.15)]" style={bg(hex)} />
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
      <span className="flex flex-col gap-px rounded-sm bg-white p-[2px] shadow-[0_0_0_0.5px_rgba(0,0,0,.12)]">
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
    <span data-palette-thumb={look} className="grid h-11 w-[3.25rem] place-items-center rounded-sm bg-[#f6f1e7] shadow-[0_0_0_1px_rgba(43,36,28,.1)]">
      {inner}
    </span>
  );
}
