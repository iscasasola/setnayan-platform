import { PinDoor, PinDoors } from '@/app/_components/pinned-row/pin-door';
import type { PinFigure } from '@/lib/pin-figure';

/**
 * 📌 A PAGE'S FIGURES ON ITS PINNED ROW (supplier dashboard v13, APPROVED 2026-10-29; DECISION_LOG "EVERY SUPPLIER-DASHBOARD
 * PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED ROW ON SCROLL"). The tile Customers' Dates · Money draw (S4,
 * `customers/_components/customers-figures.tsx`, PR #7066) — the same door shape as Events' counts — so the shared fold
 * (`use-pin-fold.ts` + `pin-fold.css`) folds them with no second copy of the look: `data-pin-door` on each, `data-pin-n` /
 * `data-pin-w` on its number and word.
 *
 * 🔁 ONE DOOR (2026-10-31): Customers' figures and this file both draw the shared `PinDoor`
 * (`app/_components/pinned-row/pin-door.tsx`) — no tile of their own.
 *
 * A figure is a door, never a dead number ("A compressed figure still taps"): `href` = where its rows are.
 * HONEST: a figure the page could not read is "—" with "couldn't load", never 0 (`reads-are-honest.test.ts`).
 * 🔒 shop/the-shop-sections-are-v13.test.ts
 */
export type { PinFigure };

// 📌 THE ONE COUNT DOOR (owner 2026-10-30 "all yes", Q3): each figure is the shared `PinDoor` as a link — number + word,
// the door every pinned row draws. Was a two-line round tile of its own.
function Tile({ f, name }: { f: PinFigure; name: string }) {
  return <PinDoor value={f.value} word={f.word} short={f.short} hot={f.hot} href={f.href} mark={{ [`data-${name}-figure`]: f.key }} unreadMark="data-pin-figure-unread" />;
}

/** The figures, in the doors' place on a pinned row. `name` keys the data hooks (`data-shop-figure="…"`). */
export function PinFigures({ figures, label, name }: { figures: readonly PinFigure[]; label: string; name: string }) {
  return (
    <>
      <PinDoors label={label} mark={{ 'data-pin-figures': name }}>
        {figures.map((f) => (
          <Tile key={f.key} f={f} name={name} />
        ))}
      </PinDoors>
      <span className="min-w-0 flex-1" aria-hidden />
    </>
  );
}
