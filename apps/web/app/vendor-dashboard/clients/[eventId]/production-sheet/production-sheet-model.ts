/**
 * The production sheet's model — the live counts' shape, the caterer's portion rules, their labels and the one
 * multiplication (rule × live count). Moved out of `page.tsx` unchanged so the body, the rule rows and the add-rule
 * sheet read ONE copy (supplier pages set two, page 5).
 */
export type Metrics = {
  as_of: string | null;
  event_date: string | null;
  finality: { is_provisional: boolean; responded_pct: number; pending: number; maybe: number };
  headcount_scenarios: { confirmed: number; expected: number; ceiling: number };
  invited: number;
  declined: number;
  meal_counts: Record<string, number>;
  per_block_headcount: Record<string, { confirmed: number; expected: number; ceiling: number }>;
  dietary_restriction_count: number;
};

export type PortionRule = {
  rule_id: string;
  label: string;
  unit: string;
  qty_per_guest: number;
  applies_to_meals: string[] | null;
  applies_to_block: string | null;
  headcount_basis: 'confirmed' | 'expected' | 'ceiling';
  waste_factor_pct: number;
};

export const MEAL_LABELS: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids meal',
  no_preference: 'No preference',
  unspecified: 'Not specified yet',
};

export const BLOCK_LABELS: Record<string, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  cocktails: 'Cocktails',
  after_party: 'After party',
  rehearsal_dinner: 'Rehearsal dinner',
};

export const BASIS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  expected: 'Expected (+maybe)',
  ceiling: 'Ceiling (+pending)',
};

/**
 * The deterministic multiplication (§ 2.3): rule × matching live count.
 * Block-scoped rules read that block's pax at the rule's basis; meal-scoped
 * rules read confirmed meal counts (pending guests have no meal preference
 * yet — scaling them would be invention, not arithmetic).
 */
export function ruleCount(rule: PortionRule, m: Metrics): { count: number; basisNote: string } {
  if (rule.applies_to_block) {
    const block = m.per_block_headcount[rule.applies_to_block];
    return {
      count: block?.[rule.headcount_basis] ?? 0,
      basisNote: `${BLOCK_LABELS[rule.applies_to_block] ?? rule.applies_to_block} · ${BASIS_LABELS[rule.headcount_basis]}`,
    };
  }
  if (rule.applies_to_meals && rule.applies_to_meals.length > 0) {
    const count = rule.applies_to_meals.reduce((sum, p) => sum + (m.meal_counts[p] ?? 0), 0);
    return {
      count,
      basisNote: `${rule.applies_to_meals.map((p) => MEAL_LABELS[p] ?? p).join(' + ')} · confirmed`,
    };
  }
  return {
    count: m.headcount_scenarios[rule.headcount_basis],
    basisNote: `All guests · ${BASIS_LABELS[rule.headcount_basis]}`,
  };
}

export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}
