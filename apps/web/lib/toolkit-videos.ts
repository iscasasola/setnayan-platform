/**
 * 🎞 A SHORT VIDEO AT THE TOP OF EACH PAID WIDGET'S TOOLKIT PAGE (DECISION_LOG 4c07edd7, owner 23 Nov 2026): *"for Papic
 * Challenge, how they set up and then how that challenge shows up on the Papic app. Same goes to the 3D plan."*
 *
 * Each clip (5–10 s, silent, looping, phone size) shows the set-up, then the widget where it shows. It is a PREVIEW, not
 * a "try it first" demo. The video-loops session records them from the real screens with sample data and uploads them
 * to R2 `setnayan-media`; this file only names the object key for each widget. `null` = not recorded yet → the page
 * renders NOTHING in that slot (no frame, no placeholder, no "coming soon").
 *
 * Pure. The URL is built server-side from the key (`lib/toolkit-videos.server.ts`). 🔒 lib/supplier-store.test.ts
 */
import type { PaidStoreTool } from './supplier-store';

/** The `setnayan-media` object key of each paid widget's clip; null until it is recorded. */
export const TOOL_VIDEO_KEYS: Readonly<Record<PaidStoreTool, string | null>> = {
  cake_tool: null,
  song_bank: null,
  papic_challenge: null,
  plan_3d: null,
};

/** The key of this widget's clip, or null (not a paid widget, or not recorded yet). */
export function toolVideoKey(tool: string): string | null {
  const key = (TOOL_VIDEO_KEYS as Readonly<Record<string, string | null>>)[tool];
  return typeof key === 'string' && key.trim() !== '' ? key.trim() : null;
}
