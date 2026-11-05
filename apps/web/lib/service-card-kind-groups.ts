/**
 * service-card-kind-groups.ts — THE CARD MAKER'S "SOMETHING ELSE" FOLDS, FROM THE LIVE TAXONOMY ONLY.
 *
 * 🔴 THE BUG (owner, 2026-11-04 — "why is it that i only see these categories when we have a whole spectrum"). The
 * folds under "What you offer → Something else" were drawn from the hard-coded `SERVICE_GROUPS` in `lib/vendors.ts`
 * (~46 kinds in 6 groups), while the live taxonomy — Admin › Categories, every trade — reached only the search band.
 * Owner rule (2026-10-26, "the taxonomy has one source"): Admin › Categories only, no hard-coded copies.
 *
 * ✅ One fold per live top-level group (its own label), listing every live trade under it (its own label, the branch as
 * the small hint). Standing is NOT decided here: it is handed in — the same `standingForCategory` the save enforces — so
 * a plan lock still shows and still refuses.
 *
 * Two things the live tree cannot carry, kept on purpose:
 *   · a kind the shop ALREADY has a card under that is no longer a live trade — listed (as covered) under "Your other
 *     cards", never stranded;
 *   · Miscellaneous — the kind sheet's own miss line tells a supplier "pick Miscellaneous for now", so it stays
 *     reachable (added under "Other" only when the live tree does not already carry it).
 * 🔒 lib/service-card-kind-groups.test.ts
 */
import type { CoverageParent } from '@/lib/vendor-coverages';
import type { CategoryChoice, CategoryGroup } from '@/app/vendor-dashboard/services/_components/canvas-maker';

/** The one kind the miss line names. */
export const MISC_KIND = 'misc';

type Standing = { standing: 'covered' | 'open' | 'locked'; why?: string };

export function liveKindGroups(input: {
  tree: readonly CoverageParent[];
  standingOf: (key: string) => Standing;
  /** The kinds of the shop's existing cards. */
  ownCategories: readonly string[];
  /** The shop's own coverage words lead "Common for …" — a live trade it already works in then moves to its fold. */
  leadWithOwnWords: boolean;
  kindLabel: (key: string) => string;
  /** Kinds already listed on the sheet in the shop's own words ("What you cover") — not listed a second time. */
  alreadyListed?: ReadonlySet<string>;
}): CategoryGroup[] {
  const { tree, standingOf, ownCategories, leadWithOwnWords, kindLabel } = input;
  const alreadyListed = input.alreadyListed ?? new Set<string>();
  const choice = (key: string, label: string, hint?: string): CategoryChoice => {
    const st = standingOf(key);
    return {
      value: key,
      label,
      // ⚠ RE-BANDED, NEVER REMOVED — a kind in a family the shop's own words already lead moves to its fold rather
      // than competing with their word for it.
      standing: leadWithOwnWords && st.standing === 'covered' ? 'open' : st.standing,
      why: st.standing === 'locked' ? st.why : undefined,
      ...(hint && hint !== label ? { hint } : {}),
    };
  };

  const live = new Set<string>();
  const groups: CategoryGroup[] = [];
  for (const p of tree) {
    const options: CategoryChoice[] = [];
    for (const b of p.branches) {
      for (const l of b.leaves) {
        if (live.has(l.canonicalService)) continue;
        live.add(l.canonicalService);
        if (alreadyListed.has(l.canonicalService)) continue;
        options.push(choice(l.canonicalService, l.label, b.label));
      }
    }
    if (options.length > 0) groups.push({ key: `live-${p.folderId}`, label: p.label, options });
  }

  // A card's kind that is no longer a live trade — still the shop's, still choosable, never stranded.
  const stranded = Array.from(new Set(ownCategories)).filter((c) => c && !live.has(c) && !alreadyListed.has(c));
  if (stranded.length > 0) {
    groups.push({
      key: 'your-cards',
      label: 'Your other cards',
      options: stranded.map((c) => {
        const st = standingOf(c);
        return { value: c, label: kindLabel(c), standing: st.standing === 'locked' ? 'locked' : 'covered', why: st.standing === 'locked' ? st.why : undefined };
      }),
    });
  }

  if (!live.has(MISC_KIND) && !stranded.includes(MISC_KIND) && !alreadyListed.has(MISC_KIND)) {
    groups.push({ key: 'other', label: 'Other', options: [choice(MISC_KIND, kindLabel(MISC_KIND))] });
  }
  return groups;
}
