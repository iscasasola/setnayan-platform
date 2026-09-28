/**
 * apps/web/lib/post-event-styles.ts
 *
 * POST EVENT — WHICH SCENE IS WHICH TYPE, AND WHERE ITS STYLE PICK LIVES.
 *
 * Owner, 2026-09-26 (DECISION_LOG "POST EVENT: 13 SCENE TYPES"), verbatim:
 * *"so each part of the story has templates. and each scene"* ⇒ (1) the THEME
 * dresses the whole Event Hub; (2) each SCENE TYPE has its own styles; (3) each
 * scene on the page picks one, and every part of it is tap-to-edit.
 * 2026-09-29 ("EVERY STYLE OF EVERY SCENE SHIPS"): every style ships, a pick is
 * FREE, the default is the prototype's Recommended.
 *
 * The styles themselves are in the ONE registry every stage shares
 * (`lib/scene-styles.ts`, Post Event's sets in `lib/scene-styles-post-event.ts`).
 * This file only maps Post Event's compiled scene keys onto registry types, and
 * says where each scene's pick is kept:
 *
 *   · by default with the scene, on the story's row —
 *     `event_editorial.draft_json.sceneLooks[<scene>].style`;
 *   · for the two scenes that share a name with a section of the other stages —
 *     Schedule and Gallery — on THAT section's `canvas.style`
 *     (`POST_EVENT_STYLE_HOME`), because the owner's rule is one value across
 *     stages: the couple picks once.
 *
 * The day's chapters are ONE block of the page (they move together, in the order
 * they happened), so they share one look, kept under `chapters` (`postEventLookKey`).
 *
 * ── NAMES ─────────────────────────────────────────────────────────────────
 * Plain words (owner 2026-09-29 rules row: only Papic and Patiktok keep custom
 * names). "Kwento" is shown as "Photo notes" — a label constant, one place to
 * change it — and the bar's word is "Suppliers", never "Vendors".
 *
 * Pure. No I/O. Client-safe.
 */

import { resolveSceneStyle, sanitizeSceneStyleId, sceneStyleOptions, type SceneStyle } from '@/lib/scene-styles';

/** The owner's proposed plain name for Papic's photo-anchored guest messages ("Kwento"). */
export const PHOTO_NOTES_LABEL = 'Photo notes';
/** The Post Event bar's word for the team (owner 2026-09-27: "Suppliers", never "Vendors"). */
export const SUPPLIERS_LABEL = 'Suppliers';

/** A style id — the registry's permanent, semantic id ('full-bleed', 'one-per-screen', …). */
export type PostEventStyleId = string;

export function isPostEventStyleId(v: unknown): v is PostEventStyleId {
  return sanitizeSceneStyleId(v) !== undefined;
}

/**
 * THE SEVENTEEN, by registry type — the prototype's names. A type appears in the
 * registry (and so offers a dropdown) only once its styles are drawn.
 */
export const POST_EVENT_SCENE_TYPE_LABEL: Readonly<Record<string, string>> = {
  'front-page': 'Front Page',
  'road-to-the-day': 'The Road to the Day',
  statistics: 'Statistics',
  schedule: 'Schedule',
  gallery: 'Gallery',
  'photo-notes': PHOTO_NOTES_LABEL,
  messages: 'Messages',
  'where-everyone-sat': 'Where Everyone Sat',
  'supplier-stories': 'Supplier Stories',
  entourage: 'Entourage',
  'specific-memory': 'Specific Memory',
  'papic-challenge': 'Papic Challenge',
  'thank-you': 'Thank You',
  'live-stream': 'Live Stream',
  videos: 'Videos',
  clips: 'Clips',
};

/**
 * Which registry type a Post Event scene is — by the compiled scene's key
 * (`lib/post-event-scenes.ts`). Null = a scene with one look of its own (Were
 * you there?, the song, What comes next — the auto extras keep one style).
 */
export function postEventSceneTypeOf(sceneKey: string): string | null {
  if (sceneKey === 'chapters' || /^ch-\d+$/.test(sceneKey)) return 'schedule';
  switch (sceneKey) {
    case 'cover':
      return 'front-page';
    case 'before':
      return 'road-to-the-day';
    case 'numbers':
      return 'statistics';
    case 'gallery':
      return 'gallery';
    case 'wishes':
      return 'photo-notes';
    case 'letters':
      return 'messages';
    case 'asked':
      return 'papic-challenge';
    case 'vendors':
    case 'loved':
    case 'said':
    case 'powered':
      return 'supplier-stories';
    case 'film':
      return 'live-stream';
    case 'videos':
      return 'videos';
    case 'couple':
      return 'thank-you';
    default:
      return null;
  }
}

/** The key a scene's look is kept under — the chapters share one (`chapters`). */
export function postEventLookKey(sceneKey: string): string {
  return sceneKey === 'chapters' || /^ch-\d+$/.test(sceneKey) ? 'chapters' : sceneKey;
}

/**
 * 🔗 ONE VALUE ACROSS STAGES — the Post Event scenes whose style pick lives on a
 * section row's `canvas.style`, because the section is the same scene on another
 * stage (owner 2026-09-29: where scenes share names, a couple picks once).
 */
export const POST_EVENT_STYLE_HOME: Readonly<Record<string, string>> = {
  chapters: 'schedule',
  gallery: 'our_photos',
};

/** The section row a Post Event scene's style lives on, or null (it lives in `sceneLooks`). */
export function postEventStyleHome(sceneKey: string): string | null {
  return POST_EVENT_STYLE_HOME[postEventLookKey(sceneKey)] ?? null;
}

/**
 * The style a Post Event scene is DRAWN in: its pick when Post Event draws it,
 * else the type's default. Null for a scene with no styles registered yet — the
 * page then keeps the scene's shipped block, and the Maker offers no dropdown.
 */
export function resolvePostEventStyle(
  sceneKey: string,
  picked: unknown,
  eventType?: string | null,
): PostEventStyleId | null {
  return resolveSceneStyle(postEventSceneTypeOf(sceneKey), 'editorial', picked, eventType);
}

/** The dropdown's options for a Post Event scene — empty when there is no choice. */
export function postEventStyleOptions(
  sceneKey: string,
  eventType?: string | null,
): Array<SceneStyle & { isDefault: boolean }> {
  return sceneStyleOptions(postEventSceneTypeOf(sceneKey), 'editorial', eventType);
}

/**
 * 🔤 THE SCOPE a scene's part styles are written under — the same scoped
 * `<style data-hub-els>` every section uses (`hubElementSceneCss`), keyed
 * `pe_<look key>` so a Post Event scene can never collide with a section row.
 */
export function postEventElementScope(sceneKey: string): string {
  return `pe_${postEventLookKey(sceneKey)}`;
}

/** The scene a `pe_<look key>` scope names, or null. */
export function postEventSceneOfScope(scope: string): string | null {
  const m = /^pe_([a-z]+)$/.exec(scope);
  return m ? m[1]! : null;
}

/**
 * ✍ WHICH PARTS A STYLE DRAWS WITH WORDS THE COUPLE MAY REWRITE — the Maker
 * offers a words field only for a part the page will actually show, so no
 * edit lands somewhere invisible. (Each chapter's own name is its title in the
 * story's chapters, not one line of the scene.)
 */
export function postEventWordParts(sceneKey: string, style: PostEventStyleId | null): Array<'label' | 'heading' | 'body'> {
  if (!style) return [];
  switch (postEventSceneTypeOf(sceneKey)) {
    case 'front-page':
      return style === 'full-bleed' ? ['label', 'heading', 'body'] : ['label', 'heading'];
    case 'statistics':
      return style === 'big-numbers' ? ['label'] : ['label', 'heading'];
    case 'schedule':
      return style === 'timeline' ? ['label', 'heading'] : ['label'];
    case 'gallery':
      return ['label', 'heading'];
    case 'photo-notes':
      return style === 'swipe-story' ? ['label'] : ['label', 'heading'];
    case 'messages':
      return style === 'note-wall' ? ['label', 'heading'] : ['label'];
    case 'papic-challenge':
      return ['label'];
    case 'supplier-stories':
      return style === 'credits-roll' ? ['label'] : ['label', 'heading'];
    case 'live-stream':
    case 'videos':
      return ['label', 'heading'];
    case 'thank-you':
      return style === 'letter' ? ['label', 'body'] : style === 'words-only' ? ['label', 'heading'] : ['label', 'heading', 'body'];
    default:
      return [];
  }
}
