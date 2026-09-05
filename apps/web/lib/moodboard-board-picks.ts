/**
 * MB28 · The two picks "In your colors" makes on the couple's behalf.
 *
 * Both used to be one-liners inside the mood-board page's server component,
 * and both ignored the couple entirely: the Ceremony card took the first
 * `venue_scene` whose subtype was `church`/`ceremony` (MB25), and each attire
 * card took the first figure for its role that carried a colour range (MB23).
 * A beach wedding got a church. A `bridgerton · regal` couple got whichever
 * bride Postgres returned first.
 *
 * They live here, pure and DOM-free, for the reason `reception-decor-layers.ts`
 * gives for `resolveDecorLayer`: the page is an async server component over a
 * Supabase client, so a guard that wants to assert what a couple actually SEES
 * can either import this file or re-implement the decision in the test and
 * assert against its own copy. The second option is how a guard ends up
 * guarding itself — see the "PARSED FROM THE MIGRATION, NEVER RETYPED" note in
 * `_components/the-background-never-wears-the-palette.test.ts`.
 *
 * Everything here is TOTAL: no throw, and every unknown input resolves to the
 * behaviour that shipped before MB28.
 */

import { isCeremonyVenueSetting } from './venue-settings';
import { isMoodboardStyleFamily } from './moodboard-templates';

/**
 * The subtypes the Ceremony card falls back to when the couple has not chosen
 * a ceremony setting, or has chosen one with no live drawing behind it.
 *
 * 🪤 THIS LIST IS THE WHOLE DEFENCE AGAINST MB14b. Ten `venue_scene` rows are
 * live that are NOT ceremony spaces — the backdrop and ceiling decor layers
 * seeded by `20271194970382` and published by `20271207934361` — and the
 * page's query carries no `ORDER BY`. A fallback of "the first live
 * venue_scene" would show a couple a draped reception ceiling labelled
 * "Ceremony", intermittently, depending on row order. It must stay a list of
 * exact ceremony subtypes.
 *
 * `ceremony` is MB25's legacy alias, kept because a row may still carry it.
 */
export const CEREMONY_FALLBACK_SUBTYPES: readonly string[] = ['church', 'ceremony'];

export type VenueSceneRow = {
  asset_type: string;
  asset_subtype: string | null;
};

/**
 * The Ceremony card's drawing: the live `venue_scene` whose `asset_subtype`
 * EQUALS the couple's `events.ceremony_venue_setting`, else the church.
 *
 * `ceremonySetting` is validated through `isCeremonyVenueSetting` — the one
 * list in `venue-settings.ts` that the DB CHECK, the details editor and
 * `updateCeremonyVenueSetting` all already derive from — so a value this app
 * no longer knows degrades to the church instead of reaching the comparison as
 * an arbitrary string that might equal a decor zone's name.
 *
 * Matching is EQUALITY on the lower-cased subtype. Never a substring test: the
 * moment it is one, every zone name we ever add becomes a candidate for the
 * Ceremony card.
 */
export function pickCeremonyScene<T extends VenueSceneRow>(
  rows: readonly T[],
  ceremonySetting: string | null | undefined,
): T | undefined {
  const scenes = rows.filter((r) => r.asset_type === 'venue_scene');
  const subtypeOf = (r: T) => (r.asset_subtype || '').toLowerCase();

  if (isCeremonyVenueSetting(ceremonySetting)) {
    const chosen = scenes.find((r) => subtypeOf(r) === ceremonySetting);
    if (chosen) return chosen;
  }
  return scenes.find((r) => CEREMONY_FALLBACK_SUBTYPES.includes(subtypeOf(r)));
}

export type FigureRow = {
  /** The attire role this figure draws (`bride`, `groom`, `ninang`, …). */
  subtype: string | null;
  /** `moodboard_library_assets.style_theme` — the figure's style family. */
  styleTheme: string | null;
  /** Whether this figure carries at least one tagged colour range. */
  hasRange: boolean;
};

/**
 * How good a candidate one figure is for the role it draws. Higher wins.
 *
 *   2 · has a colour range AND is the couple's own style family
 *   1 · has a colour range
 *   0 · no colour range — a reference drawing that cannot wear their colours
 *
 * 🔑 THE ORDER OF THE TOP TWO IS THE ENTIRE POINT. Family-before-range would
 * re-open MB23 by another door: `modern-minimalist/bride` drew her gown in the
 * same colour as her own background (ΔE 0.0), her range was deleted for it,
 * and the picker's job was to pass her over. Preferring the family FIRST would
 * pick her back up — and only for couples who chose that family, and only as
 * "the card stopped recolouring", which no type and no rendering test can see.
 */
export function rankFigure(f: { hasRange: boolean; onFamily: boolean }): number {
  if (!f.hasRange) return 0;
  return f.onFamily ? 2 : 1;
}

/**
 * One representative figure per attire role, keyed by role.
 *
 * Ties keep the INCUMBENT, so within a rank the first row still wins exactly as
 * it did before MB28 — a couple with no style family (`null`, and every couple
 * who has never applied a template) gets byte-identically what shipped before.
 *
 * `styleFamily` is validated through `isMoodboardStyleFamily`, the same
 * validate-or-null the seating lab performs before handing a family to MB14b's
 * `resolveDecorLayer`. There is deliberately NO second mapping here from
 * `mood_feel_key`, a theme name, or a palette to a family: a mapping only this
 * page knew would put the attire row and the reception room in different style
 * families for the same couple, and neither surface would report it.
 */
export function pickFiguresByRole<T extends FigureRow>(
  rows: readonly T[],
  styleFamily: string | null | undefined,
): Record<string, T> {
  const family = isMoodboardStyleFamily(styleFamily) ? styleFamily : null;
  const out: Record<string, T> = {};
  for (const row of rows) {
    if (!row.subtype) continue;
    const score = rankFigure({
      hasRange: row.hasRange,
      onFamily: family !== null && row.styleTheme === family,
    });
    const held = out[row.subtype];
    if (
      held &&
      rankFigure({
        hasRange: held.hasRange,
        onFamily: family !== null && held.styleTheme === family,
      }) >= score
    ) {
      continue;
    }
    out[row.subtype] = row;
  }
  return out;
}
