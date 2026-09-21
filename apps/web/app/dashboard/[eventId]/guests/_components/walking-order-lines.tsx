'use client';

/**
 * walking-order-lines.tsx — grab a line and move it.
 *
 * ⚖ Owner 2026-09-20: drag is **desktop-only and additional**. The Move ↑ /
 * Move ↓ buttons rendered beside every line are the always-available path and
 * are untouched by this file — they are plain forms posting a server action, so
 * they work with JavaScript off, on a phone, and under any assistive tech.
 *
 * ── WHY A KEYBOARD PATH EXISTS EVEN THOUGH BUTTONS DO ──────────────────────
 * 🔑 A DRAG HANDLE THAT ONLY DRAGS IS A CONTROL HALF THE ROOM CANNOT USE. Once
 * a handle is on screen it looks like the way to reorder, so it must answer the
 * keyboard too: Space grabs, ↑/↓ move, Space drops, Esc puts it back. The
 * handle carries `aria-pressed` so a screen reader says whether it is held, and
 * every move is announced in a live region — a silent reorder is indistinguish-
 * able from a dead control.
 *
 * ── WHAT IT POSTS ──────────────────────────────────────────────────────────
 * The lead guest id of every line, in the new order, to `setEntourageLineOrder`
 * — not positions. A position only means something against the list the client
 * was looking at; if another planner has since moved a line, applying positions
 * would reorder the wrong ones. Names let the server refuse a stale order
 * instead of obeying it.
 *
 * ⛔ Reordering the processional never touches a chair. That invariant lives in
 * the action, which writes `entourage_order` and nothing else.
 *
 * ── NAMES MOVE TOO (owner 2026-09-21) ──────────────────────────────────────
 * *"tapping [an empty place] should allow us to pair them as well with
 * someone. or the name can be dragged there to pair."* · *"dragging a name to
 * another will swap the names."*
 *
 * So there are two drags, told apart by WHAT you pick up:
 *   · the ROW (number, grip, padding) → reorders lines, as before;
 *   · a NAME → drop it on an empty "—" to walk with that line's person, or on
 *     another name to trade places.
 * And two taps, which work on a phone, by keyboard and without a mouse:
 *   · tap an empty "—" → "Walks with…" picker;
 *   · tap a name → "Swap with…" picker.
 * The pickers list exactly the moves `lib/march-moves.ts` allows — computed on
 * the server and passed in, so this island never re-derives a rule — and a
 * drop the rules refuse is SAID, in words, rather than silently ignored.
 */

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { GripVertical } from 'lucide-react';
import { setEntourageLineOrder } from '../entourage-order-actions';
import { joinEntourageLine, swapEntouragePlaces } from '../march-actions';

export type WalkingLine = {
  /** The line's lead guest id — how the server names it. */
  leadId: string;
  /** Pre-rendered cells, so this island never re-implements a name. */
  cells: [React.ReactNode, React.ReactNode];
  /** Screen-reader sentence for this line, e.g. "Ramon Zamora and Rosa Zamora". */
  label: string;
  /** What each cell can DO — a name that can swap, or an empty place to fill. */
  slots: [MarchSlot, MarchSlot];
};

export type MarchOption = { id: string; name: string; note: string | null };

/** A cell's moves, precomputed on the server from `lib/march-moves.ts`. */
export type MarchSlot =
  | { kind: 'name'; id: string; name: string; swapWith: MarchOption[] }
  | { kind: 'empty'; anchorId: string; anchorName: string; joiners: MarchOption[] };

/** The drag payload for a NAME — its own type, so a row drop never mistakes it. */
const NAME_TYPE = 'application/x-setnayan-march-name';

export function WalkingOrderLines({
  eventId,
  groupKey,
  groupLabel,
  lines,
  children,
}: {
  eventId: string;
  groupKey: string;
  groupLabel: string;
  lines: WalkingLine[];
  /** The always-available Move ↑ / ↓ forms, one per line, in the same order. */
  children: React.ReactNode[];
}) {
  const [order, setOrder] = useState<string[]>(() => lines.map((l) => l.leadId));
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [say, setSay] = useState('');
  const [pending, start] = useTransition();
  const committed = useRef<string[]>(lines.map((l) => l.leadId));

  // The server is the source of truth: when it sends a new order (somebody
  // else moved a line, or our own save landed), take it.
  useEffect(() => {
    const next = lines.map((l) => l.leadId);
    if (next.join() !== committed.current.join()) {
      committed.current = next;
      setOrder(next);
    }
  }, [lines]);

  const byId = new Map(lines.map((l) => [l.leadId, l]));
  const at = (id: string) => order.indexOf(id);

  function joinLine(anchorId: string, joinerId: string) {
    start(async () => {
      await joinEntourageLine(eventId, groupKey, anchorId, joinerId);
    });
  }

  function swapNames(a: string, b: string) {
    start(async () => {
      await swapEntouragePlaces(eventId, groupKey, a, b);
    });
  }

  /** A NAME was dropped on a cell: do the move the cell allows, or say why not. */
  function dropName(slot: MarchSlot, draggedId: string, draggedName: string) {
    if (slot.kind === 'empty') {
      if (slot.joiners.some((o) => o.id === draggedId)) {
        setSay(`${draggedName} now walks with ${slot.anchorName}.`);
        joinLine(slot.anchorId, draggedId);
      } else if (draggedId !== slot.anchorId) {
        setSay(`${draggedName} cannot take the place beside ${slot.anchorName} — tap the empty place to see who can.`);
      }
      return;
    }
    if (slot.id === draggedId) return;
    if (slot.swapWith.some((o) => o.id === draggedId)) {
      setSay(`${draggedName} and ${slot.name} traded places.`);
      swapNames(draggedId, slot.id);
    } else {
      setSay(`${draggedName} and ${slot.name} cannot swap — tap a name to see who it can swap with.`);
    }
  }

  function commit(next: string[]) {
    setOrder(next);
    start(async () => {
      await setEntourageLineOrder(eventId, groupKey, next);
    });
  }

  function move(id: string, delta: number) {
    const from = at(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setOrder(next);
    setSay(`${byId.get(id)?.label ?? 'Line'} is now ${to + 1} of ${next.length} in ${groupLabel}.`);
    return next;
  }

  function onKey(e: React.KeyboardEvent, id: string) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (grabbed === id) {
        setGrabbed(null);
        commit(order);
        setSay(`${byId.get(id)?.label ?? 'Line'} dropped at ${at(id) + 1}.`);
      } else {
        setGrabbed(id);
        setSay(`${byId.get(id)?.label ?? 'Line'} grabbed. Use the arrow keys to move it, Space to drop, Escape to cancel.`);
      }
      return;
    }
    if (e.key === 'Escape' && grabbed === id) {
      e.preventDefault();
      setGrabbed(null);
      setOrder(committed.current);
      setSay('Move cancelled. The order is unchanged.');
      return;
    }
    if (grabbed === id && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      move(id, e.key === 'ArrowUp' ? -1 : 1);
    }
  }

  return (
    <>
      <ol className="mt-1.5 space-y-1" aria-busy={pending}>
        {order.map((id, i) => {
          const line = byId.get(id);
          if (!line) return null;
          const held = grabbed === id;
          return (
            <li
              key={id}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm odd:bg-ink/[0.02] ${
                held ? 'bg-terracotta/10 ring-1 ring-terracotta/40' : ''
              }`}
              // Desktop only: a touch device gets the buttons, which is the
              // whole point of them being the always-available path.
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', id);
                setGrabbed(id);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = e.dataTransfer.getData('text/plain');
                if (!from || from === id) return;
                const next = [...order];
                next.splice(order.indexOf(id), 0, next.splice(next.indexOf(from), 1)[0]!);
                setGrabbed(null);
                commit(next);
                setSay(`${byId.get(from)?.label ?? 'Line'} moved to ${next.indexOf(from) + 1}.`);
              }}
              onDragEnd={() => setGrabbed(null)}
            >
              <span className="w-5 flex-none font-mono text-[11px] text-ink/40">{i + 1}</span>
              <button
                type="button"
                aria-pressed={held}
                aria-label={`Reorder ${line.label}: press Space, then use the arrow keys`}
                title="Drag, or press Space then use the arrow keys"
                onKeyDown={(e) => onKey(e, id)}
                className="hidden h-7 w-7 flex-none cursor-grab items-center justify-center rounded text-ink/35 hover:bg-ink/5 hover:text-ink sm:inline-flex"
              >
                <GripVertical className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
              <span className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                {([0, 1] as const).map((c) => (
                  <MarchCell
                    key={c}
                    slot={line.slots[c]}
                    align={c === 0 ? 'left' : 'right'}
                    disabled={pending}
                    onDropName={(id, name) => dropName(line.slots[c], id, name)}
                    onPick={(optionId) => {
                      const slot = line.slots[c];
                      if (slot.kind === 'empty') joinLine(slot.anchorId, optionId);
                      else swapNames(slot.id, optionId);
                    }}
                  >
                    {line.cells[c]}
                  </MarchCell>
                ))}
              </span>
              {children[i]}
            </li>
          );
        })}
      </ol>
      {/* A reorder nobody can hear is indistinguishable from a dead control. */}
      <p aria-live="polite" className="sr-only">
        {say}
      </p>
    </>
  );
}

/**
 * One cell of a line: a name you can drag or tap, or an empty place you can
 * drop on or tap. The server-rendered content (name + role) is the child, so a
 * name is never re-implemented here.
 */
function MarchCell({
  slot,
  align,
  disabled,
  onDropName,
  onPick,
  children,
}: {
  slot: MarchSlot;
  /** Which edge the picker hangs from — the RIGHT column opens leftward, or on
   *  a phone the list runs off the screen. */
  align: 'left' | 'right';
  disabled: boolean;
  onDropName: (id: string, name: string) => void;
  onPick: (optionId: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Same close rules as the Filter popover: Escape, or a press outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options = slot.kind === 'empty' ? slot.joiners : slot.swapWith;
  const title =
    slot.kind === 'empty' ? `Walks with ${slot.anchorName}` : `Swap ${slot.name} with`;
  const label =
    slot.kind === 'empty'
      ? `Empty place beside ${slot.anchorName} — choose who walks with them`
      : `${slot.name} — swap places with someone`;

  return (
    <span
      ref={root}
      className={`relative min-w-0 rounded ${over ? 'bg-terracotta/10 ring-1 ring-terracotta/40' : ''}`}
      draggable={slot.kind === 'name'}
      onDragStart={(e) => {
        if (slot.kind !== 'name') return;
        // 🔑 Stop here, or the ROW's dragstart also fires and this becomes a
        // line reorder instead of a name move.
        e.stopPropagation();
        e.dataTransfer.setData(NAME_TYPE, JSON.stringify({ id: slot.id, name: slot.name }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(NAME_TYPE)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(NAME_TYPE);
        setOver(false);
        if (!raw) return; // a ROW drop — the row handles it
        e.preventDefault();
        e.stopPropagation();
        try {
          const { id, name } = JSON.parse(raw) as { id: string; name: string };
          onDropName(id, name);
        } catch {
          /* not ours */
        }
      }}
    >
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`block w-full min-w-0 truncate rounded px-1 text-left hover:bg-ink/5 ${
          slot.kind === 'name' ? 'cursor-grab' : ''
        }`}
      >
        {children}
      </button>
      {open ? (
        <span
          id={menuId}
          role="menu"
          aria-label={title}
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-20 mt-1 block w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-ink/10 bg-white p-1 shadow-lg`}
        >
          <span className="block px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink/55">
            {title}
          </span>
          {options.length === 0 ? (
            <span className="block px-2 py-1.5 text-xs text-ink/55">
              {slot.kind === 'empty'
                ? 'Nobody in this part of the entourage can stand here.'
                : 'Nobody in this column to swap with.'}
            </span>
          ) : (
            options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onPick(o.id);
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-ink/5"
              >
                <span className="text-ink">{o.name}</span>
                {o.note ? <span className="ml-1 text-[11px] text-ink/45">{o.note}</span> : null}
              </button>
            ))
          )}
        </span>
      ) : null}
    </span>
  );
}
