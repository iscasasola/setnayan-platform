'use client';

/**
 * GlobalHaptics — app-wide tap haptics (owner directive 2026-06-03, "apply
 * interaction on buttons and haptic feedbacks").
 *
 * Before this, `haptic()` (lib/haptics.ts) fired in only 3 vendor components.
 * Every other button had the CSS press animation but no physical feedback.
 * Rather than touch hundreds of call-sites, we delegate one passive
 * `pointerdown` listener on the document: any tap that lands on an interactive
 * control fires a light `tick`. pointerdown (not click) is used so the pulse
 * lands on PRESS — the moment a tap feels most responsive — and because it's a
 * real user gesture, the iOS Safari switch-toggle path inside haptic() still
 * registers.
 *
 * Layering: components that fire a richer haptic on commit (accordion-lock's
 * `confirm`, etc.) keep doing so — press-tick + commit-confirm reads as
 * natural "press then lock". Anything that should stay silent opts out with a
 * `data-no-haptic` attribute on itself or an ancestor.
 *
 * Disable globally by setting localStorage `setnayan-haptics` = `off` (a future
 * Settings → Appearance toggle, iteration 0025, writes this key). Default ON.
 * On unsupported engines (desktop, older iOS) haptic() is already a no-op, so
 * this is harmless everywhere.
 */

import { useEffect } from 'react';
import { haptic } from '@/lib/haptics';

const INTERACTIVE = [
  'button',
  '[role="button"]',
  'a[href]',
  'summary',
  'label[for]',
  'input[type="submit"]',
  'input[type="button"]',
  '.button-primary',
  '.button-secondary',
].join(',');

export function GlobalHaptics() {
  useEffect(() => {
    let enabled = true;
    try {
      enabled = window.localStorage.getItem('setnayan-haptics') !== 'off';
    } catch {
      /* storage blocked (private mode) — leave enabled */
    }
    if (!enabled) return;

    function onPointerDown(e: PointerEvent) {
      // Primary pointer only — ignore right/middle click + secondary contacts.
      if (e.button !== 0) return;
      const target = e.target as Element | null;
      const el = target?.closest?.(INTERACTIVE) as HTMLElement | null;
      if (!el) return;
      if (
        el.hasAttribute('disabled') ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.closest('[data-no-haptic]')
      ) {
        return;
      }
      // Synchronous inside the gesture — required for the iOS switch path.
      haptic('tick');
    }

    document.addEventListener('pointerdown', onPointerDown, {
      capture: true,
      passive: true,
    });
    return () =>
      document.removeEventListener(
        'pointerdown',
        onPointerDown,
        { capture: true } as EventListenerOptions,
      );
  }, []);

  return null;
}
