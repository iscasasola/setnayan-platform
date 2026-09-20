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
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { GripVertical } from 'lucide-react';
import { setEntourageLineOrder } from '../entourage-order-actions';

export type WalkingLine = {
  /** The line's lead guest id — how the server names it. */
  leadId: string;
  /** Pre-rendered cells, so this island never re-implements a name. */
  cells: [React.ReactNode, React.ReactNode];
  /** Screen-reader sentence for this line, e.g. "Ramon Zamora and Rosa Zamora". */
  label: string;
};

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
                {line.cells[0]}
                {line.cells[1]}
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
