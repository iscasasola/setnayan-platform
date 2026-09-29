/**
 * THE FIVE FIXED PARTS' STYLE PICKS — where they live, and how they are read.
 *
 * Owner 2026-09-29 ("EVERY SCENE ON EVERY STAGE HAS AT LEAST THREE PREMADE
 * STYLES") and the controller's ruling the same day: the entourage, Find your
 * seat, each guest's own photos, the announcements and the live hub have no
 * section row, so no `canvas.style` for a pick to live in. With NO migration,
 * their picks live in the one existing per-event JSON the QR look already uses:
 *
 *     events.style_preferences.scene_styles = { entourage: 'march', … }
 *
 * Drafted like every other Maker edit (`HubDraftState.fixedStyles`) and written
 * only by Apply (host-checked, read-merge-write, every other key of
 * `style_preferences` kept — `lib/style-preferences.server.ts`). Never live
 * before Apply.
 *
 * 🔑 AN ABSENT PICK IS THE SHIPPED LOOK. `fixedSceneStyleOf` resolves through
 * the ONE registry (`lib/scene-styles.ts`), whose default for every one of
 * these on every stage is its style A — so an event that never picked draws
 * exactly what it drew before. Pure; client-safe.
 */
import type { HubStage } from '@/lib/hub-canvas';
import { sanitizeSceneStyleId } from '@/lib/scene-style-id';

/** The five, by their registry type. The Maker's fixed key for each is the same word. */
export const FIXED_STYLE_SCENES = ['entourage', 'find_your_seat', 'photos_of_you', 'announcements', 'live_hub'] as const;
export type FixedStyleScene = (typeof FIXED_STYLE_SCENES)[number];

/** The key inside `events.style_preferences` the picks live under. */
export const SCENE_STYLES_PREF_KEY = 'scene_styles';

/** Stored picks — an absent scene is the default. */
export type FixedSceneStyles = Partial<Record<FixedStyleScene, string>>;
/** Drafted picks — `null` = back to the default (the key comes off at Apply). */
export type FixedSceneStylesDraft = Partial<Record<FixedStyleScene, string | null>>;

export function isFixedStyleScene(v: unknown): v is FixedStyleScene {
  return typeof v === 'string' && (FIXED_STYLE_SCENES as readonly string[]).includes(v);
}

const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Anything → the stored picks. Unknown scenes and malformed ids are dropped. */
export function sanitizeFixedSceneStyles(raw: unknown): FixedSceneStyles {
  const src = asObject(raw);
  const out: FixedSceneStyles = {};
  if (!src) return out;
  for (const scene of FIXED_STYLE_SCENES) {
    const id = sanitizeSceneStyleId(src[scene]);
    if (id) out[scene] = id;
  }
  return out;
}

/** Anything → the drafted picks, or null when it holds none. */
export function sanitizeFixedSceneStylesDraft(raw: unknown): FixedSceneStylesDraft | null {
  const src = asObject(raw);
  if (!src) return null;
  const out: FixedSceneStylesDraft = {};
  for (const scene of FIXED_STYLE_SCENES) {
    if (!(scene in src)) continue;
    if (src[scene] === null) out[scene] = null;
    else {
      const id = sanitizeSceneStyleId(src[scene]);
      if (id) out[scene] = id;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** The picks out of an `events.style_preferences` blob (unknown shape). */
export function fixedSceneStylesFromPreferences(stylePreferences: unknown): FixedSceneStyles {
  return sanitizeFixedSceneStyles(asObject(stylePreferences)?.[SCENE_STYLES_PREF_KEY]);
}

/** Live picks with a draft on top — what the host's canvas and the Maker show. */
export function fixedSceneStylesAfter(live: FixedSceneStyles, draft: FixedSceneStylesDraft | null | undefined): FixedSceneStyles {
  const out: FixedSceneStyles = { ...live };
  for (const scene of FIXED_STYLE_SCENES) {
    if (!draft || !(scene in draft)) continue;
    const v = draft[scene];
    if (v === null || v === undefined) delete out[scene];
    else out[scene] = v;
  }
  return out;
}

/**
 * The `scene_styles` value to store after these picks, from the one live now:
 * MERGED, never replaced — a pick for one part never forgets another's. An
 * empty result is `undefined` (the key comes off `style_preferences`).
 */
export function sceneStylesValueAfter(liveValue: unknown, picks: FixedSceneStylesDraft): FixedSceneStyles | undefined {
  const next = fixedSceneStylesAfter(sanitizeFixedSceneStyles(liveValue), picks);
  return Object.keys(next).length > 0 ? next : undefined;
}

/** `style_preferences` with the draft's picks laid on — every other key kept (the host's canvas). */
export function stylePreferencesWithDraftedStyles(stylePreferences: unknown, draft: FixedSceneStylesDraft | null | undefined): unknown {
  if (!draft || Object.keys(draft).length === 0) return stylePreferences;
  const base = { ...(asObject(stylePreferences) ?? {}) };
  const next = sceneStylesValueAfter(base[SCENE_STYLES_PREF_KEY], draft);
  if (next === undefined) delete base[SCENE_STYLES_PREF_KEY];
  else base[SCENE_STYLES_PREF_KEY] = next;
  return base;
}
