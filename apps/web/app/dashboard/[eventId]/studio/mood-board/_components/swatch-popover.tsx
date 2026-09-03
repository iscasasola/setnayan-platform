'use client';

/**
 * One swatch, everywhere a couple picks a color on the board — the majors
 * (section 00, via `<MajorsEditor>`) and every role (section 02, via
 * `<PaletteSection>`). One component so "tap to change, copy, paste, swap,
 * or search by name" behaves identically no matter which swatch it's on —
 * the prototype's own "one popover serves every swatch" principle, done as
 * a inline expanding panel instead of the reference's draggable HSV square:
 * this codebase's established swatch pattern is a native
 * `<input type="color">` (see the pre-MB5 `palette-editor.tsx`), and
 * rebuilding a custom drag-square picker is out of proportion for a port —
 * noted here rather than silently done.
 *
 * `interactive.enabled = false` (the majors) hides copy/paste/swap and the
 * "your theme colors" quick-pick row — those exist to pull a MAJOR into a
 * ROLE; a major offering itself back is not a real action, and the
 * one-directional rule blocks the write anyway (see
 * `mood-board-board-ops.ts`). Search-by-name is available everywhere.
 */

import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import { nearestColorName } from '@/lib/color-names';
import { searchColorNames } from '@/lib/color-search';
import type { PaletteKey } from '@/lib/mood-board';
import { usePaletteBoard } from './palette-board-context';

type Props = {
  paletteKey: PaletteKey;
  index: number;
  hex: string;
  onChange: (hex: string) => void;
  onRemove?: () => void;
  removeLabel?: string;
  slotLabel?: string;
  interactive: { enabled: boolean };
};

export function SwatchPopover({ paletteKey, index, hex, onChange, onRemove, removeLabel, slotLabel, interactive }: Props) {
  const board = usePaletteBoard();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const name = nearestColorName(hex) ?? hex.toUpperCase();
  const results = query.trim() ? searchColorNames(query) : null;

  const isSwapSource =
    interactive.enabled && board?.swapSource?.key === paletteKey && board.swapSource.index === index;
  const swapPending = interactive.enabled && board?.swapSource != null;

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-cream p-1.5 pr-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
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
        <div
          role="dialog"
          aria-label={`Choose a color${slotLabel ? ` for ${slotLabel}` : ''}`}
          className="absolute left-0 top-full z-20 mt-1 w-64 space-y-3 rounded-xl border border-ink/15 bg-white p-3 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hex}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`Pick a color${slotLabel ? ` for ${slotLabel}` : ''}`}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-ink/10 p-0.5"
            />
            <input
              type="text"
              value={hex.toUpperCase()}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
              }}
              maxLength={7}
              spellCheck={false}
              aria-label="Hex color code"
              className="min-w-0 flex-1 rounded-md border border-ink/15 px-2 py-1.5 text-xs font-mono uppercase text-ink focus:border-terracotta focus:outline-none"
            />
          </div>
          <p className="text-xs text-ink/60">{name}</p>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono uppercase tracking-[0.15em] text-ink/45">
              Search by color name
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. moss green, burgundy…"
              className="w-full rounded-md border border-ink/15 px-2 py-1.5 text-xs text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
            />
            {results ? (
              results.matches.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {results.matches.map((m) => (
                    <button
                      key={m.hex}
                      type="button"
                      onClick={() => {
                        onChange(m.hex);
                        setQuery('');
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-ink/15 py-1 pl-1.5 pr-2 text-[11px] text-ink hover:border-terracotta"
                    >
                      <span
                        aria-hidden
                        className="h-3 w-3 rounded-full border border-ink/15"
                        style={{ background: m.hex }}
                      />
                      {m.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-[11px] text-ink/55">
                    No color named that{results.suggestions.length > 0 ? ' — here are the closest' : ''}.
                  </p>
                  {results.suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {results.suggestions.map((m) => (
                        <button
                          key={m.hex}
                          type="button"
                          onClick={() => {
                            onChange(m.hex);
                            setQuery('');
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/20 py-1 pl-1.5 pr-2 text-[11px] text-ink/70 hover:border-terracotta"
                        >
                          <span
                            aria-hidden
                            className="h-3 w-3 rounded-full border border-ink/15"
                            style={{ background: m.hex }}
                          />
                          {m.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            ) : null}
          </div>

          {interactive.enabled && board ? (
            <div className="space-y-2 border-t border-ink/10 pt-2">
              {board.majors.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink/45">
                    Your theme colors
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {board.majors.map((m, i) => (
                      <button
                        key={`${m}-${i}`}
                        type="button"
                        onClick={() => onChange(m)}
                        aria-label={`Match your ${nearestColorName(m) ?? m} major color`}
                        className="h-6 w-6 rounded-full border border-ink/15"
                        style={{ background: m }}
                        title={nearestColorName(m) ?? m}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => board.copyToClipboard(hex, name)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink/65 hover:bg-ink/5 hover:text-terracotta"
                >
                  <Copy className="h-3 w-3" strokeWidth={2} />
                  Copy
                </button>
                {board.clipboard ? (
                  <button
                    type="button"
                    onClick={() => board.pasteFrom(paletteKey, index)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-ink/65 hover:bg-ink/5 hover:text-terracotta"
                  >
                    <span aria-hidden className="h-3 w-3 rounded-full border border-ink/15" style={{ background: board.clipboard.hex }} />
                    Paste {board.clipboard.name}
                  </button>
                ) : null}
                {isSwapSource ? (
                  <button
                    type="button"
                    onClick={() => board.cancelSwap()}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-terracotta hover:bg-terracotta/10"
                  >
                    Cancel swap
                  </button>
                ) : swapPending ? (
                  <button
                    type="button"
                    onClick={() => board.commitSwap(paletteKey, index)}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-terracotta hover:bg-terracotta/10"
                  >
                    ⇄ Swap here
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => board.beginSwap(paletteKey, index)}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-ink/65 hover:bg-ink/5 hover:text-terracotta"
                  >
                    ⇄ Swap with another role
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-md border border-ink/10 px-2 py-1.5 text-xs font-medium text-ink/65 hover:bg-ink/5"
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
