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
 *   3. HERO ON TOP — the couple's hero photo/video as the page background.
 *      Their own media is EVENT HUB PRO, so it shows on a Pro theme (whose
 *      resolution already required the unlock) and — owner 2026-09-29, "yes"
 *      (DECISION_LOG "A PRO COUPLE KEEPS THEIR OWN PHOTO/VIDEO BACKGROUND ON
 *      EVERY THEME") — on a FREE theme (Modern, Cyber Neon) when the event
 *      OWNS Event Hub Pro right now. A free or lapsed couple on a free theme
 *      gets the theme's own loop (layer 2). Classic NEVER shows it, owner or
 *      not (*"classic has no photo or video"*) — whatever the Maker stored.
 *      The door photo (`resolveHubLook`) and the print still (`loadPrintSet`)
 *      ask this too.
 *
 * Pure. No I/O. Client-safe (the layout's scope is a client component).
 */
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';

/**
 * May the couple's own hero photo/video be laid under this theme?
 *
 *   · Classic — like any free theme: only when the event OWNS Event Hub Pro
 *     (owner 2026-10-06, DECISION_LOG "EVENT DETAILS IS REBUILT": the old
 *     Classic "no photo or video" rule is DROPPED — own photo/video ◆ for everyone);
 *   · a PRO theme — yes: the caller hands the theme `resolveInviteTheme`
 *     answered, which is only ever a Pro theme when the unlock is held (or the
 *     host is trying it on), so ownership is already decided;
 *   · a FREE theme with a loop (Modern, Cyber Neon) — only when the event OWNS
 *     Event Hub Pro right now (`ownsPro`, measured by the caller through the
 *     entitlement resolver AS VIEWED — "view as a free couple" sees the loop).
 *
 * `ownsPro` is REQUIRED: a default of `true` would hand a free couple Pro media
 * on the day somebody forgets it, and that failure renders as a working page.
 */
export function heroMayBePageGround(theme: InviteThemeId | null | undefined, ownsPro: boolean): boolean {
  if (!theme) return false;
  const t = INVITE_THEMES[theme];
  if (!t) return false;
  // A Pro theme reached the caller only with the unlock held (or tried on).
  if (t.media && t.tier === 'pro') return true;
  // Every free theme — Classic included since 2026-10-06 — needs the event to own Pro.
  return ownsPro;
}

/**
 * Does answering `heroMayBePageGround` for this theme need the ownership read?
 * Every free theme (Classic included since 2026-10-06) — so only a Pro-theme
 * page pays no extra query. Callers use it to skip the read, never to decide the answer.
 */
export function heroGroundNeedsOwnership(theme: InviteThemeId | null | undefined): boolean {
  if (!theme) return false;
  const t = INVITE_THEMES[theme];
  // Every theme but a Pro theme with its own loop — Classic included (2026-10-06).
  return Boolean(t && !(t.media && t.tier === 'pro'));
}

export type PageGroundFacts = {
  /** The theme `resolveHubTheme` answered — Pro ownership already decided. */
  theme: InviteThemeId | null | undefined;
  /** The couple chose an effect (an ombré), not a plain colour. */
  ombre: boolean;
  /** A Main background exists for this event (`resolveMainGround` answered). */
  heroGround: boolean;
  /**
   * The event owns Event Hub Pro right now, as viewed. Only read on a free
   * theme with a loop; absent = not owned (fail closed). The two client
   * callers pass `heroGround: false`, where it cannot matter.
   */
  ownsPro?: boolean;
};

export type PageGround = {
  /** Layer 1 — always painted. 'paper' = the flat colour; 'ombre' = the effect. */
  base: 'paper' | 'ombre';
  /** Layer 2 — the theme's own loop over the base. */
  themeLoop: boolean;
  /** Layer 3 — the hero photo/video over everything (Pro media: a Pro theme, or a free one with the unlock). */
  heroOnTop: boolean;
  /**
   * The invitation shell paints its OWN opaque paper. True only when nothing
   * but the flat colour is under it — any other layer would be hidden by it.
   */
  shellPaper: boolean;
};

export function pageGround(f: PageGroundFacts): PageGround {
  const themed = Boolean(f.theme && f.theme !== 'house');
  const heroOnTop = f.heroGround && heroMayBePageGround(f.theme, f.ownsPro === true);
  return {
    base: f.ombre ? 'ombre' : 'paper',
    themeLoop: themed && !f.ombre && !heroOnTop,
    heroOnTop,
    shellPaper: !themed && !f.ombre && !heroOnTop,
  };
}
