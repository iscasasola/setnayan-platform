'use client';

import { useEffect, useState } from 'react';
import { PinDoor, PinDoors } from '@/app/_components/pinned-row/pin-door';

/**
 * 📌 THE FIGURES ON CUSTOMERS' PINNED ROW — Dates · Money · QR (supplier dashboard v13, APPROVED 2026-10-29; DECISION_LOG
 * "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED ROW ON SCROLL": *"like on money, they get the
 * overdue to comin and received as a sompressed pinned row"* ⇒ Money "Received · To come · Overdue"; Dates the month's
 * booked · asking · days off; QR issued · claimed · pending).
 *
 * The SAME door Events' counts draw (`PinDoor`, the one door since 2026-10-30), so the shared fold (`use-pin-fold.ts` + `pin-fold.css`)
 * folds these with no second copy of the look: `data-pin-door` on each, `data-pin-n` / `data-pin-w` on its number and
 * word. A figure is a door, never a dead number (the ruling: "A compressed figure still taps"):
 *   · `href`   — a link to where that figure's rows are (Money's rows, the Issued fold);
 *   · `jump`   — Dates only: the month (a client component) picks the first day of that kind. The month owns the figures
 *                (they follow ‹ ›), so the two speak through two window events instead of one lifting the other's state:
 *                the month says `DATES_FIGURES_EVENT` whenever its counts change, a tap says `DATES_JUMP_EVENT`.
 *
 * HONEST: a figure the page could not read is "—", never 0 (`reads-are-honest.test.ts`).
 *
 * 🔒 customers/the-customers-figures-are-the-pinned-row.test.ts
 */

export type CustomersFigure = {
  key: string;
  /** Already worded ("3", "₱53K"), or null = not read — drawn "—", never 0. */
  value: string | null;
  word: string;
  /**
   * The word on the FOLDED line, when the full one cannot fit beside a peso figure at 390 px — Money's "to come" (the
   * owner's own word for the compressed row: *"Received ₱… · To come ₱… · Overdue ₱…"*). Absent → the full word.
   */
  short?: string;
  /** The brand colour — the figure that waits on the shop. */
  hot?: boolean;
  /** Where the figure's rows are. */
  href?: string;
  /** Dates: which kind of day a tap picks. */
  jump?: string;
};

/** The month → the row: its figures, re-counted for the month on show. */
export const DATES_FIGURES_EVENT = 'sn:dates-figures';
/** The row → the month: pick the first day of this kind. */
export const DATES_JUMP_EVENT = 'sn:dates-jump';

// 📌 THE ONE COUNT DOOR (owner 2026-10-30 "all yes", Q3): a figure is drawn by the shared `PinDoor` — number + word,
// the same door Events' counts and every other pinned row draw. Was its own two-line round tile.
function Tile({ f }: { f: CustomersFigure }) {
  const mark = { 'data-customers-figure': f.key } as const;
  if (f.href) {
    return <PinDoor value={f.value} word={f.word} short={f.short} hot={f.hot} href={f.href} mark={mark} unreadMark="data-customers-figure-unread" />;
  }
  return (
    <PinDoor
      value={f.value}
      word={f.word}
      short={f.short}
      hot={f.hot}
      onTap={() => {
        if (f.jump) window.dispatchEvent(new CustomEvent(DATES_JUMP_EVENT, { detail: f.jump }));
      }}
      mark={mark}
      unreadMark="data-customers-figure-unread"
    />
  );
}

export function CustomersFigures({ figures, live = false, label }: { figures: readonly CustomersFigure[]; live?: boolean; label: string }) {
  const [shown, setShown] = useState(figures);
  useEffect(() => setShown(figures), [figures]);
  // Dates: the month re-counts on ‹ › and says so — the row follows it (never the month the page first drew).
  useEffect(() => {
    if (!live) return;
    const on = (e: Event) => {
      const next = (e as CustomEvent<CustomersFigure[]>).detail;
      if (Array.isArray(next)) setShown(next);
    };
    window.addEventListener(DATES_FIGURES_EVENT, on);
    return () => window.removeEventListener(DATES_FIGURES_EVENT, on);
  }, [live]);
  return (
    <>
      <PinDoors label={label} mark={{ 'data-customers-figures': '' }}>
        {shown.map((f) => (
          <Tile key={f.key} f={f} />
        ))}
      </PinDoors>
      <span className="min-w-0 flex-1" aria-hidden />
    </>
  );
}
