'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DetailsItemKey } from '@/lib/maker-details-items';

/**
 * 🧩 A TOOL MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS (owner
 * 2026-09-29, DECISION_LOG row of that name: *"make sure they are just not link
 * to another page but those page are there making use of the 3 parts"*).
 *
 * A Details item that is a whole tool (the Schedule, the Love Story, RSVP) has
 * PIECES — the schedule's moments, the story's chapters, RSVP's settings. The
 * navigator lists them under the item (LEFT), the item's picture shows the
 * picked piece (MIDDLE), and the right column shows that piece's controls
 * (RIGHT). The pieces are the tool's own — nothing is re-drawn: the shipped
 * components read the picked piece here and show or focus it.
 *
 *   · `DetailsPieceContext` — provided by `DetailsWorkspace`: the picked piece
 *     of each item, and `pick`. Null outside Details (the stage's inspector, the
 *     standalone pages): every piece then shows, exactly as before.
 *   · `pickDetailsPiece` — a tool picks from inside its own picture (a moment
 *     tapped on the rail, a chapter tapped in the book), so the navigator
 *     follows the page as well as the other way round.
 *   · `DetailsPieceOnly` — wraps one piece's controls; hidden (never unmounted
 *     — a form's other fields still post) while another piece is picked.
 *   · `InSlot` — a shipped component's own panel, drawn into the right column
 *     (the schedule's moment inspector, its Announce): the same component, the
 *     same state, in the Maker's third part.
 */
export type DetailsPieceApi = {
  pieceOf: (item: DetailsItemKey) => string | null;
  pick: (item: DetailsItemKey, piece: string) => void;
};

export const DetailsPieceContext = createContext<DetailsPieceApi | null>(null);

/** The picked piece of an item, or null outside Details (show everything). */
export function useDetailsPiece(item: DetailsItemKey): string | null {
  return useContext(DetailsPieceContext)?.pieceOf(item) ?? null;
}

export const DETAILS_PIECE_EVENT = 'setnayan:details-piece';

/** Pick a piece from inside a tool's own picture — the navigator follows. */
export function pickDetailsPiece(item: DetailsItemKey, piece: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ item: DetailsItemKey; piece: string }>(DETAILS_PIECE_EVENT, { detail: { item, piece } }));
}

/** One piece's controls: shown while it is the picked one (or outside Details). */
export function DetailsPieceOnly({ item, piece, children }: { item: DetailsItemKey; piece: string | readonly string[]; children: ReactNode }) {
  const picked = useDetailsPiece(item);
  const mine = typeof piece === 'string' ? [piece] : piece;
  const shown = picked === null || mine.includes(picked);
  return (
    <div hidden={!shown} className={shown ? 'contents' : 'hidden'} data-details-piece={mine.join(' ')}>
      {children}
    </div>
  );
}

/**
 * Draw `children` into the element with this id — the right column's slot for
 * a tool's own panel. No id: drawn where it stands. An id with no element on
 * the page (the tool opened outside Details): drawn where it stands too, so a
 * panel is never lost.
 */
export function InSlot({ id, children }: { id?: string | null; children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null | 'none'>(null);
  useEffect(() => {
    if (!id) return;
    setTarget(document.getElementById(id) ?? 'none');
  }, [id]);
  if (!id || target === 'none') return <>{children}</>;
  return target ? createPortal(children, target) : null;
}
