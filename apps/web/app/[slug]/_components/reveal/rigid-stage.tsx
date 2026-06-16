'use client';

/**
 * RigidStage — the shared engine for the rigid reveal family (4 envelopes +
 * church doors), implementing the locked 0024 addendum §1a interaction:
 *
 *   1. SWIPE THE SEAL OFF (gate). The couple's monogram wax seal rests on the
 *      paper at dead-centre. You pick it up and SWIPE it across & off a screen
 *      edge — it slides the way you flick it (never "falls"). Release without a
 *      real swipe and it springs back onto the paper and stays sealed.
 *   2. SCROLL TO OPEN (scrub). Once the seal is gone, SCROLL / drag scrubs the
 *      flaps open (progress 0→1) — NOT a tap. At full open the overlay clears.
 *
 * Template-specific flap geometry is passed in via `renderFlaps(progress)`; this
 * component owns the backdrop, the seal, the gesture handling and the cues. The
 * gesture model mirrors the veil family's scroll/drag-to-lift so the whole reveal
 * library feels consistent.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { WaxSeal } from './wax-seal';

type Props = {
  markSvg: string | null;
  monogramText: string;
  waxColor: string;
  /** Fired once the flaps have scrubbed fully open. */
  onOpened: () => void;
  /** Render the template's flaps for a given open progress (0 = shut, 1 = clear). */
  renderFlaps: (progress: number) => ReactNode;
};

const SCRUB_WHEEL = 0.0016; // wheel delta → progress
const SCRUB_DRAG = 0.0042; // pointer/touch drag px → progress

export function RigidStage({ markSvg, monogramText, waxColor, onOpened, renderFlaps }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLButtonElement>(null);

  const [sealGone, setSealGone] = useState(false);
  const [pickedUp, setPickedUp] = useState(false);
  const [progress, setProgress] = useState(0);

  const targetRef = useRef(0);
  const openedRef = useRef(false);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  // ── 1. seal swipe-off gate ──────────────────────────────────────────────
  const drag = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });

  const onSealDown = (e: React.PointerEvent) => {
    if (sealGone) return;
    e.preventDefault();
    sealRef.current?.setPointerCapture(e.pointerId);
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 };
    setPickedUp(true);
    if (sealRef.current) sealRef.current.style.transition = 'none';
  };

  const onSealMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    d.dx = e.clientX - d.startX;
    d.dy = e.clientY - d.startY;
    if (sealRef.current) {
      sealRef.current.style.transform = `translate(${d.dx}px, ${d.dy}px) scale(1.06)`;
    }
  };

  const finishSeal = useCallback((swipedOff: boolean) => {
    const el = sealRef.current;
    setPickedUp(false);
    drag.current.active = false;
    if (!el) {
      if (swipedOff) setSealGone(true);
      return;
    }
    if (swipedOff) {
      // Slide it the way it was flicked, across the paper and off the edge.
      const { dx, dy } = drag.current;
      const mag = Math.hypot(dx, dy) || 1;
      const vw = window.innerWidth || 1000;
      const vh = window.innerHeight || 1000;
      const reach = 1.4 * Math.max(vw, vh);
      const ox = (dx / mag) * reach;
      const oy = (dy / mag) * reach;
      el.style.transition = 'transform 420ms cubic-bezier(0.4,0,0.7,0.2), opacity 420ms ease-out';
      el.style.transform = `translate(${ox}px, ${oy}px) scale(0.92)`;
      el.style.opacity = '0';
      window.setTimeout(() => setSealGone(true), 360);
    } else {
      // Weak gesture → drop back onto the paper with a small bounce; stays sealed.
      el.style.transition = 'transform 360ms cubic-bezier(0.34,1.56,0.64,1)';
      el.style.transform = 'translate(0px, 0px) scale(1)';
    }
  }, []);

  const onSealUp = () => {
    const d = drag.current;
    if (!d.active) return;
    const dist = Math.hypot(d.dx, d.dy);
    const threshold = 0.16 * Math.min(window.innerWidth || 1000, window.innerHeight || 1000);
    finishSeal(dist > threshold);
  };

  // Keyboard / reduced-dexterity fallback: activating the seal opens directly.
  const onSealKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      targetRef.current = 1;
      setSealGone(true);
    }
  };

  // ── 2. scroll-scrub open (after the seal is gone) ───────────────────────
  useEffect(() => {
    if (!sealGone) return;
    const el = stageRef.current;
    if (!el) return;

    const bump = (delta: number) => {
      targetRef.current = Math.max(0, Math.min(1, targetRef.current + delta));
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      bump(e.deltaY * SCRUB_WHEEL);
    };

    // Pointer / touch drag — dragging UP (or scrolling down) opens.
    let dragging = false;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      bump((lastY - e.clientY) * SCRUB_DRAG);
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
      // Forgiving auto-complete: a committed gesture finishes the open.
      if (targetRef.current > 0.42) targetRef.current = 1;
    };
    const onTouchMove = (e: TouchEvent) => {
      // Prevent the page behind from scrolling while we scrub the open.
      if (e.cancelable) e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    let raf = 0;
    const tick = () => {
      setProgress((p) => {
        const t = targetRef.current;
        const np = Math.abs(t - p) < 0.001 ? t : p + (t - p) * 0.14;
        if (np >= 0.985 && !openedRef.current) {
          openedRef.current = true;
          onOpenedRef.current();
        }
        return np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [sealGone]);

  return (
    <div ref={stageRef} className="absolute inset-0 overflow-hidden" style={{ touchAction: 'none' }}>
      {/* soft stage behind the flaps so the seam / arch surround reads */}
      <div className="absolute inset-0 bg-ink" />

      {/* template flaps, scrubbed by progress */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          progress > 0.97 ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        style={{ perspective: '2000px' }}
      >
        {renderFlaps(progress)}
      </div>

      {/* the seal — pick up & swipe off to gate the reveal */}
      {!sealGone ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          <button
            ref={sealRef}
            type="button"
            aria-label="Swipe the seal away to open the invitation"
            onPointerDown={onSealDown}
            onPointerMove={onSealMove}
            onPointerUp={onSealUp}
            onPointerCancel={onSealUp}
            onKeyDown={onSealKey}
            className="pointer-events-auto cursor-grab touch-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream/70 active:cursor-grabbing"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <WaxSeal markSvg={markSvg} monogramText={monogramText} waxColor={waxColor} />
          </button>
          <span
            className={`pointer-events-none font-mono text-[11px] uppercase tracking-[0.28em] text-cream/85 transition-opacity duration-300 ${
              pickedUp ? 'opacity-0' : 'opacity-100'
            }`}
          >
            Swipe the seal away
          </span>
        </div>
      ) : null}

      {/* once sealed-off → scroll cue, until the open gets going */}
      {sealGone ? (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-12 text-center transition-opacity duration-500 ${
            progress > 0.12 ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cream/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
            Scroll to open ↑
          </p>
        </div>
      ) : null}
    </div>
  );
}
