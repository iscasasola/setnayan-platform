/**
 * lib/look-sample.ts — WHAT STUDIO › LOOK'S SAMPLE SCREEN WEARS, FROM THE VALUES IN HAND.
 *
 * Owner, 2026-10-08, shown the guest page's cover above the Look panel
 * (DECISION_LOG "THE LOOK PREVIEW IS A SAMPLE OF WHAT IS BEING EDITED — NOT THE
 * COVER PAGE"): *"our preview should not be this. but a sample of the header
 * text, buttons on the actual screen"* · *"this should be a preview of whatever
 * we edit here."* Contract: `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.D,
 * prototype part D.
 *
 * The sample is drawn IN THE BROWSER, so a pick shows with no server render and
 * no guest-page document (Look mounted two). That is only honest if it is the
 * SAME look the guest page composes — so nothing here is a second rule:
 *
 *   · `lookSampleScope` is `guestLookFrom`'s own sequence
 *     (`app/[slug]/_lib/loaders.ts`): the Mood Board over the theme → the
 *     couple's own colours and face → the ombré → the words re-measured on the
 *     paper the page ends with → the plate ink → Look › Buttons. The same pure
 *     functions, in the same order. `lib/the-look-sample-is-the-guest-look.test.ts`
 *     RUNS the guest page's function beside this one over a sweep of looks and
 *     fails on the first value that differs.
 *   · `lookSampleGround` is `mainGroundLayerFor`'s
 *     (`app/[slug]/_lib/main-ground-layer.tsx`): the paper veil the page's rule
 *     measures over a picture, the tint a picture lends, the Shade veil and the
 *     words that flip with it.
 *
 * Pure: no React, no DOM, no reads.
 */
import { adaptiveThemeVars, pagePaperAndInk, resolveAdaptiveTheme, type HubTint } from './adaptive-theme';
import { hubMainLook, isHubMainFollow, isHubMainLoop, isHubMainOwn, type HubMainGround } from './hub-canvas';
import { hubButtonPage, resolveHubButtons, type HubButtonsLook } from './hub-buttons';
import { compositeOver } from './hub-legibility';
import { INVITE_THEMES, type InviteThemeId } from './invite-themes';
import { mainGroundShade, shadeWordVars } from './main-ground-shade';
import { ombreLook, ombreRamp, parseSiteBackground } from './ombre';
import { buildCustomSiteColorVars } from './site-palette';
import { dressedTheme, paletteColourVars } from './theme-colours';
import { pageWordBase, pinPlateInk, pinWordInks, proSiteVarsFor, shadeWordInks } from '@/app/[slug]/_lib/pro-site-vars';

/** The look columns of one event, as the Maker's draft holds them (the draft over live). */
export type LookSampleRow = {
  role_palette: unknown;
  site_bg_color: string | null;
  site_button_color: string | null;
  site_button_style: string | null;
  site_font_key: string | null;
  site_art_direction: 'daylight' | 'candlelight' | null;
};

/** What the guest scope wears (`GuestLookScope`): two attributes, the inline variables, the ombré, the buttons. */
export type LookSampleScope = {
  theme: Exclude<InviteThemeId, 'house'> | null;
  art: 'candlelight' | null;
  vars: Record<string, string> | null;
  ombre: string | null;
  buttons: HubButtonsLook | null;
};

/**
 * The page's look for one drafted row — `guestLookFrom(row, { theme }, true)`,
 * call for call. `proActive` is true as on the host's own canvas: a couple TRIES
 * a colour in the draft and Apply asks.
 */
export function lookSampleScope(event: LookSampleRow, themeId: InviteThemeId): LookSampleScope {
  const palette = paletteColourVars(event.role_palette, themeId);
  const pro = proSiteVarsFor(event, true, themeId);
  let vars = pro ? { ...(palette ?? {}), ...pro } : palette;

  const background = parseSiteBackground(event.site_bg_color);
  const dressed = dressedTheme(themeId, event.role_palette);
  let ombre: string | null = null;
  let ramp: string[] = [];
  if (background?.kind === 'ombre') {
    const look = ombreLook(dressed, background.ombre);
    ombre = look.css;
    vars = { ...(vars ?? {}), ...look.vars };
    const { color, opacity } = look.legibility.scrim;
    ramp = ombreRamp(background.ombre).map((stop) => compositeOver(color, opacity, stop));
  }

  vars = pinWordInks(vars, pageWordBase(themeId, palette, event.site_art_direction === 'candlelight' ? 'candlelight' : null), ramp);

  const painted = vars && Object.keys(vars).length > 0 ? pinPlateInk(vars, themeId) : null;
  const buttons = resolveHubButtons({
    style: event.site_button_style,
    colour: event.site_button_color,
    theme: dressed,
    page: hubButtonPage(dressed, painted),
  });

  return {
    theme: themeId === 'house' ? null : themeId,
    art: event.site_art_direction === 'candlelight' ? 'candlelight' : null,
    vars: painted,
    ombre,
    buttons,
  };
}

/** What lies over a picture, and the variables that follow it. */
export type LookSampleGround = {
  /** The page's paper over the picture, 0…1 (`resolveAdaptiveTheme(…).scrim`) — null: no picture, or nothing measured yet. */
  scrim: number | null;
  /** The Shade veil — the page's ink or paper at the strength its rule measured. */
  veil: { color: string; opacity: number } | null;
  /** The tint the picture lends, then the words a dark shade flips — spread AFTER the scope's own variables. */
  vars: Record<string, string>;
};

const NO_GROUND: LookSampleGround = { scrim: null, veil: null, vars: {} };

/**
 * The colours the page's rules measure a main background over: a picture of
 * theirs or the cover (its measured frame), a loop of ours (its two sampled
 * colours — and it never tints). Null = no picture (a colour, a pattern).
 */
export function lookSampleTint(main: HubMainGround | null, themeId: InviteThemeId, followsCover: boolean): HubTint | null {
  if (isHubMainOwn(main)) return main.tint ?? null;
  if (isHubMainFollow(main) && followsCover) return main.tint;
  /* Nothing stored, the theme's own, or a follow whose photo is gone: the page wears the theme's loop where it has one. */
  const loopId = isHubMainLoop(main) ? main.loop : !main || isHubMainFollow(main) || main.ground === 'theme' ? themeId : null;
  const samples = loopId ? (INVITE_THEMES[loopId]?.media?.samples ?? null) : null;
  return samples ? { match: false, frame: [samples.light, samples.dark] } : null;
}

/**
 * The veil and the words for one main background — `mainGroundLayerFor`'s own
 * sequence: `adaptiveThemeVars` (the tint), then `shadeWordVars` (the flip),
 * then `shadeWordInks` (the coloured words that follow the flip).
 */
export function lookSampleGround(
  main: HubMainGround | null,
  event: Pick<LookSampleRow, 'role_palette' | 'site_button_color'>,
  themeId: InviteThemeId,
  followsCover = true,
): LookSampleGround {
  const tint = lookSampleTint(main, themeId, followsCover);
  if (!tint || tint.frame.length === 0) return NO_GROUND;
  const dressed = dressedTheme(themeId, event.role_palette);
  const adaptive = resolveAdaptiveTheme(dressed, tint);
  const ownButton = typeof event.site_button_color === 'string' && event.site_button_color ? event.site_button_color : null;
  const tinted = adaptiveThemeVars(adaptive, { ownButton: Boolean(ownButton) });
  const step = hubMainLook(main).shade ?? null;
  if (!step) return { scrim: adaptive.scrim, veil: null, vars: tinted };
  const page = pagePaperAndInk(dressed);
  const shade = mainGroundShade(step, page, tint.frame);
  const flip = shadeWordVars(shade, page);
  const followers = shadeWordInks(
    flip,
    { ...pageWordBase(themeId, paletteColourVars(event.role_palette, themeId)), ...tinted },
    tint.frame.map((sample) => compositeOver(shade.veil, shade.opacity, sample)),
    buildCustomSiteColorVars(null, ownButton) ?? {},
  );
  return { scrim: adaptive.scrim, veil: { color: shade.veil, opacity: shade.opacity }, vars: { ...tinted, ...flip, ...followers } };
}
