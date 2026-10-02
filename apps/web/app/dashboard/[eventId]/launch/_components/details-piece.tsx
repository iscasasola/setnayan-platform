'use client';

import { useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DetailsItemKey } from '@/lib/maker-details-items';
import { DetailsPieceButton, DetailsPieceContext, useDetailsPiece } from './details-go';

/**
 * 🧩 THE PIECES OF THE TOOLS PART 2b MOVED IN — Love Story, Schedule, RSVP —
 * on part 3's ONE mechanism (`details-go.tsx`: `DetailsPieceContext`,
 * `DetailsPieceButton`, the workspace's `pieces` prop). DECISION_LOG "A TOOL
 * MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS": LEFT the tool's
 * pieces, MIDDLE the picked one, RIGHT its controls.
 *
 *   · `ItemPieces` — a list of pieces in the navigator (the schedule's
 *     moments, the story's chapters, RSVP's settings); the first is picked when
 *     the item opens, and a tool may pick from inside its own picture
 *     (`pickDetailsPiece` — a moment on the rail, a chapter in the book).
 *   · `DetailsPieceOnly` — one piece's controls, shown while it is picked
 *     (hidden, never unmounted, so one form still posts every field). Outside
 *     Details nothing is picked and every piece shows, exactly as before.
 *   · `InSlot` — a shipped component's own panel drawn into the right column
 *     (the schedule's moment inspector, its Announce): the same component, the
 *     same state, in the Maker's third part.
 */
export type ItemPiece = { key: string; label: string; sub?: string };

export const DETAILS_PIECE_EVENT = 'setnayan:details-piece';

/** Pick a piece from inside a tool's own picture — the navigator follows. */
export function pickDetailsPiece(item: DetailsItemKey, piece: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ item: DetailsItemKey; piece: string }>(DETAILS_PIECE_EVENT, { detail: { item, piece } }));
}

/**
 * ⚡ A piece renamed as it is typed (the Programme's moment names, 2026-09-30):
 * `{ item, piece, label?, sub? }` — the list shows it at once; the next render
 * of the Maker brings the saved truth and these are dropped.
 */
export const DETAILS_PIECE_LABEL_EVENT = 'setnayan:details-piece-label';

export function ItemPieces({ item, pieces }: { item: DetailsItemKey; pieces: readonly ItemPiece[] }) {
  const [picked, setPicked] = useDetailsPiece(item);
  const [typed, setTyped] = useState<Record<string, { label?: string; sub?: string }>>({});
  useEffect(() => setTyped({}), [pieces]);
  useEffect(() => {
    const onLabel = (e: Event) => {
      const d = (e as CustomEvent<{ item?: unknown; piece?: unknown; label?: unknown; sub?: unknown }>).detail;
      if (!d || d.item !== item || typeof d.piece !== 'string') return;
      const piece = d.piece;
      setTyped((t) => ({
        ...t,
        [piece]: {
          ...t[piece],
          ...(typeof d.label === 'string' && d.label.trim() ? { label: d.label } : {}),
          ...(typeof d.sub === 'string' ? { sub: d.sub } : {}),
        },
      }));
    };
    window.addEventListener(DETAILS_PIECE_LABEL_EVENT, onLabel);
    return () => window.removeEventListener(DETAILS_PIECE_LABEL_EVENT, onLabel);
  }, [item]);
  /* 📱 Say the sections' names to the sheet's dropdown ("What you ask ▾"). */
  const note = useContext(DetailsPieceContext)?.noteLabels;
  const labelsSig = pieces.map((p) => `${p.key}=${typed[p.key]?.label ?? p.label}`).join('|');
  useEffect(() => {
    note?.(item, Object.fromEntries(pieces.map((p) => [p.key, typed[p.key]?.label ?? p.label])));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the names
  }, [item, labelsSig]);
  const first = pieces[0]?.key ?? null;
  const current = picked && pieces.some((p) => p.key === picked) ? picked : first;
  useEffect(() => {
    if (current && current !== picked) setPicked(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the setter is rebuilt every render; only the pick matters
  }, [current, picked]);
  useEffect(() => {
    const onPick = (e: Event) => {
      const d = (e as CustomEvent<{ item: DetailsItemKey; piece: string }>).detail;
      if (d?.item === item && pieces.some((p) => p.key === d.piece)) setPicked(d.piece);
    };
    window.addEventListener(DETAILS_PIECE_EVENT, onPick);
    return () => window.removeEventListener(DETAILS_PIECE_EVENT, onPick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as above
  }, [item, pieces]);
  return (
    <>
      {pieces.map((p) => (
        <DetailsPieceButton key={p.key} on={p.key === current} onPick={() => setPicked(p.key, { openEditor: true })} data={p.key}>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{typed[p.key]?.label ?? p.label}</span>
            {(typed[p.key]?.sub ?? p.sub) ? <small className="truncate text-[11px] opacity-70">{typed[p.key]?.sub ?? p.sub}</small> : null}
          </span>
        </DetailsPieceButton>
      ))}
    </>
  );
}

/** One piece's controls: shown while it is the picked one (or while nothing is picked). */
export function DetailsPieceOnly({ item, piece, children }: { item: DetailsItemKey; piece: string | readonly string[]; children: ReactNode }) {
  const ctx = useContext(DetailsPieceContext);
  const picked = ctx?.piece(item) ?? null;
  const mine = typeof piece === 'string' ? [piece] : piece;
  const shown = picked === null || mine.includes(picked);
  return (
    <div hidden={!shown} className={shown ? 'contents' : 'hidden'} data-details-piece-only={mine.join(' ')}>
      {children}
    </div>
  );
}

/**
 * Draw `children` into the element with this id — the right column's slot for
 * a tool's own panel. No id, or no such element on the page (the tool opened
 * outside Details): drawn where it stands, so a panel is never lost.
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
