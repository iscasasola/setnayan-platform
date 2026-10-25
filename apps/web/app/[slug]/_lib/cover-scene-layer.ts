import 'server-only';

import { displayUrlForStoredAsset, publicUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { coverGroundCss, coverGroundShape, coverSceneLegibility, coverShadeVeil } from '@/lib/cover-scene';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { coverClipRefForGuests } from '@/lib/guest-hero-video';
import type { HubCoverGround } from '@/lib/hub-canvas';

/**
 * 🖼 THE COVER SCENE'S BACKGROUND, READY TO DRAW (`cover-scene-ground.tsx`) — the stored `canvas.ground` of the hero
 * row (`sanitizeHubCoverGround` keeps a clip only while the cover clip switch is open) resolved to URLs,
 * the shade's veil and the words' tone over it (`coverSceneLegibility`). Null: nothing stored — The theme's own, the
 * page exactly as before.
 */
export type CoverSceneLayer = {
  /** Always 'full' — the Cover Scene is always edge to edge (owner 2026-10-16); a stored Framed is ignored. */
  shape: 'full';
  /** A colour or a glass — the CSS background. */
  css: string | null;
  /** A photo, or a loop's first frame. */
  still: string | null;
  /** A ready-made loop (Setnayan's own), or the couple's own ≤ 15 s cover clip (`GUEST_COVER_CLIP_PLAYBACK`). */
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
 * 🔏 THE COVER'S FILES ARE SERVED FROM THE HOST THE MAIN BACKGROUND IS (owner report 2026-10-19, cale-ice: *"claire tried
 * to check the invitation link. and it did not show the video. just the photo under the reveal."*).
 *
 * 🔴 MEASURED: the cover's clip and still were the PUBLIC address (`publicUrlForStoredAsset` → the bucket's
 * `pub-….r2.dev` development host), while the Main background behind it is SIGNED on the bucket's own
 * `….r2.cloudflarestorage.com` host (`mainGroundLayerFor` → `displayUrlForStoredAsset`). A browser that cannot reach
 * `*.r2.dev` — a DNS filter, a blocker list, a network that refuses it; on her laptop Safari AND Chrome alike — got
 * neither cover file (video error 4), the cover layer drew nothing, and the Main background photo showed through
 * where the video should be. Blocking `*.r2.dev` alone in Playwright reproduces her screen exactly. Cloudflare also
 * rate-limits `r2.dev` and calls it not for production — the night every invitation goes out is when it would bite.
 * (`media.setnayan.com` is in the CSP but does not resolve: an R2 custom domain needs a Cloudflare zone, and the DNS is
 * at GoDaddy — CLAUDE.md "CLOUDFLARE IS STORAGE ONLY".)
 *
 * So every ref the cover draws is signed here, ONCE per render, through the same signer and the same one-bucket fence
 * the Main background uses (`siteMediaServeRef`), and `coverSceneLayer` reads the signed address first. Same 24 h
 * lifetime as the Main background's, so a page left open overnight loses both together, never one. A ref that cannot
 * be signed falls back to its public address (the lab, which has no signer — never an empty cover where a link could
 * still work). Held by `lib/the-cover-is-served-where-the-main-background-is.test.ts`.
 */
export async function signCoverSceneMedia(ground: HubCoverGround | null | undefined): Promise<Record<string, string>> {
  if (!ground) return {};
  const refs: string[] = [];
  if (ground.kind === 'loop') {
    const media = INVITE_THEMES[ground.loop]?.media;
    if (media) refs.push(media.poster, media.loop);
  } else if (ground.kind === 'snippet') {
    for (const r of [ground.poster, coverClipRefForGuests(ground.media)]) if (typeof r === 'string' && r) refs.push(r);
  }
  const signed = await Promise.all(
    refs.map(async (ref) => [ref, await displayUrlForStoredAsset(siteMediaServeRef(ref)).catch(() => null)] as const),
  );
  return Object.fromEntries(signed.filter((e): e is readonly [string, string] => typeof e[1] === 'string' && e[1].length > 0));
}

/** The address the cover draws a ref at: its SIGNED one (`signCoverSceneMedia`) first, its public one only without. */
function servedUrl(ref: string | null | undefined, signed: Record<string, string> | undefined): string | null {
  if (typeof ref === 'string' && signed?.[ref]) return signed[ref]!;
  return publicUrl(ref);
}

/**
 * `heroPhotoUrl`: the page's resolved hero photo — an Upload pick IS the hero photo (the one hero writer writes it
 * through to `landing_page_hero_image_url`), so it is the ONLY photo the cover draws.
 */
export function coverSceneLayer(
  ground: HubCoverGround | null | undefined,
  ctx: {
    heroPhotoUrl: string | null;
    /** 🔏 The cover's refs, signed (`signCoverSceneMedia`) — the guest page always passes them. */
    signed?: Record<string, string>;
    /** 🧪 The lab only (`/dev/maker-lab`, no public media host): a loop's stand-in files this repo ships. */
    loopMedia?: (loop: string) => { still: string | null; clip: string | null } | null;
  },
): CoverSceneLayer | null {
  if (!ground) return null;
  const legible = coverSceneLegibility(ground);
  const base = { shape: coverGroundShape(ground), veil: coverShadeVeil(ground.shade), scrim: legible.scrim, tone: legible.tone, parallax: false };
  if (ground.kind === 'loop') {
    const media = INVITE_THEMES[ground.loop].media;
    if (!media) return null;
    const stand = ctx.loopMedia?.(ground.loop) ?? null;
    const still = servedUrl(media.poster, ctx.signed) ?? stand?.still ?? null;
    const clip = servedUrl(media.loop, ctx.signed) ?? stand?.clip ?? null;
    /* 🚫 A loop whose files do not resolve is NOT drawn as an empty veil (a failure never renders as success): the
       cover stays The theme's own. */
    if (!still && !clip) return null;
    return { ...base, css: null, still, clip };
  }
  if (ground.kind === 'photo' || ground.kind === 'snippet') {
    /* 🔑 ONE VALUE (owner 2026-10-15, "Yes, one background"): an Upload pick on the cover IS the hero photo, so the
       cover draws THE HERO PHOTO the page resolved (`resolveHero`) — never a second copy of the ref that could
       disagree with it. Details › Hero changing the photo changes the cover; "Use the invitation card instead"
       (no hero photo) leaves the cover on The theme's own.
       🎞 THE COUPLE'S OWN CLIP (owner 2026-10-16, "let a cover video play for guests on the event's own page"): its
       still is its own grabbed frame (`poster`), the clip plays through the shipped `SceneClip` — only while the
       cover clip switch is open (`coverClipRefForGuests`). A clip with neither a still nor a playable address is NOT
       drawn as an empty veil: the cover stays The theme's own. */
    if (ground.kind === 'snippet') {
      const still = servedUrl(ground.poster, ctx.signed);
      const clip = servedUrl(coverClipRefForGuests(ground.media), ctx.signed);
      if (!still && !clip) return null;
      return { ...base, css: null, still, clip, parallax: false };
    }
    const still = ctx.heroPhotoUrl;
    if (!still) return null;
    return { ...base, css: null, still, clip: null, parallax: ground.motion === 'parallax' };
  }
  return { ...base, veil: ground.kind === 'glass' || ground.kind === 'frost' ? null : base.veil, css: coverGroundCss(ground), still: null, clip: null };
}
