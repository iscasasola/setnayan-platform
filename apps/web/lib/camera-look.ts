/**
 * lib/camera-look.ts — 🎛 THE GUEST CAMERA'S THREE LOOKS: Classic · Your brand ·
 * Challenges (owner 2026-10-06, DECISION_LOG "THE CAMERA HAS ITS OWN THREE
 * LAYOUTS"): *"camera will have a design that is classic meaning no design.
 * another layout is having their shutter button have their logo, have the focus
 * grid have their theme colors. another layout is having the challenge more
 * accessible?"*
 *
 *   classic     no design at all — a plain white shutter, white focus corners,
 *               neutral pills, no logo
 *   brand       the event's logo on the shutter; the focus corners and the
 *               pills in the theme's colour
 *   challenges  every Papic Challenge as a row of tappable chips just above the
 *               shutter (done ones greyed), instead of the panel below it
 *
 * The names are the Maker's (`MAKER_CAMERA_LAYOUTS`, `lib/maker-parts.ts`) —
 * one spelling, held equal by a test. No flash button in any look (the browser cannot honour one).
 *
 * ── WHERE THE PICK LIVES ────────────────────────────────────────────────────
 * No migration: `events.style_preferences.camera_look`, the same per-event JSON
 * the fixed parts' styles and the QR look already use. An absent, unknown or
 * malformed value is Classic. It sits beside — never inside — `scene_styles`,
 * whose five fixed scenes are pinned (`lib/the-day-parts-are-in-the-maker.test.ts`).
 *
 * Pure. No I/O. Client-safe.
 */
export const CAMERA_LOOKS = ['classic', 'brand', 'challenges'] as const;
export type CameraLook = (typeof CAMERA_LOOKS)[number];

/** The key inside `events.style_preferences`. */
export const CAMERA_LOOK_PREF_KEY = 'camera_look';

/** Each look's word — the Maker's `MAKER_CAMERA_LAYOUTS`, same order (restated so the
 *  camera's chunk does not carry the Maker's part map; `the-camera-tab-is-the-camera.test.ts`
 *  holds the two lists equal). */
export const CAMERA_LOOK_LABEL: Readonly<Record<CameraLook, string>> = {
  classic: 'Classic',
  brand: 'Your brand',
  challenges: 'Challenges',
};

export function isCameraLook(v: unknown): v is CameraLook {
  return typeof v === 'string' && (CAMERA_LOOKS as readonly string[]).includes(v);
}

/** The look out of an `events.style_preferences` blob (unknown shape). Absent → Classic. */
export function cameraLookFromPreferences(stylePreferences: unknown): CameraLook {
  const prefs = stylePreferences && typeof stylePreferences === 'object' && !Array.isArray(stylePreferences)
    ? (stylePreferences as Record<string, unknown>)
    : null;
  const v = prefs?.[CAMERA_LOOK_PREF_KEY];
  return isCameraLook(v) ? v : 'classic';
}

/** The colour the corners and pills wear — white for Classic and Challenges, the theme's for Your brand. */
export function cameraLookTint(look: CameraLook, themeAccent: string | null | undefined): string {
  const hex = typeof themeAccent === 'string' && /^#[0-9a-f]{6}$/i.test(themeAccent) ? themeAccent : null;
  return look === 'brand' && hex ? hex : '#FFFFFF';
}

/** Does this look put the event's logo on the shutter? Only Your brand. */
export function cameraLookDrawsLogo(look: CameraLook): boolean {
  return look === 'brand';
}

/** A word drawn ON the tint: near-black on a light colour, white on a dark one (WCAG relative luminance). */
export function cameraInkOn(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return '#111111';
  const lin = (c: string) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(m[1]!) + 0.7152 * lin(m[2]!) + 0.0722 * lin(m[3]!);
  return l > 0.179 ? '#111111' : '#FFFFFF';
}
