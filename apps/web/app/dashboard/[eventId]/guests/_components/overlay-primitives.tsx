'use client';

/**
 * overlay-primitives.tsx — the in-page overlay kit for the Living Roster (P1).
 *
 * Everything on the Guests page now happens IN PLACE (no route changes, no
 * native confirm dialogs): a quick-view guest sheet, the invite explainer, and
 * (P2) the inline chip editors all render through these three primitives.
 *
 *  • <Scrim>   — a full-viewport dismiss layer (click / Esc closes).
 *  • <Drawer>  — right slide-in on desktop, bottom sheet on mobile.
 *  • <Popover> — a menu anchored to a trigger element.
 *
 * A11y is delegated to the shared `useModalA11y` hook (focus-in on open, Tab
 * trap, Esc-to-close, body-scroll-lock, focus RESTORED to the trigger on close —
 * so opening/closing the drawer never strands or steals the roster's
 * selection-checkbox focus). Motion uses the `.gl-*` keyframes in globals.css,
 * which the file's universal `prefers-reduced-motion: reduce` block freezes to a
 * still frame — no per-component opt-out needed.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '@/lib/use-modal-a11y';

/** Portal target = document.body, gated on mount so SSR/first paint match. */
function usePortal(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setEl(document.body);
  }, []);
  return el;
}

// ── Scrim ───────────────────────────────────────────────────────────────────

/**
 * Full-viewport dismiss layer. Rendered as a <button> so keyboard users get a
 * focusable affordance rather than a bare onClick div. `dim` tints it (used
 * behind the drawer); the popover uses a transparent scrim purely to catch
 * outside clicks.
 */
export function Scrim({
  onClose,
  dim = false,
  z = 70,
  label = 'Close',
}: {
  onClose: () => void;
  dim?: boolean;
  z?: number;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClose}
      className={`gl-scrim fixed inset-0 ${dim ? 'bg-ink/30 backdrop-blur-[1px]' : ''}`}
      style={{ zIndex: z }}
    />
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

/**
 * Right slide-in (desktop) / bottom sheet (mobile). Always mounted only while
 * `open` — the parent renders `{open ? <Drawer …/> : null}` — so mount = open
 * and unmount runs `useModalA11y`'s focus-restore.
 *
 * The consumer renders the whole body (including its own header + a close
 * control that calls `onClose`); the drawer just supplies the positioned,
 * a11y-wired shell. `labelledById` must point at a heading inside `children`.
 */
export function Drawer({
  onClose,
  labelledById,
  children,
}: {
  onClose: () => void;
  labelledById: string;
  children: ReactNode;
}) {
  const portal = usePortal();
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: ref });
  if (!portal) return null;

  return createPortal(
    <>
      <Scrim onClose={onClose} dim z={75} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        className="gl-drawer fixed inset-x-0 bottom-0 z-[80] max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-ink/10 bg-paper p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-xl outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[24rem] sm:max-w-[92vw] sm:rounded-none sm:rounded-l-2xl"
      >
        {children}
      </div>
    </>,
    portal,
  );
}

// ── Popover ───────────────────────────────────────────────────────────────────

/**
 * A menu anchored under (or above, when it would overflow) a trigger element.
 * Position is measured from `anchorRef` on open and clamped to the viewport.
 * Mounted only while `open`. Focus-trapped + Esc/outside-click closes.
 * (Ships in P1 for P2's inline side/RSVP/role chip editors.)
 */
export function Popover({
  anchorRef,
  onClose,
  labelledById,
  width = 210,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  labelledById?: string;
  width?: number;
  children: ReactNode;
}) {
  const portal = usePortal();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useModalA11y({ open: true, onClose, containerRef: ref, lockScroll: false });

  // Measure after layout so `ref` height is known for the flip-up clamp.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const el = ref.current;
    if (!anchor || !el) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    let top = r.bottom + 6;
    if (top + h > vh - 8) top = Math.max(8, r.top - h - 6); // flip above
    setPos({ left, top });
  }, [anchorRef, width]);

  if (!portal) return null;

  return createPortal(
    <>
      <Scrim onClose={onClose} z={78} label="Dismiss menu" />
      <div
        ref={ref}
        role="menu"
        aria-labelledby={labelledById}
        className="gl-pop fixed z-[80] overflow-hidden rounded-xl border border-ink/10 bg-paper p-1.5 shadow-lg outline-none"
        style={{
          width,
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          // Hidden until measured so it never flashes at (0,0).
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </>,
    portal,
  );
}
