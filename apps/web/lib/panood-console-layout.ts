/**
 * Which Live Studio console layout an operator gets — the director BOARD or the COMPACT stack.
 *
 * ── Why this is not a CSS breakpoint ────────────────────────────────────────────────────────
 * The console used `lg:` (1024px VIEWPORT width), which conflates "narrow window" with "small
 * device". For an ordinary page that is fine. For a live production console it breaks the exact
 * workflow this feature was designed around:
 *
 *   The operator runs OBS beside the control room. Snap two windows side by side on a 1440px
 *   laptop and each gets ~720px — under the breakpoint — so the director board collapses into
 *   the phone layout at precisely the moment they are setting up to broadcast.
 *
 * So the decision keys off the DEVICE (physical screen + pointer type), which a window resize
 * cannot change. A laptop stays a laptop at any window width; a phone still gets the phone UI.
 *
 * Two further rules, both about not surprising someone mid-ceremony:
 *   • An explicit operator choice always wins, and persists.
 *   • Once ON AIR, automatic re-detection stops. A layout reflow during the processional is
 *     exactly the kind of thing that makes an operator miss a cut. A deliberate manual switch
 *     still works — the operator is allowed to change their own mind; the browser is not.
 *
 * NOTE: camera capability is NOT affected by any of this. Caps come from the entitlement tier
 * (`panoodCameraCapForTier`), server-side. A narrow window never costs an operator a camera.
 */

export type ConsoleLayout = 'board' | 'compact';

/** localStorage key for the operator's explicit choice. Deliberately global, not per-event —
 *  it is a statement about their hardware, which does not change between weddings. */
export const CONSOLE_LAYOUT_STORAGE_KEY = 'setnayan:panood:console-layout';

/**
 * Minimum PHYSICAL screen width for the board. Matches Tailwind's `lg`, but read from
 * `screen.width` rather than the viewport so it describes the machine, not the window.
 */
export const BOARD_MIN_SCREEN_WIDTH = 1024;

export type LayoutSignals = {
  /** Operator's explicit choice, or null if they have never set one. */
  override: ConsoleLayout | null;
  /** `matchMedia('(pointer: fine)')` — a mouse/trackpad, i.e. not a touch-primary device. */
  pointerFine: boolean;
  /** `window.screen.width` — the DEVICE's screen, unaffected by resizing the window. */
  screenWidth: number;
  /** Layout captured when the show went on air, or null if not live. */
  frozen: ConsoleLayout | null;
};

/** What the device alone implies, ignoring overrides and freezing. */
export function deviceLayout(pointerFine: boolean, screenWidth: number): ConsoleLayout {
  return pointerFine && screenWidth >= BOARD_MIN_SCREEN_WIDTH ? 'board' : 'compact';
}

/**
 * The resolved layout.
 *
 * Precedence: explicit override → frozen-while-live → device.
 *
 * Override outranks the freeze on purpose: the freeze exists to stop the BROWSER changing the
 * console under the operator, not to stop the operator changing it themselves.
 */
export function resolveConsoleLayout(s: LayoutSignals): ConsoleLayout {
  if (s.override) return s.override;
  if (s.frozen) return s.frozen;
  return deviceLayout(s.pointerFine, s.screenWidth);
}

/** Narrow unknown localStorage content — anything unrecognised means "no preference". */
export function parseStoredLayout(raw: string | null): ConsoleLayout | null {
  return raw === 'board' || raw === 'compact' ? raw : null;
}
