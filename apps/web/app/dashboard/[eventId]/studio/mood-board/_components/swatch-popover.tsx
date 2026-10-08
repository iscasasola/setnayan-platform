'use client';

/**
 * One swatch, everywhere a couple picks a color on the board — the majors
 * (section 00, via `<MajorsEditor>`), every role (section 02, via
 * `<PaletteSection>`) and the Story Maker's Theme step. One component so "tap
 * to change, copy, paste, swap, or search by name" behaves identically no
 * matter which swatch it is on.
 *
 * 🎨 ITS OWN POPOVER IS RETIRED (owner 2026-10-08 "restudy is good" —
 * `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 6 row 4: *"Retire `ColourWell`,
 * `SwatchPopover`, `StudioMainColours` in favour of `ColourPickerSheet`"*). The
 * swatch is now only the TRIGGER: a tap opens the ONE colour picker — Your Mood
 * Board · Goes with your Mood Board · Swatches · Custom (the wheel and the code
 * this popover used to draw itself). What only this swatch does rides in the
 * sheet's own quiet row (`extra`), nothing dropped: Search by color name, and on
 * a role Copy · Paste · Swap with another role.
 *
 * `interactive.enabled = false` (the majors) hides copy/paste/swap and the
 * board's colours as suggestions — those exist to pull a MAJOR into a ROLE; a
 * major offering itself back is not a real action, and the one-directional rule
 * blocks the write anyway (see `mood-board-board-ops.ts`). Search-by-name is
 * available everywhere.
 */

import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import { nearestColorName } from '@/lib/color-names';
import { searchColorNames } from '@/lib/color-search';
import type { PaletteKey } from '@/lib/mood-board';
import { usePaletteBoard } from './palette-board-context';
import { ColourPickerSheet } from './colour-picker-sheet';
import { useOneOpen } from '@/lib/one-open';

type Props = {
  paletteKey: PaletteKey;
  index: number;
  hex: string;
  onChange: (hex: string) => void;
  onRemove?: () => void;
  removeLabel?: string;
  slotLabel?: string;
  /**
   * "From your mood board" — colours to offer as a one-tap quick-pick, for
   * callers OUTSIDE the board's own provider (the Story Maker's Theme step).
   *
   * 🔑 IT IS A SEPARATE PROP FROM `interactive.enabled` ON PURPOSE. On the board
   * itself that row comes from `board.majors` and is suppressed on the majors,
   * because a major offering itself back is not a real action. The Story Maker
   * is the opposite case: its swatches are a DETACHED copy of the majors, so
   * pulling a saved board colour back is the most useful thing in the popover —
   * and it has no provider to read `majors` from. Omitted → nothing changes for
   * any existing call site.
   */
  moodBoardColors?: string[];
  interactive: { enabled: boolean };
};

export function SwatchPopover({ paletteKey, index, hex, onChange, onRemove, removeLabel, slotLabel, moodBoardColors, interactive }: Props) {
  const board = usePaletteBoard();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  useOneOpen(open, setOpen); // opening the picker closes an open dropdown — lib/one-open.ts

  const name = nearestColorName(hex) ?? hex.toUpperCase();
  const results = query.trim() ? searchColorNames(query) : null;

  const isSwapSource =
    interactive.enabled && board?.swapSource?.key === paletteKey && board.swapSource.index === index;
  const swapPending = interactive.enabled && board?.swapSource != null;

  /** A pick from this swatch's own row: change the colour, close the sheet. */
  const take = (next: string) => {
    onChange(next);
    setQuery('');
    setOpen(false);
  };
  const chip = (m: { hex: string; name: string }, dashed: boolean) => (
    <button
      key={m.hex}
      type="button"
      onClick={() => take(m.hex)}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border py-1 pl-2 pr-3 text-[12px] hover:border-terracotta ${
        dashed ? 'border-dashed border-ink/20 text-ink/70' : 'border-ink/15 text-ink'
      }`}
    >
      <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-ink/15" style={{ background: m.hex }} />
      {m.name}
    </button>
  );
  /* The board's own colours as the sheet's "Your Mood Board" shelf: the majors on a role (in slot
     order — they ARE the five), the saved board's for a caller outside the provider. */
  const fromBoard = interactive.enabled ? (board?.majors ?? []) : (moodBoardColors ?? []);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-cream p-1.5 pr-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${slotLabel ? `${slotLabel} — ` : ''}Change color, currently ${name}`}
          title={`${hex.toUpperCase()} — ${name}`}
          className={`h-9 w-9 shrink-0 cursor-pointer rounded-md border p-0.5 ${
            isSwapSource ? 'border-2 border-terracotta' : 'border-ink/10'
          }`}
          style={{ background: hex }}
        />
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel ?? `Remove ${name}`}
            className="rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-danger-700"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {open ? (
        <ColourPickerSheet
          title={slotLabel ?? 'Color'}
          job={name}
          current={hex}
          palette={fromBoard}
          slots={interactive.enabled}
          fromPhotos={NO_PHOTOS}
          onPick={take}
          onClose={() => setOpen(false)}
          extra={
            <div className="flex flex-col gap-3" data-swatch-extra="">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">
                  Search by color name
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. moss green, burgundy…"
                    className="mt-1.5 block min-h-11 w-full rounded-full bg-ink/5 px-4 text-[14px] font-normal normal-case tracking-normal text-ink placeholder:text-ink/35"
                  />
                </label>
                {results ? (
                  results.matches.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">{results.matches.map((m) => chip(m, false))}</div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[12px] text-ink/55">
                        No color named that{results.suggestions.length > 0 ? ' — here are the closest' : ''}.
                      </p>
                      {results.suggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">{results.suggestions.map((m) => chip(m, true))}</div>
                      ) : null}
                    </div>
                  )
                ) : null}
              </div>

              {interactive.enabled && board ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => board.copyToClipboard(hex, name)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full bg-ink/5 px-3 text-[12px] font-medium text-ink/70 hover:text-terracotta"
                  >
                    <Copy className="h-3 w-3" strokeWidth={2} />
                    Copy
                  </button>
                  {board.clipboard ? (
                    <button
                      type="button"
                      onClick={() => {
                        board.pasteFrom(paletteKey, index);
                        setOpen(false);
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ink/5 px-3 text-[12px] font-medium text-ink/70 hover:text-terracotta"
                    >
                      <span aria-hidden className="h-3 w-3 rounded-full border border-ink/15" style={{ background: board.clipboard.hex }} />
                      Paste {board.clipboard.name}
                    </button>
                  ) : null}
                  {isSwapSource ? (
                    <button
                      type="button"
                      onClick={() => {
                        board.cancelSwap();
                        setOpen(false);
                      }}
                      className="inline-flex min-h-9 items-center rounded-full bg-terracotta/10 px-3 text-[12px] font-medium text-terracotta-700"
                    >
                      Cancel swap
                    </button>
                  ) : swapPending ? (
                    <button
                      type="button"
                      onClick={() => {
                        board.commitSwap(paletteKey, index);
                        setOpen(false);
                      }}
                      className="inline-flex min-h-9 items-center rounded-full bg-terracotta/10 px-3 text-[12px] font-medium text-terracotta-700"
                    >
                      ⇄ Swap here
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        board.beginSwap(paletteKey, index);
                        setOpen(false);
                      }}
                      className="inline-flex min-h-9 items-center rounded-full bg-ink/5 px-3 text-[12px] font-medium text-ink/70 hover:text-terracotta"
                    >
                      ⇄ Swap with another role
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          }
        />
      ) : null}
    </div>
  );
}

const NO_PHOTOS: readonly string[] = [];
