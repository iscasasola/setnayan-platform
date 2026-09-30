import type { HubStage } from '@/lib/hub-canvas';
import { resolveSceneStyle } from '@/lib/scene-styles';
import { fixedSceneStylesFromPreferences, type FixedStyleScene } from '@/lib/fixed-scene-styles';

/*
 * 🎨 Split from `lib/fixed-scene-styles.ts` (2026-09-29, the Maker JS budget):
 * resolving a pick needs the whole scene-style registry, and the rest of that
 * file (the picks' shape, sanitising, the draft merge) is imported by the
 * Maker's first screen and the hub draft. Only the guest page calls this.
 */

/**
 * The style one fixed part is DRAWN in on this stage — its pick when this
 * stage draws it, else the stage's default (style A). Null only when the
 * registry holds no styles for it here.
 */
export function fixedSceneStyleOf(
  stylePreferences: unknown,
  scene: FixedStyleScene,
  stage: HubStage | null | undefined,
  eventType?: string | null,
): string | null {
  if (!stage) return null;
  return resolveSceneStyle(scene, stage, fixedSceneStylesFromPreferences(stylePreferences)[scene], eventType ?? null);
}
