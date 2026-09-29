/**
 * apps/web/lib/scene-styles-post-event.ts
 *
 * POST EVENT'S SCENE STYLES — each scene type, every style the approved
 * prototype draws (`prototypes/post_event_scenes_styles_2026-09-29.html`),
 * registered in the ONE registry (`lib/scene-styles.ts`).
 *
 * Owner, 2026-09-29 (DECISION_LOG "POST EVENT: EVERY STYLE OF EVERY SCENE
 * SHIPS"): *"those are all designs that we they can pick from. all should work.
 * and they pick since we already have the designs"*. The default per type is
 * the prototype's gold "Recommended", listed FIRST.
 *
 * 🚧 A TYPE IS REGISTERED ONLY ONCE ITS STYLES ARE DRAWN (`post-event-scene-
 * views.tsx`). The rest of the seventeen keep their shipped block and offer no
 * dropdown until their slice lands — see `POST_EVENT_SCENE_TYPE_LABEL`.
 *
 * Every style here is drawn on Post Event (`stages: ['editorial']`); another
 * stage that draws the same look registers the same id in its own file and the
 * registry unions the stages (Schedule's `one-per-screen` · `clock-face`,
 * Gallery's `grid` · `mosaic` · `film-strip` — one value across stages).
 */
import type { SceneStyleSet } from '@/lib/scene-styles';

const PE = ['editorial'] as const;

export const POST_EVENT_SCENE_STYLE_SETS: readonly SceneStyleSet[] = [
  {
    type: 'front-page',
    label: 'Front Page',
    styles: [
      { id: 'full-bleed', name: 'Full-bleed photo', line: 'Your hero photo fills the screen; the words sit low over it.', template: 4, stages: PE },
      { id: 'magazine', name: 'Magazine cover', line: 'A masthead, one photo, your names as the headline, three facts underneath.', stages: PE },
      { id: 'card', name: 'The Card', line: 'The card your guests know from the Save the Date — now in the past tense.', stages: PE },
    ],
  },
  {
    type: 'statistics',
    label: 'Statistics',
    styles: [
      { id: 'big-numbers', name: 'Big numbers', line: 'One figure leads; the rest step down. Numbers only.', template: 12, stages: PE },
      { id: 'receipt', name: 'Receipt tally', line: 'The day itemised like a till receipt. “Total: one day.”', stages: PE },
      { id: 'infographic', name: 'Infographic row', line: 'A track, a ring and dots — one comparison each.', stages: PE },
    ],
  },
  {
    type: 'schedule',
    label: 'Schedule',
    styles: [
      { id: 'one-per-screen', name: 'One chapter per screen', line: 'A big photo per chapter, then the next one is announced.', template: 1, stages: PE },
      { id: 'timeline', name: 'Timeline', line: 'Every chapter of the day on one screen, with a strip of its photos.', stages: PE },
      { id: 'clock-face', name: 'Clock face', line: 'The chapters placed around a dial by their time.', stages: PE },
    ],
  },
  {
    type: 'gallery',
    label: 'Gallery',
    styles: [
      { id: 'grid', name: 'Grid', line: 'Two columns of photos, filed by the time they were taken.', stages: PE },
      { id: 'mosaic', name: 'Mosaic', line: 'Wide and tall photos break the grid.', template: 21, stages: PE },
      { id: 'film-strip', name: 'Film strip', line: 'One frame at a time, with its frame number.', template: 20, stages: PE },
    ],
  },
  {
    type: 'thank-you',
    label: 'Thank You',
    styles: [
      { id: 'letter', name: 'Letter', line: 'Your own words, signed.', template: 11, stages: PE },
      { id: 'words-only', name: 'Words only', line: 'Two big words and a line — nothing else on the screen.', template: 8, stages: PE },
      { id: 'photo-words', name: 'Photo + words', line: 'A photo on top, your words under it.', template: 3, stages: PE },
    ],
  },
];
