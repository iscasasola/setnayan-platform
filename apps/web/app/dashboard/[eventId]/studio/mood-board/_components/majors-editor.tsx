'use client';

/**
 * The majors editor — section 00's `major-colors` strip (atelier-board.html
 * `#majorColors`), ported into `<ThemeCard>`. These FIVE colors
 * (`palette.reception`) are the whole board's source of truth: every
 * derivable role in section 02 follows them (`hasChosenMajors`,
 * lib/mood-board.ts). This is the ONLY place that edits them — see
 * `palette-board-context.tsx`'s docblock on the one-directional rule.
 *
 * Renders nothing outside a `<PaletteBoardProvider>` (`usePaletteBoard()` is
 * `null`) — `<ThemeCard>`'s own standalone tests render it without one, and
 * must keep passing unchanged; see that component's comment.
 *
 * Starter-slot behaviour (MB3, carried over verbatim): a fresh board shows
 * `PALETTE_LIMITS.reception.min` (3) EMPTY dashed slots, not three real
 * colors nobody chose — "why can't i delete the first 3 colors. it is a
 * requirement to have at least 3. but start with blank." Filled slots are
 * always removable; there is no floor once the couple has acted.
 */

import { PALETTE_LIMITS } from '@/lib/mood-board';
import { nearestColorName } from '@/lib/color-names';
import { usePaletteBoard } from './palette-board-context';
import { SwatchPopover } from './swatch-popover';

const LIMITS = PALETTE_LIMITS.reception;

export function MajorsEditor() {
  const board = usePaletteBoard();
  if (!board) return null;

  const colors = board.palette.reception ?? [];
  const emptyStarterSlots = Math.max(0, LIMITS.min - colors.length);
  const canAddMore = colors.length < LIMITS.max && emptyStarterSlots === 0;

  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
        Your main colors
      </p>
      <div className="flex flex-wrap items-end gap-2" aria-label="Your five main colors">
        {colors.map((hex, i) => (
          <div key={`major-${i}`} className="flex flex-col items-stretch gap-1">
            {LIMITS.slotLabels?.[i] ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                {LIMITS.slotLabels[i]}
              </span>
            ) : null}
            <SwatchPopover
              paletteKey="reception"
              index={i}
              hex={hex}
              onChange={(h) => board.setMajorColor(i, h)}
              onRemove={() => board.removeMajorSlot(i)}
              removeLabel={`Remove ${nearestColorName(hex) ?? hex} — ${LIMITS.slotLabels?.[i] ?? `color ${i + 1}`}`}
              interactive={{ enabled: false }}
            />
          </div>
        ))}

        {emptyStarterSlots > 0
          ? Array.from({ length: emptyStarterSlots }).map((_, i) => {
              const slotIndex = colors.length + i;
              return (
                <div key={`major-empty-${slotIndex}`} className="flex flex-col items-stretch gap-1">
                  {LIMITS.slotLabels?.[slotIndex] ? (
                    <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/40">
                      {LIMITS.slotLabels[slotIndex]}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => board.addMajorSlot()}
                    aria-label={`Pick your ${LIMITS.slotLabels?.[slotIndex] ?? `color ${slotIndex + 1}`} — not yet chosen`}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-ink/25 text-ink/35 transition hover:border-terracotta hover:text-terracotta"
                  >
                    +
                  </button>
                </div>
              );
            })
          : null}

        {canAddMore ? (
          <button
            type="button"
            onClick={() => board.addMajorSlot()}
            aria-label="Add a major color"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-ink/25 text-ink/50 transition hover:border-terracotta hover:text-terracotta"
          >
            +
          </button>
        ) : null}
      </div>
      <p className="text-xs text-ink/50">
        {colors.length} / {LIMITS.min}–{LIMITS.max} — the palette below (in{' '}
        <a href="#palette" className="underline underline-offset-2 hover:text-terracotta">
          Palette
        </a>
        ) follows these automatically.
      </p>
    </div>
  );
}
