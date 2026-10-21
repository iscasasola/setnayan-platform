import 'server-only';

import type { ReactNode } from 'react';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { hubMainEffect, hubMainGround, mainGroundIsNone, type HubMainLook, type ResolvedMainGround } from '@/lib/hub-canvas';
import { AMBIENT_EFFECT_DRAWN_ONLY_WITH_PRO } from '@/lib/ambient-effects';
import { lookEffectOn, lookSampleEffect, type LookSampleRow } from '@/lib/look-sample';
import { mainGroundShade, shadeWordVars } from '@/lib/main-ground-shade';
import { heroGroundNeedsOwnership } from '@/lib/page-ground';
import { websiteProActiveFor } from './hub-look';
import { adaptiveThemeVars, pagePaperAndInk, resolveAdaptiveTheme } from '@/lib/adaptive-theme';
import { dressedTheme, paletteColourVars } from '@/lib/theme-colours';
import { buildCustomSiteColorVars } from '@/lib/site-palette';
import { compositeOver } from '@/lib/hub-legibility';
import { pageWordBase, shadeWordInks } from './pro-site-vars';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { MainGround, MainGroundNone, PatternGround } from '../_components/main-ground';
/* The plain half — what the picture IS, and the film's and the prints' readers (`main-ground-picture.ts`, 2026-10-22). */
import { pictureOf, screenSizedStill, type MainGroundInput } from './main-ground-picture';
export { mainGroundPictureFor, mainGroundStillFor } from './main-ground-picture';
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

/**
 * ✨ THE EFFECT ON TOP (owner 2026-10-08, DECISION_LOG "LOOK EFFECTS ROUND 4"): the background — whatever it is: a
 * picture, a film, a pattern, a plain colour, the page's own — and then the effect stored on it, drawn over it and
 * under the words (`effectOver`, at the foot of this file). ONE way out, so no background is returned without it.
 */
export async function mainGroundLayerFor(input: MainGroundInput): Promise<ReactNode> {
  return effectOver(await mainGroundOf(input), input);
}

/** The background alone — exactly as it was resolved before effects existed. */
async function mainGroundOf(input: MainGroundInput): Promise<ReactNode> {
  const { theme, heroConfig, event, viewerIsHost } = input;
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
     drawn here (`site-body.tsx` `ownGround`). Setnayan's own public art, signed on the
     bucket host like every other guest file (never `r2.dev`, 2026-10-20). The veil is measured over the
     loop's own lightest and darkest clusters (`media.samples`) with the page's
     inks — the same legibility rule an uploaded clip gets (`tint.match` off:
     a loop never recolours the page). */
  const { mainGround, urls } = await pictureOf(main, input, ownsPro);
  if (mainGround) {
    // 🎨 Measured on the theme as the Mood Board dresses it (`dressedTheme`, 2026-10-05).
    const adaptive = resolveAdaptiveTheme(dressedTheme(theme, event.role_palette), mainGround.tint);
    const { look, page, shade } = shadeOf(mainGround, dressedTheme(theme, event.role_palette));
    const sign = async (ref: string | null) =>
      ref ? (urls[ref] ?? (await displayUrlForStoredAsset(siteMediaServeRef(ref)))) : null;
    const [still, clip] = await Promise.all([
      screenSizedStill(mainGround.stillRef).then((u) => u ?? sign(mainGround.stillRef)),
      sign(viewerIsHost ? mainGround.clipRef : mainGround.guestClipRef),
    ]);
    return (
      <MainGround
        still={still}
        clip={clip}
        parallax={mainGround.parallax === true}
        adaptive={adaptive}
        vars={{
          /* 🔘 A stored `site_button_color` is no longer read (owner 2026-10-08, `pro-site-vars.ts`): no own button to spare. */
          ...adaptiveThemeVars(adaptive, { ownButton: false }),
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
  /* 🔘 The buttons are the palette's (owner 2026-10-08): a stored `site_button_color` is no longer read. */
  const ownButton: string | null = null;
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
 * ◆ One of the six ALWAYS-Pro effects (`AMBIENT_EFFECT_DRAWN_ONLY_WITH_PRO`) is drawn for a guest only while the event
 * OWNS Event Hub Pro (the request's cached read — asked only when one is stored), and on the host's own canvas as it
 * WOULD look (`tryOn`). Soft haze and Bokeh lights became Pro on 2026-10-16 and are gated at ✓ Apply instead, so one a
 * free event published before that keeps drawing (*"free events keep what they already published"*) and asks nothing.
 * It wears the COUPLE's colours only. Returning a layer also tells the page to drop its opaque paper (`ownGround`),
 * which is what lets the effect show on a plain colour.
 */
async function effectOver(ground: ReactNode, { theme, heroConfig, event, tryOn = false }: MainGroundInput): Promise<ReactNode> {
  const main = hubMainGround(heroConfig);
  const effect = hubMainEffect(main);
  if (!effect) return ground;
  if (AMBIENT_EFFECT_DRAWN_ONLY_WITH_PRO[effect.kind] && !tryOn && !(await websiteProActiveFor(event.event_id).catch(() => false))) return ground;
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
    site_roles: event.site_roles,
  };
}
