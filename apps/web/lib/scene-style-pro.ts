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

/** Scene type → its Pro ◆ styles. A type not listed has no Pro style; an absent style is the stage's (free) default. */
export const PRO_SCENE_STYLES: Readonly<Record<string, readonly string[]>> = {
  our_love_story: ['timeline', 'cards'],
};

/** Is this style, on this scene type, Event Hub Pro ◆? */
export function sceneStyleIsPro(type: string | null | undefined, id: unknown): boolean {
  if (!type || typeof id !== 'string') return false;
  return (PRO_SCENE_STYLES[type] ?? []).includes(id);
}
