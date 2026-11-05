'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { hubElementColor } from '@/lib/element-style';
import { useOneOpen } from '@/lib/one-open';
/* The ONE picker — the Mood Board's. A static import on purpose, as `studio-colour-field.tsx` does: this
   file is never in the Maker's first load (every file that mounts a well is reached through
   `details-lazy.tsx`'s `import()`), and the sheet already rides that same `maker-details` chunk, so it
   adds no byte and no chunk. `lib/every-studio-colour-opens-the-one-picker.test.ts` walks the Maker's
   first-load graph and fails the day this file — or the sheet — is in it. */
import { ColourPickerSheet } from '../../../studio/mood-board/_components/colour-picker-sheet';

/**
 * 🎨 THE COLOUR WELL — A TRIGGER, AND THE DOOR TO THE ONE COLOUR PICKER.
 *
 * Owner, 2026-10-08, verbatim: *"we already have a design for the color palettes and how to pick
 * colors on the moodboard. apply that same concept on the background and on any other color rules
 * parts"* · *"the color suggestions should rely on the moodboard as well. so the mood board colors,
 * then the complementing colors for them"* · *"restudy is good"*
 * (`BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.2 + § 6 row 4: **ONE** picker — `ColourPickerSheet`;
 * `ColourWell`'s own panel is retired).
 *
 * So the well keeps only its split swatch (Keynote's: a wide swatch that says the colour, and the
 * wheel) and BOTH halves open the Mood Board's sheet — Against the background · Your Mood Board ·
 * Goes with your Mood Board · Swatches · Custom. The wheel, Brightness, Opacity and the device's
 * "Saved colours" this file used to draw are gone with the panel: there is one picker.
 *
 * `ColourSheet` is the same door without a trigger, for a caller that already draws one — the
 * Stages rows' "+" (`stage-background.tsx`, `stage-text.tsx`), the Reveal's colour rows.
 *
 * ⚡ Neither this file nor the sheet is in the Maker's first load — see the import's note above.
 *
 * 💾 A pick goes exactly where it went before — the caller's `onPick` (a draft save, or a hidden
 * field its form posts). Opening writes nothing.
 *
 * 🔒 Only hex digits leave this file — `#rrggbb` — through the same `hubElementColor` gate the
 * sanitizer uses.
 */
type SheetProps = {
  /** The sheet's title — "Colour" unless the caller's row has its own name ("Veil colour"). */
  title?: string;
  /** The colour chosen, or null while it is the unset one (the theme's / the Mood Board's). */
  value: string | null;
  /** What is painted while `value` is null. */
  shown: string;
  /** Whose colour this is, said under the sheet's title ("the names", "this scene"); empty = no line. */
  what: string;
  /** The event's Mood Board colours, the five first — the sheet's "Your Mood Board" shelf. */
  palette: readonly string[];
  /** `palette` IS the five main colours in slot order — the sheet names them Dominant … Accent 2. */
  slots?: boolean;
  /** The ground the words sit on (a text colour): the sheet's AA line, and readable suggestions first. */
  readsOn?: string | null;
  /** Choose a colour (saved by the caller). */
  onPick: (hex: string) => void;
  /** Back to the unset colour — the sheet's "Remove this colour", offered while one is chosen. */
  onUnset?: () => void;
};

/** The one picker, opened — no trigger of its own. Mount it while it is open; `onClose` unmounts it. */
export function ColourSheet({ title = 'Colour', value, shown, what, palette, slots, readsOn, onPick, onUnset, onClose }: SheetProps & { onClose: () => void }) {
  return (
    <ColourPickerSheet
      title={title}
      job={what.charAt(0).toUpperCase() + what.slice(1)}
      current={(value ?? shown).slice(0, 7)}
      palette={palette}
      slots={slots}
      readsOn={readsOn}
      fromPhotos={NO_PHOTOS}
      onPick={(hex) => {
        onClose();
        const c = hubElementColor(hex);
        if (c) onPick(c);
      }}
      onClose={onClose}
      onRemove={
        onUnset && value
          ? () => {
              onClose();
              onUnset();
            }
          : undefined
      }
    />
  );
}

const NO_PHOTOS: readonly string[] = [];

export function ColourWell({
  data,
  unsetLabel = 'Theme',
  ...sheet
}: SheetProps & {
  /** What the well says while no colour is chosen ("From your Mood Board"). */
  unsetLabel?: string;
  data?: string;
}) {
  const [open, setOpen] = useState(false);
  useOneOpen(open, setOpen); // opening the picker closes an open dropdown — lib/one-open.ts
  const current = sheet.value ?? sheet.shown;
  return (
    <div className="relative min-w-0 flex-1" data-colour-well={data}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          data-colour-well-wide=""
          className="sn-press flex h-11 min-w-0 flex-1 items-center justify-between rounded-md border border-ink/20 px-2.5 font-mono text-[11px] tracking-wide lg:h-9"
          style={{ background: current, color: readableOn(current) }}
        >
          <span className="truncate">{sheet.value ? current.slice(0, 7).toUpperCase() : unsetLabel}</span>
          <ChevronDown aria-hidden className="h-3.5 w-3.5 opacity-80" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          aria-label="Open the Colour panel"
          title="Open the Colour panel"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          data-colour-wheel-button=""
          className="sn-press h-11 w-11 shrink-0 rounded-full shadow-[0_0_0_2px_#fff,0_0_0_3px_rgba(27,26,23,.18)] lg:h-9 lg:w-9"
          style={{ background: WHEEL_BG }}
        />
      </div>
      {open ? <ColourSheet {...sheet} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

const WHEEL_BG =
  'radial-gradient(circle, #fff 0, rgba(255,255,255,0) 68%), conic-gradient(from 0deg, #ff0000, #ffff00 60deg, #00ff00 120deg, #00ffff 180deg, #0000ff 240deg, #ff00ff 300deg, #ff0000 360deg)';

/** Black or white — whichever reads on the well's own colour. */
function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  if (Number.isNaN(n)) return '#1b1a17';
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1b1a17' : '#ffffff';
}
