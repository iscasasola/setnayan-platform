'use client';

import { useEffect } from 'react';

/**
 * ⭐ WAVE 8 · THE PAGE NEVER SCROLLS
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25 § 4g:
 * "scroll free controller. nothing under and above it.")
 *
 * The controller shell is already `position: fixed; inset: 0; overflow: hidden`,
 * which on its own is enough on every browser we target — a fixed root has no
 * flow height, so the document cannot grow past the viewport.
 *
 * This belt-and-braces lock exists for the things that are NOT the shell. The
 * root layout mounts a handful of global siblings ahead of `{children}` (the
 * cold-start splash, the pilot / demo banners, the cookie-consent banner). Any
 * one of them rendering in normal flow would give the document a scrollbar the
 * operator can drag — and the whole point of § 4g is that a one-handed operator
 * mid-ceremony cannot be shown a control that scrolled away, nor be able to
 * scroll the fixed surface out from under their own thumb.
 *
 * ⚠ Composes correctly with the shared modal scroll-lock (lib/use-modal-a11y.ts):
 * that primitive is ref-counted and SAVES the current value before setting
 * 'hidden', so a sheet opening and closing over this surface restores 'hidden',
 * not ''. Order does not matter.
 *
 * Cleaned up on unmount, so navigating away from the controller restores the
 * document exactly as it was — this must never leak onto another route.
 */
export function ViewportLock() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    // Kills the iOS rubber-band bounce: without it the whole fixed surface
    // slides under the notch on an overscroll gesture and the tally strip is
    // briefly off-screen.
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  return null;
}
