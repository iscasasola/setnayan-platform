'use client';

/**
 * Haptic-feedback toggle (owner directive 2026-06-03 follow-up — "wire a UI
 * switch" for the app-wide tap haptics shipped in PR #892).
 *
 * Writes the `setnayan-haptics` localStorage key that GlobalHaptics reads
 * (`off` disables). Lives in the customer-profile Appearance section next to
 * the theme picker — the established home for device/appearance preferences
 * (theme switching is likewise customer-profile-only).
 *
 * Live, no reload: after writing the key we dispatch `setnayan-haptics-change`
 * so the mounted GlobalHaptics listener re-reads it immediately. On enable we
 * fire a `confirm` pulse so the user feels the result of the switch.
 *
 * `data-no-haptic` on the switch suppresses the global press `tick` so toggling
 * OFF is silent (and ON gets the explicit `confirm` instead of a doubled buzz).
 */

import { useEffect, useState } from 'react';
import { Vibrate } from 'lucide-react';
import { haptic } from '@/lib/haptics';

const KEY = 'setnayan-haptics';

export function HapticsToggle() {
  // Default ON; reconcile with localStorage after mount (SSR-safe — the server
  // can't read localStorage, so we render the default then correct on hydrate).
  const [on, setOn] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(KEY) !== 'off');
    } catch {
      /* storage blocked (private mode) — keep default on */
    }
    setReady(true);
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      window.localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    // Tell the live GlobalHaptics listener to re-read without a page reload.
    window.dispatchEvent(new Event('setnayan-haptics-change'));
    // Let the user FEEL the result the instant they switch it on.
    if (next) haptic('confirm');
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-ink/10 bg-cream p-4">
      <span className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/5 text-ink/70"
        >
          <Vibrate className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-ink">Haptic feedback</span>
          <span className="text-xs text-ink/55">
            A gentle tap when you press buttons. Works on most phones; does
            nothing on desktop.
          </span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Haptic feedback"
        data-no-haptic
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          on ? 'bg-terracotta' : 'bg-ink/20'
        } ${ready ? '' : 'opacity-60'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-cream shadow transition-transform ${
            on ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
