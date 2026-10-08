'use client';

import type { ComponentType } from 'react';
import { Armchair, Clock, FileText, Gift, Heart, LayoutGrid, PersonStanding, Reply } from 'lucide-react';
import type { StudioTileKey, StudioTileModel } from '@/lib/studio-tiles';
import { formatCount } from '@/lib/format-number';
import { STUDIO_PAGE_BG } from '@/lib/studio-skin';

/**
 * 🗂 THE STUDIO HOME — the new Maker's Studio side opens on its tiles (owner
 * 2026-10-06, verbatim: *"studio, will have the same top nav, but a different
 * approach on the 10 studio pages"* → *"1. tiles · 2. yes for those 2"* → *"yes
 * add prints as the eleventh tile"*; DECISION_LOG "STUDIO OPENS ON A HOME OF TEN
 * TILES…" + "PRINTS IS THE ELEVENTH STUDIO TILE"; prototype
 * `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html` `studioHome()`).
 *
 *   Studio                                   n of 11 ready
 *   [ Info ✓ ] [ Look ✓ ] [ Logo · Missing ] …   two columns, full width
 *
 * Each tile: its picture, ✓ or Missing, its name and one live line — all handed
 * in (`lib/studio-tiles.ts`, built on the server from the SAME "done" the Event
 * Details rows read). A tap opens that tool (the shell opens the shipped editor);
 * Wedding March and Seat plan say "Full screen". A tile whose fact could not be
 * read wears no mark at all — never a Missing nobody measured.
 *
 * ⚡ Loaded when Studio is first opened (`details-lazy.tsx`, the `maker-details`
 * chunk) — never in the Maker's first load. 🔒 Opening it writes nothing.
 */
type TileIcon = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;

/** The Logo's mark in the prototype (`i-logo`): a ring with an M — the monogram it makes. */
function MonogramIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 15.5v-7l3.5 4.5 3.5-4.5v7" />
    </svg>
  );
}

/** The prototype's icons (`ICON[k]`): Look and the Mood Board share the board mark, Prints the form. */
export const TILE_ICON: Record<StudioTileKey, TileIcon> = {
  info: FileText,
  look: LayoutGrid,
  logo: MonogramIcon,
  mood: LayoutGrid,
  schedule: Clock,
  story: Heart,
  march: PersonStanding,
  seats: Armchair,
  gifts: Gift,
  rsvp: Reply,
  prints: FileText,
};

export function StudioHome({ tiles, onOpen }: { tiles: readonly StudioTileModel[]; onOpen: (key: StudioTileKey) => void }) {
  const ready = tiles.filter((t) => t.done === true).length;
  return (
    <div data-studio-home="" className={`h-full overflow-y-auto overscroll-contain ${STUDIO_PAGE_BG} px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3`}>
      <div className="flex items-baseline justify-between px-1 pb-3 pt-1">
        <h2 className="font-serif text-[26px] font-medium leading-none text-ink">Studio</h2>
        <p className="text-[12.5px] font-semibold text-success-700" data-studio-ready="">
          {formatCount(ready)} of {formatCount(tiles.length)} ready
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => {
          const Icon = TILE_ICON[t.key];
          return (
            <li key={t.key} className="contents">
              <button
                type="button"
                data-studio-tile={t.key}
                data-studio-done={t.done === undefined ? 'unread' : t.done ? 'yes' : 'no'}
                onClick={() => onOpen(t.key)}
                className={`sn-press relative flex min-h-28 flex-col items-start gap-1 rounded-2xl bg-cream py-3 pl-3.5 pr-3 text-left ring-1 transition-shadow duration-sn-control ease-sn ${
                  t.done === false ? 'ring-terracotta-700/25' : 'ring-ink/10'
                }`}
              >
                <span className="mb-1.5 flex w-full items-center justify-between">
                  <Icon aria-hidden className="h-[22px] w-[22px] text-gild" strokeWidth={1.9} />
                  {t.done === true ? (
                    <span className="rounded-full bg-success-600/12 px-2 py-[3px] text-[10.5px] font-bold text-success-700">✓</span>
                  ) : t.done === false ? (
                    <span className="rounded-full bg-terracotta-700/10 px-2 py-[3px] text-[10.5px] font-bold text-terracotta-700">Missing</span>
                  ) : null}
                </span>
                <span className="text-[15px] font-semibold leading-tight text-ink">{t.label}</span>
                <span className="text-[12px] leading-snug text-ink/70">{t.status}</span>
                {t.immersive ? (
                  <span className="absolute bottom-[9px] right-2.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink/50">Full screen</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
