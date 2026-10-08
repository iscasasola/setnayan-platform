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
import { ambientEffectSpec, ambientGround, type AmbientEffectSpec } from './ambient-effects';
import { hubMainLook, isHubMainFollow, isHubMainLoop, isHubMainOwn, type HubMainEffect, type HubMainGround } from './hub-canvas';
import { mainColoursOf } from './main-colours';
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

/* ── ✨ the effect on top ────────────────────────────────────────────────────────────────────────────────────── */

/** `r g b` (a CSS variable's triplet) → `#rrggbb`; anything else → null. */
function tripletHex(v: string | undefined): string | null {
  const m = /^\s*(\d{1,3})[ ,]+(\d{1,3})[ ,]+(\d{1,3})\s*$/.exec(v ?? '');
  return m ? `#${[m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}` : null;
}

/** What an effect is drawn over, and with: the ground's average, the five, and what lies over a picture. */
export type LookEffectOn = { ground: string; five: string[]; veil: { color: string; opacity: number } | null };

/**
 * ✨ WHAT THE EFFECT LIES ON — for the sample screen AND the guest page, which both ask THIS (`lookSampleEffect`),
 * so the two cannot draw one effect two ways. Built only from what the page's own rules already measure:
 *   · a picture / film: its measured colours (`lookSampleTint`) under the Fade's veil or the page's paper scrim
 *     (`lookSampleGround` — `mainGroundLayerFor`'s own sequence);
 *   · a blend: its ramp under the veil its words needed (`ombreLook`);
 *   · else the page colour — the page's own `--color-cream`, Candlelight and a colour of the couple's included.
 * `main` is the background AS DRAWN (a follow whose photo is gone is not drawn: pass null).
 */
export function lookEffectOn(
  main: HubMainGround | null,
  row: LookSampleRow,
  themeId: InviteThemeId,
  followsCover = true,
  /** The scope and the veil, where the caller already worked them out (the sample screen) — never a second opinion. */
  known: { scope?: LookSampleScope; ground?: LookSampleGround } = {},
): LookEffectOn {
  const scope = known.scope ?? lookSampleScope(row, themeId);
  const over = known.ground ?? lookSampleGround(main, row, themeId, followsCover);
  const dressed = dressedTheme(themeId, row.role_palette);
  const art = row.site_art_direction === 'candlelight' ? 'candlelight' : null;
  const base = pageWordBase(themeId, paletteColourVars(row.role_palette, themeId), art);
  const paper = tripletHex(scope.vars?.['--color-cream']) ?? tripletHex(base['--color-cream']) ?? pagePaperAndInk(dressed).paper;
  const tint = lookSampleTint(main, themeId, followsCover);
  const background = parseSiteBackground(row.site_bg_color);
  let ramp: string[] | null = null;
  if (background?.kind === 'ombre') {
    const { color, opacity } = ombreLook(dressed, background.ombre).legibility.scrim;
    ramp = ombreRamp(background.ombre).map((stop) => compositeOver(color, opacity, stop));
  }
  const veil = tint && tint.frame.length > 0 ? (over.veil ?? (over.scrim ? { color: paper, opacity: over.scrim } : null)) : null;
  return {
    ground: ambientGround({ frame: tint?.frame ?? null, veil: over.veil, scrim: over.scrim, paper, ramp }),
    five: mainColoursOf(row.role_palette, themeId),
    veil,
  };
}

/**
 * ✨ THE ONE ANSWER to "what effect is drawn on this page?" — null: none. The sample screen passes what it is
 * drawing over (`lookEffectOn` of the drafted row, with the pick laid over it); the guest page passes
 * `lookEffectOn` of the event's own columns. Same two functions, same drawing (`ambientEffectSpec` is seeded:
 * shape for shape).
 */
export function lookSampleEffect(effect: HubMainEffect | null, on: LookEffectOn): AmbientEffectSpec | null {
  return effect ? ambientEffectSpec(effect, on.ground, on.five) : null;
}
