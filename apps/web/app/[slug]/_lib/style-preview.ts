/**
 * 🖼 A STYLE'S TRUE MINIATURE — the page drawn with ONE scene (or part) in ONE
 * style, for the Maker's Style › Look carousel (owner 2026-10-07: *"should be a
 * preview of the style and not text"*; DECISION_LOG "THREE FOLLOW-UPS AS ONE
 * STEP" — true previews for every part and style, with the event's real content).
 *
 * The carousel frames this route at `?editor=1&only=<key>&style=<type>:<id>`
 * (`canvasOnlyScene` + `canvasStylePreview`, both host-canvas only). This lays the
 * asked style over the rows the page already read — nothing is written, nothing
 * is cached for a guest (a guest never reaches here: `stylePreview` is null off
 * the host canvas, and then both inputs come back untouched):
 *
 *   · a section row's style → that row's `canvas.style` (every row of the type);
 *   · a fixed part or a part's own style → `style_preferences.scene_styles[type]`.
 *
 * The registry still decides what is drawn (`resolveSceneStyle`): a style the
 * stage does not draw falls back, exactly as a stored pick would.
 *
 * Pure.
 */
import { STYLED_SCENES, SCENE_STYLES_PREF_KEY } from '@/lib/fixed-scene-styles';
import { sceneStyleTypeOfWidget } from '@/lib/scene-styles';
import type { CanvasStylePreview } from './editor-canvas';

const asObject = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function withStylePreview<E extends object, W extends { widget_type: string; config_json: unknown }>(
  event: E,
  widgets: readonly W[],
  preview: CanvasStylePreview | null | undefined,
): { event: E; widgets: W[] } {
  if (!preview) return { event, widgets: widgets as W[] };
  if ((STYLED_SCENES as readonly string[]).includes(preview.type)) {
    const prefs = { ...(asObject((event as { style_preferences?: unknown }).style_preferences) ?? {}) };
    prefs[SCENE_STYLES_PREF_KEY] = { ...(asObject(prefs[SCENE_STYLES_PREF_KEY]) ?? {}), [preview.type]: preview.id };
    return { event: { ...event, style_preferences: prefs }, widgets: widgets as W[] };
  }
  return {
    event,
    widgets: widgets.map((w) => {
      if (sceneStyleTypeOfWidget(w.widget_type) !== preview.type) return w;
      const cfg = asObject(w.config_json) ?? {};
      const canvas = asObject(cfg.canvas);
      /* The canvas lives at `config_json.canvas`, or (an older row) at the root — kept where it is. */
      const next = canvas ? { ...cfg, canvas: { ...canvas, style: preview.id } } : { ...cfg, style: preview.id };
      return { ...w, config_json: next };
    }),
  };
}
