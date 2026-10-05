/**
 * The word the watch-live surfaces say for the occasion — "Watch the event live".
 *
 * Owner rule (2026-10-04): say "event", never "celebration". `EventWords.occasion`
 * is "celebration" for most event types (a funeral's is "gathering"), and the
 * live card, the camera picker, the embed and the Facebook card each printed it
 * verbatim. One mapping, so the four cannot drift.
 */
export function watchLiveOccasion(occasion: string | null | undefined): string {
  const word = (occasion ?? '').trim();
  return !word || word === 'celebration' ? 'event' : word;
}
