'use client';

import { useState } from 'react';
import { Plus, Undo2, X } from 'lucide-react';
/* The ONE picker — the Mood Board's (`StudioColourField` opens the same sheet). This file is drawn only by the main
   background panel, which loads with the Look chunk — never in the Maker's first load. */
import { ColourPickerSheet } from '../../../studio/mood-board/_components/colour-picker-sheet';

/**
 * 🎨🎨 THE PAGE COLOUR, AND AN OPTIONAL SECOND — TWO CIRCLES LIKE THE MOOD BOARD'S.
 *
 * Owner, 2026-10-08, on Studio › Look › Background (DECISION_LOG "LOOK › BACKGROUND, AMENDED"): *"Color Picker can be
 * 2. so it can become ombre to do dawn/diagonal/glow for the 2 colors"* · *"Just place 2 circle palette like moodboard
 * where they pick the color there"*. Approved prototype `background_sources_amend_2026-10-08_fable.html`, frames A01–A03.
 *
 *   · circle 1 — the page colour (always there);
 *   · →  circle 2 — the colour the blend runs to: a ringed "+" until one is set, then the colour with a ✕ that
 *     takes it off in ONE tap.
 * Each circle is the Mood Board's own: a 44-px target around a 28-px colour (`mood-board-studio.tsx`). A tap opens the
 * ONE colour sheet; the second's sheet also carries "Remove the second colour". Opening writes nothing — a pick is
 * handed to the panel, which draws it on the sample screen and saves it (one draft write).
 */
export function BgColourWells({
  first,
  second,
  palette,
  firstReset = null,
  onFirst,
  onSecond,
  onRemoveSecond,
}: {
  /** The page colour as it paints (the couple's own, else the Mood Board's). */
  first: string;
  /** The second colour, or null — the blend then ramps the first colour alone. */
  second: string | null;
  /** The Mood Board's five — the sheet's first row. */
  palette: readonly string[];
  /** One way back for the first colour ("Use your Mood Board’s") — only while the couple set their own. */
  firstReset?: { label: string; onReset: () => void } | null;
  onFirst: (hex: string) => void;
  onSecond: (hex: string) => void;
  onRemoveSecond: () => void;
}) {
  const [open, setOpen] = useState<1 | 2 | null>(null);
  const quiet = 'sn-press inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink';
  return (
    <span data-bg-colour-wells={second ? 'two' : 'one'} className="flex items-center gap-1.5">
      <button
        type="button"
        data-bg-colour-well="1"
        aria-haspopup="dialog"
        aria-label={`Page colour ${first} — change it`}
        onClick={() => setOpen(1)}
        className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full"
      >
        <i aria-hidden className="h-7 w-7 rounded-full border border-ink/10" style={{ background: first }} />
      </button>
      <span aria-hidden className="text-[13px] text-ink/45">
        →
      </span>
      {second ? (
        <span className="relative inline-flex">
          <button
            type="button"
            data-bg-colour-well="2"
            aria-haspopup="dialog"
            aria-label={`Second colour ${second} — change it`}
            onClick={() => setOpen(2)}
            className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full"
          >
            <i aria-hidden className="h-7 w-7 rounded-full border border-ink/10" style={{ background: second }} />
          </button>
          {/* ✕ — one tap. A small mark with a finger-sized target around it (`after:`), beside the circle, never inside its button. */}
          <button
            type="button"
            data-bg-colour-remove=""
            aria-label="Remove the second colour"
            onClick={onRemoveSecond}
            className="sn-press absolute -right-1 -top-1 flex h-[18px] min-h-0 w-[18px] items-center justify-center rounded-full bg-ink text-cream ring-2 ring-cream after:absolute after:-inset-2.5 after:content-['']"
          >
            <X aria-hidden className="h-2.5 w-2.5" strokeWidth={3} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          data-bg-colour-well="add"
          aria-haspopup="dialog"
          aria-label="Add a second colour"
          onClick={() => setOpen(2)}
          className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full"
        >
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full text-terracotta-700 ring-1 ring-ink/25">
            <Plus className="h-4 w-4" strokeWidth={2.25} />
          </span>
        </button>
      )}
      {open === 1 ? (
        <ColourPickerSheet
          title="Page colour"
          job="Behind every page · the first colour of a blend"
          current={first}
          palette={palette}
          fromPhotos={[]}
          onPick={(hex) => {
            setOpen(null);
            onFirst(hex);
          }}
          onClose={() => setOpen(null)}
          extra={
            firstReset ? (
              <button
                type="button"
                data-bg-colour-reset=""
                onClick={() => {
                  setOpen(null);
                  firstReset.onReset();
                }}
                className={quiet}
              >
                {firstReset.label}
              </button>
            ) : null
          }
        />
      ) : null}
      {open === 2 ? (
        <ColourPickerSheet
          title="Second colour"
          job="The blend runs from the first colour to this one"
          /* Not set yet: the sheet opens on the first colour — the blend's own start. */
          current={second ?? first}
          palette={palette}
          fromPhotos={[]}
          onPick={(hex) => {
            setOpen(null);
            onSecond(hex);
          }}
          onClose={() => setOpen(null)}
          extra={
            second ? (
              <button
                type="button"
                data-bg-colour-remove-sheet=""
                onClick={() => {
                  setOpen(null);
                  onRemoveSecond();
                }}
                className={quiet}
              >
                <Undo2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                Remove the second colour
              </button>
            ) : null
          }
        />
      ) : null}
    </span>
  );
}
