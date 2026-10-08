'use client';

import type { ComponentType } from 'react';
import { Armchair, BookOpen, Clock, FileText, Gift, LayoutGrid, MailCheck, Palette, PersonStanding, Printer } from 'lucide-react';
import { PageCard } from '@/app/_components/page-card';
import type { StudioTileKey, StudioTileModel } from '@/lib/studio-tiles';
import { formatCount } from '@/lib/format-number';
import { STUDIO_PAGE_CARDS, STUDIO_TILE_UNREAD } from '@/lib/studio-page-cards';
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
 *   [▣ Info · Ready      Your names, the first words…  ] ⓘ     one column on a phone, two from 768 px
 *
 * 🚪 EACH TILE IS A PAGE CARD (owner 2026-10-08: *"Logo / Topic / Description and a small (i) that will give a more
 * detailed explanation"* · *"looks like an app button"*; the template `app/_components/page-card.tsx`, the designer's
 * eleven `lib/studio-page-cards.ts`): its mark — DISTINCT for each page — its name, one plain line of what is done
 * there, Ready or Missing with its word, and the ⓘ beside it. The name, ✓ / Missing and which pages an event draws
 * are all handed in (`lib/studio-tiles.ts`, built on the server from the SAME "done" the Event Details rows read).
 * A tap opens that tool (the shell opens the shipped editor); Wedding March and Seat plan say "Full screen". A tile
 * whose fact could not be read SAYS so and wears no mark at all — never a Missing nobody measured.
 * (The tile's live line — "2 tables · 14 seated" — is still the Tool ▾'s; the card says what the page is FOR.)
 *
 * ⚡ Loaded when Studio is first opened (`details-lazy.tsx`, the `maker-details` chunk) — never in the Maker's first
 * load. 🔒 Opening it writes nothing and asks nothing; a card opens its page exactly as the tile did.
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

/** One mark a page — never two pages sharing one (the designer's eleven, on icons the app already draws). */
export const TILE_ICON: Record<StudioTileKey, TileIcon> = {
  info: FileText,
  look: Palette,
  logo: MonogramIcon,
  mood: LayoutGrid,
  schedule: Clock,
  story: BookOpen,
  march: PersonStanding,
  seats: Armchair,
  gifts: Gift,
  rsvp: MailCheck,
  prints: Printer,
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
      {/* One column on a phone (two cannot hold a sentence and a 44-px ⓘ); two from 768 px. */}
      <ul data-studio-cards="" className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-2.5">
        {tiles.map((t) => {
          const Icon = TILE_ICON[t.key];
          const card = STUDIO_PAGE_CARDS[t.key];
          return (
            <li key={t.key} className="min-w-0">
              <PageCard
                data={t.key}
                mark={<Icon aria-hidden strokeWidth={1.9} />}
                topic={t.label}
                description={card.description}
                /* A fact that could not be read is said on the card — never drawn as an ordinary, untouched page. */
                problem={t.status === STUDIO_TILE_UNREAD ? STUDIO_TILE_UNREAD : null}
                tag={t.immersive ? 'Full screen' : null}
                badge={t.done === true ? { tone: 'ok', word: 'Ready' } : t.done === false ? { tone: 'wait', word: 'Missing' } : null}
                about={{
                  words: (
                    <>
                      <p>{card.controls}</p>
                      <p>
                        <b className="font-semibold text-ink">Guests see it:</b> {card.seenAt}
                      </p>
                      <p>
                        <b className="font-semibold text-ink">Do this first:</b> {card.first}
                      </p>
                    </>
                  ),
                }}
                onOpen={() => onOpen(t.key)}
                attrs={{ 'data-studio-tile': t.key, 'data-studio-done': t.done === undefined ? 'unread' : t.done ? 'yes' : 'no' }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
