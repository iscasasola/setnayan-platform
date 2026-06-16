'use client';

/**
 * RigidStage — the shared engine for the rigid reveal family (4 envelopes +
 * church doors), implementing the locked 0024 addendum §1a interaction:
 *
 *   1. MOTION-DRAG THE SEAL OFF (gate). The couple's monogram wax seal rests on
 *      the paper at dead-centre. You pick it up and it follows your finger 1:1;
 *      on release it carries your throw's MOMENTUM — sliding across the paper in
 *      the release-velocity direction with friction, and only gathering a little
 *      gravity + tumble once it's PAST the screen edge (never "falls" on the
 *      paper, §1a). A weak release (slow + short) springs it back onto the paper
 *      and the envelope stays sealed — "they have to swipe it away."
 *   2. SCROLL TO OPEN (scrub). Once the seal is gone, SCROLL / drag scrubs the
 *      flaps open (progress 0→1) — NOT a tap. At full open the overlay clears.
 *
 * Template-specific flap geometry is passed in via `renderFlaps(progress)`; this
 * component owns the backdrop, the seal, the gesture handling and the cues. The
 * gesture model mirrors the veil family's scroll/drag-to-lift so the whole reveal
 * library feels consistent.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { WaxSealConfig } from '@/lib/wax-seal/types';
import { WaxSeal } from './wax-seal';

type Props = {
  markSvg: string | null;
  monogramText: string;
  waxColor: string;
  /** The minted wax-seal recipe (null → default levers seeded by fallbackSeed). */
  config?: WaxSealConfig | null;
  /** Stable seed for an un-minted seal (public_id-derived). */
  fallbackSeed?: number;
  /** Fired once the flaps have scrubbed fully open. */
  onOpened: () => void;
  /** Render the template's flaps for a given open progress (0 = shut, 1 = clear). */
  renderFlaps: (progress: number) => ReactNode;
};

// Open is TRIGGERED (commit on a swipe up) then auto-plays at a fixed pace — the
// locked ~6.0s full open (owner 2026-06-17), NOT scrubbed by swipe distance/speed
// (a fast swipe no longer rushes the last flap). Swipe down draws it back.
const OPEN_VEL = 1 / (6 * 60); // progress per frame ≈ 6.0s at 60fps
const CLOSE_VEL = 1 / (1.5 * 60); // quicker to close
const COMMIT_DRAG_PX = 24; // upward drag that commits to opening

// Seal-throw physics.
const FRICTION = 0.96; // per-frame velocity decay during the fling
const FLING_SPEED = 9; // px/frame release speed that counts as a deliberate flick
const FLING_DIST_FRAC = 0.16; // OR drag this fraction of the short screen edge

export function RigidStage({
  markSvg,
  monogramText,
  waxColor,
  config = null,
  fallbackSeed,
  onOpened,
  renderFlaps,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLButtonElement>(null);

  const [sealGone, setSealGone] = useState(false);
  const [pickedUp, setPickedUp] = useState(false);
  const [progress, setProgress] = useState(0);
  // After a couple of weak releases (the seal sprang back), escalate the cue so
  // a guest who hasn't realised it must be DRAGGED off gets a stronger hint.
  const [cueStrong, setCueStrong] = useState(false);
  const weakTries = useRef(0);

  const targetRef = useRef(0);
  const openedRef = useRef(false);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  // ── 1. motion-drag the seal off ─────────────────────────────────────────
  const drag = useRef({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vx: 0,
    vy: 0,
  });
  const flingRaf = useRef(0);
  const cancelFling = () => {
    if (flingRaf.current) {
      cancelAnimationFrame(flingRaf.current);
      flingRaf.current = 0;
    }
  };

  const onSealDown = (e: React.PointerEvent) => {
    if (sealGone) return;
    e.preventDefault();
    cancelFling();
    sealRef.current?.setPointerCapture(e.pointerId);
    const t = performance.now();
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: t,
      vx: 0,
      vy: 0,
    };
    setPickedUp(true);
    if (sealRef.current) sealRef.current.style.transition = 'none';
  };

  const onSealMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const now = performance.now();
    const dt = Math.max(8, now - d.lastT); // clamp tiny/zero dt to avoid spikes
    // smoothed (EMA) release velocity in px per ~frame (16ms)
    const instVx = ((e.clientX - d.lastX) / dt) * 16;
    const instVy = ((e.clientY - d.lastY) / dt) * 16;
    d.vx = d.vx * 0.6 + instVx * 0.4;
    d.vy = d.vy * 0.6 + instVy * 0.4;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = now;
    d.dx = e.clientX - d.startX;
    d.dy = e.clientY - d.startY;
    if (sealRef.current) {
      sealRef.current.style.transform = `translate(${d.dx}px, ${d.dy}px) scale(1.06)`;
    }
  };

  // Fling the seal in the release-velocity direction with friction; once it
  // clears the visible edge it gathers a little gravity + tumble, then it's gone.
  const flingOff = (start: { x: number; y: number; vx: number; vy: number }) => {
    const el = sealRef.current;
    if (!el) {
      setSealGone(true);
      return;
    }
    el.style.transition = 'none';
    const vw = window.innerWidth || 1000;
    const vh = window.innerHeight || 1000;
    const half = 90; // generous seal half-extent (incl. the picked-up scale)
    let { x, y, vx, vy } = start;
    // Preserve the THROW DIRECTION (the seal slides the way you flick it, §1a);
    // only floor the SPEED so it always clears the long screen axis. Fall back
    // to the displacement direction — or just clear it — when there's no real
    // release velocity (so an out-and-back flick can never freeze at v=0).
    const minLaunch = Math.max(vw, vh) / 22;
    const s = Math.hypot(vx, vy);
    if (s >= 1.5) {
      if (s < minLaunch) {
        const k = minLaunch / s;
        vx *= k;
        vy *= k;
      }
    } else {
      const dm = Math.hypot(x, y);
      if (dm >= 1) {
        vx = (x / dm) * minLaunch;
        vy = (y / dm) * minLaunch;
      } else {
        setSealGone(true);
        return;
      }
    }
    let rot = 0;
    let frames = 0;
    const tick = () => {
      frames += 1;
      vx *= FRICTION;
      vy *= FRICTION;
      const pastEdge = Math.abs(x) > vw / 2 - half || Math.abs(y) > vh / 2 - half;
      if (pastEdge) {
        // Tumble + a pull that always pushes it FURTHER off-screen — never
        // reversing an upward exit, so it can't fall back onto the paper (§1a:
        // gravity/tumble only once past the edge, off the paper).
        if (Math.abs(y) >= Math.abs(x)) {
          vy += y < 0 ? -0.6 : 0.9; // exiting top/bottom → accelerate outward
        } else {
          vy += 0.5; // exiting sideways → a touch of real gravity, it's off-paper
        }
        rot += vx >= 0 ? 5 : -5;
      }
      x += vx;
      y += vy;
      el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(1.04)`;
      const fullyOff = Math.abs(x) > vw / 2 + half * 2 || Math.abs(y) > vh / 2 + half * 2;
      if (fullyOff || frames > 200) {
        flingRaf.current = 0;
        setSealGone(true);
        return;
      }
      flingRaf.current = requestAnimationFrame(tick);
    };
    flingRaf.current = requestAnimationFrame(tick);
  };

  const springBack = () => {
    const el = sealRef.current;
    if (!el) return;
    el.style.transition = 'transform 360ms cubic-bezier(0.34,1.56,0.64,1)';
    el.style.transform = 'translate(0px, 0px) scale(1)';
  };

  const onSealUp = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setPickedUp(false);
    // Decay stale velocity: if the pointer PAUSED before releasing, no
    // pointermove fired during the hold so d.vx/d.vy still hold the pre-pause
    // flick — a deliberate "let go in place" must read as ~0 and stay sealed
    // (§1a: "release without swiping → drops back, you have to swipe it away").
    const idle = performance.now() - d.lastT;
    let vx = d.vx;
    let vy = d.vy;
    if (idle > 40) {
      const k = Math.exp(-(idle - 40) / 90);
      vx *= k;
      vy *= k;
    }
    const speed = Math.hypot(vx, vy);
    const dist = Math.hypot(d.dx, d.dy);
    const minDim = Math.min(window.innerWidth || 1000, window.innerHeight || 1000);
    if (speed > FLING_SPEED || dist > FLING_DIST_FRAC * minDim) {
      flingOff({ x: d.dx, y: d.dy, vx, vy });
    } else {
      springBack();
      weakTries.current += 1;
      if (weakTries.current >= 2) setCueStrong(true);
    }
  };

  // Keyboard / reduced-dexterity fallback: activating the seal opens directly.
  const onSealKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      cancelFling();
      targetRef.current = 1;
      setSealGone(true);
    }
  };

  useEffect(() => () => cancelFling(), []);

  // ── 2. scroll-scrub open (after the seal is gone) ───────────────────────
  useEffect(() => {
    if (!sealGone) return;
    const el = stageRef.current;
    if (!el) return;

    // A swipe up COMMITS the open; it then plays out at OPEN_VEL no matter how hard
    // you swipe. Swipe down draws it back. (Two-finger swipe up = wheel deltaY > 0.)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 2) targetRef.current = 1;
      else if (e.deltaY < -2) targetRef.current = 0;
    };
    let downY = 0;
    let fired = 0;
    const onDown = (e: PointerEvent) => {
      downY = e.clientY;
      fired = 0;
    };
    const onMove = (e: PointerEvent) => {
      const dy = downY - e.clientY;
      if (dy > COMMIT_DRAG_PX && fired !== 1) {
        targetRef.current = 1;
        fired = 1;
      } else if (dy < -COMMIT_DRAG_PX && fired !== -1) {
        targetRef.current = 0;
        fired = -1;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      // Prevent the page behind from scrolling while we open.
      if (e.cancelable) e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    let raf = 0;
    const tick = () => {
      setProgress((p) => {
        const t = targetRef.current;
        let np = p;
        if (t > p) np = Math.min(t, p + OPEN_VEL);
        else if (t < p) np = Math.max(t, p - CLOSE_VEL);
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

      {/* the seal — pick it up & motion-drag it off to gate the reveal */}
      {!sealGone ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          <button
            ref={sealRef}
            type="button"
            aria-label="Drag the seal away to open the invitation"
            onPointerDown={onSealDown}
            onPointerMove={onSealMove}
            onPointerUp={onSealUp}
            onPointerCancel={onSealUp}
            onKeyDown={onSealKey}
            className="pointer-events-auto cursor-grab touch-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream/70 active:cursor-grabbing"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <WaxSeal
              markSvg={markSvg}
              monogramText={monogramText}
              waxColor={waxColor}
              config={config}
              fallbackSeed={fallbackSeed}
            />
          </button>
          <span
            className={`pointer-events-none font-mono text-[11px] uppercase tracking-[0.28em] text-cream/85 transition-opacity duration-300 ${
              pickedUp ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {cueStrong ? 'Flick the seal off the page' : 'Drag the seal away'}
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
            Swipe up to open ↑
          </p>
        </div>
      ) : null}
    </div>
  );
}
