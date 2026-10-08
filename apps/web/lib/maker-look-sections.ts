/**
 * lib/maker-look-sections.ts — THE LOOK IS ONE PANEL, IN THIS ORDER.
 *
 * Owner, live iPhone test 2026-10-02 (tracker f40; DECISION_LOG 2026-09-30
 * "'BEHIND EVERY SCENE' MOVES INTO THEME, WITH FONTS AND COLOURS" and
 * "✂ THE MAKER RE-PLAN IS CUT TO ITS CORE" — *"Theme sets background + fonts +
 * colours"*; 2026-10-01 "accessing it here is too hidden"): the toolbar's Look
 * opened on the theme alone, and the background, the font and the colours were
 * each somewhere else (the hero's page, the scenes column's 🎨 button).
 *
 * Look is ONE panel (first design: `prototypes/maker_in_four_2026-09-30_fable.html`
 * frame E; restudied 2026-10-08 — see `LOOK_SECTIONS` below), these parts and
 * nothing else:
 *
 *   · Background  — "Behind every scene" (`MainBackgroundPanel`): a moving
 *                   background ◆ (every shipped loop) · same as my hero ◆ ·
 *                   upload media ◆ · just the colour (free);
 *   · Page colour — one colour as Plain · Dawn · Diagonal · Glow (free);
 *   · Hero video  — the couple's own video where the hero photo sits ◆;
 *   · Colours     — Candlelight ◆ and Magic Move ◆, and the palette style of
 *                   the Dress code scene's "Our colours" (#6226);
 *   · Font        — the one font dropdown (`FontPick`, `site_font_key`), FREE;
 *   · Buttons     — Look › Buttons (owner 2026-10-04, "create them"): Shape ▾ ·
 *                   Fill ▾ · Colour ▾ for every Event Hub button, with the Reply
 *                   button drawn as it will look (`buttons-look-row.tsx`);
 *   · Music       — the song and its on/off, alone.
 *
 * 🚫 NO THEME SECTION (owner 2026-10-05, DECISION_LOG "THEMES ARE REPLACED BY
 * THREE DIRECT GLOBAL SETTINGS"): *"instead of having a theme, we can let them
 * just pick a background. and pick a font, color, button style"*. A couple no
 * longer picks a theme; `events.invite_theme` stays as the page's internal
 * default (never dropped), and every theme's loop is offered under Background.
 * Font, Colours and Buttons are FREE; the paid tier is media + moving
 * backgrounds.
 *
 * Each section is the SAME control it was, moved — it saves to the same field,
 * into the draft, and guests see it at Apply. Pure data, so the panel and its
 * render guard (`the-look-is-one-panel.test.ts`) read one list. The phone's
 * lower third and the desktop's right panel both draw THIS list — one set of
 * choices, two layouts.
 */
/* 🗂 2026-10-08 (owner, DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND ·
   ELEMENTS · MUSIC"; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 6 row 1):
   Look is THREE sections. Verbatim: *"colors here is not color of the background
   but the colors of the different fonts, and buttons and highlights"* · *"Button
   style is also on this global look. so how do we arrange this? Background,
   Elements (combine the font color and styles?) and Music?"* · *"i see a hero
   video on music. this should be for the background"*.

     Background — the main background ("Behind every scene"), the page fill
                  (one colour as Plain · Dawn · Diagonal · Glow — it WAS under
                  Colours) and the hero video (it WAS under Music);
     Elements   — what sits ON the background: Colours · Font · Buttons;
     Music      — only music.

   Each section is drawn from its PARTS (`LOOK_SECTION_PARTS`), and a part is the
   SAME control it was, moved: it saves to the same field, into the draft. It
   replaces 2026-10-06's Background · Colours · Buttons · Font · Music. */
export const LOOK_SECTIONS = ['background', 'elements', 'music'] as const;
export type LookSection = (typeof LOOK_SECTIONS)[number];

export const LOOK_SECTION_LABEL: Record<LookSection, string> = {
  background: 'Background',
  elements: 'Elements',
  music: 'Music',
};

/**
 * The controls Look is made of — each ONE row the editor page builds
 * (`LOOK_ROW_OF`) and hands to Look as it is. `page` and `video` are the two
 * that moved on 2026-10-08: the page fill out of Colours, the hero video out of
 * Music.
 */
export const LOOK_PARTS = ['background', 'page', 'video', 'colours', 'font', 'buttons', 'music'] as const;
export type LookPart = (typeof LOOK_PARTS)[number];

/** Which parts each section draws, in the order it draws them. */
export const LOOK_SECTION_PARTS: Readonly<Record<LookSection, readonly LookPart[]>> = {
  background: ['background', 'page', 'video'],
  elements: ['colours', 'font', 'buttons'],
  music: ['music'],
};

/** A part's own name — the small heading inside Elements, and the Apply sheet's "Look · …" line. */
export const LOOK_PART_LABEL: Readonly<Record<LookPart, string>> = {
  background: 'Background',
  page: 'Page colour',
  video: 'Hero video',
  colours: 'Colours',
  font: 'Font',
  buttons: 'Buttons',
  music: 'Music',
};

/** Event Details' Look rows and the panel section each opens — one row, one section (2026-10-08). */
export const LOOK_ITEM_SECTIONS: Readonly<Record<LookSection, readonly LookSection[]>> = {
  background: ['background'],
  elements: ['elements'],
  music: ['music'],
};

/**
 * The Maker rows that moved into Look (`website/editor/page.tsx` builds them):
 * an old `?open=` naming one of them opens Look, never a panel of its own.
 */
export const LOOK_ROW_OF: Readonly<Record<LookPart, string>> = {
  background: 'main-background',
  page: 'page-colour',
  video: 'hero-video',
  colours: 'colors',
  font: 'font',
  buttons: 'buttons',
  music: 'music',
};

export function isLookRow(key: string | null | undefined): boolean {
  return typeof key === 'string' && (Object.values(LOOK_ROW_OF) as string[]).includes(key);
}
