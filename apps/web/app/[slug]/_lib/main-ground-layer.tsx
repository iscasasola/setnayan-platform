import 'server-only';

import type { ReactNode } from 'react';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { hubMainGround, mainGroundIsNone, resolveMainGround } from '@/lib/hub-canvas';
import { heroGroundNeedsOwnership, heroMayBePageGround } from '@/lib/page-ground';
import { websiteProActiveFor } from './hub-look';
import { resolveHero, type HeroEventInput } from '@/lib/event-hero';
import { adaptiveThemeVars, resolveAdaptiveTheme } from '@/lib/adaptive-theme';
import { heroVideoRefForGuests } from '@/lib/guest-hero-video';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { MainGround, MainGroundNone } from '../_components/main-ground';

/**
 * 🎞 THE MAIN BACKGROUND (Maker Phase 10) — the couple's hero photo/video, or
 * their own "different clip or photo", laid over the page as its ground.
 *
 * ONE resolution, TWO pages: the Event Hub (`site-body.tsx`) and the RSVP page
 * (`invite/reply/page.tsx`), because the owner ruled the RSVP's background
 * follows the Event Hub's (2026-09-28, verbatim: *"background should follow the
 * background of the event hub"*). It was inline in `site-body.tsx`; a second
 * inline copy on the RSVP page would have been a second opinion about the same
 * ground, so it moved here and both ask it.
 *
 * By default the Main background IS THE HERO (owner, 2026-09-25: "whatever they
 * make on the hero scene will be their cover and the main background") —
 * `resolveMainGround` over `resolveHero`, the one hero answer; an explicit
 * "different clip or photo" override wins. Stored on the hero row, draft-
 * overlaid for the host's preview like every other canvas. The scrim is measured
 * over the frame and is free; the tint follows it only when "Match my photo's
 * colours" is on. Their own button colour, if they chose one, outranks the
 * automatic tint.
 *
 * 🧱 THE ONE PAGE-GROUND RULE (`lib/page-ground.ts`, owner 2026-09-26 "YES TO
 * ALL" (a)): the colour + effect is always the base; the hero sits on top as
 * Pro media — on a Pro theme, and (owner 2026-09-29, "yes") on a free theme
 * with a loop when the event OWNS Event Hub Pro (`websiteProActiveFor`, the
 * entitlement resolver as viewed). Classic never gets it ("classic has no
 * photo or video"); a free or lapsed couple on Modern / Cyber Neon gets the
 * theme's own loop.
 *
 * ⛔ An unscreened clip plays for the HOST only; a guest gets the still — the
 * same closed switch every hero-video read goes through.
 *
 * 🔒 NEVER FROM THE LAYOUT. The layout wraps the private landing, and a couple's
 * own footage must not reach a stranger there. Both callers are pages behind
 * their own gates: the Event Hub body, and the RSVP page, which a guest reaches
 * only holding this event's key (or the host, on the Maker's canvas).
 */
export async function mainGroundLayerFor({
  theme,
  heroConfig,
  event,
  viewerIsHost,
  signed = {},
}: {
  /** The theme `resolveHubTheme` answered — Pro ownership already decided. */
  theme: InviteThemeId;
  /** The hero row's `config_json` (draft-overlaid for the host's canvas). */
  heroConfig: unknown;
  event: HeroEventInput & { event_id: string; site_button_color?: unknown };
  viewerIsHost: boolean;
  /** Refs the caller already signed, so a ref is never signed twice. */
  signed?: Record<string, string>;
}): Promise<ReactNode> {
  /* 🖼 "NONE — JUST THE COLOUR" (owner 2026-09-29, *"the background animated
     video cannot be unpicked"*): the theme's loop is switched off and nothing
     is laid over the Background colour. Free — no ownership read, any theme
     with a loop. */
  if (mainGroundIsNone(hubMainGround(heroConfig))) {
    return INVITE_THEMES[theme]?.media ? <MainGroundNone /> : null;
  }
  // The ownership read only where it can change the answer (a free theme with
  // a loop); cached per request, shared with the theme gate and the watermark.
  const ownsPro = heroGroundNeedsOwnership(theme)
    ? await websiteProActiveFor(event.event_id).catch(() => false)
    : false;
  const mainGround = heroMayBePageGround(theme, ownsPro)
    ? resolveMainGround(hubMainGround(heroConfig), resolveHero(event), heroVideoRefForGuests)
    : null;
  if (mainGround) {
    const adaptive = resolveAdaptiveTheme(INVITE_THEMES[theme], mainGround.tint);
    const sign = async (ref: string | null) =>
      ref ? (signed[ref] ?? (await displayUrlForStoredAsset(siteMediaServeRef(ref)))) : null;
    const [still, clip] = await Promise.all([
      sign(mainGround.stillRef),
      sign(viewerIsHost ? mainGround.clipRef : mainGround.guestClipRef),
    ]);
    return (
      <MainGround
        still={still}
        clip={clip}
        parallax={mainGround.parallax === true}
        adaptive={adaptive}
        vars={adaptiveThemeVars(adaptive, { ownButton: Boolean(event.site_button_color) })}
      />
    );
  }
  return null;
}
