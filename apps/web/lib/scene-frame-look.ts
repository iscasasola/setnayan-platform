/**
 * apps/web/lib/scene-frame-look.ts — THE ONE ANSWER TO "HOW DOES THIS SCENE'S
 * FRAME LOOK": its class list and its style (the `--hub-…` canvas variables and
 * the legibility tokens the words are painted through).
 *
 * Read by the guest page's `HubCanvasFrame` AND by the Maker's instant
 * background preview (`scene-bg-preview-message.ts`) — so what the couple sees
 * the moment they tap a background is exactly what the page will draw after
 * the save, never an imitation of it.
 *
 * The words follow the ground (`lib/scene-legibility.ts`): a flat colour, both
 * ombrés (measured over their whole ramp), both glasses (measured over the pane
 * at the couple's own opacity, raised only as far as the words need), and a
 * photo or clip under the light scrim.
 *
 * Pure. No I/O.
 */
import {
  hubBackgroundTint,
  hubCanvasClass,
  hubCanvasVars,
  hubPhotoPlacement,
  hubSpacingClass,
  type HubBackground,
  type HubSectionCanvas,
} from '@/lib/hub-canvas';
import type { InviteTheme } from '@/lib/invite-themes';
import { sceneLegibilityVars } from '@/lib/scene-legibility';
import { sceneMediaShadeVars } from '@/lib/scene-media-shade';

export type SceneFrameLook = { className: string; style: Record<string, string>; placement: ReturnType<typeof hubPhotoPlacement> };

export function sceneFrameLook(
  canvas: HubSectionCanvas,
  ground: { bg: HubBackground | null; mediaUrl: string | null; painted: boolean },
  theme: InviteTheme,
): SceneFrameLook {
  const { bg, mediaUrl, painted } = ground;
  const placement = hubPhotoPlacement(canvas, painted);
  const tint = hubBackgroundTint(bg);
  const legible =
    placement !== 'behind'
      ? null
      : tint && bg && bg.kind !== 'photo' && bg.kind !== 'snippet' && bg.kind !== 'none'
        ? sceneLegibilityVars(theme, tint, bg.kind, canvas.opacity)
        : mediaUrl && (bg?.kind === 'photo' || bg?.kind === 'snippet')
          ? /* 🌗 Darker ↔ Lighter (`lib/scene-media-shade.ts`): the veil and the words over it, never under AA. */
            canvas.shade
            ? sceneMediaShadeVars(canvas.shade, theme)
            : sceneLegibilityVars(theme, '#ffffff', 'media')
          : null;
  return {
    className: [hubCanvasClass(canvas, painted), hubSpacingClass(canvas)].filter(Boolean).join(' '),
    style: { ...hubCanvasVars(canvas, placement === 'none' ? null : mediaUrl), ...(legible ?? {}) },
    placement,
  };
}
