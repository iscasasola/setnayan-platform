'use client';

/**
 * 📱 THE PHONE'S 3D BUDGET — one place that decides how much a 3D room may ask of a phone, and what the room does
 * when the phone says no.
 *
 * WHY THIS EXISTS (owner, 2026-10-29, iPhone, the installed app): *"When i pressed 3d plan"* → iOS's own
 * `"Setnayan" Crashed` dialog, back to the Events home. The seat plan's 3D room (`seating-lab-3d.tsx`) always ran the
 * DESKTOP tier — `quality="high"` (2048 shadow map, 256 env map), the Tier B postprocessing composer in Play, a render
 * loop at full rate even with nothing moving, and, since R4 kept the room mounted after its first open, that loop and
 * its GPU context stayed alive (behind `hidden`) while the 2D plan and the List ran. Measured in WebKit at an iPhone
 * viewport (390×844, DPR 3) on a 25-table / 230-guest plan — the size of the event that crashed — the GPU process
 * footprint was ~290 MB in Build and ~390–465 MB in Play, on top of ~400–450 MB in the page's own process. A phone
 * that runs out of memory there has its web content killed; nothing in the room ever noticed.
 *
 * So a phone gets: the 'low' tier the guest venue walk already runs, no Tier B composer, a capped pixel ratio, a
 * render loop that only draws when something changes, no GPU context at all while the room is hidden, and — when
 * WebGL is lost anyway — an honest line and a way to the 2D plan instead of a dead canvas.
 *
 * The caps and the phone reading are pure, in `lib/phone-gpu-budget.ts`. Held by `lib/phone-gpu-budget.test.ts`.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree, type RootState } from '@react-three/fiber';
import { PHONE_3D, phoneGpuFrom } from '@/lib/phone-gpu-budget';

/** `phoneGpuFrom` over this browser. False where it cannot be known (no `window`). */
export function isPhoneGpu(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return phoneGpuFrom(navigator.userAgent, navigator.maxTouchPoints ?? 0, coarse);
}

/** The phone answer, read once on mount (every caller is a client-only, `ssr: false` 3D chunk). */
export function usePhoneGpu(): boolean {
  const [phone] = useState(isPhoneGpu);
  return phone;
}

/**
 * Is the element actually on screen with a size? A room drawn inside `hidden` (R4 keeps the room mounted after its
 * first open) measures 0×0 — the caller then unmounts its Canvas, which releases the WebGL context (R3F calls
 * `forceContextLoss` on unmount) instead of keeping it alive behind the 2D plan.
 */
export function useHasSize(ref: RefObject<HTMLElement | null>): boolean {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const read = () => setShown(el.clientWidth > 0 && el.clientHeight > 0);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return shown;
}

/**
 * Watch the Canvas's WebGL context. `onCreated` goes on the `<Canvas>`; `lost` turns true when the browser takes the
 * context away (`webglcontextlost` — a phone out of GPU memory), and the caller then draws `<ContextLostNotice>`
 * instead of a canvas that will never paint again. `retry` mounts a fresh Canvas.
 */
export function useWebglContextLost(): { lost: boolean; retry: () => void; attempt: number; onCreated: (s: RootState) => void } {
  const [lost, setLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const onCreated = (s: RootState) => {
    cleanup.current?.();
    const canvas = s.gl.domElement;
    // Our OWN unmount loses the context too (R3F calls `forceContextLoss` once the canvas has left the page) — that is
    // the release this module asks for, not a failure. Only a loss while the canvas is still on the page is the phone
    // saying no.
    const onLost = () => {
      if (canvas.isConnected) setLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    cleanup.current = () => canvas.removeEventListener('webglcontextlost', onLost);
  };
  const retry = () => {
    setLost(false);
    setAttempt((n) => n + 1);
  };
  return { lost, retry, attempt, onCreated };
}

/**
 * Inside a `frameloop="demand"` Canvas: keep drawing while `busy`, and for `PHONE_3D.demandTailMs` after any React
 * render of the room or any touch / wheel / key — so a change is drawn and its ease finishes, then the loop rests.
 */
export function DemandTail({ busy }: { busy: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const until = useRef(0);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  // Every render of the room (a state change anywhere in it re-renders this child) extends the tail.
  useEffect(() => {
    until.current = performance.now() + PHONE_3D.demandTailMs;
    invalidate();
  });
  useEffect(() => {
    const poke = () => {
      until.current = performance.now() + PHONE_3D.demandTailMs;
      invalidate();
    };
    const opts = { passive: true, capture: true } as const;
    window.addEventListener('pointerdown', poke, opts);
    window.addEventListener('pointermove', poke, opts);
    window.addEventListener('pointerup', poke, opts);
    window.addEventListener('wheel', poke, opts);
    window.addEventListener('keydown', poke, opts);
    return () => {
      window.removeEventListener('pointerdown', poke, opts);
      window.removeEventListener('pointermove', poke, opts);
      window.removeEventListener('pointerup', poke, opts);
      window.removeEventListener('wheel', poke, opts);
      window.removeEventListener('keydown', poke, opts);
    };
  }, [invalidate]);
  useFrame(() => {
    if (busyRef.current || performance.now() < until.current) invalidate();
  });
  return null;
}

/** What the room shows instead of a dead canvas once WebGL is lost. */
export function ContextLostNotice({ onShow2d, onRetry }: { onShow2d?: () => void; onRetry: () => void }) {
  return (
    <div
      role="status"
      data-webgl-lost=""
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#11131a] px-6 text-center"
    >
      <p className="max-w-xs text-sm text-white/85">3D needs more memory than this device has free right now.</p>
      {onShow2d ? (
        <button
          type="button"
          onClick={onShow2d}
          className="min-h-11 rounded-xl border border-white/20 bg-white/15 px-5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/25"
        >
          Show 2D
        </button>
      ) : null}
      <button type="button" onClick={onRetry} className="min-h-11 px-3 text-xs text-white/60 underline">
        Try 3D again
      </button>
    </div>
  );
}
