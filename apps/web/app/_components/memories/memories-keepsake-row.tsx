'use client';

/**
 * THE KEEPSAKE ROW — Magazine · Recap · Flash · Thank You, under the Papic block on Memories (owner 2026-10-31, "Build
 * both": the row, and the + Add cell in the grid; owner 2026-11-20, "memories approved": under Papic, and ONE sheet
 * shape — `prototypes/memories_redesign_2026-11-20/`). HOSTS ONLY — the page draws it inside its host branch.
 *
 * Four equal buttons, icon + one word, in the Papic block's white rounded look (`sn-frame` — a frame, because each is a
 * press). A press opens THAT shipped card in the house sheet (`Sheet` — its scrim is the one `OverlayBackdrop`, and it
 * draws itself into <body>, so it clears the event bar): Photo Notes Magazine, Your Recap, This day as a flash, and the
 * Thank-You Video.
 *
 * 🧾 ONE SHEET SHAPE (20 Nov): the handle · the card's icon and title ONCE, the Recap's PRIVATE mark beside it, and ✕ ·
 * the card's one line + ⓘ · one main button (each card's `seat="sheet"`). The repeated small-caps eyebrow and its rule
 * are gone; every word is kept ("Para sa inyo lang", the PRIVATE mark). Thank You's sheet carries the film itself — its
 * line and "Open your Thank-You Video" — instead of a row that opened another page.
 *
 * Which doors, in what order, and why a door is dimmed: `lib/memories-keepsakes.ts` (from each card's own read). A
 * dimmed door says why in its ⓘ and opens nothing — never silently missing. Held by `the-keepsakes-are-a-row.test.ts`.
 */

import { useId, useState, type ReactNode } from 'react';
import { BookHeart, Clapperboard, Sparkles, X, Zap, type LucideIcon } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { RecapPrivacyPill } from '@/app/dashboard/[eventId]/studio/papic/_components/recap-privacy-pill';
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
  'flex min-h-[58px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 text-[12.5px] font-medium leading-none';

export function MemoriesKeepsakeRow({ doors, cards }: { doors: KeepsakeDoor[]; cards: KeepsakeCards }) {
  const [open, setOpen] = useState<KeepsakeKey | null>(null);
  const heading = useId();
  if (doors.length === 0) return null;
  const opened = open ? doors.find((d) => d.key === open && d.ready) ?? null : null;
  const OpenedIcon = opened ? ICONS[opened.key] : null;
  // The one head: the card's icon and title once, the Recap's mark beside it, ✕ — never the small-caps eyebrow.
  const head =
    opened && OpenedIcon ? (
      <div className="flex min-w-0 items-center gap-2.5 pb-3 pl-5 pr-3" data-keepsake-sheet-head="">
        <OpenedIcon aria-hidden className="h-6 w-6 shrink-0 text-terracotta" strokeWidth={1.9} />
        <h2 id={heading} className="min-w-0 text-[22px] font-bold leading-tight text-ink [overflow-wrap:anywhere]">
          {opened.title}
        </h2>
        {opened.mark ? <RecapPrivacyPill published={opened.mark === 'public'} /> : null}
        <span className="flex-1" />
        <span className="inline-flex shrink-0" data-sheet-close="">
          <ActionButton tone="neutral" iconOnly icon={X} label="Close" onClick={() => setOpen(null)} />
        </span>
      </div>
    ) : null;
  return (
    <>
      <nav
        aria-label="Made from your memories"
        data-memories-keepsakes=""
        className="grid gap-2 pb-1 pt-3"
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
              className={`${CELL} sn-press bg-frame text-ink shadow-sn-frame`}
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
        <Sheet open onClose={() => setOpen(null)} labelledById={heading} head={head} wide>
          <div className="px-5 pb-5 pt-1" data-keepsake-sheet={opened.key}>
            {cards[opened.key] ?? null}
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
