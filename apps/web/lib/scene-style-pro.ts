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
 * Scene type → its Pro ◆ styles. A type not listed has no Pro style; an absent style is the stage's (free) default.
 *
 * 💎 EVERY STYLE CARD BUT THE THEME'S OWN (owner 2026-10-16, the same night as "all animate, effects, styles,
 * accents are pro": *everything in Style is Pro … style cards on a part; free events keep the theme's defaults*). A
 * style is FREE only when it is the default on every stage that draws it — one stored id carries to every stage
 * (`lib/scene-styles.ts`), so an id that is one stage's default but another stage's change still changes what guests
 * see there (the Gallery: Mosaic is Save the Date's own and Grid is Post Event's, and each draws the other — so
 * both are Pro once stored). The Love Story's Timeline and Swipe cards (2026-10-17) are two of these.
 *
 * GENERATED from the registry, never hand-kept: `scene-style-pro.test.ts` recomputes it from `sceneStylesOn` /
 * `defaultSceneStyle` and fails, printing the right table, the moment a style is added or a default moves. It is a
 * table rather than a call because the Apply gate (`lib/hub-draft.ts`) is in the Maker's first load and may not
 * load every scene's style list.
 */
export const PRO_SCENE_STYLES: Readonly<Record<string, readonly string[]>> = {
  'front-page': ['magazine', 'card'],
  'road-to-the-day': ['diary', 'scrapbook'],
  statistics: ['receipt', 'infographic'],
  schedule: ['one-per-screen', 'clock-face', 'timeline'],
  gallery: ['grid', 'mosaic', 'film-strip', 'glimpse'],
  'photo-notes': ['scrapbook-pairs', 'swipe-story'],
  messages: ['note-wall', 'quote-cards'],
  'papic-challenge': ['photo-grid', 'answer-share'],
  'where-everyone-sat': ['room-3d', 'by-table'],
  entourage: ['lines', 'march', 'portrait-grid', 'family-tree'],
  'supplier-stories': ['photo-strip', 'side-by-side'],
  'live-stream': ['full-replay', 'by-chapter'],
  videos: ['playlist-row', 'film-grid'],
  'thank-you': ['words-only', 'photo-words'],
  countdown: ['big-number', 'offset', 'line', 'circle'],
  special_message: ['letter', 'quote'],
  our_love_story: ['chapters', 'essay', 'years', 'timeline', 'cards'],
  event_details: ['big-date', 'card'],
  venue_map: ['full-photo', 'journey'],
  dress_code: ['palette', 'line'],
  what_to_bring: ['list', 'gift-line'],
  photo_moments: ['down-the-day', 'yes-and-no'],
  rsvp: ['question', 'ticket'],
  find_your_seat: ['table-number', 'place-card'],
  photos_of_you: ['lead', 'polaroids'],
  announcements: ['notice', 'line'],
  live_hub: ['theatre', 'wall-first'],
  hero_names: ['one-line', 'staggered', 'spaced-caps', 'big-joiner'],
  hero_date: ['big-day', 'ruled', 'numerals'],
  hero_venue: ['name-first', 'ruled', 'pin'],
  hero_mark: ['ringed', 'between-rules', 'large'],
  hero_eyebrow: ['serif', 'flanked', 'ruled', 'pill'],
  gifts: ['centred', 'side-rule', 'ruled'],
  my_role: ['centred', 'italic', 'spaced-caps', 'side-rule'],
  my_wear: ['centred', 'italic', 'spaced-caps', 'side-rule'],
  my_arrive: ['centred', 'italic', 'spaced-caps', 'side-rule'],
  my_guests: ['centred', 'italic', 'spaced-caps', 'side-rule'],
};

/** Is this style, on this scene type, Event Hub Pro ◆? */
export function sceneStyleIsPro(type: string | null | undefined, id: unknown): boolean {
  if (!type || typeof id !== 'string') return false;
  return (PRO_SCENE_STYLES[type] ?? []).includes(id);
}
