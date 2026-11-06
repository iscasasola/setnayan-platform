'use client';

/**
 * find-inspiration.tsx — 💡 THE INSPIRATION BOX IN SUPPLIERS › FIND, frames A and B of the owner-approved prototype
 * `prototypes/inspiration_in_find_2026-10-28/` (DECISION_LOG 2026-10-28 "INSPIRATION LIVES IN SUPPLIERS › FIND",
 * "FINAL FRAMES A–F APPROVED"). The facts and the words are `lib/find-inspiration.ts`; this file only draws them.
 *
 *   A · `FindInspirationRow` — one row on top of Find: a stack of up to three covers, "Your inspiration board",
 *       "24 photos · 6 parts · 3 from your suppliers", ›. It opens the whole board (`findBoardHref`, a sheet on Find).
 *   B · `FindInspirationStrip` — first inside an opened category: "INSPIRATION · See all ›", then one tile per part that
 *       holds photos (cover · "On your list" · name · "N photos"), ＋ Add a part last. A category with parts and no
 *       photos yet still draws ＋ Add a part, so the box is always reachable where its parts live.
 *   C · `InspirationBoardSheet` — the whole board: the SHIPPED `InspirationBoard` (Studio › Mood Board's), rendered
 *       whole inside the house `Sheet`; closing it takes `?board=1` off the address and nothing else.
 *
 * 🔑 A refused read is said in words (`FIND_INSPIRATION_WORDS.unread`), never drawn as an empty board. Frames only on
 * what you press: the row and each tile are pressable; the strip itself is not framed.
 */
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { Explain } from '@/app/_components/explain';
import {
  FIND_BOARD_PARAM,
  FIND_INSPIRATION_WORDS as W,
  inspirationRowLine,
  partCountLine,
  type FindInspiration,
} from '@/lib/find-inspiration';

/** A — "Your inspiration board", the first row of Find. */
export function FindInspirationRow({ board, href }: { board: FindInspiration; href: string }) {
  const covers = board.read === 'ok' ? board.covers : [];
  return (
    <div className="mb-3 flex items-center gap-1" data-find-inspiration-row="" data-tour="suppliers-inspiration">
      <Link
        href={href}
        scroll={false}
        className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 rounded-2xl bg-ink/[0.04] px-3 py-2.5 hover:bg-ink/[0.06]"
      >
        <span className="relative flex h-11 w-[68px] shrink-0 items-center" aria-hidden>
          {covers.length > 0 ? (
            covers.map((src, i) => (
              <span
                key={src + i}
                className="absolute top-0 h-11 w-9 overflow-hidden rounded-lg bg-ink/10 shadow-sm ring-2 ring-white"
                style={{ left: `${i * 16}px`, zIndex: 3 - i }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
            ))
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink/[0.06] text-ink/45">
              <Plus className="h-4 w-4" strokeWidth={2} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{W.rowTitle}</span>
          <span
            className={`block text-[13px] leading-snug ${board.read === 'unread' ? 'text-terracotta-700' : 'text-ink/60'}`}
            role={board.read === 'unread' ? 'alert' : undefined}
            data-find-inspiration-line=""
          >
            {inspirationRowLine(board)}
          </span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
      </Link>
      <Explain title={W.rowTitle} data="find-inspiration">
        {W.info}
      </Explain>
    </div>
  );
}

/** B — the opened category's Inspiration strip, above its suppliers. Draws nothing for a category with no parts. */
export function FindInspirationStrip({ board, tile, href }: { board: FindInspiration | null; tile: string; href: string }) {
  if (!board) return null;
  if (board.read === 'unread') {
    return (
      <p role="alert" className="mb-2 text-[13px] text-terracotta-700" data-find-inspiration-strip="unread">
        {W.unread}
      </p>
    );
  }
  if (!board.partTiles.includes(tile)) return null;
  const parts = board.byTile[tile] ?? [];
  return (
    <div className="mb-3" data-find-inspiration-strip={tile}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">{W.stripHead}</p>
        {parts.length > 0 ? (
          <Link href={href} scroll={false} className="inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-terracotta-700">
            {W.seeAll} ›
          </Link>
        ) : null}
      </div>
      <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="list">
        {parts.map((p) => (
          <li key={p.slotKey} className="w-[104px] shrink-0 snap-start" data-find-inspiration-part={p.slotKey}>
            <Link href={href} scroll={false} className="block rounded-xl p-1 hover:bg-ink/[0.04]">
              <span className="relative block h-[104px] overflow-hidden rounded-lg bg-ink/[0.06]">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
                {p.onList ? (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-cream px-1.5 py-0.5 text-[10px] font-semibold text-success-900" data-find-inspiration-onlist="">
                    {W.onList}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block truncate text-[13px] font-medium text-ink">{p.label}</span>
              <span className="block text-[11.5px] text-ink/55">{partCountLine(p.count)}</span>
            </Link>
          </li>
        ))}
        <li className="w-[104px] shrink-0 snap-start" data-find-inspiration-add="">
          <Link href={href} scroll={false} className="block rounded-xl p-1 hover:bg-ink/[0.04]">
            <span className="flex h-[104px] items-center justify-center rounded-lg bg-ink/[0.04] text-ink/50">
              <Plus className="h-5 w-5" strokeWidth={1.9} aria-hidden />
            </span>
            <span className="mt-1 block text-[13px] font-medium text-ink">{W.addPart}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}

/** C — the whole board in the house sheet. `children` is the shipped board, rendered on the server. */
export function InspirationBoardSheet({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const titleId = useId();
  const close = () => {
    const q = new URLSearchParams(search.toString());
    q.delete(FIND_BOARD_PARAM);
    const rest = q.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  };
  return (
    <Sheet open onClose={close} labelledById={titleId} full>
      <div className="px-5 pb-[calc(1rem+var(--sn-safe-b,0px))] pt-5" data-find-inspiration-board="">
        <h2 id={titleId} className="pr-12 text-[17px] font-semibold text-ink">
          {W.sheetTitle}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </Sheet>
  );
}
