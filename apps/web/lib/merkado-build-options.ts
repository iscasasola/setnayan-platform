/**
 * merkado-build-options.ts — Setnayan AI's one-click build (2026-07-10, PR-4 · S6).
 *
 * Given the couple's candidate vendors per category (their considered/shortlisted
 * picks), assemble THREE complete team options in one tap. Internally these are
 * our good/better/best tiers — cheapest · best-value · top-rated — but they are
 * NEVER labelled that way to the couple: customer-facing they're simply
 * "Option 1 · 2 · 3" (owner 2026-07-09), ordered cheapest→priciest so the ladder
 * reads through the totals, not through ranking words.
 *
 * Pure + framework-free so it unit-tests cleanly; the server action feeds it the
 * per-group candidates it already resolves and saves each option as a named
 * `budget_builds` snapshot.
 */

export type OptionCandidate = {
  groupId: string;
  groupLabel: string;
  vendorId: string;
  vendorName: string;
  costPhp: number | null;
  rating: number | null;
};

export type OptionPick = {
  groupId: string;
  label: string;
  vendorName: string;
  vendorId: string;
  costPhp: number | null;
};

export type BuildOption = {
  /** Customer-facing name — "Option 1 · 2 · 3", never good/better/best. */
  name: string;
  picks: OptionPick[];
  totalPhp: number;
};

type Tier = 'cheapest' | 'value' | 'top';

/** Pick one candidate from a group's list for a given tier. */
function pickForTier(cands: OptionCandidate[], tier: Tier): OptionCandidate {
  const arr = [...cands];
  if (tier === 'cheapest') {
    arr.sort((a, b) => (a.costPhp ?? Infinity) - (b.costPhp ?? Infinity));
  } else if (tier === 'top') {
    arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (a.costPhp ?? Infinity) - (b.costPhp ?? Infinity));
  } else {
    // best value = highest rating per ₱ (fall back to rating when price unknown).
    arr.sort((a, b) => valueScore(b) - valueScore(a) || (b.rating ?? 0) - (a.rating ?? 0));
  }
  return arr[0]!;
}

function valueScore(c: OptionCandidate): number {
  const r = c.rating ?? 0;
  const p = c.costPhp && c.costPhp > 0 ? c.costPhp : null;
  return p ? (r / p) * 100000 : r;
}

function assembleTier(candidatesByGroup: Map<string, OptionCandidate[]>, tier: Tier): OptionPick[] {
  const picks: OptionPick[] = [];
  for (const [groupId, cands] of candidatesByGroup) {
    if (cands.length === 0) continue;
    const c = pickForTier(cands, tier);
    picks.push({
      groupId,
      label: c.groupLabel,
      vendorName: c.vendorName,
      vendorId: c.vendorId,
      costPhp: c.costPhp,
    });
  }
  return picks;
}

const total = (picks: OptionPick[]) => picks.reduce((s, p) => s + (p.costPhp ?? 0), 0);

/**
 * Assemble the three options from per-group candidates. Returns them ordered
 * cheapest→priciest and named "Option 1/2/3". Empty when there are no candidates.
 */
export function selectBuildOptions(candidatesByGroup: Map<string, OptionCandidate[]>): BuildOption[] {
  const nonEmpty = new Map([...candidatesByGroup].filter(([, c]) => c.length > 0));
  if (nonEmpty.size === 0) return [];

  const tiers: Tier[] = ['cheapest', 'value', 'top'];
  const options = tiers.map((t) => {
    const picks = assembleTier(nonEmpty, t);
    return { picks, totalPhp: total(picks) };
  });

  // Order cheapest→priciest, then label Option 1/2/3 (never good/better/best).
  options.sort((a, b) => a.totalPhp - b.totalPhp);
  return options.map((o, i) => ({ name: `Option ${i + 1}`, picks: o.picks, totalPhp: o.totalPhp }));
}
