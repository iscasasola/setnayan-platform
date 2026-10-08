/**
 * lib/background-source.ts — STUDIO › LOOK › BACKGROUND HAS ONE SOURCE ▾.
 *
 * Owner 2026-10-08 (DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND ·
 * ELEMENTS · MUSIC"; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.1 and
 * § 6 row 2), verbatim: *"main background does not show the animated
 * backgrounds, color, upload media and everything we can do for the background
 * restudy this and create a better approach to design background."*
 *
 * Everything the main background can be already ships; it was spread over a
 * carousel, a "Pattern · None ▾" row, the page fill and the Music tab. It is ONE
 * dropdown, and the picture cards of the source on screen. A stored background is one of five
 * (`BACKGROUND_SOURCES`); the dropdown OFFERS four (`BACKGROUND_SOURCES_OFFERED` — Pattern left the
 * list on 2026-10-08, and "Your photo or video" is named Upload):
 *
 *   Colour               — the page colour, plain or blended (`events.site_bg_color`,
 *                          `lib/ombre.ts`) with nothing laid over it (`{ ground: 'none' }`);
 *   Pattern              — Fine lines · Dots · Lace · Grid on that colour (`{ ground: 'pattern' }`) —
 *                          no longer offered; still read, said and drawn where it is already stored;
 *   Scene ◆              — one of the ten ready-made stills (`STD_REALISTIC_BACKGROUNDS`),
 *                          stored as the couple's own photo (`HubMainOwn`, a library `media`);
 *   Video ◆              — one of the nine theme loops (`{ ground: 'loop' }`, or the page's
 *                          own — `{ ground: 'theme' }`);
 *   Upload ◆             — the cover photo (the hero follow), a picture or clip of
 *                          theirs, or a new upload (`HubMainOwn`).
 *
 * 🔑 NOTHING NEW IS STORED. The source is READ off what is stored
 * (`backgroundSourceOf`) — never a column of its own — so a background set
 * before this dropdown existed opens on the right source.
 *
 * ◆ follows the shipped Pro rule (`mainGroundChange`, lib/hub-draft.ts): a
 * moving background and any media of the couple's own are Event Hub Pro, tried
 * free and named at Apply. ⚠ A ready-made Scene is stored as own media, so the
 * shipped rule holds it as Pro too — the mark says so (the restudy drew Scene
 * without a ◆; making scenes free is a pricing rule, the owner's call).
 *
 * Pure. Held by `the-background-has-one-source.test.ts`.
 */
import { isHubMainFollow, isHubMainLoop, isHubMainOwn, type HubMainGround } from './hub-canvas';
import { isStdLibrarySrc } from './std-backgrounds';

/** Everything a STORED main background can be — what `backgroundSourceOf` answers. */
export const BACKGROUND_SOURCES = ['colour', 'pattern', 'scene', 'video', 'own'] as const;
export type BackgroundSource = (typeof BACKGROUND_SOURCES)[number];

export const BACKGROUND_SOURCE_LABEL: Readonly<Record<BackgroundSource, string>> = {
  colour: 'Colour',
  pattern: 'Pattern',
  scene: 'Scene',
  video: 'Video',
  own: 'Upload',
};

/**
 * 📋 WHAT SOURCE ▾ OFFERS — owner 2026-10-08, on the local copy (DECISION_LOG "LOOK › BACKGROUND, AMENDED"):
 * *"Color · no more Pattern · Scene · Video · Upload"*. Four choices; Pattern is no longer one to PICK.
 *
 * 🔑 A PATTERN ALREADY STORED IS STILL SAID. An event saved with a pattern keeps drawing it for guests
 * (`main-ground.tsx` `PatternGround` — untouched), so the dropdown still names "Pattern" for THAT event — as the
 * current value, with its one card ringed — until the couple picks something else. Never a Source that reads
 * "Colour" over a page that wears dots. Once they leave it, Pattern is gone from their list.
 */
export const BACKGROUND_SOURCES_OFFERED = ['colour', 'scene', 'video', 'own'] as const satisfies readonly BackgroundSource[];
export function backgroundSourcesOffered(stored: BackgroundSource): readonly BackgroundSource[] {
  return stored === 'pattern' ? BACKGROUND_SOURCES : BACKGROUND_SOURCES_OFFERED;
}

/** Which sources Apply asks Event Hub Pro for — exactly what `mainGroundChange` holds as an addition. */
export const BACKGROUND_SOURCE_IS_PRO: Readonly<Record<BackgroundSource, boolean>> = {
  colour: false,
  pattern: false,
  scene: true,
  video: true,
  own: true,
};

/**
 * The source the stored main background IS.
 *   · `themeHasLoop` — the page's own theme carries a moving background (nothing
 *     stored, or "the theme's own", then draws it);
 *   · `followsHero` — the page IS wearing the cover photo: nothing is stored
 *     and there is one to follow (the default on every theme but Classic, which
 *     never follows one), or the stored follow is of this very photo.
 *
 * 🔑 A FOLLOW WITH NOTHING TO FOLLOW IS NOT "YOUR PHOTO" (owner 2026-10-08, on a
 * grey card reading "Your hero": *"why same as hero?"*). `{ follow: 'hero' }`
 * stored on an event whose cover photo is gone (or is a different, unmeasured
 * one) draws NO picture for guests — `resolveMainGround` answers null and the
 * page wears the theme's own background. The Source reads what guests see:
 * Video on a theme with a loop, else Colour — never "Your photo or video" with
 * no card ringed.
 */
export function backgroundSourceOf(
  main: HubMainGround | null,
  page: { themeHasLoop: boolean; followsHero: boolean },
): BackgroundSource {
  if (isHubMainOwn(main)) return isStdLibrarySrc(main.media) ? 'scene' : 'own';
  if (isHubMainFollow(main)) return page.followsHero ? 'own' : page.themeHasLoop ? 'video' : 'colour';
  if (isHubMainLoop(main)) return 'video';
  if (main && 'ground' in main) {
    if (main.ground === 'pattern') return 'pattern';
    if (main.ground === 'none') return 'colour';
    return page.themeHasLoop ? 'video' : 'colour';
  }
  if (page.followsHero) return 'own';
  return page.themeHasLoop ? 'video' : 'colour';
}

/**
 * 🖼 IS THERE A "YOUR COVER PHOTO" CARD? Only when there is a cover photo to
 * follow AND a picture of it to draw — never an empty card that says to add
 * one (owner 2026-10-08). Classic never follows a cover (it would have to
 * measure one on open), so it never draws the card.
 */
export function coverCardShows(input: { classic: boolean; photoRef: string | null; photoUrl: string | null }): boolean {
  return !input.classic && Boolean(input.photoRef) && Boolean(input.photoUrl);
}

/**
 * SHADE ▾ — ONE LIST. Darker · Dark · As is · Light · Lighter are the shipped
 * veil over a PICTURE (`lib/main-ground-shade.ts`, stored on the main
 * background); **Candlelight** is the shipped dark art direction
 * (`events.site_art_direction`) offered as the darkest shade (restudy § 3.1: it
 * is a palette flip, and beside per-role colours it would override them
 * silently). One is picked at a time: Candlelight is worn INSTEAD of a veil.
 *
 * A flat colour or a pattern has no picture to veil, so there the list is As is
 * and Candlelight (a deeper colour is picked as a colour).
 */
export const BACKGROUND_SHADE_CANDLELIGHT = 'candlelight';
export const BACKGROUND_SHADE_CANDLELIGHT_LABEL = 'Candlelight';

/** The Shade ▾ value on screen: Candlelight when the page wears it, else the stored veil step. */
export function backgroundShadeValue(input: { art: 'daylight' | 'candlelight' | null; shade: string | null }): string {
  return input.art === 'candlelight' ? BACKGROUND_SHADE_CANDLELIGHT : (input.shade ?? 'as-is');
}

/**
 * What the Source row's ⓘ says — the line Studio › Look › Background has carried
 * since 2026-10-06 (owner: *"explain that this is the main background"*), now
 * behind the ⓘ instead of a paragraph under the bar (helper text lives behind ⓘ).
 */
export const BACKGROUND_MAIN_INFO =
  'The main background — behind every stage and every page, the cover included; a part’s own Background can still change just that part';

/** What ONE Background pick writes — the main background, the page colour, Candlelight; any of them. */
export type BackgroundWrite = {
  main?: HubMainGround | null;
  events?: { site_bg_color?: string | null; site_art_direction?: 'daylight' | 'candlelight' };
};

/**
 * ONE pick, ONE draft save (`hubDraftAction` intent=save): the patch the panel
 * posts. The main background rides the hero row (`widgets.hero.main`), the page
 * colour and Candlelight their own `events` columns — together, so a Colour card
 * picked from a video takes the video off and sets the colour in the same save,
 * and the ✓ never counts half a pick.
 */
export function backgroundWritePatch(write: BackgroundWrite): {
  widgets?: { hero: { main: HubMainGround | null } };
  events?: NonNullable<BackgroundWrite['events']>;
} {
  return {
    ...('main' in write ? { widgets: { hero: { main: write.main ?? null } } } : {}),
    ...(write.events && Object.keys(write.events).length > 0 ? { events: write.events } : {}),
  };
}

/**
 * What ONE Shade ▾ pick writes, from what is stored. A veil step is stored on a
 * main background that has a picture (`takesShade`); Candlelight is the page's
 * art direction. Only what CHANGES is written — picking the value already on
 * writes nothing (`null`).
 */
export function backgroundShadeWrite(
  pick: string,
  now: { art: 'daylight' | 'candlelight' | null; shade: string | null; takesShade: boolean },
): { art: 'daylight' | 'candlelight' | null; step: string | null; stepMoves: boolean } | null {
  if (pick === backgroundShadeValue({ art: now.art, shade: now.takesShade ? now.shade : null })) return null;
  const candle = pick === BACKGROUND_SHADE_CANDLELIGHT;
  const step = candle || pick === 'as-is' ? null : pick;
  return {
    art: candle ? 'candlelight' : now.art === 'candlelight' ? 'daylight' : null,
    step,
    stepMoves: now.takesShade && (now.shade ?? null) !== step,
  };
}

/**
 * 🎞 Does a Video card draw its `<video>`? Only with a loop to play, never under
 * "reduce motion" (the poster is the card), and never again once it failed.
 */
export function loopCardDrawsVideo(input: { src: string | null | undefined; reducedMotion: boolean; failed: boolean }): boolean {
  return Boolean(input.src) && !input.reducedMotion && !input.failed;
}
