'use client';

import { useEffect } from 'react';

/**
 * ZoomGuard — makes the web app feel like a native app by suppressing the
 * browser's pinch-zoom across the whole tree, with ONE carve-out: any element
 * marked `[data-allow-zoom]` (or nested inside one) keeps its gestures. The
 * seat-plan canvas wears that attribute because it runs its own pointer-event
 * pan/pinch (`touch-none` + custom handlers) and must receive raw gestures.
 *
 * WHY a JS guard on top of the viewport meta (app/layout.tsx):
 *   - Android Chrome honours `user-scalable=no` / `maximum-scale=1`, so the
 *     viewport meta alone disables pinch-zoom there.
 *   - iOS Safari DELIBERATELY IGNORES those for the user's pinch gesture
 *     (accessibility), so the viewport meta cannot disable pinch on iOS. The
 *     reliable lever is preventing WebKit's non-standard `gesturestart` /
 *     `gesturechange` events — and, unlike clobbering `touchmove`, that does
 *     NOT affect scrolling (gesture* events fire only for pinch/rotate).
 * Double-tap-to-zoom + the 300ms tap delay are already handled by
 * `touch-action: manipulation` on the root (globals.css), so we don't touch
 * touchmove/scroll here.
 *
 * Scope: touch pinch-zoom only. Desktop keyboard (⌘/Ctrl +/-/0) and trackpad
 * (ctrl+wheel) browser zoom are intentionally LEFT ALONE — those are deliberate
 * accessibility affordances on a pointer device, not the accidental mobile zoom
 * the owner asked to remove.
 *
 * ⚠ Accessibility: this removes WCAG 1.4.4 pinch-to-zoom on content per explicit
 * owner directive (2026-06-15). OS-level zoom (iOS/Android Settings →
 * Accessibility → Zoom) still works as the user fallback.
 *
 * Returns null — it only wires document-level listeners for their lifetime.
 */

// WebKit pinch/rotate events. Not in the standard DOM lib types, so we attach
// them via the string-typed addEventListener overload.
const GESTURE_EVENTS = ['gesturestart', 'gesturechange', 'gestureend'] as const;

export function ZoomGuard() {
  useEffect(() => {
    const inAllowedZone = (target: EventTarget | null): boolean =>
      target instanceof Element && target.closest('[data-allow-zoom]') !== null;

    const onGesture = (e: Event) => {
      // Let the seat-plan canvas (and any opt-in zone) own its gestures.
      if (inAllowedZone(e.target)) return;
      e.preventDefault();
    };

    // Non-passive so preventDefault is honoured.
    const opts: AddEventListenerOptions = { passive: false };
    for (const name of GESTURE_EVENTS) {
      document.addEventListener(name, onGesture as EventListener, opts);
    }
    return () => {
      for (const name of GESTURE_EVENTS) {
        document.removeEventListener(name, onGesture as EventListener, opts);
      }
    };
  }, []);

  return null;
}
