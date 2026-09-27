import {
  hubBackgroundOwnsBox,
  hubBackgroundTint,
  resolveHubBackground,
  sanitizeHubCanvas,
  type HubBackground,
  type HubSectionCanvas,
} from './hub-canvas';
import { heroVideoRefForGuests } from './guest-hero-video';
import type { InvitationWidgetRow } from './invitation-widgets';

/**
 * WHAT THIS SCENE'S GROUND ACTUALLY PAINTS — read ONCE, the same way, by the
 * frame and by both dispatchers (which ask it whether the widget should draw
 * its own card: `sceneWidgetIsBare`).
 *
 *   · a colour or either glass always paints (no signing);
 *   · a photo paints once its ref signed; a snippet also only when the guest
 *     hero-video gate lets that clip through (SEC-6, below);
 *   · "No background" paints nothing, on purpose.
 */
export function sceneGround(
  widget: Pick<InvitationWidgetRow, 'config_json'>,
  mediaUrls?: Readonly<Record<string, string>>,
): { canvas: HubSectionCanvas; bg: HubBackground | null; mediaUrl: string | null; painted: boolean } {
  const canvas = sanitizeHubCanvas(widget.config_json);
  /* ⛔ A ref whose signing FAILED is not a picture. A deleted object or a
     refused bucket resolves to nothing, and the section must then render as a
     section with no background — never as a styled plate waiting for an image
     that is not coming, which reads to a guest as a broken page. */
  const rawMediaUrl = canvas.media ? (mediaUrls?.[canvas.media] ?? null) : null;
  /* WHICH ground this section has. `resolveHubBackground` is the one place
     that decides, including the rule that a row written before `kind` existed
     is a PHOTO. */
  const bg = resolveHubBackground(canvas);
  /* 🔒 SEC-6 — CLOSE THE SNIPPET BYPASS (plan Phase 4). `setWidgetBackground`'s
     ONLY snippet source is the couple's own `landing_page_hero_video_r2_key`
     (see that action's docblock: "the couple's own hero video, and only
     that") — the SAME unscreened clip `heroVideoRefForGuests` exists to keep
     off every other guest surface. Without this, a couple could post the
     identical clip to a guest page through this one section background,
     bypassing `GUEST_HERO_VIDEO_PLAYBACK` entirely. Gate it exactly the same
     way `app/[slug]/_lib/loaders.ts` gates the hero itself: a blocked snippet
     is treated like a ref whose signing failed — no picture, not a styled
     plate — never as an error. */
  const mediaUrl =
    bg && bg.kind === 'snippet'
      ? (heroVideoRefForGuests(bg.media) ? rawMediaUrl : null)
      : rawMediaUrl;
  /* A colour (flat or glass) needs no signing, so it stands on its own; a
     photo and a snippet both need their ref to have survived the allow-list
     AND the signer. "No background" paints nothing. */
  const painted = hubBackgroundTint(bg) ? true : bg?.kind === 'none' ? false : Boolean(mediaUrl);
  return { canvas, bg, mediaUrl, painted };
}

/**
 * 🖼 SHOULD THE WIDGET DRAW ITS OWN CARD? No, when the scene background owns
 * the box — "No background" (no box at all) or a painted ground (the frame IS
 * the box). Yes only when the couple chose no background at all: the page as it
 * always looked. `lib/hub-canvas.ts` `hubBackgroundOwnsBox` is the rule.
 */
export function sceneWidgetIsBare(
  widget: Pick<InvitationWidgetRow, 'config_json'>,
  mediaUrls?: Readonly<Record<string, string>>,
): boolean {
  const { canvas, painted } = sceneGround(widget, mediaUrls);
  return hubBackgroundOwnsBox(canvas, painted);
}

