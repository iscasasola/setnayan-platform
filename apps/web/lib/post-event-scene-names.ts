/**
 * lib/post-event-scene-names.ts — 🏷 EVERY POST EVENT SCENE'S SHIPPED NAME, by its
 * key — the one home of the words the navigator prints (`lib/post-event-scenes.ts`
 * builds every scene with these) and the Maker's ＋ sheet lists
 * (`lib/maker-part-groups.ts`, DECISION_LOG 2026-10-06 "POST EVENT: EVERY SHIPPED
 * AUTO SCENE CAN BE ADDED"). The day's chapters are named per day, not here.
 *
 * Its own module on purpose: the Maker's lazy Stages panel reads the names
 * without dragging the story compiler into a chunk the Maker's first load
 * shares (`scripts/check-maker-js-budget.mjs`).
 */
import { PHOTO_NOTES_LABEL } from './post-event-styles';

export const POST_EVENT_SCENE_NAMES: Readonly<Record<string, string>> = {
  cover: 'Front Page',
  before: 'The Road to the Day',
  numbers: 'Statistics',
  gallery: 'Gallery',
  film: 'Watch Live',
  videos: 'Videos',
  you: 'Were you there?',
  wishes: PHOTO_NOTES_LABEL,
  asked: 'Papic Challenge',
  letters: 'Messages',
  vendors: 'Supplier Stories',
  wall: 'Live Photo Wall',
  said: 'What They Said',
  powered: 'Powered by Setnayan',
  loved: 'Suppliers We Loved',
  seating: 'Where Everyone Sat',
  entourage: 'Entourage',
  beforeAfter: 'Before & After',
  couple: 'Thank You',
  song: 'Song',
  next: 'What comes next',
};
