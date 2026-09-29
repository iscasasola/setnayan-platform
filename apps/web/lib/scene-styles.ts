/**
 * apps/web/lib/scene-styles.ts
 *
 * EVERY SCENE ON EVERY STAGE HAS AT LEAST THREE PREMADE STYLES — the ONE
 * registry, the ONE stored key, the ONE resolver.
 *
 * Owner, 2026-09-29 (DECISION_LOG "EVERY SCENE ON EVERY STAGE HAS AT LEAST
 * THREE PREMADE STYLES"), verbatim: *"we want at least 3 choices for each
 * scene that are premade. even the countdown and other scenes"* — after *"those
 * are all designs that we they can pick from. all should work"* for Post Event.
 * A style is picked with ONE dropdown in the scene's inspector, a pick is FREE,
 * and a style switch never changes the couple's words or data.
 *
 * ── THE REGISTRY — scene TYPE → its styles, in order ─────────────────────────
 * A `SceneStyleSet` is one scene type ('countdown', 'schedule', 'gallery',
 * 'front-page' …) and its styles. Each style has a PERMANENT semantic id
 * ('one-per-screen', 'mosaic' …) — ids are never letters and never renumbered,
 * because one id is shared by every stage that draws that look: the owner's
 * rule is that where scenes share a name (Schedule, Gallery) ONE value carries
 * across stages, so the couple picks once.
 *
 *   · `styles` is ordered, and the FIRST style drawn on a stage is that stage's
 *     default — unless `defaults[stage]` names another (the Schedule defaults
 *     to the programme rail on the Invitation and one chapter per screen on
 *     The Day).
 *   · `stages` on a style = the stages its renderer DRAWS it on. A style is
 *     offered only where it is drawn — a pick that changed nothing would be the
 *     "failure that renders like success" disease. Absent = every stage.
 *   · `eventTypes` on a style = the event types it suits (absent = all), so a
 *     set adapts to the celebration (a wake is never offered a confetti look).
 *
 * 🧩 MANY FILES, ONE REGISTRY. Each builder keeps its sets in its OWN file and
 * this module merges them (`mergeSceneStyleSets`): two files may register the
 * same type, and the same style id in two files is ONE style whose `stages`
 * are the union — so a builder adding the Invitation's run of show extends
 * Post Event's `one-per-screen` to the Invitation without touching Post
 * Event's file. To add styles: put your sets in `lib/scene-styles-stages.ts`
 * (the Save the Date · Invitation · The Day file) and they are live here.
 *
 * ── WHERE A PICK LIVES ─────────────────────────────────────────────────────
 * On the scene, like `canvas.template`:
 *   · a section row → `invitation_widgets.config_json.canvas.style`
 *     (`HubSectionCanvas.style`, sanitised by `sanitizeSceneStyleId`);
 *   · a Post Event scene → `event_editorial.draft_json.sceneLooks[<scene>].style`
 *     (`lib/post-event-draft.ts`) — EXCEPT the two Post Event scenes that share
 *     a name with a section (Schedule, Gallery), whose one value lives on that
 *     section's `canvas.style` (`POST_EVENT_STYLE_HOME` in `post-event-styles.ts`).
 * Both are drafted and written by Apply like every other key, and NEITHER is a
 * Pro look key (`HUB_CANVAS_LOOK_KEYS` does not list `style`). An ABSENT style
 * is the stage's default — "Auto is an absence" (`lib/hub-canvas.ts`).
 *
 * Pure. No I/O. Client-safe.
 */

import type { SceneTemplateId } from '@/lib/scene-templates';
import type { HubStage } from '@/lib/hub-canvas';
import { POST_EVENT_SCENE_STYLE_SETS } from '@/lib/scene-styles-post-event';
import { STAGE_SCENE_STYLE_SETS } from '@/lib/scene-styles-stages';

export type SceneStyle = {
  /** Permanent, semantic, shared by every stage that draws it: `[a-z][a-z0-9-]{0,31}`. */
  id: string;
  /** The dropdown's word for it. */
  name: string;
  /** One line under the name: what it looks like. */
  line: string;
  /** The shipped scene template it is drawn from, when it is one (for the ⓘ). */
  template?: SceneTemplateId | null;
  /** The stages its renderer DRAWS it on. Absent = every stage. */
  stages?: readonly HubStage[];
  /** The event types it suits (`events.event_type`). Absent = every type. */
  eventTypes?: readonly string[];
};

export type SceneStyleSet = {
  /** The scene type — the registry key ('schedule', 'gallery', 'front-page', …). */
  type: string;
  /** The type's plain name. */
  label: string;
  /** Ordered: the FIRST drawn on a stage is its default, unless `defaults` says otherwise. */
  styles: readonly SceneStyle[];
  /** A stage whose default is not the first style drawn there. */
  defaults?: Partial<Record<HubStage, string>>;
};

export const SCENE_STYLE_ID_RE = /^[a-z][a-z0-9-]{0,31}$/;

/** A stored style id, or undefined. The registry — not this — decides whether it is drawn. */
export function sanitizeSceneStyleId(v: unknown): string | undefined {
  return typeof v === 'string' && SCENE_STYLE_ID_RE.test(v) ? v : undefined;
}

/**
 * Many files' sets → one registry. Same type = one set (the first label wins);
 * same style id = one style, its `stages` / `eventTypes` the union (absent on
 * either side = every one); a stage default set by an earlier file stands.
 */
export function mergeSceneStyleSets(...lists: ReadonlyArray<readonly SceneStyleSet[]>): Record<string, SceneStyleSet> {
  const out: Record<string, { type: string; label: string; styles: SceneStyle[]; defaults: Partial<Record<HubStage, string>> }> = {};
  const union = <T,>(a: readonly T[] | undefined, b: readonly T[] | undefined): readonly T[] | undefined =>
    a === undefined || b === undefined ? undefined : [...new Set([...a, ...b])];
  for (const list of lists) {
    for (const set of list) {
      const into = (out[set.type] ??= { type: set.type, label: set.label, styles: [], defaults: {} });
      for (const st of set.styles) {
        if (!SCENE_STYLE_ID_RE.test(st.id)) continue;
        const i = into.styles.findIndex((x) => x.id === st.id);
        if (i < 0) into.styles.push({ ...st });
        else {
          const was = into.styles[i]!;
          into.styles[i] = {
            ...was,
            stages: union(was.stages, st.stages),
            eventTypes: union(was.eventTypes, st.eventTypes),
          };
        }
      }
      for (const [stage, id] of Object.entries(set.defaults ?? {}) as Array<[HubStage, string]>) {
        if (into.defaults[stage] === undefined) into.defaults[stage] = id;
      }
    }
  }
  return out;
}

/** THE registry — every file's sets, merged. */
export const SCENE_STYLE_SETS: Readonly<Record<string, SceneStyleSet>> = mergeSceneStyleSets(
  POST_EVENT_SCENE_STYLE_SETS,
  STAGE_SCENE_STYLE_SETS,
);

export function sceneStyleSet(type: string | null | undefined): SceneStyleSet | null {
  return type ? (SCENE_STYLE_SETS[type] ?? null) : null;
}

/** The styles a type DRAWS on this stage, for this event type — in order. */
export function sceneStylesOn(type: string | null | undefined, stage: HubStage, eventType?: string | null): SceneStyle[] {
  const set = sceneStyleSet(type);
  if (!set) return [];
  return set.styles.filter(
    (st) =>
      (!st.stages || st.stages.includes(stage)) &&
      (!st.eventTypes || !eventType || st.eventTypes.includes(eventType)),
  );
}

/** The style a scene wears on this stage when nothing was picked. Null = the type has no styles here. */
export function defaultSceneStyle(type: string | null | undefined, stage: HubStage, eventType?: string | null): string | null {
  const on = sceneStylesOn(type, stage, eventType);
  if (on.length === 0) return null;
  const named = sceneStyleSet(type)?.defaults?.[stage];
  return named && on.some((st) => st.id === named) ? named : on[0]!.id;
}

/**
 * THE RESOLVER — the style a scene is DRAWN in on this stage: its pick when the
 * pick is drawn here, else the stage's default. A pick made on another stage
 * that this stage does not draw falls back quietly and is kept (it still wins
 * where it is drawn). Null = no styles here: the scene keeps its one look.
 */
export function resolveSceneStyle(
  type: string | null | undefined,
  stage: HubStage,
  picked: unknown,
  eventType?: string | null,
): string | null {
  const id = sanitizeSceneStyleId(picked);
  if (id && sceneStylesOn(type, stage, eventType).some((st) => st.id === id)) return id;
  return defaultSceneStyle(type, stage, eventType);
}

/**
 * The dropdown for a scene: shown only when there is a CHOICE (two or more
 * drawn here). Each option says whether it is the stage's default.
 */
export function sceneStyleOptions(
  type: string | null | undefined,
  stage: HubStage,
  eventType?: string | null,
): Array<SceneStyle & { isDefault: boolean }> {
  const on = sceneStylesOn(type, stage, eventType);
  if (on.length < 2) return [];
  const def = defaultSceneStyle(type, stage, eventType);
  return on.map((st) => ({ ...st, isDefault: st.id === def }));
}

/**
 * A section row's scene type. Most rows ARE their type; a row that shares a
 * name with another stage's scene maps onto it, so one value carries.
 */
const WIDGET_SCENE_TYPE: Readonly<Record<string, string>> = {
  our_photos: 'gallery',
};

export function sceneStyleTypeOfWidget(widgetType: string): string {
  return WIDGET_SCENE_TYPE[widgetType] ?? widgetType;
}
