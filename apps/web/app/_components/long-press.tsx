'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { LIFT_HOLD_MS, dropGhost, ghostAt, liftGhost } from '@/lib/lift';

/**
 * 👆 LONG PRESS — ONE HOLD, ONE MENU (MOTION_STANDARD_2026-11-18 § 4 #24; drawing
 * `motion_standard_2026-11-18_fable.html` Part H "Long press"; owner 18 Nov "Add all 10").
 *
 * "Hold a row: it lifts and its menu opens beside it." After 350 ms (the standard's one hold — a WAIT, not a speed):
 * the row lifts (Lift: 1.03 in Quick on Spring, shadow on Settle), the house scrim dims the rest, and the menu grows
 * out beside the row (Pop: Quick, size on Spring, fade on Settle). Uses Lift (`.sn-m-lift`) and Pop (`.sn-m-pop`) —
 * it has no motion of its own. Reduced motion: no lift, the menu fades in.
 *
 *   · `useLongPress(onHold)` — the hold alone (a finger that moves is a scroll, never a hold; the tap that follows a
 *     hold is swallowed; the phone's own long-press menu is kept off the row);
 *   · `<LongPressMenu items>` — the hold + the lift + the menu, around any row or card with more actions.
 *
 * The dim is `<OverlayBackdrop>` (one scrim, `lib/one-scrim.test.ts`); the keyboard reaches the same menu with the
 * context-menu key / Shift+F10 on the row. 🔒 lib/the-moments-move-by-the-standard.test.ts
 */

/** A finger that travels further than this before the hold ends is scrolling. */
export const HOLD_SLOP_PX = 10;

export type LongPressPoint = { x: number; y: number; target: HTMLElement };

export function useLongPress(onHold: (at: LongPressPoint) => void, { holdMs = LIFT_HOLD_MS, disabled = false }: { holdMs?: number; disabled?: boolean } = {}) {
  const pending = useRef<{ x: number; y: number; timer: number } | null>(null);
  const held = useRef(false);
  const tell = useRef(onHold);
  tell.current = onHold;

  const cancel = useCallback(() => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      cancel();
      held.current = false;
      const target = e.currentTarget;
      const x = e.clientX;
      const y = e.clientY;
      pending.current = {
        x,
        y,
        timer: window.setTimeout(() => {
          pending.current = null;
          held.current = true;
          try {
            navigator.vibrate?.(10);
          } catch {
            /* no haptics here */
          }
          tell.current({ x, y, target });
        }, holdMs),
      };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const p = pending.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > HOLD_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    /** The tap a lifted finger sends after a hold is not a tap on the row. */
    onClickCapture: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (!held.current) return;
      held.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    /** The phone's own long-press menu never opens over the row; a mouse's right click opens OUR menu. */
    onContextMenu: (e: { preventDefault: () => void; clientX: number; clientY: number; currentTarget: HTMLElement }) => {
      if (disabled) return;
      e.preventDefault();
      if (held.current) return;
      cancel();
      tell.current({ x: e.clientX, y: e.clientY, target: e.currentTarget });
    },
  };
}

export type LongPressItem = { key: string; label: string; icon?: ReactNode; danger?: boolean; onPick: () => void };

/** Where the menu stands: under the row and against its right edge; over it when there is no room below. */
export function holdMenuPlace(row: { top: number; bottom: number; right: number }, menuH: number, vw: number, vh: number): { top: number; right: number; side: 'below' | 'above' } {
  const gap = 8;
  const right = Math.max(16, vw - row.right);
  if (row.bottom + gap + menuH <= vh - 16) return { top: row.bottom + gap, right, side: 'below' };
  return { top: Math.max(16, row.top - gap - menuH), right, side: 'above' };
}

export function LongPressMenu({
  items,
  children,
  label = 'More actions',
  className,
  disabled = false,
}: {
  items: readonly LongPressItem[];
  children: ReactNode;
  /** The menu's name for a screen reader. */
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; right: number; side: 'below' | 'above' } | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const hold = useLongPress(() => setOpen(true), { disabled: disabled || items.length === 0 });

  useLayoutEffect(() => {
    if (!open) return setPlace(null);
    const el = rowRef.current;
    const row = el?.getBoundingClientRect();
    if (!el || !row) return;
    setPlace(holdMenuPlace(row, menuRef.current?.offsetHeight ?? items.length * 44 + 8, window.innerWidth, window.innerHeight));
    // The lifted row is a COPY that stands over the scrim (the row itself stays in its list, dimmed with the rest) —
    // the same carried copy every drag uses, dressed by the one Lift.
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-long-press');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.dataset.holdGhost = '';
    Object.assign(ghost.style, {
      left: '0',
      top: '0',
      width: `${row.width}px`,
      height: `${row.height}px`,
      margin: '0',
      pointerEvents: 'none',
      transform: ghostAt(row.left, row.top),
      background: 'var(--m-paper, #fff)',
      borderRadius: 'var(--m-r-md)',
    });
    liftGhost(ghost);
    ghost.classList.add('sn-m-hold-row');
    document.body.appendChild(ghost);
    return () => void dropGhost(ghost);
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  return (
    <div
      ref={rowRef}
      className={className}
      data-long-press=""
      data-held={open ? '' : undefined}
      style={{ WebkitTouchCallout: 'none' } as CSSProperties}
      onKeyDown={(e) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          setOpen(true);
        }
      }}
      {...hold}
    >
      {children}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <>
              <OverlayBackdrop onClose={close} label="Close the menu" />
              <div
                ref={menuRef}
                role="menu"
                aria-label={label}
                className="sn-m-pop sn-m-hold-menu"
                data-hold-menu=""
                data-pick-side={place?.side}
                style={place ? { top: place.top, right: place.right } : { top: 0, right: 16, visibility: 'hidden' }}
              >
                {items.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    role="menuitem"
                    data-danger={it.danger ? '' : undefined}
                    onClick={() => {
                      close();
                      it.onPick();
                    }}
                  >
                    {it.icon}
                    {it.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
