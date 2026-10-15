import 'server-only';

import { publicUrlForStoredAsset } from '@/lib/uploads';
import { coverGroundCss, coverGroundShape, coverSceneLegibility, coverShadeVeil } from '@/lib/cover-scene';
import { INVITE_THEMES } from '@/lib/invite-themes';
import type { HubCoverGround } from '@/lib/hub-canvas';

/**
 * 🖼 THE COVER SCENE'S BACKGROUND, READY TO DRAW (`cover-scene-ground.tsx`) — the stored `canvas.ground` of the hero
 * row (`sanitizeHubCoverGround` already refused a clip while the hero clip may not reach guests) resolved to URLs,
 * the shade's veil and the words' tone over it (`coverSceneLegibility`). Null: nothing stored — The theme's own, the
 * page exactly as before.
 */
export type CoverSceneLayer = {
  shape: 'framed' | 'full';
  /** A colour or a glass — the CSS background. */
  css: string | null;
  /** A photo, or a loop's first frame. */
  still: string | null;
  /** A ready-made loop (Setnayan's own — screened by definition, it plays for guests). */
  clip: string | null;
  parallax: boolean;
  veil: { color: string; opacity: number } | null;
  scrim: { color: string; opacity: number };
  tone: 'ink' | 'cream';
};

function publicUrl(ref: string | null | undefined): string | null {
  try {
    return publicUrlForStoredAsset(ref ?? null);
  } catch {
    return null;
  }
}

/**
 * `heroPhotoUrl`: the page's resolved hero photo — an Upload pick IS the hero photo (the one hero writer writes it
 * through to `landing_page_hero_image_url`), so the URL the page already signed is the one drawn when the ref does
 * not resolve on its own.
 */
export function coverSceneLayer(ground: HubCoverGround | null | undefined, ctx: { heroPhotoUrl: string | null }): CoverSceneLayer | null {
  if (!ground) return null;
  const legible = coverSceneLegibility(ground);
  const base = { shape: coverGroundShape(ground), veil: coverShadeVeil(ground.shade), scrim: legible.scrim, tone: legible.tone, parallax: false };
  if (ground.kind === 'loop') {
    const media = INVITE_THEMES[ground.loop].media;
    if (!media) return null;
    const still = publicUrl(media.poster);
    const clip = publicUrl(media.loop);
    /* 🚫 A loop whose files do not resolve is NOT drawn as an empty veil (a failure never renders as success): the
       cover stays The theme's own. */
    if (!still && !clip) return null;
    return { ...base, css: null, still, clip };
  }
  if (ground.kind === 'photo' || ground.kind === 'snippet') {
    /* A clip never reaches here while it may not play for guests (the sanitiser drops it); its still is what is drawn. */
    const still = ground.kind === 'photo' ? (publicUrl(ground.media) ?? ctx.heroPhotoUrl) : publicUrl(ground.poster);
    if (!still) return null;
    return { ...base, css: null, still, clip: null, parallax: ground.kind === 'photo' && ground.motion === 'parallax' };
  }
  return { ...base, veil: ground.kind === 'glass' || ground.kind === 'frost' ? null : base.veil, css: coverGroundCss(ground), still: null, clip: null };
}
