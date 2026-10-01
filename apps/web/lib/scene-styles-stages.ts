/**
 * apps/web/lib/scene-styles-stages.ts
 *
 * THE SAVE THE DATE · INVITATION · THE DAY SCENE STYLES — this file is theirs.
 *
 * Owner, 2026-09-29 ("EVERY SCENE ON EVERY STAGE HAS AT LEAST THREE PREMADE
 * STYLES"): *"we want at least 3 choices for each scene that are premade. even
 * the countdown and other scenes"*. Designs: `prototypes/every_scene_three_
 * styles_2026-09-29.html`. Put each section's styles here as `SceneStyleSet`s
 * (`lib/scene-styles.ts` merges this list with Post Event's own): the type is
 * the row's scene type (`sceneStyleTypeOfWidget` — a row is its own type except
 * `our_photos`, which is `gallery`), each style's `stages` are where its
 * renderer draws it, and the first drawn on a stage is its default unless
 * `defaults` names another.
 *
 * 🔑 A STYLE THAT SHARES A NAME WITH POST EVENT'S KEEPS POST EVENT'S ID —
 * `schedule`: `one-per-screen` · `clock-face`; `gallery`: `grid` · `mosaic` ·
 * `film-strip` — list it here with this file's `stages` and the registry makes
 * it ONE style drawn on both, so the couple's one pick carries across stages.
 *
 * ── WHO DRAWS THEM ─────────────────────────────────────────────────────────
 * Style A of every set is the shipped component, unchanged. B and C live next
 * to it as `<scene>-styles.tsx` in `app/[slug]/_components/`, pure and
 * props-in; the shipped component takes a `sceneStyle` prop and hands its own
 * data to them. A style re-arranges the scene's EXISTING data — no new field,
 * no new question, no new query.
 *
 * ── THE DEFAULT IS ALWAYS THE SHIPPED LOOK (controller, 2026-09-29) ───────
 * No surprise changes to a live page: every scene's default on every stage is
 * its style A — today's look — so an event with no stored style draws exactly
 * what it drew before this file had any sets. The prototype's
 * "Recommended" is a HINT on that option in the Style dropdown
 * (`recommendedStageSceneStyle`, read by `scene-style-row.tsx`), never a
 * default.
 *
 * ── THE FIVE FIXED PARTS ───────────────────────────────────────────────────
 * The entourage, Find your seat, each guest's own photos, the announcements and
 * the live hub have no section row, so their pick is not a `canvas.style`: it
 * lives in `events.style_preferences.scene_styles` (`lib/fixed-scene-styles.ts`),
 * drafted and written by Apply like every other Maker edit. Their sets are
 * registered here like any other, so the ONE resolver answers for them too.
 */
import type { HubStage } from '@/lib/hub-canvas';
import type { SceneStyleSet } from '@/lib/scene-styles';

const STD: readonly HubStage[] = ['save_the_date'];
const INV: readonly HubStage[] = ['rsvp'];
const DAY: readonly HubStage[] = ['event'];
const STD_INV: readonly HubStage[] = ['save_the_date', 'rsvp'];
const INV_DAY: readonly HubStage[] = ['rsvp', 'event'];
const BEFORE_AFTER: readonly HubStage[] = ['save_the_date', 'rsvp', 'event'];

export const STAGE_SCENE_STYLE_SETS: readonly SceneStyleSet[] = [
  {
    type: 'countdown',
    label: 'Countdown',
    styles: [
      { id: 'four-tiles', name: 'Four tiles', line: 'Days · hours · minutes · seconds, a tile each.', stages: STD_INV },
      { id: 'big-number', name: 'Big number', line: 'The days, large; the rest in one line.', template: 12, stages: STD_INV },
      { id: 'calendar', name: 'The calendar', line: 'The month, the day marked, the count under it.', stages: STD_INV },
    ],
  },
  {
    type: 'special_message',
    label: 'Special message',
    styles: [
      { id: 'note', name: 'The note', line: 'Your message on a plate, in italics.', stages: INV },
      { id: 'letter', name: 'The letter', line: 'A drop cap, a narrow column, signed with your names.', template: 11, stages: INV },
      { id: 'quote', name: 'The quote', line: 'Your first sentence large; the rest under a rule.', stages: INV },
    ],
  },
  {
    type: 'our_love_story',
    label: 'Love Story',
    styles: [
      { id: 'chapters', name: 'Chapters', line: 'One part per moment, in story order.', stages: STD_INV },
      { id: 'essay', name: 'The essay', line: 'A drop cap, a pull quote, the milestones as a list.', stages: STD_INV },
      { id: 'years', name: 'The years', line: 'A rail of years — tap one and its line opens. One screen.', stages: STD_INV },
    ],
  },
  {
    type: 'event_details',
    label: 'The details',
    styles: [
      { id: 'plate', name: 'The plate', line: 'When, then each place, an icon each.', stages: INV },
      { id: 'big-date', name: 'Big date, two places', line: 'The day as a number, the places side by side.', stages: INV },
      { id: 'card', name: 'The card', line: 'Centred and small caps, like the printed invitation.', stages: INV },
    ],
  },
  {
    type: 'schedule',
    label: 'Schedule',
    styles: [
      { id: 'programme-rail', name: 'Programme rail', line: 'A time column and hairlines; the live row marked.', stages: INV_DAY },
      { id: 'one-per-screen', name: 'One chapter per screen', line: 'One moment fills the screen; the live one opens first.', stages: INV_DAY },
      { id: 'clock-face', name: 'Clock face', line: 'The day around a dial; tap a moment for the rest.', stages: INV_DAY },
    ],
    // Post Event registers its styles first, so without this the first style
    // drawn here would be theirs — the shipped rail stays the default.
    defaults: { rsvp: 'programme-rail', event: 'programme-rail' },
  },
  {
    type: 'venue_map',
    label: 'Venue map',
    styles: [
      { id: 'map-and-plate', name: 'Map and plate', line: 'One map and one plate per place, stacked.', stages: INV_DAY },
      { id: 'one-map', name: 'One map, two pins', line: 'Every place on one map, numbered, with a row each.', stages: INV_DAY },
      { id: 'full-map', name: 'Full map', line: 'The map is the scene; the places float over it.', stages: INV_DAY },
    ],
  },
  {
    type: 'dress_code',
    label: 'Dress code',
    styles: [
      { id: 'colours-and-roles', name: 'Colours and roles', line: 'Your words, your colours, then a row per role.', stages: INV },
      { id: 'palette', name: 'The palette', line: 'The colours first, large, each with who wears it.', stages: INV },
      { id: 'line', name: 'The line', line: 'Words first, the palette as one ribbon, roles as a quiet table.', stages: INV },
    ],
  },
  {
    type: 'what_to_bring',
    label: 'What to bring',
    styles: [
      { id: 'note', name: 'The note', line: 'Your words on a plate, as written.', stages: INV },
      { id: 'list', name: 'The list', line: 'Each paragraph you wrote is a row.', stages: INV },
      { id: 'gift-line', name: 'The gift line', line: 'Your first sentence large; the rest under a rule.', stages: INV },
    ],
  },
  {
    type: 'photo_moments',
    label: 'Camera cues',
    styles: [
      { id: 'cards', name: 'Cards', line: 'One card per moment, with its badge.', stages: DAY },
      { id: 'down-the-day', name: 'Down the day', line: 'In time order, one row each.', stages: DAY },
      { id: 'yes-and-no', name: 'Yes and no', line: 'When to shoot, and when to put the phone away.', stages: DAY },
    ],
  },
  {
    type: 'rsvp',
    label: 'RSVP',
    styles: [
      { id: 'reply-card', name: 'The reply card', line: 'The printed card: your number, the perforation, the answers.', stages: BEFORE_AFTER },
      { id: 'question', name: 'The question', line: 'One question by name, with big answers.', stages: BEFORE_AFTER },
      { id: 'ticket', name: 'The ticket', line: 'A tear-off ticket; the answers as stamps.', stages: BEFORE_AFTER },
    ],
  },
  {
    type: 'gallery',
    label: 'Photos',
    styles: [
      { id: 'mosaic', name: 'Mosaic', line: 'A cover photo, then two across, offset.', stages: STD },
      { id: 'grid', name: 'Grid', line: 'Three across, every photo the same size.', stages: STD },
      { id: 'film-strip', name: 'Film strip', line: 'Strips that slide sideways.', stages: STD },
    ],
    // Post Event's Grid is listed first; the shipped Save the Date look stays the default.
    defaults: { save_the_date: 'mosaic' },
  },
  /* ── The five fixed parts (picks in `events.style_preferences.scene_styles`). ── */
  {
    type: 'entourage',
    label: 'Entourage',
    styles: [
      { id: 'roll-call', name: 'Roll call', line: 'Each group under its heading, pairs side by side.', stages: INV_DAY },
      // Sides are read from roles only a wedding's entourage carries.
      { id: 'two-sides', name: 'Two sides', line: 'The two sides as two columns; the pairs under a rule.', stages: INV_DAY, eventTypes: ['wedding'] },
      { id: 'march', name: 'The march', line: 'Numbered, in walking order, each role under its names.', stages: INV_DAY },
    ],
  },
  {
    type: 'find_your_seat',
    label: 'Find your seat',
    styles: [
      { id: 'map', name: 'The map', line: 'Their table, the room map and the path to it.', stages: DAY },
      { id: 'table-number', name: 'The table number', line: 'The number fills the screen; the map is a tap away.', stages: DAY },
      { id: 'place-card', name: 'The place card', line: 'Their name on a place card, the map beneath.', stages: DAY },
    ],
  },
  {
    type: 'photos_of_you',
    label: "Each guest's own photos",
    styles: [
      { id: 'grid', name: 'The grid', line: 'Three across, with the count.', stages: DAY },
      { id: 'lead', name: 'The big one', line: 'The latest photo large, the rest as a strip.', stages: DAY },
      { id: 'polaroids', name: 'Polaroids', line: 'Each photo as an instant print, with its time.', stages: DAY },
    ],
  },
  {
    type: 'announcements',
    label: 'Announcements',
    styles: [
      { id: 'banner', name: 'The banner', line: 'A banner at the top of the page.', stages: INV_DAY },
      { id: 'notice', name: 'The notice', line: 'The first sentence as a headline.', stages: INV_DAY },
      { id: 'line', name: 'The line', line: 'One quiet line.', stages: INV_DAY },
    ],
  },
  {
    type: 'live_hub',
    label: 'Live hub',
    styles: [
      { id: 'player-and-wall', name: 'Player and wall', line: 'The live player, then the photo wall.', stages: DAY },
      { id: 'theatre', name: 'Theatre', line: 'Dark, the player first and large, the wall under it.', stages: DAY },
      { id: 'wall-first', name: 'Wall first', line: 'The photo wall leads; the player follows.', stages: DAY },
    ],
  },
];

/**
 * THE PROTOTYPE'S "RECOMMENDED", AS A HINT — never a default.
 * (`prototypes/every_scene_three_styles_2026-09-29.html`, each scene's
 * Recommended line.) Only the recommendations the Maker can know from the
 * stage and the event type are here; the data-dependent ones (two venues, a
 * saved march order, a Save the Date that leads with its film) are not
 * guessed. Absent = the stage's default carries the hint, as for Post Event.
 */
const RECOMMENDED: Readonly<Record<string, (stage: HubStage, eventType: string | null) => string | null>> = {
  countdown: (stage) => (stage === 'save_the_date' ? 'big-number' : 'four-tiles'),
  our_love_story: (stage) => (stage === 'save_the_date' ? 'years' : 'chapters'),
  event_details: (_s, t) => (t === 'wedding' || t === 'debut' ? 'card' : 'plate'),
  schedule: (stage) => (stage === 'event' ? 'one-per-screen' : stage === 'rsvp' ? 'programme-rail' : null),
  photo_moments: (stage) => (stage === 'event' ? 'down-the-day' : null),
  rsvp: () => 'question',
  find_your_seat: (stage) => (stage === 'event' ? 'table-number' : null),
};

/** The style the prototype recommends for this scene here, or null for "the default". */
export function recommendedStageSceneStyle(type: string, stage: HubStage, eventType: string | null): string | null {
  const rule = RECOMMENDED[type];
  if (!rule) return null;
  const id = rule(stage, eventType);
  if (!id) return null;
  const set = STAGE_SCENE_STYLE_SETS.find((x) => x.type === type);
  const st = set?.styles.find((x) => x.id === id);
  return st && (!st.stages || st.stages.includes(stage)) ? id : null;
}
