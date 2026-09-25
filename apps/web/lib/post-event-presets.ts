/**
 * apps/web/lib/post-event-presets.ts
 *
 * POST EVENT'S OWN PRESET SCENES — what "+ Add a scene" offers on the Post
 * Event stage, and ONLY there.
 *
 * Owner, 2026-09-25 (DECISION_LOG "POST EVENT IS MANY SMALL SCENES"), verbatim:
 * *"scene creation will have different preset scenes as well. different from
 * save the date, invitation and on the day."* The other three stages keep the 25
 * layout templates (`lib/scene-templates.ts`); Post Event offers these, drawn
 * from the scene KINDS of `prototypes/post_event_auto_story_2026-09-25.html`
 * (a letter, a chapter of the day, the gallery, the film, the wishes, "Were you
 * there?", a thank-you note, what's next).
 *
 * ── WHERE A PRESET SCENE LIVES ─────────────────────────────────────────────
 * A preset scene is one of the couple's OWN COLUMNS — `draft_json.customColumns`
 * on the story's row, beside `sections` / `sectionOrder` — carrying `preset:
 * <id>`. It is placed in the run by the same `custom:<id>` key the story has
 * always ordered its own columns with (`custom-columns.ts`). No table, no
 * migration, and no second list of "what order the story is in".
 *
 * ── WHAT A PRESET DRAWS ────────────────────────────────────────────────────
 * Every preset is the couple's words (a title and a few lines). Four of them
 * also show a part of the day beside those words — `shows` — read from the SAME
 * data the story already loaded for this reader (so a preset can never show a
 * guest something the story itself would not). Before that part of the day
 * exists the Maker's canvas says so in words (`waiting`); a guest never meets an
 * empty box — only the words.
 *
 * ── PRO ────────────────────────────────────────────────────────────────────
 * "Your own scene" is Pro in the plan and the prototype. A free couple may
 * TRY one in the draft; Apply holds a new scene back until Event Hub Pro
 * (`lib/post-event-draft.ts` classifies it). The scenes the Maker writes itself
 * stay free.
 *
 * Pure. Client-safe (the picker imports it). Ids are permanent: a stored
 * `preset: 'gallery_grid'` must mean the gallery grid forever.
 */

import type { SceneTemplateId } from '@/lib/scene-templates';

export const POST_EVENT_PRESET_IDS = [
  'thank_you',
  'letter',
  'chapter',
  'quote',
  'gallery_grid',
  'film',
  'wishes_wall',
  'were_you_there',
  'whats_next',
  'in_memory',
] as const;
export type PostEventPresetId = (typeof POST_EVENT_PRESET_IDS)[number];

/** What a preset shows beside the couple's words — a part of the day, or nothing. */
export type PostEventPresetShows = 'words' | 'gallery' | 'film' | 'wishes' | 'you';

/** The picker's two groups: the couple's words, and a part of the day with their words. */
export type PostEventPresetFamily = 'words' | 'day';

export type PostEventPreset = {
  id: PostEventPresetId;
  /** The tile's name. */
  name: string;
  /** One line under the tile — what it is for. */
  blurb: string;
  family: PostEventPresetFamily;
  /** How it lays out — one of the 25, so the thumbnail is the approved drawing. */
  template: SceneTemplateId;
  shows: PostEventPresetShows;
  /** The words it starts with. The couple edits both; neither may be left empty. */
  title: string;
  body: string;
  /**
   * What the Maker's canvas says in place of the part of the day, before it
   * exists — "Your photos from the day appear here." Null for a words-only
   * preset (it is never waiting on anything).
   */
  waiting: string | null;
};

const P: Record<PostEventPresetId, Omit<PostEventPreset, 'id'>> = {
  thank_you: {
    name: 'A thank-you note',
    blurb: 'Your thanks, to everyone who came and everyone who could not.',
    family: 'words',
    template: 11,
    shows: 'words',
    title: 'Salamat',
    body: 'To everyone who came, and to everyone who could not: thank you. This page is yours as much as ours.',
    waiting: null,
  },
  letter: {
    name: 'A letter to each other',
    blurb: 'A few lines one of you writes to the other, for everyone to read.',
    family: 'words',
    template: 11,
    shows: 'words',
    title: 'To you',
    body: 'Write the letter you want to read again on your first anniversary.',
    waiting: null,
  },
  chapter: {
    name: 'A chapter of the day',
    blurb: 'A moment you want remembered, in your own words — the time and what happened.',
    family: 'words',
    template: 10,
    shows: 'words',
    title: 'The moment we will never forget',
    body: 'What happened, who was there, and why it mattered.',
    waiting: null,
  },
  quote: {
    name: 'A line to remember',
    blurb: 'One line, set large — a vow, a toast, something a guest said.',
    family: 'words',
    template: 9,
    shows: 'words',
    title: 'Said on the day',
    body: 'The one line everyone is still quoting.',
    waiting: null,
  },
  gallery_grid: {
    name: 'A gallery grid',
    blurb: 'Six photos from the day under your own title.',
    family: 'day',
    template: 21,
    shows: 'gallery',
    title: 'A few of our favourites',
    body: 'The photos we keep going back to.',
    waiting: 'Your photos from the day appear here.',
  },
  film: {
    name: 'A film',
    blurb: 'Your livestream replay or your own film, with a few words.',
    family: 'day',
    template: 14,
    shows: 'film',
    title: 'Watch it again',
    body: 'The day, from the first song to the last.',
    waiting: 'Your livestream replay or your film appears here.',
  },
  wishes_wall: {
    name: 'A wishes wall',
    blurb: 'The wishes your guests left, under your own words.',
    family: 'day',
    template: 23,
    shows: 'wishes',
    title: 'What you told us',
    body: 'We read every one of these. Thank you.',
    waiting: 'Your guests’ approved wishes appear here.',
  },
  were_you_there: {
    name: 'Were you there?',
    blurb: 'A door for each guest to their own day — the photos they are in.',
    family: 'day',
    template: 8,
    shows: 'you',
    title: 'Find yourself in our day',
    body: 'Open this story from your own Papic link to see the photos you are in.',
    waiting: null,
  },
  whats_next: {
    name: 'What’s next for us',
    blurb: 'Where life takes you after the day — a move, a trip, a new home.',
    family: 'words',
    template: 10,
    shows: 'words',
    title: 'What’s next',
    body: 'Tell your guests where you are headed.',
    waiting: null,
  },
  in_memory: {
    name: 'In memory',
    blurb: 'For the people who could not be there, and are always with you.',
    family: 'words',
    template: 8,
    shows: 'words',
    title: 'In loving memory',
    body: 'For those who were with us in spirit.',
    waiting: null,
  },
};

export const POST_EVENT_PRESETS: readonly PostEventPreset[] = POST_EVENT_PRESET_IDS.map((id) => ({ id, ...P[id] }));

export const POST_EVENT_PRESET_FAMILY_LABEL: Record<PostEventPresetFamily, string> = {
  words: 'Your words',
  day: 'A part of the day, with your words',
};

export function isPostEventPresetId(v: unknown): v is PostEventPresetId {
  return typeof v === 'string' && (POST_EVENT_PRESET_IDS as readonly string[]).includes(v);
}

/** A stored preset id → its preset, or null. Nothing is repaired. */
export function postEventPreset(id: unknown): PostEventPreset | null {
  return isPostEventPresetId(id) ? (POST_EVENT_PRESETS.find((p) => p.id === id) ?? null) : null;
}

/** The presets of one family, in the picker's order. */
export function postEventPresetsIn(family: PostEventPresetFamily): PostEventPreset[] {
  return POST_EVENT_PRESETS.filter((p) => p.family === family);
}
