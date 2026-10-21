import 'server-only';

import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { hubMainGround, hubMainLook, isHubMainLoop, mainGroundIsNone, type HubMainLook, type ResolvedMainGround } from '@/lib/hub-canvas';
import { heroGroundNeedsOwnership } from '@/lib/page-ground';
import { guestMainGround } from '@/lib/guest-main-ground';
import { mainGroundClipRefForGuests } from '@/lib/guest-hero-video';
import { websiteProActiveFor } from './hub-look';
import type { HeroEventInput } from '@/lib/event-hero';
import { resolveAdaptiveTheme } from '@/lib/adaptive-theme';
import { dressedTheme } from '@/lib/theme-colours';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { displayUrlForStoredAsset, stableDisplayUrlForStoredAsset } from '@/lib/uploads';
import { displayUrlForStdBackground } from '@/lib/std-bg-image';

/**
 * 🖼 THE MAIN BACKGROUND'S PICTURE — the plain half of `main-ground-layer.tsx` (2026-10-22, split out unchanged).
 *
 * WHAT IS BEHIND THE EVENT (`pictureOf`) and the two readers that hand it to other surfaces — the Save the Date
 * film's still (`mainGroundStillFor`) and the prints' picture (`mainGroundPictureFor`). No component, no JSX.
 *
 * 🔑 WHY ITS OWN FILE: `main-ground-layer.tsx` also DRAWS the background (`MainGround`, whose clip is the client
 * `SceneClip`). The prints read their picture here from `lib/print-set.server.ts`, which the Maker's page imports —
 * and Next puts every `'use client'` module a route's server files import into that route's first load, drawn or
 * not. Reading `mainGroundPictureFor` through the drawing file put the guest page's cover-video player in the Maker's
 * first load (`launch/_components/details-pieces-are-lazy.test.ts` test 5). A surface that only needs the ANSWER
 * imports it from here; the page's layer imports `pictureOf` from here too, so the two can never disagree.
 */

export type MainGroundInput = {
  /** The theme `resolveHubTheme` answered — Pro ownership already decided. */
  theme: InviteThemeId;
  /** The hero row's `config_json` (draft-overlaid for the host's canvas). */
  heroConfig: unknown;
  event: HeroEventInput & {
    event_id: string;
    site_button_color?: unknown;
    role_palette?: unknown;
    /** ✨ The look columns an effect's ground and colours are measured from (`lookEffectOn`) — the row the caller already read. */
    site_bg_color?: unknown;
    site_button_style?: unknown;
    site_font_key?: unknown;
    site_art_direction?: unknown;
    site_roles?: unknown;
  };
  viewerIsHost: boolean;
  /** Refs the caller already signed, so a ref is never signed twice. */
  signed?: Record<string, string>;
  /**
   * 🎞 The HOST's own canvas, wearing their draft (`hostDraft` non-null — a
   * verified host on `?editor=1`, never a guest): a moving background they have
   * not paid for yet is shown to them as it WOULD look (tried free, asked at
   * Apply). Guests never pass it.
   */
  tryOn?: boolean;
};

/**
 * 🖼 THE PICTURE BEHIND THE EVENT — a moving background of ours (as viewed: Pro, or tried on the host's canvas), else
 * the ONE answer shared with Discover's card (`guestMainGround`). Shared by the page's layer and the film's
 * (`mainGroundStillFor`), so the two can never disagree about what the background is.
 */
export async function pictureOf(
  main: ReturnType<typeof hubMainGround>,
  input: Pick<MainGroundInput, 'theme' | 'heroConfig' | 'event' | 'signed' | 'tryOn'>,
  ownsPro: boolean,
): Promise<{ mainGround: ResolvedMainGround | null; urls: Record<string, string> }> {
  const { theme, heroConfig, event, signed = {}, tryOn = false } = input;
  const loop = isHubMainLoop(main) ? movingBackground(main.loop) : null;
  // 🌄 A moving background carries its Shade · Blur (owner 2026-10-06/07) — and Parallax (Look restudy row 8).
  if (loop && isHubMainLoop(main)) loop.ground.look = loopLook(hubMainLook(main));
  if (loop && isHubMainLoop(main) && main.motion === 'parallax') loop.ground.parallax = true;
  const loopShows = loop ? tryOn || (await websiteProActiveFor(event.event_id).catch(() => false)) : false;
  const urls = loop && loopShows ? { ...signed, ...loop.urls } : signed;
  // The ONE answer to "what is behind the event", shared with Discover's card.
  const mainGround = loop && loopShows ? loop.ground : guestMainGround(theme, ownsPro, heroConfig, event);
  return { mainGround, urls };
}

/**
 * 🎞 THE SAVE THE DATE FILM WEARS THE MAIN BACKGROUND (Look restudy row 6, owner-approved 2026-10-08: *"Save the
 * date should adapt to the main background as well. we stay 1 design for all."*). The film is a full-screen layer
 * of its own over the page, which draws a PICTURE behind its words (`StdBackgroundLayer`) — so it is handed the
 * main background's picture as one still URL: the couple's photo or scene, a clip's or a moving background's still,
 * else the theme's own loop's still (what the page wears with nothing stored). `null` = no picture (a colour, a
 * pattern, "just the colour"): the film then wears the page colour — the caller's `stdFilmOnMain`.
 */
export async function mainGroundStillFor(input: MainGroundInput): Promise<string | null> {
  const { theme, heroConfig, event, signed = {} } = input;
  const main = hubMainGround(heroConfig);
  if (mainGroundIsNone(main) || (main && 'ground' in main && main.ground === 'pattern')) return null;
  const ownsPro = heroGroundNeedsOwnership(theme) ? await websiteProActiveFor(event.event_id).catch(() => false) : false;
  const { mainGround, urls } = await pictureOf(main, input, ownsPro);
  const ref = mainGround?.stillRef ?? null;
  if (ref) return (await screenSizedStill(ref)) ?? urls[ref] ?? signed[ref] ?? (await displayUrlForStoredAsset(siteMediaServeRef(ref)).catch(() => null));
  /* Nothing of theirs: the theme's own loop, as its still — the page's own ground. */
  return movingBackground(theme)?.urls[INVITE_THEMES[theme]?.media?.poster ?? ''] ?? null;
}

/**
 * 🖨 THE PRINTS WEAR THE MAIN BACKGROUND (owner 2026-10-21, *"shouldn't this mimic the event hub design? and so does the
 * other prints?"* → *"yes wire all, and yes it's Pro"*). The SAME answer the page draws (`pictureOf`, the page's own
 * Pro rule and all), handed back as what paper needs: the picture's address, the colours its frame was measured to
 * (`HubTint.frame` — never re-measured), and the paper veil the page lays over it (`resolveAdaptiveTheme(…).scrim`).
 *   · `picture` null = no picture of theirs behind the event (a colour, a pattern, "just the colour", the theme's own);
 *   · `wearsThemeLoop` false = the page shows NO loop of the theme's ("just the colour", a pattern), so paper shows none.
 */
export async function mainGroundPictureFor(input: MainGroundInput, opts: { full?: boolean } = {}): Promise<{
  picture: { url: string; samples: string[]; scrim: number | null } | null;
  wearsThemeLoop: boolean;
}> {
  const { theme, heroConfig, event, signed = {} } = input;
  const main = hubMainGround(heroConfig);
  if (mainGroundIsNone(main) || (main && 'ground' in main && main.ground === 'pattern')) return { picture: null, wearsThemeLoop: false };
  const ownsPro = heroGroundNeedsOwnership(theme) ? await websiteProActiveFor(event.event_id).catch(() => false) : false;
  const { mainGround, urls } = await pictureOf(main, input, ownsPro);
  const ref = mainGround?.stillRef ?? null;
  const frame = mainGround?.tint?.frame ?? [];
  if (!mainGround || !ref || frame.length === 0) return { picture: null, wearsThemeLoop: true };
  /* A print-ready file takes the original; a preview the page's own screen-sized copy. */
  const url =
    (opts.full ? null : await screenSizedStill(ref)) ?? urls[ref] ?? signed[ref] ?? (await displayUrlForStoredAsset(siteMediaServeRef(ref)).catch(() => null));
  if (!url) return { picture: null, wearsThemeLoop: true };
  const adaptive = resolveAdaptiveTheme(dressedTheme(theme, event.role_palette), mainGround.tint);
  return { picture: { url, samples: [...frame], scrim: adaptive.scrim }, wearsThemeLoop: true };
}

/**
 * 🖼 THE BACKGROUND PHOTO AT SCREEN SIZE, NOT CAMERA SIZE (owner 2026-10-20 *"we want all pages to load at its
 * fastest"*). Measured on a live invitation: the Main background was the couple's 4.4 MB camera original, drawn
 * full-bleed as a CSS background and fetched eagerly, while its 1600 px WebP copy (25 KB) already sat beside it in
 * the bucket — made by the Save-the-Date's own pipeline (`displayUrlForStdBackground`, lib/std-bg-image.ts), which
 * derives it once, caches it next to the original and reuses it forever. The couple's own photo only (a clip's still
 * is a photo too); a video, a loop of ours or a legacy URL is left to the normal signer. Null = draw the original as before
 * (any failure inside the pipeline already falls back to the original).
 */
export async function screenSizedStill(ref: string | null): Promise<string | null> {
  // The couple's own uploads only (`events/…`) — never our theme posters, which need no copy made on a guest's visit.
  if (!ref || !/^r2:\/\/setnayan-media\/events\/.+\.(jpe?g|png|webp)$/i.test(ref)) return null;
  return await displayUrlForStdBackground(siteMediaServeRef(ref)).catch(() => null);
}

/** A loop takes Shade and Blur, never Focus (it is not a photo). */
function loopLook(look: HubMainLook): HubMainLook | undefined {
  const out: HubMainLook = { ...(look.shade ? { shade: look.shade } : {}), ...(look.blur ? { blur: look.blur } : {}) };
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * 🎞 One of our loops as a Main background — the same shape the couple's own
 * clip resolves to (`ResolvedMainGround`), so the ONE mount above draws it. Its
 * refs map to their signed bucket-host URLs (our own art on the public bucket). Null when
 * the theme has no loop or R2 is not configured.
 */
function movingBackground(id: InviteThemeId): { ground: ResolvedMainGround; urls: Record<string, string> } | null {
  const media = INVITE_THEMES[id]?.media ?? null;
  if (!media) return null;
  // 📸 Signed on the bucket host, one address per window (`stableDisplayUrlForStoredAsset`) — never `r2.dev`.
  const at = (ref: string): string | null => {
    try {
      return stableDisplayUrlForStoredAsset(ref);
    } catch {
      return null;
    }
  };
  const poster = at(media.poster);
  const clip = at(media.loop);
  if (!poster && !clip) return null;
  const urls: Record<string, string> = {};
  if (poster) urls[media.poster] = poster;
  if (clip) urls[media.loop] = clip;
  return {
    ground: {
      source: 'own',
      stillRef: poster ? media.poster : null,
      clipRef: clip ? media.loop : null,
      // The SAME guest switch every Main-background clip meets (`mainGroundClipRefForGuests`) — closed, a guest gets the still.
      guestClipRef: clip ? mainGroundClipRefForGuests(media.loop) : null,
      tint: { match: false, frame: [media.samples.light, media.samples.dark] },
    },
    urls,
  };
}
