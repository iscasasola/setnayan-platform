import {
  hubBackgroundOwnsBox,
  hubBackgroundTint,
  resolveHubBackground,
  sanitizeHubCanvas,
  type HubBackground,
  type HubSectionCanvas,
} from './hub-canvas';
import { heroVideoRefForGuests, sceneClipRefForGuests } from './guest-hero-video';
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
export type SceneGroundOptions = {
  /**
   * 🎞 THIS RENDER IS THE COUPLE'S OWN MAKER CANVAS — a VERIFIED host
   * (`isEditorCanvas && editorBridge` in `SiteBody`, never the param alone), so
   * their own clip plays. `guest-hero-video.ts`: *"Non-public surfaces (the
   * couple's own editors) must NOT call this — the couple is allowed to see
   * their own upload."* Absent = a guest, and the SEC-6 gate below applies.
   * ⛔ Never defaulted on: a caller that forgets it is a guest.
   */
  ownClipPlays?: boolean;
  /**
   * The scene-clip switch (`GUEST_SCENE_CLIP_PLAYBACK`, OPEN since the owner's
   * 2026-09-29 *"make it move"*). Tests pass `false` to hold the closed path.
   */
  sceneClipsOpen?: boolean;
};

export function sceneGround(
  widget: Pick<InvitationWidgetRow, 'config_json'>,
  mediaUrls?: Readonly<Record<string, string>>,
  opts: SceneGroundOptions = {},
): { canvas: HubSectionCanvas; bg: HubBackground | null; mediaUrl: string | null; painted: boolean } {
  const stored = sanitizeHubCanvas(widget.config_json);
  /* ⛔ A ref whose signing FAILED is not a picture. A deleted object or a
     refused bucket resolves to nothing, and the section must then render as a
     section with no background — never as a styled plate waiting for an image
     that is not coming, which reads to a guest as a broken page. */
  const rawClipUrl = stored.media ? (mediaUrls?.[stored.media] ?? null) : null;
  /* WHICH ground this section has. `resolveHubBackground` is the one place
     that decides, including the rule that a row written before `kind` existed
     is a PHOTO. */
  const storedBg = resolveHubBackground(stored);
  /* 🔒 SEC-6 — CLOSE THE SNIPPET BYPASS (plan Phase 4). `setWidgetBackground`'s
     ONLY snippet source is the couple's own `landing_page_hero_video_r2_key`
     (see that action's docblock: "the couple's own hero video, and only
     that") — the SAME unscreened clip `heroVideoRefForGuests` exists to keep
     off every other guest surface. Without this, a couple could post the
     identical clip to a guest page through this one section background,
     bypassing `GUEST_HERO_VIDEO_PLAYBACK` entirely. Gate it exactly the same
     way `app/[slug]/_lib/loaders.ts` gates the hero itself: a blocked snippet
     is treated like a ref whose signing failed — no picture, not a styled
     plate — never as an error.
     🎞 OPENED FOR SCENE CLIPS (owner 2026-09-29, *"make it move"*): a scene's
     clip passes `sceneClipRefForGuests` (`GUEST_SCENE_CLIP_PLAYBACK`); the
     hero's own clip elsewhere stays behind the hero switch. The couple's own
     Maker canvas (`opts.ownClipPlays`) always plays it. Close the scene switch
     and every guest is back on the clip's still. */
  const clipMayPlay = (ref: string) =>
    Boolean(heroVideoRefForGuests(ref)) ||
    Boolean(sceneClipRefForGuests(ref, opts.sceneClipsOpen)) ||
    opts.ownClipPlays === true;
  const clipPlays = storedBg && storedBg.kind === 'snippet' ? clipMayPlay(storedBg.media) : true;
  /* 🎞 A CLIP THAT MAY NOT PLAY HERE SHOWS ITS STILL (owner 2026-09-28: the
     snippet "would run like the background"). Its `poster` becomes the scene's
     PHOTO for this render — the Main background's rule for the same gate — so
     a guest sees the moment the couple chose, never an empty card where their
     background should be. No still, or one that did not sign: nothing, as
     before. */
  const posterUrl = !clipPlays && stored.poster ? (mediaUrls?.[stored.poster] ?? null) : null;
  const canvas: HubSectionCanvas =
    posterUrl && stored.poster ? stillOf(stored, stored.poster) : stored;
  const bg = posterUrl ? resolveHubBackground(canvas) : storedBg;
  const rawMediaUrl = posterUrl ?? rawClipUrl;
  const mediaUrl =
    bg && bg.kind === 'snippet'
      ? (clipMayPlay(bg.media) ? rawMediaUrl : null)
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
  opts: SceneGroundOptions = {},
): boolean {
  const { canvas, painted } = sceneGround(widget, mediaUrls, opts);
  return hubBackgroundOwnsBox(canvas, painted);
}

/**
 * 🎞 A PLAYING CLIP'S FIRST FRAME — its still (`canvas.poster`), signed, shown
 * by the <video> before it plays and under reduced motion. Null when none.
 */
export function sceneClipStillUrl(
  canvas: HubSectionCanvas,
  mediaUrls?: Readonly<Record<string, string>>,
): string | null {
  return canvas.kind === 'snippet' && canvas.poster ? (mediaUrls?.[canvas.poster] ?? null) : null;
}

/** A snippet's canvas drawn as its still: a photo of `poster`, the clip's own keys dropped. */
function stillOf(canvas: HubSectionCanvas, poster: string): HubSectionCanvas {
  const { poster: _poster, video: _video, ...rest } = canvas;
  return { ...rest, kind: 'photo', media: poster };
}

