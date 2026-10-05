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
 * Look is now ONE panel (design: `prototypes/maker_in_four_2026-09-30_fable.html`
 * frame E), these sections and nothing else, in this order:
 *
 *   1. Theme       — the shipped theme pick (`MakerThemeMenu`);
 *   2. Background  — "Behind every scene" (`MainBackgroundPanel`): the theme's
 *                    own · same as my hero · upload media ◆ · none, just the colour;
 *   3. Font        — the one font dropdown (`FontPick`, `site_font_key`) ◆;
 *   4. Colours     — the page colour (free), and the palette style of the
 *                    Dress code scene's "Our colours" (#6226);
 *   5. Buttons     — Look › Buttons (owner 2026-10-04, "create them"): Shape ▾ ·
 *                    Fill ▾ · Colour ▾ for every Event Hub button, with the Reply
 *                    button drawn as it will look (`buttons-look-row.tsx`). The
 *                    button COLOUR moved here from Colours — one field
 *                    (`site_button_color`), one place to set it.
 *
 * Each section is the SAME control it was, moved — it saves to the same field,
 * into the draft, and guests see it at Apply. Pure data, so the panel and its
 * render guard (`the-look-is-one-panel.test.ts`) read one list.
 */
export const LOOK_SECTIONS = ['theme', 'background', 'font', 'colours', 'buttons'] as const;
export type LookSection = (typeof LOOK_SECTIONS)[number];

export const LOOK_SECTION_LABEL: Record<LookSection, string> = {
  theme: 'Theme',
  background: 'Background',
  font: 'Font',
  colours: 'Colours',
  buttons: 'Buttons',
};

/**
 * The Maker rows that moved into Look (`website/editor/page.tsx` builds them):
 * an old `?open=` naming one of them opens Look, never a panel of its own.
 */
export const LOOK_ROW_OF: Readonly<Record<Exclude<LookSection, 'theme'>, string>> = {
  background: 'main-background',
  font: 'font',
  colours: 'colors',
  buttons: 'buttons',
};

export function isLookRow(key: string | null | undefined): boolean {
  return typeof key === 'string' && (Object.values(LOOK_ROW_OF) as string[]).includes(key);
}
