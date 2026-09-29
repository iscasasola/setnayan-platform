'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { DetailsItemKey } from '@/lib/maker-details-items';

/**
 * 🧭 ONE ITEM OF DETAILS OPENS ANOTHER — in place (owner rule: *"no 'Edit in X
 * ↗' link-outs — the field sits where you are"*). A note like "Build your Mood
 * Board first" used to be a link out of the Maker to `/studio/mood-board`;
 * since Details part 3 the Mood Board is an item of Details, so the note picks
 * that item instead. `DetailsWorkspace` provides the picker; outside Details it
 * is null and the button is not drawn (a door that does nothing is not a door).
 */
export const DetailsSelectContext = createContext<((key: DetailsItemKey) => void) | null>(null);

export function DetailsGoTo({ item, children, className = '' }: { item: DetailsItemKey; children: ReactNode; className?: string }) {
  const select = useContext(DetailsSelectContext);
  if (!select) return null;
  return (
    <button
      type="button"
      data-details-go={item}
      onClick={() => select(item)}
      className={`sn-press inline-flex min-h-11 items-center text-left underline underline-offset-2 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * 🧩 A TOOL'S PIECES, IN THE NAVIGATOR (owner 2026-09-29, DECISION_LOG "A TOOL
 * MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS"): *"make sure they are
 * just not link to another page but those page are there making use of the 3
 * parts"*. A tool that moved into Details lists its pieces in the LEFT column
 * under its item (the Mood Board's parts, the Hero's parts, the Reveal's
 * openings); the MIDDLE draws the picked piece and the RIGHT holds its
 * controls. Which piece is picked is kept here, per item, by `DetailsWorkspace`
 * — the three columns are separate trees, so they meet in this context.
 */
export type DetailsPieces = {
  piece: (item: DetailsItemKey) => string | null;
  /** `openEditor`: on a phone, also open the editor panel (the piece's controls). */
  setPiece: (item: DetailsItemKey, piece: string | null, opts?: { openEditor?: boolean }) => void;
  /** Open the right part on a phone (a tool's own button that shows its controls there — the seat plan's "N to seat"). */
  openEditor?: () => void;
};
export const DetailsPieceContext = createContext<DetailsPieces | null>(null);

/** The piece picked under one item, and its setter. Outside Details: nothing picked, a no-op. */
export function useDetailsPiece(
  item: DetailsItemKey,
): [string | null, (piece: string | null, opts?: { openEditor?: boolean }) => void] {
  const ctx = useContext(DetailsPieceContext);
  return [ctx?.piece(item) ?? null, (p, opts) => ctx?.setPiece(item, p, opts)];
}

/** Open Details' right part (a phone's editor panel). Outside Details: a no-op. */
export function useDetailsEditorOpener(): () => void {
  const ctx = useContext(DetailsPieceContext);
  return () => ctx?.openEditor?.();
}

/**
 * One piece in the navigator — a row on a desk, a chip in the phone's strip.
 * The one shape every tool's pieces are drawn in, so they read as the Maker's
 * own navigator and never as a second tab bar.
 */
export function DetailsPieceButton({
  on,
  onPick,
  children,
  data,
  disabled = false,
}: {
  on: boolean;
  onPick: () => void;
  children: ReactNode;
  data?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onPick}
      data-details-piece={data}
      className={`sn-press inline-flex min-h-11 shrink-0 items-center gap-2 self-center rounded-full px-3 text-left lg:self-auto text-[13px] font-medium transition-colors duration-sn-control ease-sn disabled:opacity-60 lg:w-full lg:rounded-md lg:px-2.5 ${
        on ? 'bg-ink text-cream' : 'bg-white/70 text-ink/80 hover:bg-white lg:bg-transparent lg:hover:bg-ink/[0.05]'
      }`}
    >
      {children}
    </button>
  );
}
