'use client';

/**
 * walking-order-lines.tsx — grab a line and move it.
 *
 * ⚖ Owner 2026-09-20: drag is **desktop-only and additional**. Move ↑ / Move ↓
 * beside every line are the always-available path — reachable by thumb, by
 * keyboard and by screen reader.
 *
 * ── ⚖ OWNER 2026-09-23 — THE MOVE HAPPENS HERE NOW ────────────────────────
 * *"when i move someone, the whole screen refreshes. feels laggy."* · *"when
 * it reloads, it goes back up and does not stay on where we are editing. this
 * is hassle because we need to always scroll back down. we want them to move
 * and pair people easily and fast."*
 *
 * Move ↑ / ↓ used to be plain `<form action={serverAction}>`, one form per
 * arrow. A form action that redirects is a 303: the browser throws the whole
 * document away and loads it again, which is the refresh he saw AND the reason
 * the page came back at the top. Measured in production on 2026-09-23, his own
 * moves: `POST …/guests 303` at 05:51:33 → the page's two GETs at 05:51:36-37.
 * Roughly three seconds and a scroll reset, to move one line by one place.
 *
 * So the arrows are buttons in this island. A tap reorders the list on screen
 * IMMEDIATELY and the write goes out behind it; if the server refuses, the
 * order snaps back and the reason is printed where the couple is looking. No
 * navigation, so the scroll position is simply never lost.
 *
 * 🪤 WHAT THIS DELIBERATELY GAVE UP, AND WHY IT IS NOT A LOSS. The forms
 * worked with JavaScript off. So does nothing else on this page — the pickers,
 * the drag, the grab-and-move and the whole roster above are already client
 * islands, and an arrow that worked alone in a JavaScript-less browser was
 * never a path anybody could complete a processional through.
 *
 * ── THE COUPLING THAT IS GONE ─────────────────────────────────────────────
 * 🔑 The arrows used to arrive as a `children` ARRAY and be drawn as
 * `children[i]`, indexed by THIS component's optimistic order while the array
 * was built in the SERVER's order. The two agree until a move is in flight —
 * exactly when somebody is tapping — and during that window each arrow was
 * bound to whoever used to stand at its position. Owning the buttons removes
 * the positional binding rather than trying to keep two orders in step.
 *
 * ── WHAT IT POSTS ──────────────────────────────────────────────────────────
 * The lead guest id of every line, in the new order — not positions. A
 * position only means something against the list the client was looking at; if
 * another planner has since moved a line, applying positions would reorder the
 * wrong ones. Names let the server refuse a stale order instead of obeying it.
 * Every write names the WHOLE group, so two quick taps resolve to the last
 * full sequence rather than to a half-applied pair of swaps.
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
 *
 * 🔑 A JOIN OR A SWAP CHANGES WHICH LINES EXIST, so those two cannot be drawn
 * optimistically from what this island knows — it would have to re-implement
 * `pairUp`. They ask the server and then `router.refresh()`, which replaces the
 * panel's data IN PLACE: no document load, no scroll jump, no remount.
 */

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { setEntourageLineOrder } from '../entourage-order-actions';
import { joinEntourageLine, swapEntouragePlaces } from '../march-actions';
import type { MarchResult } from '@/lib/march-result';

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
}: {
  eventId: string;
  groupKey: string;
  groupLabel: string;
  lines: WalkingLine[];
}) {
  const router = useRouter();
  const [order, setOrder] = useState<string[]>(() => lines.map((l) => l.leadId));
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [say, setSay] = useState('');
  /* 🔑 A REFUSAL MUST REACH THE RENDER. It used to ride back as `?error=…` on
     a navigation; a returned reason that only reached a log would be the
     silence that change was made to end. */
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const committed = useRef<string[]>(lines.map((l) => l.leadId));
  /** The order on screen, which the drain below chases. See `persist`. */
  const desired = useRef<string[]>(lines.map((l) => l.leadId));
  const inFlight = useRef(false);

  // The server is the source of truth: when it sends a new order (somebody
  // else moved a line, or our own save landed), take it.
  useEffect(() => {
    const next = lines.map((l) => l.leadId);
    if (next.join() !== committed.current.join()) {
      committed.current = next;
      desired.current = next;
      setOrder(next);
    }
  }, [lines]);

  const byId = new Map(lines.map((l) => [l.leadId, l]));
  const at = (id: string) => order.indexOf(id);

  /** A join or a swap: ask, then take the server's new lines in place. */
  function nameMove(run: () => Promise<MarchResult>, announce: string) {
    setProblem(null);
    setSay(announce);
    start(async () => {
      const result = await run();
      if (!result.ok) {
        setProblem(result.reason);
        setSay(result.reason);
        return;
      }
      router.refresh();
    });
  }

  function joinLine(anchorId: string, joinerId: string, announce: string) {
    nameMove(() => joinEntourageLine(eventId, groupKey, anchorId, joinerId), announce);
  }

  function swapNames(a: string, b: string, announce: string) {
    nameMove(() => swapEntouragePlaces(eventId, groupKey, a, b), announce);
  }

  /** A NAME was dropped on a cell: do the move the cell allows, or say why not. */
  function dropName(slot: MarchSlot, draggedId: string, draggedName: string) {
    if (slot.kind === 'empty') {
      if (slot.joiners.some((o) => o.id === draggedId)) {
        joinLine(slot.anchorId, draggedId, `${draggedName} now walks with ${slot.anchorName}.`);
      } else if (draggedId !== slot.anchorId) {
        setProblem(
          `${draggedName} cannot take the place beside ${slot.anchorName} — tap the empty place to see who can.`,
        );
      }
      return;
    }
    if (slot.id === draggedId) return;
    if (slot.swapWith.some((o) => o.id === draggedId)) {
      swapNames(draggedId, slot.id, `${draggedName} and ${slot.name} traded places.`);
    } else {
      setProblem(
        `${draggedName} and ${slot.name} cannot swap — tap a name to see who it can swap with.`,
      );
    }
  }

  /**
   * Persist a reordering that is ALREADY on screen.
   *
   * 🔑 OPTIMISTIC, AND IT PUTS ITSELF BACK. The list moves first so a tap feels
   * like a tap; if the server refuses, `order` returns to the last sequence the
   * server acknowledged and the reason is printed. A refusal that silently kept
   * the new order on screen would tell the couple their processional says
   * something it does not.
   *
   * ── 🪤 ONE WRITE AT A TIME, AND IT ALWAYS POSTS THE LATEST ────────────────
   * The owner's whole ask is to move people FAST, which means tapping ↑ again
   * before the last tap has landed. Firing one request per tap races: five
   * single-step "move him up" calls, each resolved against its own fresh read,
   * can interleave and settle somewhere nobody chose — and the screen would go
   * on showing the order he tapped for. So a tap only updates `desired`, and
   * this drains it: at most one request in flight, each posting the WHOLE
   * sequence currently on screen. Two taps during one write collapse into one
   * write of the final order, and the last thing posted is always what he is
   * looking at.
   */
  function persist(next: string[]) {
    setProblem(null);
    setOrder(next);
    desired.current = next;
    start(drainOrder);
  }

  async function drainOrder() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      while (desired.current.join() !== committed.current.join()) {
        const target = desired.current;
        const result = await setEntourageLineOrder(eventId, groupKey, target);
        if (!result.ok) {
          setOrder(committed.current);
          desired.current = committed.current;
          setProblem(result.reason);
          setSay(result.reason);
          return;
        }
        committed.current = target;
      }
    } finally {
      inFlight.current = false;
    }
  }

  /** Move ↑ / Move ↓ — the always-available path, now without a page load. */
  function moveLine(id: string, delta: -1 | 1) {
    const from = at(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setSay(`${byId.get(id)?.label ?? 'Line'} is now ${to + 1} of ${next.length} in ${groupLabel}.`);
    /* Posts the whole sequence, exactly like the drag does — NOT "move this
       person one step". A single-step request means something only against the
       list the server happens to read, and two of them in flight mean it twice
       against two different lists. `setEntourageLineOrder` still refuses a
       sequence that does not name this group's lines exactly once, so a list
       that gained or lost a line while we were tapping is caught, not obeyed. */
    persist(next);
  }

  /** The keyboard grab: ↑/↓ shuffle on screen, Space commits the whole order. */
  function moveHeld(id: string, delta: -1 | 1): void {
    const from = at(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setOrder(next);
    setSay(`${byId.get(id)?.label ?? 'Line'} is now ${to + 1} of ${next.length} in ${groupLabel}.`);
  }

  function commit(next: string[]) {
    persist(next);
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
      moveHeld(id, e.key === 'ArrowUp' ? -1 : 1);
    }
  }

  return (
    <>
      {/* ⚖ Owner 2026-09-23 — a refused move used to arrive as a query string
          after a page load. It is said here, next to the list it is about. */}
      {problem ? (
        <p
          role="status"
          className="mt-1.5 rounded-md border border-danger-200 bg-danger-50/70 px-2 py-1.5 text-xs text-danger-900"
        >
          {problem}
        </p>
      ) : null}
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
                setGrabbed(null);
                // A name drop, or a line this list does not hold — either way
                // `indexOf` would be -1 and `splice(-1, 1)` would quietly move
                // the LAST line instead of the dropped one.
                if (!from || from === id || !byId.has(from)) return;
                const next = [...order];
                next.splice(order.indexOf(id), 0, next.splice(next.indexOf(from), 1)[0]!);
                setSay(`${byId.get(from)?.label ?? 'Line'} moved to ${next.indexOf(from) + 1}.`);
                commit(next);
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
                    onDropName={(dragId, name) => dropName(line.slots[c], dragId, name)}
                    onPick={(optionId, optionName) => {
                      const slot = line.slots[c];
                      if (slot.kind === 'empty') {
                        joinLine(
                          slot.anchorId,
                          optionId,
                          `${optionName} now walks with ${slot.anchorName}.`,
                        );
                      } else {
                        swapNames(
                          slot.id,
                          optionId,
                          `${slot.name} and ${optionName} traded places.`,
                        );
                      }
                    }}
                  >
                    {line.cells[c]}
                  </MarchCell>
                ))}
              </span>
              {/* The always-available path. The end of the list keeps a
                  disabled control rather than none, so the buttons do not
                  shuffle sideways as the order changes — the one thing that
                  would make a column of arrows hard to use with a thumb. */}
              <span className="inline-flex flex-none">
                <MoveArrow
                  direction="up"
                  disabled={i === 0}
                  onMove={() => moveLine(id, -1)}
                />
                <MoveArrow
                  direction="down"
                  disabled={i === order.length - 1}
                  onMove={() => moveLine(id, 1)}
                />
              </span>
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

function MoveArrow({
  direction,
  disabled,
  onMove,
}: {
  direction: 'up' | 'down';
  disabled: boolean;
  onMove: () => void;
}) {
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  if (disabled) {
    return (
      <span
        aria-hidden
        className="inline-flex h-7 w-7 flex-none items-center justify-center rounded text-ink/15"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Move this line ${direction}`}
      onClick={onMove}
      className="inline-flex h-7 w-7 flex-none items-center justify-center rounded text-ink/45 hover:bg-ink/5 hover:text-ink"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </button>
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
  onPick: (optionId: string, optionName: string) => void;
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
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-20 mt-1 block max-h-72 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-ink/10 bg-white p-1 shadow-lg`}
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
                  onPick(o.id, o.name);
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
