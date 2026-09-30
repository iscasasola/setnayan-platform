/**
 * 🎞 THE TWELVE POST EVENT PRESETS' IDS — the stored value on a scene's canvas
 * (`canvas.postEventPreset`), and the check a stored value must pass.
 *
 * Split from `lib/post-event-presets.ts` (2026-09-29, the Maker JS budget): the
 * canvas sanitizer (`lib/hub-canvas.ts`, on every page) needs only these; the
 * presets' names, purposes and templates load with the Post Event "+" sheet.
 *
 * Pure. No I/O. Client-safe.
 */

export const POST_EVENT_PRESET_IDS = [
  'thank_you_from_us',
  'the_toast',
  'best_of',
  'before_and_after',
  'behind_the_scenes',
  'what_almost_happened',
  'by_our_count',
  'near_and_far',
  'our_playlist',
  'the_guestbook',
  'wish_you_were_here',
  'since_then',
] as const;
export type PostEventPresetId = (typeof POST_EVENT_PRESET_IDS)[number];

export function isPostEventPresetId(v: unknown): v is PostEventPresetId {
  return typeof v === 'string' && (POST_EVENT_PRESET_IDS as readonly string[]).includes(v);
}
