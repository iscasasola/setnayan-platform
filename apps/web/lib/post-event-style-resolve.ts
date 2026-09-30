import { resolveSceneStyle, sceneStyleOptions, type SceneStyle } from '@/lib/scene-styles';
import { postEventSceneTypeOf, type PostEventStyleId } from '@/lib/post-event-styles';

/**
 * 🎞 A POST EVENT SCENE'S STYLE, READ FROM THE REGISTRY.
 *
 * Split from `lib/post-event-styles.ts` (2026-09-29, the Maker JS budget): these
 * two need the whole scene-style registry (`lib/scene-styles.ts`), and the rest
 * of that file — the scene keys, labels, scopes and word parts — is imported by
 * the Maker's first screen. The Maker's client reads the RESULT of these from
 * its navigator data (`maker-navigator-data.ts` → `postEvent.styles`), computed
 * on the server; the page, the scene panel and the navigator builder call them.
 */

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
