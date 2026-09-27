/**
 * apps/web/lib/scene-background-scope.ts
 *
 * 🪟 ONE SCENE'S BACKGROUND, OR EVERY SCENE'S — the question the Maker asks
 * after a background is picked, and the chip a scene kept different wears.
 *
 * Owner, 2026-09-27 (DECISION_LOG "SETTING ONE SCENE'S BACKGROUND ASKS 'EVERY
 * SCENE' OR 'JUST THIS SCENE'"): *"setting a background for one can be asked if
 * they want to apply it to all or just this."* Then: *"“Own background · ↺ Use
 * the Event Hub’s” yes this is good"* (the chip), and on the approved prototype
 * (`prototypes/maker_toolbars_keynote_pages_2026-09-27.html`), answer 6:
 * *"this stage"* — "Every scene" means THIS STAGE's scenes, never all four
 * stages. The buttons say "Just this scene" / "Every scene", never "Apply" —
 * that word is the publish button.
 *
 * ── NO NEW STORAGE ─────────────────────────────────────────────────────────
 * A scene's background already lives on its own canvas
 * (`invitation_widgets.config_json.canvas`: `kind` · `color` · `opacity` ·
 * `media`). So:
 *
 *   · EVERY SCENE writes the picked background onto every scene of the stage,
 *     in ONE draft save (one patch, many widgets), and clears their `own` marks
 *     — it is every scene;
 *   · JUST THIS SCENE marks the scene `own: true` (`HubSectionCanvas.own`);
 *   · ↺ USE THE EVENT HUB'S gives an own scene the background its stage-mates
 *     SHARE — the one every other (not-own) scene of the stage wears — or, when
 *     they do not share one, takes this scene's background off, back to the
 *     Event Hub's own look (the theme's). It never guesses between two.
 *
 * The draft replaces a canvas WHOLE (`mergeHubDraft`), so every patch here is
 * built from each scene's current canvas with only the background keys
 * changed — a scene's motion, words and parts ride along untouched.
 *
 * Pure. No I/O.
 */
import {
  resolveHubBackground,
  sanitizeHubCanvas,
  type HubSectionCanvas,
} from '@/lib/hub-canvas';

/** The canvas keys that ARE the background — the only ones "every scene" copies. */
export const SCENE_BACKGROUND_KEYS = ['kind', 'color', 'opacity', 'media', 'focal', 'zoom'] as const;

export type SceneOnStage = { type: string; canvas: HubSectionCanvas };

/** Just the background of a canvas (possibly empty = the theme's own). */
export function backgroundOf(canvas: HubSectionCanvas): Partial<HubSectionCanvas> {
  const out: Record<string, unknown> = {};
  for (const k of SCENE_BACKGROUND_KEYS) if (canvas[k] !== undefined) out[k] = canvas[k];
  return out as Partial<HubSectionCanvas>;
}

/** One spelling per background, so two scenes can be compared. */
function bgKey(canvas: HubSectionCanvas): string {
  const bg = backgroundOf(canvas);
  return JSON.stringify(SCENE_BACKGROUND_KEYS.map((k) => bg[k] ?? null));
}

/**
 * The canvas with its background replaced by `bg` (an empty `bg` takes it
 * off). Framed / Full width stays the scene's own — it is the Shape row, not
 * the background — and the sanitizer drops it where no box is painted.
 */
export function withBackground(canvas: HubSectionCanvas, bg: Partial<HubSectionCanvas>, own: boolean): HubSectionCanvas {
  const next: Record<string, unknown> = { ...canvas };
  for (const k of SCENE_BACKGROUND_KEYS) delete next[k];
  delete next.own;
  Object.assign(next, backgroundOf(bg as HubSectionCanvas));
  if (own) next.own = true;
  return sanitizeHubCanvas({ canvas: next });
}

/**
 * EVERY SCENE — the one draft patch that puts `from`'s background on every
 * scene of the stage (and clears every `own` mark). `from` must be one of them.
 */
export function everySceneBackgroundPatch(
  stageScenes: readonly SceneOnStage[],
  from: HubSectionCanvas,
): { widgets: Record<string, { canvas: HubSectionCanvas }> } {
  const bg = backgroundOf(from);
  const widgets: Record<string, { canvas: HubSectionCanvas }> = {};
  for (const s of stageScenes) widgets[s.type] = { canvas: withBackground(s.canvas, bg, false) };
  return { widgets };
}

/** JUST THIS SCENE — the scene keeps what it has, marked as its own. */
export function justThisSceneCanvas(canvas: HubSectionCanvas): HubSectionCanvas {
  return withBackground(canvas, backgroundOf(canvas), true);
}

/**
 * The background this stage's scenes SHARE — every not-own scene other than
 * `type` wearing the same one — or null when they do not agree (or there are
 * none). Null means "the Event Hub's own look": no background of the scene's.
 */
export function sharedStageBackground(
  stageScenes: readonly SceneOnStage[],
  type: string,
): Partial<HubSectionCanvas> | null {
  const mates = stageScenes.filter((s) => s.type !== type && !s.canvas.own);
  if (mates.length === 0) return null;
  const first = bgKey(mates[0]!.canvas);
  if (!mates.every((s) => bgKey(s.canvas) === first)) return null;
  const bg = backgroundOf(mates[0]!.canvas);
  return Object.keys(bg).length > 0 ? bg : null;
}

/** ↺ USE THE EVENT HUB'S — the own scene back on its stage's shared background (or the theme's). */
export function hubBackgroundCanvasFor(stageScenes: readonly SceneOnStage[], type: string, canvas: HubSectionCanvas): HubSectionCanvas {
  return withBackground(canvas, sharedStageBackground(stageScenes, type) ?? {}, false);
}

/**
 * WHAT THE BACKGROUND ROW SAYS UNDER THE CHOICES:
 *   · `own`   — "Own background · ↺ Use the Event Hub's";
 *   · `every` — "On every scene of <stage>. Make this one different": every
 *               scene of the stage wears this one;
 *   · `mixed` — nothing: the scenes differ and none was set "just here"
 *               (the question appears after the next pick).
 */
export type SceneBackgroundScope = 'own' | 'every' | 'mixed';
export function sceneBackgroundScope(stageScenes: readonly SceneOnStage[], type: string, canvas: HubSectionCanvas): SceneBackgroundScope {
  if (canvas.own && resolveHubBackground(canvas)) return 'own';
  if (!resolveHubBackground(canvas)) return 'mixed';
  const mine = bgKey(canvas);
  const others = stageScenes.filter((s) => s.type !== type);
  if (others.length > 0 && others.every((s) => bgKey(s.canvas) === mine)) return 'every';
  return 'mixed';
}
