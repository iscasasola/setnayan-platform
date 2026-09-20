/**
 * role-chip-style.ts — ONE rule for what colour a role chip is.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Every role chip used to take its colour from `ROLE_GROUP_CHIP`, a fixed
 * Tailwind class per ROLE GROUP. That made the couple and their parents the
 * same red (`bg-danger-100` and `bg-danger-200/70`), because they share no
 * meaning — only a tier. The couple had already chosen a colour for each of
 * these people on the mood board, and the guest list ignored it, showing it as
 * an 8px dot at most.
 *
 * Now the chip's tint IS the mood-board colour, resolved by the SAME function
 * the 3D scene dresses attire with. A couple who has not filled that key keeps
 * the existing class, unchanged — so an empty mood board looks exactly as it
 * does today.
 *
 * ── WHY IT IS ITS OWN MODULE ────────────────────────────────────────────────
 * Two call sites render role chips (the primary chip and the `+Role` extras
 * beside it) and they disagreed: the primary resolved the specific palette key,
 * the extras resolved only the group. A rule that lives at the call site gets
 * two answers. This module is the rule; both sites import it.
 *
 * Pure and client-safe — no hooks, no server imports. Returns EXACTLY ONE of
 * `tintClass` (the untouched fallback) or `style` (the palette tint), never
 * both, so a caller cannot accidentally paint a Tailwind ring under an inline
 * one.
 */

import type { GuestRole } from './guests';
import { resolveAttirePaletteColor, type RolePalette } from './mood-board';
import { ROLE_GROUP_CHIP, ROLE_GROUP_TEXT, roleGroupOf } from './role-groups';
import { accentTextOnRoster, tintedChipFromAccent } from './site-palette';

/** The inline half — a wash, a hue-carrying label, and a 1px inset ring. */
export type RoleChipInlineStyle = {
  backgroundColor: string;
  color: string;
  /** An inset box-shadow reproduces Tailwind's `ring-1` without a ring class. */
  boxShadow: string;
};

export type RoleChipStyle = {
  /** The fallback tint class, or null when the palette answered. */
  tintClass: string | null;
  /** The palette tint, or null when the couple has not filled that key. */
  style: RoleChipInlineStyle | null;
};

/**
 * The colour for one role's chip, given the event's mood-board palette.
 *
 * 🔑 THE CHIP SHOWS WHAT THAT ROLE WILL WEAR. `resolveAttirePaletteColor` is
 * the canonical chain the 3D scene already dresses people by — the role's own
 * palette key, then the shared `wedding_party` fallback — so a bridesmaid's
 * chip and her gown in the seating lab can never disagree. Resolving it here a
 * second time is how they drifted before: the old chip asked for the role
 * GROUP, and since `roleGroupOf('groomsman')` returns `groomsmen` (its own
 * group since the wedding-party split), a couple who had filled only
 * `wedding_party` got NO chip colour at all while the scene dressed the man
 * correctly.
 *
 * `sideColor` is deliberately null. Step 3 of that chain falls back to the
 * bride's/groom's side colour, which is right for a figure in a room and wrong
 * for a list that already carries a separate side chip beside this one — it
 * would paint every uncoloured role with the side tint and say nothing about
 * their role.
 */
export function roleChipStyle(role: GuestRole, palette: RolePalette): RoleChipStyle {
  const group = roleGroupOf(role);
  const accent = resolveAttirePaletteColor(role, palette, null);
  const tinted = accent ? tintedChipFromAccent(accent) : null;
  if (!tinted) return { tintClass: ROLE_GROUP_CHIP[group], style: null };
  return {
    tintClass: null,
    style: {
      backgroundColor: tinted.background,
      color: tinted.color,
      boxShadow: `inset 0 0 0 1px ${tinted.ring}`,
    },
  };
}

/** The roster's text-only half — same accent, no capsule. */
export type RoleTextStyle = {
  /** The fallback text class, or null when the palette answered. */
  textClass: string | null;
  /** The palette colour as text, or null when that key is unfilled. */
  style: { color: string } | null;
};

/**
 * The same role, the same colour, rendered as TEXT for the dense roster.
 *
 * ⚖ Owner 2026-09-20: "remove the pill boxes ... so it looks neater". The
 * desktop table drops the capsules; the mobile card keeps them, because one
 * guest per card is sparse enough that a chip reads as a label rather than as
 * texture.
 *
 * 🔑 TWO PRESENTATIONS, ONE RESOLVER. Both this and `roleChipStyle` above read
 * the accent from `resolveAttirePaletteColor`, so a role can never be one
 * colour on a card and a different colour on a row. Resolving the accent twice,
 * in two components, is exactly how the primary chip and the `+Role` extras
 * came to disagree before #5755.
 *
 * The contrast target differs on purpose: the chip darkens against its own 16%
 * wash, this darkens against the row. See `accentTextOnRoster`.
 */
export function roleTextStyle(role: GuestRole, palette: RolePalette): RoleTextStyle {
  const group = roleGroupOf(role);
  const accent = resolveAttirePaletteColor(role, palette, null);
  const color = accent ? accentTextOnRoster(accent) : null;
  if (!color) return { textClass: ROLE_GROUP_TEXT[group], style: null };
  return { textClass: null, style: { color } };
}
