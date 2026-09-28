/**
 * apps/web/lib/post-event-presets.ts
 *
 * POST EVENT'S OWN "+ ADD A SCENE" — the twelve presets (strategy §5,
 * `POST_EVENT_SCENES_STRATEGY_2026-09-25.md`; drawn in
 * `prototypes/post_event_scenes_styles_2026-09-29.html` "12 presets · Apply").
 *
 * Owner, 2026-09-25 (DECISION_LOG "POST EVENT IS MANY SMALL SCENES"): *"scene
 * creation will have different preset scenes as well. different from save the
 * date, invitation and on the day."* — and answers 3 and 5 to Fable's five:
 * all twelve are Pro, word-only ones included (E3); six scenes of their own,
 * shared across stages (E5).
 *
 * ── WHAT A PRESET IS ───────────────────────────────────────────────────────
 * Not a 26th template: a NAMED, content-shaped start — one of the 25 templates
 * (`lib/scene-templates.ts`), pre-titled, with a one-line purpose. It is stored
 * as an ORDINARY scene of the couple's own — a `custom_N` row with
 * `canvas.template`, and `canvas.postEventPreset` naming the preset that seeded
 * it (never `canvas.preset`, which is the scene's MOTION preset) — so the guest
 * renderer draws it with no new layout code, the six-slot cap is the shipped
 * one (`nextFreeCustomSlot`), and it is on Post Event only
 * (`widgetsGuestsMeet`). A preset scene is Pro at Apply: tried in the draft,
 * held until Event Hub Pro, everything else in the draft applied beside it.
 *
 * Pure. No I/O. Client-safe (the picker imports it).
 */

import type { SceneTemplateId } from '@/lib/scene-templates';

export type PostEventPreset = {
  /** Permanent — stored on the scene's canvas. */
  id: PostEventPresetId;
  /** The tile's name, and the scene's starting title. */
  name: string;
  /** The ⓘ: what it is for, in one line. */
  purpose: string;
  /** The one of the 25 it is drawn with. */
  template: SceneTemplateId;
  /** What the couple fills — said on the tile under the template's name. */
  fields: string;
};

export const POST_EVENT_PRESET_IDS = [
  'thank_you_from_us',
  'the_toast',
  'best_of',
  'before_and_after',
  'behind_the_scenes',
  'what_almost_happened',
  'by_our_count',
  'near_and_far',
  'our_playlist',
  'the_guestbook',
  'wish_you_were_here',
  'since_then',
] as const;
export type PostEventPresetId = (typeof POST_EVENT_PRESET_IDS)[number];

/** P1–P12, in the strategy's order. */
export const POST_EVENT_PRESETS: readonly PostEventPreset[] = [
  { id: 'thank_you_from_us', name: 'Thank You, From Us', purpose: 'A second letter, to one group — your parents, your sponsors, the ones who travelled.', template: 11, fields: 'Letter · to one group' },
  { id: 'the_toast', name: 'The Toast', purpose: 'One speech worth keeping.', template: 6, fields: 'Portrait + pull quote' },
  { id: 'best_of', name: 'Best Of', purpose: 'Your own six — hand-picked, not the software’s.', template: 21, fields: 'Collage · your six' },
  { id: 'before_and_after', name: 'Before & After', purpose: 'The plan beside the day — the mood board and the real table, the sketch and the gown.', template: 17, fields: 'Two side by side' },
  { id: 'behind_the_scenes', name: 'Behind the Scenes', purpose: 'Getting ready, and the things nobody saw.', template: 18, fields: 'Three mosaic' },
  { id: 'what_almost_happened', name: 'What Almost Happened', purpose: 'The rain, the late car, the missing ring — told with love.', template: 23, fields: 'Three short blocks' },
  { id: 'by_our_count', name: 'By Our Count', purpose: 'Your own playful numbers — hours danced, lumpia eaten, tissues used.', template: 12, fields: 'Big number · three readouts' },
  { id: 'near_and_far', name: 'From Near and Far', purpose: 'Where everyone came from.', template: 22, fields: 'Two columns · places and names' },
  { id: 'our_playlist', name: 'Our Playlist', purpose: 'The songs of the night, in order.', template: 24, fields: 'Timeline · moment, song, artist' },
  { id: 'the_guestbook', name: 'The Guestbook', purpose: 'The paper guestbook, photographed.', template: 19, fields: 'Grid of four · photographed pages' },
  { id: 'wish_you_were_here', name: 'Wish You Were Here', purpose: 'For the ones who could not come.', template: 8, fields: 'Words only' },
  { id: 'since_then', name: 'Since Then', purpose: 'An update — the honeymoon, the first anniversary, the news.', template: 1, fields: 'Photo left, words right' },
];

export function isPostEventPresetId(v: unknown): v is PostEventPresetId {
  return typeof v === 'string' && (POST_EVENT_PRESET_IDS as readonly string[]).includes(v);
}

export function postEventPreset(id: unknown): PostEventPreset | null {
  return isPostEventPresetId(id) ? (POST_EVENT_PRESETS.find((p) => p.id === id) ?? null) : null;
}
