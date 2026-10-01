/**
 * lib/theme-own-look.ts — what picking a theme hands back to the theme.
 *
 * Owner 2026-09-30 ("THE MAKER RE-PLAN IS CUT TO ITS CORE" — *Theme sets
 * background + fonts + colours*; the Maker-in-four prototype: "one pick sets
 * background, fonts and colours. Then Make it my own"). A theme owns those
 * three; the couple's own page colour, button colour and typeface
 * (`site_bg_color` · `site_button_color` · `site_font_key` — the Colours panel,
 * an opt-in override on top of the theme) are what they changed AFTER picking.
 * Picking a new theme used to write `invite_theme` alone and leave an older
 * override standing, so "Modern" could arrive in Luxe's typeface and a stale
 * background — a pick that did not change what the page looked like.
 *
 * ONE DRAFT PATCH: the pick clears the three overrides in the same save that
 * names the theme, so Undo steps the whole pick back together and Apply counts
 * it once. A cleared override is a removal — never Pro (`eventItemIsPro`).
 * They can still override each after; nothing here blocks that.
 *
 * Deliberately NOT here: the hero's Main background (`widgets.hero.main`) — it
 * follows the hero's own photo by default and a clip they uploaded is a
 * deliberate, Pro choice, not a theme default — and the candlelight / magic
 * move switches, which are not background, fonts or colours.
 *
 * Pure and import-free: the Maker's client bundle is at its ceiling.
 */
export const THEME_OWN_LOOK_RESET = {
  site_bg_color: null,
  site_button_color: null,
  site_font_key: null,
} as const;

type OwnLookRow = Partial<Record<keyof typeof THEME_OWN_LOOK_RESET, unknown>>;

/**
 * Does the couple wear their OWN page colour, button colour or typeface, as they
 * are editing it — the draft's value where the draft holds that column, else
 * live? A value is an override when it is set to anything but null/blank.
 */
export function hasOwnLook(live: OwnLookRow | null | undefined, drafted?: OwnLookRow | null): boolean {
  return (Object.keys(THEME_OWN_LOOK_RESET) as Array<keyof typeof THEME_OWN_LOOK_RESET>).some((k) => {
    const v = drafted && k in drafted ? drafted[k] : live?.[k];
    return v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '');
  });
}

/**
 * Does a tap on theme `id` send the one-pick save? Always for another theme.
 * Re-tapping the CURRENT theme sends it only to hand an own look back to the
 * theme (the same patch, so Undo and Apply behave as for any pick) — and is a
 * no-op when nothing is overridden.
 */
export function themePickSends(id: string, picked: string, ownLook: boolean): boolean {
  return id !== picked || ownLook;
}
