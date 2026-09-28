/**
 * ⚡ A SCENE'S BACKGROUND, ON THE MAKER CANVAS NOW — the Maker side.
 *
 * Builds the `sceneBg` message the bridge lays (`app/[slug]/_components/
 * scene-bg-preview.ts`): each scene's frame class list and variables, computed
 * by the SAME function `HubCanvasFrame` renders with (`sceneFrameLook`:
 * classes, canvas variables AND the legibility tokens the words are painted
 * through) and the same "is it painted" rule (`scene-ground.ts`: a
 * colour, ombré or glass always paints; a photo only once it has a URL). So
 * the preview is what the buffered reload will confirm, not an imitation.
 *
 * Pure. Lives in the Maker's bundle, which already carries `lib/hub-canvas`.
 */
import { hubBackgroundTint, resolveHubBackground, type HubSectionCanvas } from '@/lib/hub-canvas';
import type { InviteTheme } from '@/lib/invite-themes';
import { sceneFrameLook } from '@/lib/scene-frame-look';
import type { SceneBgPreviewScene } from '@/app/[slug]/_components/scene-bg-preview';
import { sceneCardBareFor } from './element-preview';

export type SceneBgPreviewMessage = { source: 'setnayan-editor'; t: 'sceneBg'; scenes: SceneBgPreviewScene[] };

/**
 * One scene's frame as the server would draw it. `mediaUrl` resolves a photo ref (the couple's uploads).
 *
 * 🖼 With `mediaUrls` (the same uploads, as the map the server reads), the
 * scene also carries `bare` — the server's own answer (`sceneCardBareFor` →
 * `sceneWidgetIsBare`) to "does the widget draw no card of its own?" — so the
 * bridge takes the card off (or puts it back) at once (owner 2026-09-28,
 * *"yes must be instant"*). Left out when it cannot be answered here; the
 * reload then decides, as it always does.
 */
export function sceneBgPreview(
  widgetType: string,
  canvas: HubSectionCanvas,
  mediaUrl: (ref: string) => string | null,
  theme: InviteTheme,
  mediaUrls?: Readonly<Record<string, string>>,
): SceneBgPreviewScene {
  const bg = resolveHubBackground(canvas);
  // A snippet is a <video> the preview does not draw — only a photo's URL paints here.
  const url = bg?.kind === 'photo' ? mediaUrl(bg.media) : null;
  const painted = hubBackgroundTint(bg) ? true : bg?.kind === 'none' ? false : Boolean(url);
  const look = sceneFrameLook(canvas, { bg, mediaUrl: url, painted }, theme);
  const scene: SceneBgPreviewScene = { key: `w:${widgetType}`, classes: look.className.split(/\s+/).filter(Boolean), vars: look.style };
  const bare = mediaUrls ? sceneCardBareFor(canvas, mediaUrls) : null;
  if (bare !== null) scene.bare = bare;
  return scene;
}

/** The message for one or many scenes ("Every scene" previews the whole stage). */
export function sceneBgPreviewMessage(
  scenes: ReadonlyArray<{ type: string; canvas: HubSectionCanvas }>,
  mediaUrl: (ref: string) => string | null,
  theme: InviteTheme,
  mediaUrls?: Readonly<Record<string, string>>,
): SceneBgPreviewMessage {
  return {
    source: 'setnayan-editor',
    t: 'sceneBg',
    scenes: scenes.map((s) => sceneBgPreview(s.type, s.canvas, mediaUrl, theme, mediaUrls)),
  };
}
