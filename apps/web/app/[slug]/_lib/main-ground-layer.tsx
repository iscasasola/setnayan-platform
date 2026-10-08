import 'server-only';

import type { ReactNode } from 'react';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { hubMainEffect, hubMainGround, hubMainLook, isHubMainLoop, mainGroundIsNone, type HubMainLook, type ResolvedMainGround } from '@/lib/hub-canvas';
import { AMBIENT_EFFECT_IS_PRO } from '@/lib/ambient-effects';
import { lookEffectOn, lookSampleEffect, type LookSampleRow } from '@/lib/look-sample';
import { mainGroundShade, shadeWordVars } from '@/lib/main-ground-shade';
import { heroGroundNeedsOwnership } from '@/lib/page-ground';
import { guestMainGround } from '@/lib/guest-main-ground';
import { mainGroundClipRefForGuests } from '@/lib/guest-hero-video';
import { websiteProActiveFor } from './hub-look';
import type { HeroEventInput } from '@/lib/event-hero';
import { adaptiveThemeVars, pagePaperAndInk, resolveAdaptiveTheme } from '@/lib/adaptive-theme';
import { dressedTheme, paletteColourVars } from '@/lib/theme-colours';
import { buildCustomSiteColorVars } from '@/lib/site-palette';
import { compositeOver } from '@/lib/hub-legibility';
import { pageWordBase, shadeWordInks } from './pro-site-vars';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { displayUrlForStoredAsset, publicUrlForStoredAsset } from '@/lib/uploads';
import { MainGround, MainGroundNone, PatternGround } from '../_components/main-ground';
import { AmbientEffectLayer } from '../_components/ambient-effect';

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
 * 🎞 THE CLIP PLAYS FOR GUESTS TOO (owner 2026-09-29 *"make it move"*; audit
 * 2026-10-02 Batch F1 item 4 — it had played for the host only). A guest's clip
 * meets the scene-clip kill switch (`mainGroundClipRefForGuests`, ON), the same
 * switch every scene clip meets; closed, a guest gets the still. The still is
 * always drawn first and stays whenever the clip does not play (`MainGround`).
 *
 * 🔒 NEVER FROM THE LAYOUT. The layout wraps the private landing, and a couple's
 * own footage must not reach a stranger there. Both callers are pages behind
 * their own gates: the Event Hub body, and the RSVP page, which a guest reaches
 * only holding this event's key (or the host, on the Maker's canvas).
 */
type MainGroundInput = {
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
 * ✨ THE EFFECT ON TOP (owner 2026-10-08, DECISION_LOG "LOOK EFFECTS ROUND 4"): the background — whatever it is: a
 * picture, a film, a pattern, a plain colour, the page's own — and then the effect stored on it, drawn over it and
 * under the words (`effectOver`, at the foot of this file). ONE way out, so no background is returned without it.
 */
export async function mainGroundLayerFor(input: MainGroundInput): Promise<ReactNode> {
  return effectOver(await mainGroundOf(input), input);
}

/** The background alone — exactly as it was resolved before effects existed. */
async function mainGroundOf({
  theme,
  heroConfig,
  event,
  viewerIsHost,
  signed = {},
  tryOn = false,
}: MainGroundInput): Promise<ReactNode> {
  const main = hubMainGround(heroConfig);
  /* 🖼 "NONE — JUST THE COLOUR" (owner 2026-09-29, *"the background animated
     video cannot be unpicked"*): the theme's loop is switched off and nothing
     is laid over the Background colour. Free — no ownership read, any theme
     with a loop. */
  if (mainGroundIsNone(hubMainGround(heroConfig))) {
    return INVITE_THEMES[theme]?.media ? <MainGroundNone /> : null;
  }
  /* 🧵 A PATTERN ON THE COLOUR (owner 2026-10-06/07, Studio › Look › Pattern ▾):
     the theme's loop off, as "Just the colour", and the pattern drawn in the
     page's ink over the Background colour. Free. */
  if (main && 'ground' in main && main.ground === 'pattern') {
    return <PatternGround pattern={main.pattern} hideLoop={Boolean(INVITE_THEMES[theme]?.media)} />;
  }
  // The ownership read only where it can change the answer (a free theme with
  // a loop); cached per request, shared with the theme gate and the watermark.
  const ownsPro = heroGroundNeedsOwnership(theme)
    ? await websiteProActiveFor(event.event_id).catch(() => false)
    : false;
  /* 🎞 A MOVING BACKGROUND OF OURS (owner 2026-10-05, DECISION_LOG "THEMES ARE
     REPLACED BY THREE DIRECT GLOBAL SETTINGS"): one of the shipped loops, picked
     on its own — only the loop, never the theme's fonts or colours. Event Hub
     Pro: drawn for a guest only while the event OWNS it (as viewed), and on the
     host's own canvas as it WOULD look (`tryOn`); without it the page falls
     through to what it drew before (the theme's own ground). On ANY theme —
     Classic included: the shell drops its opaque paper whenever a layer is
     drawn here (`site-body.tsx` `ownGround`). Setnayan's own public art, so its
     URLs are the public ones, never signed. The veil is measured over the
     loop's own lightest and darkest clusters (`media.samples`) with the page's
     inks — the same legibility rule an uploaded clip gets (`tint.match` off:
     a loop never recolours the page). */
  const loop = isHubMainLoop(main) ? movingBackground(main.loop) : null;
  // 🌄 A moving background carries its Shade · Blur (owner 2026-10-06/07).
  if (loop && isHubMainLoop(main)) loop.ground.look = loopLook(hubMainLook(main));
  const loopShows = loop ? tryOn || (await websiteProActiveFor(event.event_id).catch(() => false)) : false;
  const urls = loop && loopShows ? { ...signed, ...loop.urls } : signed;
  // The ONE answer to "what is behind the event", shared with Discover's card.
  const mainGround = loop && loopShows ? loop.ground : guestMainGround(theme, ownsPro, heroConfig, event);
  if (mainGround) {
    // 🎨 Measured on the theme as the Mood Board dresses it (`dressedTheme`, 2026-10-05).
    const adaptive = resolveAdaptiveTheme(dressedTheme(theme, event.role_palette), mainGround.tint);
    const { look, page, shade } = shadeOf(mainGround, dressedTheme(theme, event.role_palette));
    const sign = async (ref: string | null) =>
      ref ? (urls[ref] ?? (await displayUrlForStoredAsset(siteMediaServeRef(ref)))) : null;
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
        vars={{
          ...adaptiveThemeVars(adaptive, { ownButton: Boolean(event.site_button_color) }),
          ...(shade ? shadeWordVars(shade, page) : {}),
          ...(shade ? shadeFollowers(shade, page, mainGround, theme, event, adaptive) : {}),
        }}
        veil={shade ? { color: shade.veil, opacity: shade.opacity } : null}
        blur={look.blur ?? null}
        focus={look.focus ?? null}
      />
    );
  }
  return null;
}

/**
 * 🎞 One of our loops as a Main background — the same shape the couple's own
 * clip resolves to (`ResolvedMainGround`), so the ONE mount above draws it. Its
 * refs map to their PUBLIC URLs (our own art on the public bucket). Null when
 * the theme has no loop or no public host is configured.
 */
/**
 * 🌗 SHADE ▾ (owner 2026-10-06/07): Darker · Dark · Light · Lighter lay the
 * shipped veil (`mainGroundShade`) — never less than readability already needs,
 * so no step takes the words under the floor — and on a dark veil the words
 * flip light (`shadeWordVars`). As is (absent) = today's measured scrim.
 */
function shadeOf(mainGround: ResolvedMainGround, dressed: Parameters<typeof pagePaperAndInk>[0]) {
  const look: HubMainLook = mainGround.look ?? {};
  const page = pagePaperAndInk(dressed);
  const shade = look.shade ? mainGroundShade(look.shade, page, mainGround.tint?.frame ?? []) : null;
  return { look, page, shade };
}

/**
 * 🔤 A DARK SHADE CHANGES THE PAGE'S SIDE, so the coloured words follow the
 * flipped paper too (`shadeWordInks` — the rule a dark ombré gets): the button's
 * fill, whose label IS the paper, and the accent's steps, sized against what
 * they resolved to before the flip (the board or the theme, the footage tint)
 * and measured over the footage as the veil leaves it. The couple's own button
 * colour stands. `{}` for a paper veil, which flips nothing.
 */
function shadeFollowers(
  shade: NonNullable<ReturnType<typeof shadeOf>['shade']>,
  page: ReturnType<typeof pagePaperAndInk>,
  mainGround: ResolvedMainGround,
  theme: InviteThemeId,
  event: { site_button_color?: unknown; role_palette?: unknown },
  adaptive: Parameters<typeof adaptiveThemeVars>[0],
): Record<string, string> {
  const ownButton = typeof event.site_button_color === 'string' ? event.site_button_color : null;
  return shadeWordInks(
    shadeWordVars(shade, page),
    {
      ...pageWordBase(theme, paletteColourVars(event.role_palette, theme)),
      ...adaptiveThemeVars(adaptive, { ownButton: Boolean(ownButton) }),
    },
    (mainGround.tint?.frame ?? []).map((sample) => compositeOver(shade.veil, shade.opacity, sample)),
    buildCustomSiteColorVars(null, ownButton) ?? {},
  );
}

/** A loop takes Shade and Blur, never Focus (it is not a photo). */
function loopLook(look: HubMainLook): HubMainLook | undefined {
  const out: HubMainLook = { ...(look.shade ? { shade: look.shade } : {}), ...(look.blur ? { blur: look.blur } : {}) };
  return Object.keys(out).length > 0 ? out : undefined;
}

function movingBackground(id: InviteThemeId): { ground: ResolvedMainGround; urls: Record<string, string> } | null {
  const media = INVITE_THEMES[id]?.media ?? null;
  if (!media) return null;
  const at = (ref: string): string | null => {
    try {
      return publicUrlForStoredAsset(ref);
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

/**
 * ✨ The effect stored on the main background, laid over what was resolved above — by the ONE layer
 * (`AmbientEffectLayer`: shapes and a stylesheet; no script, no request).
 *
 * 🔑 THE SAME ANSWER AS STUDIO › LOOK'S SAMPLE SCREEN: `lookSampleEffect(effect, lookEffectOn(…))`. The sample asks it
 * of the drafted row; this page asks it of the event's own columns (`lookRowOf`) — so what the couple saw IS what a
 * guest sees (`the-look-sample-is-the-guest-look`). `shown` is the background as it is REALLY drawn here: the stored
 * one where a layer was resolved for it, else null — the page's own ground (nothing drawn for a follow with no photo,
 * or for media this viewer is not shown).
 *
 * ◆ A Pro effect is drawn for a guest only while the event OWNS Event Hub Pro (the request's cached read — asked only
 * when a Pro effect is stored), and on the host's own canvas as it WOULD look (`tryOn`). A free one asks nothing.
 * It wears the COUPLE's colours only. Returning a layer also tells the page to drop its opaque paper (`ownGround`),
 * which is what lets the effect show on a plain colour.
 */
async function effectOver(ground: ReactNode, { theme, heroConfig, event, tryOn = false }: MainGroundInput): Promise<ReactNode> {
  const main = hubMainGround(heroConfig);
  const effect = hubMainEffect(main);
  if (!effect) return ground;
  if (AMBIENT_EFFECT_IS_PRO[effect.kind] && !tryOn && !(await websiteProActiveFor(event.event_id).catch(() => false))) return ground;
  const shown = ground === null ? null : main;
  const spec = lookSampleEffect(effect, lookEffectOn(shown, lookRowOf(event), theme, true));
  if (!spec) return ground;
  return (
    <>
      {ground}
      <AmbientEffectLayer spec={spec} className="fixed inset-0 -z-10" />
    </>
  );
}

/** The event's own look columns, as `lookEffectOn` reads them — exactly the row Studio › Look's sample drafts over. */
function lookRowOf(event: MainGroundInput['event']): LookSampleRow {
  const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    role_palette: event.role_palette,
    site_bg_color: text(event.site_bg_color),
    site_button_color: text(event.site_button_color),
    site_button_style: text(event.site_button_style),
    site_font_key: text(event.site_font_key),
    site_art_direction: event.site_art_direction === 'candlelight' ? 'candlelight' : event.site_art_direction === 'daylight' ? 'daylight' : null,
  };
}
