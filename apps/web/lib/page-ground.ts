/**
 * lib/page-ground.ts — WHAT PAINTS THE EVENT HUB'S PAGE GROUND, AS ONE RULE.
 *
 * Owner, 2026-09-26 (DECISION_LOG "YES TO ALL", item (a)), verbatim ruling:
 * *"background: the colour is always the base; the hero photo/video sits on
 * top only on Pro themes"*.
 *
 * Three surfaces paint the page ground, and before this file each spelled the
 * rule its own way:
 *
 *   · `GuestLookScope` (the layout) — the paper: the theme's colour, the
 *     couple's plain colour (via `--color-cream`), or their ombré; and the
 *     theme's own loop over it;
 *   · `SiteBody` → `MainGround` — the couple's hero photo/video (or their
 *     explicit override) laid over everything, gated on `theme !== 'house'`;
 *   · `InvitationShell` — its own opaque paper, dropped when a ground exists.
 *
 * Three spellings of one decision is how a surface drifts: a new free theme,
 * or a Pro theme with no loop, would have been answered differently by each.
 * Every one of them now asks `pageGround`.
 *
 * ── THE RULE, IN LAYERS (bottom → top) ─────────────────────────────────────
 *   1. BASE — ALWAYS painted, for every theme: the colour with its effect
 *      (Plain · Dawn · Diagonal · Glow, `lib/ombre.ts`). Plain = the paper
 *      colour (the theme's, or the couple's own hex); an effect = the ombré.
 *   2. THEME LOOP — Setnayan's own theme art, only for a theme that has one,
 *      and never over an ombré (an ombré is a background; decoding a video to
 *      hide it behind a gradient costs a guest's phone for nothing).
 *   3. HERO ON TOP — the couple's hero photo/video as the page background,
 *      ONLY on a Pro theme. Classic (free) NEVER shows it (owner: *"classic has
 *      no photo or video"*) — whatever the Maker stored.
 *
 * Pure. No I/O. Client-safe (the layout's scope is a client component).
 */
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';

/**
 * May the hero photo/video be laid over the page as its background under this
 * (already ownership-gated) theme? Only a PRO theme — keyed on the registry's
 * `tier`, not on "is it House", so a future free theme is refused by default.
 */
export function heroMayBePageGround(theme: InviteThemeId | null | undefined): boolean {
  if (!theme) return false;
  return INVITE_THEMES[theme]?.tier === 'pro';
}

export type PageGroundFacts = {
  /** The theme `resolveHubTheme` answered — Pro ownership already decided. */
  theme: InviteThemeId | null | undefined;
  /** The couple chose an effect (an ombré), not a plain colour. */
  ombre: boolean;
  /** A Main background exists for this event (`resolveMainGround` answered). */
  heroGround: boolean;
};

export type PageGround = {
  /** Layer 1 — always painted. 'paper' = the flat colour; 'ombre' = the effect. */
  base: 'paper' | 'ombre';
  /** Layer 2 — the theme's own loop over the base. */
  themeLoop: boolean;
  /** Layer 3 — the hero photo/video over everything (Pro themes only). */
  heroOnTop: boolean;
  /**
   * The invitation shell paints its OWN opaque paper. True only when nothing
   * but the flat colour is under it — any other layer would be hidden by it.
   */
  shellPaper: boolean;
};

export function pageGround(f: PageGroundFacts): PageGround {
  const themed = Boolean(f.theme && f.theme !== 'house');
  const heroOnTop = f.heroGround && heroMayBePageGround(f.theme);
  return {
    base: f.ombre ? 'ombre' : 'paper',
    themeLoop: themed && !f.ombre && !heroOnTop,
    heroOnTop,
    shellPaper: !themed && !f.ombre && !heroOnTop,
  };
}
