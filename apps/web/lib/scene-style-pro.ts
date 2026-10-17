/**
 * apps/web/lib/scene-style-pro.ts — 💎 THE SCENE STYLES THAT ARE EVENT HUB PRO ◆, BY SCENE TYPE.
 *
 * Owner, 2026-10-17 (DECISION_LOG "APPROVED — LOVE STORY, TWO VOICES"), verbatim: *"Conversation as the default
 * look, Timeline and Swipe cards as Pro looks in Style."* Under the 2026-10-16 rule ("ALL ANIMATE, EFFECTS, STYLES
 * AND ACCENTS ARE EVENT HUB PRO ◆"), by the shipped pattern: tried free in the Maker, named at ✓ Apply, and the
 * event's unlock covers everyone on it (`planHubDraftApply`'s `ownsPro`).
 *
 * 🔑 KEYED BY SCENE TYPE, NEVER BY ID ALONE. Style ids are per type and repeat across types — `timeline` is also a
 * Post Event Schedule look and `cards` the Camera cues' free default — so "is `cards` Pro?" has no answer without
 * the scene it is on.
 *
 * Its own tiny module, apart from the registry (`lib/scene-styles.ts`), so the Apply gate (`lib/hub-draft.ts`) can
 * ask without loading every scene's style list — the same reason `lib/scene-style-id.ts` stands alone.
 * `scene-style-pro.test.ts` holds that every id here is a style the registry draws for that type.
 *
 * Pure. No I/O. Client-safe.
 */

/**
 * 💎 EVERY STYLE CARD BUT THE THEME'S OWN (owner 2026-10-16, the same night as "all animate, effects, styles,
 * accents are pro": *everything in Style is Pro … style cards on a part; free events keep the theme's defaults*).
 * Scene type → the ONE style that is free on it: the default on every stage that draws it. Every other style of a
 * listed type is Pro ◆ — tried free in the Maker, named at ✓ Apply. One stored id carries to every stage
 * (`lib/scene-styles.ts`), so an id that is one stage's default but another stage's change still changes what
 * guests see there: the Gallery (Mosaic on Save the Date, Grid on Post Event, each drawing the other) has none ('').
 * The Love Story's Timeline and Swipe cards (2026-10-17) are two of its Pro looks. A type not listed has no choice.
 *
 * GENERATED from the registry, never hand-kept: `scene-style-pro.test.ts` recomputes it from `sceneStylesOn` /
 * `defaultSceneStyle` and fails, printing the right table, the moment a style is added or a default moves. A table
 * rather than a call because the Apply gate (`lib/hub-draft.ts`) is in the Maker's first load (one id per type, not
 * every Pro id: `scripts/check-maker-js-budget.mjs`).
 */
export const SCENE_STYLE_FREE: Readonly<Record<string, string>> = {
  'front-page': 'full-bleed',
  'road-to-the-day': 'countdown',
  statistics: 'big-numbers',
  schedule: 'programme-rail',
  gallery: '',
  'photo-notes': 'photo-note',
  messages: 'one-letter',
  'papic-challenge': 'q-and-a',
  'where-everyone-sat': 'floor-plan',
  entourage: 'roll-call',
  'supplier-stories': 'credits-roll',
  'live-stream': 'replay-card',
  videos: 'featured',
  'thank-you': 'letter',
  countdown: 'four-tiles',
  special_message: 'note',
  our_love_story: 'conversation',
  event_details: 'plate',
  venue_map: 'photo-card',
  dress_code: 'colours-and-roles',
  what_to_bring: 'note',
  photo_moments: 'cards',
  rsvp: 'reply-card',
  find_your_seat: 'map',
  photos_of_you: 'grid',
  announcements: 'banner',
  live_hub: 'player-and-wall',
  hero_names: 'stacked',
  hero_date: 'the-line',
  hero_venue: 'the-line',
  hero_mark: 'as-made',
  hero_eyebrow: 'small-caps',
  gifts: 'door',
  my_role: 'plain',
  my_wear: 'plain',
  my_arrive: 'plain',
  my_guests: 'plain',
};

/** Is this style, on this scene type, Event Hub Pro ◆? */
export function sceneStyleIsPro(type: string | null | undefined, id: unknown): boolean {
  if (!type || typeof id !== 'string' || !id) return false;
  const free = SCENE_STYLE_FREE[type];
  return free !== undefined && id !== free;
}
