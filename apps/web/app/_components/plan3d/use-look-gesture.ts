'use client';

/**
 * useLookGesture — the shared swipe-to-look / tap discriminator for the 3D
 * walk-around surfaces (Slice B, owner interaction model 2026-07-03).
 *
 * A horizontal drag on the canvas should ROTATE the camera (yaw), a gentle
 * vertical drag should tilt it (clamped pitch), and a short press that barely
 * moves should stay a TAP ("walk here" / "tap a booth" / "tap my seat"). The
 * problem: the chase camera auto-faces the walker's heading, so a user's look
 * has to (a) override that heading while they're actively looking, then (b)
 * ease back to the auto-facing once they stop — never snap.
 *
 * This hook owns a single mutable `look` ref the in-Canvas camera code reads
 * every frame, plus the DOM pointer handlers to spread onto the <Canvas>. It
 * does NOT raycast — R3F's own object `onClick` handlers still fire for taps;
 * they consult `look.current.suppressTap` (set true the moment a press crosses
 * the movement threshold) so a swipe never doubles as a tap.
 *
 * Frame-rate-independent blend + `prefers-reduced-motion` are handled by the
 * consumer (it reads `yawOffset` / `blendFactor()` in useFrame); this hook only
 * accumulates raw input and timestamps the last look.
 */

import { useMemo, useRef } from 'react';

export type LookState = {
  /** Accumulated user yaw offset (radians) added on top of the auto-facing. */
  yawOffset: number;
  /** Accumulated user pitch (radians), clamped — a gentle up/down tilt. */
  pitch: number;
  /** performance.now() of the last look drag — drives the ease-back timer. */
  lastLookAt: number;
  /** True while a press has crossed the drag threshold — object onClick checks
   *  this to skip a tap that was really a swipe. Reset on the next pointerdown. */
  suppressTap: boolean;
};

// A drag past this many CSS px (from the press origin) is a LOOK, not a tap.
const TAP_MOVE_PX = 8;
// Radians of yaw per CSS px dragged horizontally — a comfortable look speed.
const YAW_PER_PX = 0.005;
// Radians of pitch per CSS px dragged vertically (gentler than yaw).
const PITCH_PER_PX = 0.003;
// Pitch clamp — a small tilt each way; never a full look-up/down.
const PITCH_MIN = -0.35;
const PITCH_MAX = 0.5;

export function useLookGesture() {
  const look = useRef<LookState>({ yawOffset: 0, pitch: 0, lastLookAt: 0, suppressTap: false });
  const active = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);

  const handlers = useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent) => {
        // Ignore multi-touch (pinch/zoom belongs to OrbitControls / the browser).
        active.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
        look.current.suppressTap = false;
        // Capture on the press target (the canvas) so a drag that slides off the
        // edge keeps steering — same convention as the couple lab's LookPad.
        // R3F's own canvas listeners keep firing (the capture target IS the canvas).
        try {
          (e.target as Element).setPointerCapture?.(e.pointerId);
        } catch {
          /* best-effort — detached target / synthetic events */
        }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const a = active.current;
        if (!a || a.id !== e.pointerId) return;
        const dx = e.clientX - a.x;
        const dy = e.clientY - a.y;
        const moved = Math.hypot(e.clientX - a.ox, e.clientY - a.oy);
        if (moved > TAP_MOVE_PX) {
          // Crossed into a look-drag: this press will not fire a tap.
          look.current.suppressTap = true;
          look.current.yawOffset -= dx * YAW_PER_PX;
          look.current.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, look.current.pitch - dy * PITCH_PER_PX));
          look.current.lastLookAt = performance.now();
        }
        a.x = e.clientX;
        a.y = e.clientY;
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (active.current?.id === e.pointerId) active.current = null;
      },
      onPointerCancel: (e: React.PointerEvent) => {
        if (active.current?.id === e.pointerId) active.current = null;
      },
    }),
    [],
  );

  return { look, handlers };
}
