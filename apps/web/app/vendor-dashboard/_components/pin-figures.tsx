import Link from 'next/link';
import type { PinFigure } from '@/lib/pin-figure';

/**
 * 📌 A PAGE'S FIGURES ON ITS PINNED ROW (supplier dashboard v13, APPROVED 2026-10-29; DECISION_LOG "EVERY SUPPLIER-DASHBOARD
 * PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED ROW ON SCROLL"). The tile Customers' Dates · Money draw (S4,
 * `customers/_components/customers-figures.tsx`, PR #7066) — the same door shape as Events' counts — so the shared fold
 * (`use-pin-fold.ts` + `pin-fold.css`) folds them with no second copy of the look: `data-pin-door` on each, `data-pin-n` /
 * `data-pin-w` on its number and word.
 *
 * 🔁 ONE SHAPE, TWO FILES UNTIL #7066 LANDS: this is that tile without Dates' month events (`jump` / `live`), lifted to the
 * supplier frame's own folder so Shop's five sections use it. When #7066 is on main, Customers' figures should draw THIS
 * tile (or this file should re-export theirs) — not a third copy.
 *
 * A figure is a door, never a dead number ("A compressed figure still taps"): `href` = where its rows are.
 * HONEST: a figure the page could not read is "—" with "couldn't load", never 0 (`reads-are-honest.test.ts`).
 * 🔒 shop/the-shop-sections-are-v13.test.ts
 */
export type { PinFigure };

// Sized by what it says (`flex-auto`): a peso or a rating is wider than a count, and folded the three must sit on one
// 390-px line with the section ▾ and the ⚙ without cutting a word. Caps at 6.5rem so a laptop keeps the phone's proportions.
const TILE =
  'sn-press grid min-h-11 min-w-0 max-w-[6.5rem] flex-auto content-center gap-0.5 rounded-full px-0.5 py-1 text-center transition-colors duration-200 motion-reduce:transition-none [[data-folded]_&]:!gap-[3px] [[data-folded]_&]:!px-0';
const FOLDED_N = '[[data-folded]_&]:!text-[14.5px]';
const FOLDED_W = '[[data-folded]_&]:!text-[10.5px]';

function Tile({ f, name }: { f: PinFigure; name: string }) {
  const inner =
    f.value === null ? (
      <>
        <span className="block text-[20px] font-semibold leading-none" style={{ color: 'rgb(var(--color-warn))' }} aria-hidden data-pin-n="">
          —
        </span>
        {/* Customers' door says it the same way: "—" over "couldn't load"; which figure it is stays in the name. */}
        <span className={`block truncate text-[11.5px] text-ink/60 ${FOLDED_W}`} data-pin-w="" data-pin-figure-unread="">
          <span className="sr-only">{f.word} · </span>couldn&rsquo;t load
        </span>
      </>
    ) : (
      <>
        <span className={`block text-[20px] font-semibold leading-none tabular-nums ${FOLDED_N} ${f.hot ? 'text-sn-accent' : 'text-ink'}`} data-pin-n="">
          {f.value}
        </span>
        <span className={`block truncate text-[11.5px] text-ink/60 ${FOLDED_W}`} data-pin-w="">
          {f.short ? (
            <>
              <span className="[[data-folded]_&]:hidden">{f.word}</span>
              <span className="hidden [[data-folded]_&]:inline">{f.short}</span>
            </>
          ) : (
            f.word
          )}
        </span>
      </>
    );
  const common = { className: TILE, [`data-${name}-figure`]: f.key, 'data-pin-door': '' } as Record<string, string>;
  return (
    <Link href={f.href} scroll {...common}>
      {inner}
    </Link>
  );
}

/** The figures, in the doors' place on a pinned row. `name` keys the data hooks (`data-shop-figure="…"`). */
export function PinFigures({ figures, label, name }: { figures: readonly PinFigure[]; label: string; name: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-0.5" role="group" aria-label={label} data-pin-figures={name}>
      {figures.map((f) => (
        <Tile key={f.key} f={f} name={name} />
      ))}
    </span>
  );
}
