'use client';

/**
 * THE KEEPSAKE ROW — Magazine · Recap · Flash · Thank You, under the Memories pinned row (owner 2026-10-31, "Build
 * both": the row, and the + Add cell in the grid). HOSTS ONLY — the page draws it inside its host branch.
 *
 * Four equal buttons, icon + one word. A press opens THAT shipped card, unchanged, in the house sheet (`Sheet` — its
 * scrim is the one `OverlayBackdrop`, and it draws itself into <body>, so it clears the event bar): Photo Notes
 * Magazine, Your Recap, This day as a flash, and the Thank-You Video door that left the ⚙ for this row. The cards were
 * the stack at the BOTTOM of the page ("Made from your memories"); that stack is gone — every card and its gating moved
 * here, nothing was lost.
 *
 * Which doors, in what order, and why a door is dimmed: `lib/memories-keepsakes.ts` (from each card's own read). A
 * dimmed door says why in its ⓘ and opens nothing — never silently missing. Held by `memories-keepsake-row.test.ts`.
 */

import { useId, useState, type ReactNode } from 'react';
import { BookHeart, Clapperboard, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import type { KeepsakeDoor, KeepsakeKey } from '@/lib/memories-keepsakes';

const ICONS: Record<KeepsakeKey, LucideIcon> = {
  magazine: BookHeart,
  recap: Sparkles,
  flash: Zap,
  'thank-you': Clapperboard,
};

/**
 * The shipped cards, server-rendered, by door — a RECORD, never a list: an element carried inside an array across the
 * server/client line is checked for a list `key` (measured: "Each child in a list should have a unique key").
 */
export type KeepsakeCards = Partial<Record<KeepsakeKey, ReactNode>>;

const CELL =
  'flex min-h-[60px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[12.5px] font-medium leading-none';

export function MemoriesKeepsakeRow({ doors, cards }: { doors: KeepsakeDoor[]; cards: KeepsakeCards }) {
  const [open, setOpen] = useState<KeepsakeKey | null>(null);
  const heading = useId();
  if (doors.length === 0) return null;
  const opened = open ? doors.find((d) => d.key === open && d.ready) ?? null : null;
  return (
    <>
      <nav
        aria-label="Made from your memories"
        data-memories-keepsakes=""
        className="grid gap-2 pb-3"
        style={{ gridTemplateColumns: `repeat(${doors.length}, minmax(0, 1fr))` }}
      >
        {doors.map((d) => {
          const Icon = ICONS[d.key];
          return d.ready ? (
            <button
              key={d.key}
              type="button"
              onClick={() => setOpen(d.key)}
              aria-haspopup="dialog"
              aria-label={d.title}
              data-keepsake={d.key}
              data-keepsake-ready="true"
              className={`${CELL} sn-press border border-ink/15 bg-ink/[0.03] text-ink hover:bg-ink/[0.06]`}
            >
              <Icon aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.9} />
              <span className="max-w-full truncate">{d.word}</span>
            </button>
          ) : (
            // Dimmed: nothing to open YET — the word carries its ⓘ (the reason), and no frame (nothing to press but the ⓘ).
            // ⚠ Never `aria-disabled` on this wrapper: it disables everything inside it, the ⓘ too (measured, WebKit).
            <div key={d.key} data-keepsake={d.key} data-keepsake-ready="false" className={`${CELL} text-ink/45`}>
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.9} />
              <InfoTip label={d.word} ariaLabel={`Why ${d.title} isn’t ready`} labelClassName="max-w-full truncate" align="center">
                {d.reason}
              </InfoTip>
            </div>
          );
        })}
      </nav>
      {opened ? (
        <Sheet open onClose={() => setOpen(null)} labelledById={heading} title={opened.title} wide>
          <h2 id={heading} className="sr-only">
            {opened.title}
          </h2>
          <div className="px-4 pb-4 pt-3" data-keepsake-sheet={opened.key}>
            {cards[opened.key] ?? null}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
