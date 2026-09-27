/**
 * ⚡ A SCENE'S BACKGROUND, ON THE MAKER CANVAS NOW — the Maker side.
 *
 * Builds the `sceneBg` message the bridge lays (`app/[slug]/_components/
 * scene-bg-preview.ts`): each scene's frame class list and variables, computed
 * by the SAME functions `HubCanvasFrame` renders with (`hubCanvasClass`,
 * `hubCanvasVars`) and the same "is it painted" rule (`scene-ground.ts`: a
 * colour, ombré or glass always paints; a photo only once it has a URL). So
 * the preview is what the buffered reload will confirm, not an imitation.
 *
 * Pure. Lives in the Maker's bundle, which already carries `lib/hub-canvas`.
 */
import { hubBackgroundTint, hubCanvasClass, hubCanvasVars, resolveHubBackground, type HubSectionCanvas } from '@/lib/hub-canvas';
import type { SceneBgPreviewScene } from '@/app/[slug]/_components/scene-bg-preview';

export type SceneBgPreviewMessage = { source: 'setnayan-editor'; t: 'sceneBg'; scenes: SceneBgPreviewScene[] };

/** One scene's frame as the server would draw it. `mediaUrl` resolves a photo ref (the couple's uploads). */
export function sceneBgPreview(
  widgetType: string,
  canvas: HubSectionCanvas,
  mediaUrl: (ref: string) => string | null,
): SceneBgPreviewScene {
  const bg = resolveHubBackground(canvas);
  const url = bg && (bg.kind === 'photo' || bg.kind === 'snippet') ? mediaUrl(bg.media) : null;
  const painted = hubBackgroundTint(bg) ? true : bg?.kind === 'none' ? false : Boolean(url);
  const classes = hubCanvasClass(canvas, painted).split(/\s+/).filter(Boolean);
  // A snippet is a <video> the preview does not draw — its URL is not a CSS image.
  const vars = hubCanvasVars(canvas, bg?.kind === 'photo' ? url : null);
  return { key: `w:${widgetType}`, classes, vars };
}

/** The message for one or many scenes ("Every scene" previews the whole stage). */
export function sceneBgPreviewMessage(
  scenes: ReadonlyArray<{ type: string; canvas: HubSectionCanvas }>,
  mediaUrl: (ref: string) => string | null,
): SceneBgPreviewMessage {
  return { source: 'setnayan-editor', t: 'sceneBg', scenes: scenes.map((s) => sceneBgPreview(s.type, s.canvas, mediaUrl)) };
}
