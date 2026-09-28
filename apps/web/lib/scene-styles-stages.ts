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
 * ── NOT REGISTERED HERE, ON PURPOSE ────────────────────────────────────────
 * The entourage, Find your seat, each guest's own photos, the announcements and
 * the live hub have their three styles drawn (`entourage-styles.tsx`,
 * `your-seat-styles.tsx`, `photos-of-you-styles.tsx`,
 * `announcement-styles.tsx`, `live-hub-styles.tsx`) but NO section row, so
 * there is no `canvas.style` for a pick to live in. Registering them would
 * offer a dropdown whose pick cannot be saved, or draw a default nobody can
 * change back. They join this list the day they have a home.
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
    // On the Save the Date the number is the whole message.
    defaults: { save_the_date: 'big-number' },
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
    defaults: { save_the_date: 'years' },
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
    // On The Day a guest wants "now" and nothing else.
    defaults: { rsvp: 'programme-rail', event: 'one-per-screen' },
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
    // Time order is what a guest checks on the day.
    defaults: { event: 'down-the-day' },
  },
  {
    type: 'rsvp',
    label: 'RSVP',
    styles: [
      { id: 'reply-card', name: 'The reply card', line: 'The printed card: your number, the perforation, the answers.', stages: BEFORE_AFTER },
      { id: 'question', name: 'The question', line: 'One question by name, with big answers.', stages: BEFORE_AFTER },
      { id: 'ticket', name: 'The ticket', line: 'A tear-off ticket; the answers as stamps.', stages: BEFORE_AFTER },
    ],
    // One tap answers the one thing the hosts need; the rest follows on "yes".
    defaults: { save_the_date: 'question', rsvp: 'question', event: 'question' },
  },
  {
    type: 'gallery',
    label: 'Photos',
    styles: [
      { id: 'mosaic', name: 'Mosaic', line: 'A cover photo, then two across, offset.', stages: STD },
      { id: 'grid', name: 'Grid', line: 'Three across, every photo the same size.', stages: STD },
      { id: 'film-strip', name: 'Film strip', line: 'Strips that slide sideways.', stages: STD },
    ],
    defaults: { save_the_date: 'mosaic' },
  },
];
