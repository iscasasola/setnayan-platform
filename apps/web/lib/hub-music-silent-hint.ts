/**
 * lib/hub-music-silent-hint.ts — "NO SOUND? YOUR PHONE MAY BE ON SILENT."
 *
 * Owner's real iPhone, 2026-11-01: with the ring/silent switch on silent, the Event Hub's song started, the music
 * button moved as if playing, and nothing was heard; with the switch off it played. Owner's ruling, verbatim:
 * *"keep it silently playing but a message saying the audio is playing but your phone is in silent/muted?"*
 *
 *   · The song keeps respecting the silent switch — no `audioSession = 'playback'` (that would override it).
 *   · On iPhone and iPad only, each time the song starts, a short hint shows under the button and fades.
 *   · A web page CANNOT read the silent switch, so the hint never claims to know: it says "may be".
 *   · Android and desktop have no silent switch that mutes a page's media, so they never see it.
 *
 * Pure: callers pass what they read from `navigator`. Held by `lib/hub-music-silent-hint.test.ts`.
 */
import { isAppleTouchDevice } from './apple-device';

/** The words. "may" on purpose: the switch is unreadable from a web page. */
export const SILENT_HINT_COPY = 'Music is on. No sound? Your phone may be on silent.';

/** How long the hint stays fully visible, then how long its fade takes (no fade under reduced motion). */
export const SILENT_HINT_SHOW_MS = 4000;
export const SILENT_HINT_FADE_MS = 700;

/**
 * Whether a song that just started should carry the silent hint: only on an iPhone or iPad (the app's web view,
 * the "View Event Hub" sheet and Safari all included — an iPad that says "Macintosh" is told by its touch points).
 */
export function songStartNeedsSilentHint(userAgent: string | null | undefined, maxTouchPoints?: number | null): boolean {
  return isAppleTouchDevice(userAgent, maxTouchPoints);
}
