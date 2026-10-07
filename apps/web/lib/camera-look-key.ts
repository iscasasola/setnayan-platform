/**
 * lib/camera-look-key.ts — 🎛 THE GUEST CAMERA'S THREE LOOKS, AS DATA: the keys, where the pick is stored, and
 * the check. Everything else about a look (its word, its tint, its ink) is `lib/camera-look.ts`, which re-exports
 * these — so there is one spelling of each.
 *
 * ⚡ WHY ITS OWN FILE: the hub draft (`lib/hub-draft.ts`) reads only this much, and the hub draft is on the Event
 * Hub Maker's first load (`scripts/check-maker-js-budget.mjs`). A file is carried whole wherever any of it is used.
 *
 * Pure. No I/O. Client-safe.
 */
export const CAMERA_LOOKS = ['classic', 'brand', 'challenges'] as const;
export type CameraLook = (typeof CAMERA_LOOKS)[number];

/** The key inside `events.style_preferences`. */
export const CAMERA_LOOK_PREF_KEY = 'camera_look';

export function isCameraLook(v: unknown): v is CameraLook {
  return typeof v === 'string' && (CAMERA_LOOKS as readonly string[]).includes(v);
}
