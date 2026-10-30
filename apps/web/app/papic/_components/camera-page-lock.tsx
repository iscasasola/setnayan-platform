'use client';

import { useEffect } from 'react';
import { lockPageScroll, unlockPageScroll } from '@/lib/overlay-lock';

/**
 * 📱 THE CAMERA PAGE IS EXACTLY THE SCREEN (owner 2026-10-30, verbatim: *"also the camera page should be scroll free
 * full screen camera page that works on browser and app."*).
 *
 * Mounted inside a full-screen Papic camera (`/papic/guest`, `/papic/seat/[token]`) while it is open. The camera's own
 * root is a `fixed inset-0` stage, so it already fits whatever the browser leaves it (Safari's toolbar shown or
 * hidden, the iOS app's WKWebView, an Android Chrome bar) with no viewport-unit guess. This holds the DOCUMENT still
 * behind it: the page lock every sheet uses (`lib/overlay-lock.ts` — the body pinned `position: fixed` and
 * `overscroll-behavior: none` on html and body, because `overflow: hidden` alone does not stop iOS), so there is no
 * scroll, no rubber-band bounce and nothing below the fold to drag up. Reference-counted with the sheets, and
 * released on leave, so the page the ✕ returns to scrolls exactly as before.
 *
 * 🔒 app/papic/the-camera-is-the-whole-screen.test.ts
 */
export function CameraPageLock() {
  useEffect(() => {
    lockPageScroll();
    return () => unlockPageScroll();
  }, []);
  return null;
}
