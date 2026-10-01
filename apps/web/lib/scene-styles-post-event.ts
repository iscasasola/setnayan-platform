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
    type: 'road-to-the-day',
    label: 'The Road to the Day',
    styles: [
      { id: 'countdown', name: 'Countdown timeline', line: 'Days to go as the big number at each step of the way.', template: 24, stages: PE },
      { id: 'diary', name: 'Diary', line: 'The month in the margin, one line per step.', stages: PE },
      { id: 'scrapbook', name: 'Scrapbook', line: 'Each step pinned at an angle, written in by hand.', stages: PE },
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
    type: 'photo-notes',
    label: 'Photo Notes',
    styles: [
      { id: 'photo-note', name: 'Photo + note card', line: 'The photo on top, what they said under it, signed.', stages: PE },
      { id: 'scrapbook-pairs', name: 'Scrapbook pairs', line: 'Photo and note side by side, alternating sides.', stages: PE },
      { id: 'swipe-story', name: 'Swipe story', line: 'One full photo at a time, the message across it — swipe for the next.', stages: PE },
    ],
  },
  {
    /* The Messages scene holds the guests' LETTERS (`guest_columns`) — long, so
       the prototype's own note ("letters get B on their own — one voice per
       screen — because they are long") makes One letter at a time the default. */
    type: 'messages',
    label: 'Messages',
    styles: [
      { id: 'one-letter', name: 'One letter at a time', line: 'One voice per screen, with a drop cap — swipe between letters.', template: 11, stages: PE },
      { id: 'note-wall', name: 'Note wall', line: 'Every letter as a pinned note.', stages: PE },
      { id: 'quote-cards', name: 'Quote cards', line: 'Three big quotes, each with its name.', template: 9, stages: PE },
    ],
  },
  {
    type: 'papic-challenge',
    label: 'Papic Challenge',
    styles: [
      { id: 'q-and-a', name: 'Q&A cards', line: 'Each question with its first answers.', template: 25, stages: PE },
      { id: 'photo-grid', name: 'Photo answers grid', line: 'One question per screen, its photo answers three across.', stages: PE },
      { id: 'answer-share', name: 'Share of answers', line: 'Which question drew the most answers, as a track each.', stages: PE },
    ],
  },
  {
    type: 'where-everyone-sat',
    label: 'Where Everyone Sat',
    styles: [
      { id: 'floor-plan', name: 'Floor plan', line: 'The room from above; a guest’s own table in gold.', stages: PE },
      { id: 'room-3d', name: '3D room', line: 'The seat plan, tilted — a guest’s own table marked.', stages: PE },
      { id: 'by-table', name: 'List by table', line: 'Each table in a list; a guest’s own row marked.', stages: PE },
    ],
  },
  {
    type: 'entourage',
    label: 'Entourage',
    styles: [
      { id: 'roll-call', name: 'Roll call', line: 'Each role and its names, like the invitation’s list.', stages: PE },
      { id: 'portrait-grid', name: 'Portrait grid', line: 'A circle for each person, three across.', stages: PE },
      { id: 'family-tree', name: 'Family tree', line: 'The two of you at the root, then parents, sponsors and the party.', stages: PE },
    ],
  },
  {
    type: 'supplier-stories',
    label: 'Supplier Stories',
    styles: [
      { id: 'credits-roll', name: 'Credits roll', line: 'Role and name, like the credits of a film.', stages: PE },
      { id: 'photo-strip', name: 'Photo strip', line: 'One panel per supplier, swiped.', template: 20, stages: PE },
      { id: 'side-by-side', name: 'Side by side', line: 'Each supplier’s own photo beside what you said about them.', template: 17, stages: PE },
    ],
  },
  {
    type: 'live-stream',
    label: 'Watch Live',
    styles: [
      { id: 'replay-card', name: 'Watch-the-replay card', line: 'A poster, one line, one button.', stages: PE },
      { id: 'full-replay', name: 'Full replay', line: 'The replay large, with the broadcast’s own numbers under it.', template: 14, stages: PE },
      { id: 'by-chapter', name: 'Highlights by chapter', line: 'The replay, listed by the chapters of the day.', stages: PE },
    ],
  },
  {
    type: 'videos',
    label: 'Videos',
    styles: [
      { id: 'featured', name: 'Featured film', line: 'The first film leads; the rest sit beneath it.', stages: PE },
      { id: 'playlist-row', name: 'Playlist row', line: 'The films side by side, swiped.', stages: PE },
      { id: 'film-grid', name: 'Grid', line: 'The first film wide, the rest two across.', stages: PE },
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
