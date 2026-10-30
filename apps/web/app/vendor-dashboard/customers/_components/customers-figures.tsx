'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * 📌 THE FIGURES ON CUSTOMERS' PINNED ROW — Dates · Money · QR (supplier dashboard v13, APPROVED 2026-10-29; DECISION_LOG
 * "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS COMPRESS INTO ONE PINNED ROW ON SCROLL": *"like on money, they get the
 * overdue to comin and received as a sompressed pinned row"* ⇒ Money "Received · To come · Overdue"; Dates the month's
 * booked · asking · days off; QR issued · claimed · pending).
 *
 * The SAME tile Events' doors draw (`customers-pin.tsx` `door()`), so the shared fold (`use-pin-fold.ts` + `pin-fold.css`)
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

// Sized by what it says (`flex-auto`, not Events' equal `flex-1`): a peso figure is wider than a count, and folded the
// three must sit on one 390-px line with the view ▾ and the ⚙ without cutting a word.
const TILE =
  'sn-press grid min-h-11 min-w-0 max-w-[6.5rem] flex-auto content-center gap-0.5 rounded-full px-0.5 py-1 text-center transition-colors duration-200 motion-reduce:transition-none';

// Folded, a figure is a touch smaller than Events' door (the prototype's own `.mini` sizes, 14.5 / 11): three figures, two
// of them pesos, share one 390-px line with the view ▾ and the ⚙. `!` because `pin-fold.css` sets the shared size.
const FOLDED_N = '[[data-folded]_&]:!text-[14.5px]';
const FOLDED_W = '[[data-folded]_&]:!text-[10.5px]';

function Tile({ f }: { f: CustomersFigure }) {
  const inner =
    f.value === null ? (
      <>
        <span className="block text-[20px] font-semibold leading-none" style={{ color: 'rgb(var(--color-warn))' }} aria-hidden data-pin-n="">
          —
        </span>
        <span className="block truncate text-[11.5px] text-ink/60" data-pin-w="" data-customers-figure-unread="">
          {f.word} · couldn&rsquo;t load
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
  const common = { className: `${TILE} [[data-folded]_&]:!gap-[3px] [[data-folded]_&]:!px-0`, 'data-customers-figure': f.key, 'data-pin-door': '' } as const;
  if (f.href) {
    return (
      <Link href={f.href} scroll {...common}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      {...common}
      onClick={() => {
        if (f.jump) window.dispatchEvent(new CustomEvent(DATES_JUMP_EVENT, { detail: f.jump }));
      }}
    >
      {inner}
    </button>
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
    <span className="flex min-w-0 flex-1 items-center gap-0.5" role="group" aria-label={label} data-customers-figures="">
      {shown.map((f) => (
        <Tile key={f.key} f={f} />
      ))}
    </span>
  );
}
