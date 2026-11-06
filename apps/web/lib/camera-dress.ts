/**
 * lib/camera-dress.ts — 📷 THE ONE GUEST CAMERA, AND ITS PRO DRESS.
 *
 * Owner, 24 Oct 2026, verbatim: *"place this as a style template for the
 * camera. remove the other style template"* — then, final: *"Free: plain camera
 * with a small Setnayan mark on saved photos. Pro: their logo on the shutter,
 * theme colours, and their monogram on saved photos. No frames."*
 *
 * So there is ONE camera (`prototypes/papic_camera_complete_2026-10-24_fable.html`)
 * and no look to pick: the three looks of 06 Oct (Classic · Your brand ·
 * Challenges) and the Maker's Camera Style dropdown are gone. What "Your brand"
 * drew — the event's logo on the shutter, the theme's colour on the corners and
 * the pills — is now simply what a PRO event's camera wears. Pro is the event's
 * Logo & QR part (or Full Pro), read with the existing part gate
 * (`eventHubPartActive(…, 'logo_qr')`) — an unlock belongs to the event.
 *
 * A stored `events.style_preferences.camera_look` (zero events had one when this
 * shipped) is simply never read again.
 *
 * Pure. No I/O. Client-safe.
 */

/** White — the free camera's corners and pills. */
export const CAMERA_PLAIN_TINT = '#FFFFFF';

/** The colour the corners and the chosen pills wear: the theme's accent on a Pro event, else white. */
export function cameraDressTint(pro: boolean, themeAccent: string | null | undefined): string {
  const hex = typeof themeAccent === 'string' && /^#[0-9a-f]{6}$/i.test(themeAccent) ? themeAccent : null;
  return pro && hex ? hex : CAMERA_PLAIN_TINT;
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
