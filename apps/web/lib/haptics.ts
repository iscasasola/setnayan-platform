/**
 * Cross-platform light haptic feedback for tap-driven interactions.
 *
 * Why two paths:
 * - Android Chrome / installed PWA → navigator.vibrate (real motor pulse).
 * - iOS Safari 17.4+ → toggling a hidden <input type="checkbox" switch> plays a
 *   system haptic. Apple blocks navigator.vibrate entirely, so this switch-toggle
 *   is the ONLY web path on iPhone. It must run synchronously inside a real
 *   tap/gesture handler — outside a gesture (e.g. a scroll rAF callback) it
 *   silently no-ops (no haptic, no sound, no harm).
 * - Anywhere unsupported (older iOS, desktop, SSR) → silent no-op.
 *
 * Passive scroll-snap haptics therefore work on Android only; iOS has no web
 * path for non-tap haptics — that arrives with the native app (iteration 0052).
 *
 * Call haptic() SYNCHRONOUSLY inside the tap handler (before any await), or the
 * iOS path loses its gesture context and won't fire.
 */

export type HapticKind = 'tick' | 'select' | 'confirm';

const VIBRATE_PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 8, // gentle: rail snap, arm-to-remove
  select: 14, // medium: add to shortlist
  confirm: [16, 36, 22], // success-ish: lock a vendor / finalize a pick
};

let switchEl: HTMLInputElement | null = null;

function getSwitch(): HTMLInputElement | null {
  if (typeof document === 'undefined') return null;
  if (switchEl?.isConnected) return switchEl;
  try {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;opacity:0;pointer-events:none;overflow:hidden';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.tabIndex = -1;
    // Safari 17.4+ fires a system haptic when this toggles. Inert (a plain
    // off-screen checkbox) on every other engine, so it's safe to attach.
    input.setAttribute('switch', '');
    label.appendChild(input);
    (document.body ?? document.documentElement).appendChild(label);
    switchEl = input;
    return input;
  } catch {
    return null;
  }
}

/**
 * Fire a light haptic. Must be called synchronously inside a tap handler for the
 * iOS path to register.
 *
 * @param kind intensity bucket (tick | select | confirm)
 * @param opts.iosSwitch pass false in scroll/passive contexts — skips the iOS
 *   switch-toggle (which can't fire outside a gesture anyway), leaving it
 *   Android-only and avoiding redundant .click() calls during scrolling.
 */
export function haptic(
  kind: HapticKind = 'tick',
  opts?: { iosSwitch?: boolean },
): void {
  if (typeof window === 'undefined') return;

  const nav = window.navigator as Navigator & {
    vibrate?: (pattern: number | number[]) => boolean;
  };
  if (typeof nav.vibrate === 'function') {
    try {
      nav.vibrate(VIBRATE_PATTERNS[kind]);
      return;
    } catch {
      /* fall through to the iOS path */
    }
  }

  if (opts?.iosSwitch === false) return;
  const sw = getSwitch();
  if (sw) {
    try {
      sw.click();
    } catch {
      /* unsupported — silent no-op */
    }
  }
}
