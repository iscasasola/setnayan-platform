/**
 * 🎬 The two words between ▶ on the Cover Scene (`play-sequence.ts` `playCover`) and the guests' own veil it mounts
 * (`reveal/cover-play-opening.tsx`) — a module of their own, so the veil's side never imports the preview's player
 * (`the-play-button-previews.test.ts` (5): the player is the canvas bridge's alone).
 */
export const COVER_PLAY_OPENING_EVENT = 'setnayan:cover-play-opening';
export type CoverPlayOpeningDetail = { on: boolean; liftAfterMs: number };
/** …and the veil says when it starts to rise: the lines enter on that moment, not on a clock of their own. */
export const COVER_PLAY_LIFT_EVENT = 'setnayan:cover-play-lift';
