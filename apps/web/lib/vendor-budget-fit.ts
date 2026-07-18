import { priceFitScore } from './smart-sort';
import { canonicalServiceToPlanGroupId } from './wedding-plan-groups';

/**
 * Per-vendor budget-fit ratio for compat-score's `budgetFit` dimension on the
 * couple's budget-planner accordion.
 *
 * Maps the vendor's category → its plan group → the couple's allocated ₱ for
 * that group (from the median-anchored allocation engine — the same numbers the
 * Budget tab and the category-search overlay use), then scores the vendor's
 * "starts at" price against it with `priceFitScore`. This lets the budget
 * planner's own per-candidate % finally reflect budget fit — before this it fed
 * only distance/reviews/verified and left `budgetFit` frozen at neutral.
 *
 * Returns `null` (→ compat-score applies its own NEUTRAL) whenever any input is
 * missing or unmappable — an absent price, a category with no plan group, or a
 * group the couple's allocation doesn't cover. Never fabricates a fit. Pure:
 * inject `budgetByPlanGroup` so it is unit-testable off the DB.
 */
export function vendorBudgetFitRatio(args: {
  /** The vendor pick's category (event_vendors.category), a VendorCategory. */
  vendorCategory: string | null | undefined;
  /** The vendor's "starts at" anchor in whole pesos (starting_price_php). */
  startingPricePhp: number | null | undefined;
  /** planGroupId → allocated ₱ for that category (allocation leaf amountPhp). */
  budgetByPlanGroup: ReadonlyMap<string, number>;
}): number | null {
  const { vendorCategory, startingPricePhp, budgetByPlanGroup } = args;
  if (
    vendorCategory == null ||
    startingPricePhp == null ||
    !Number.isFinite(startingPricePhp) ||
    startingPricePhp <= 0
  ) {
    return null;
  }
  const groupId = canonicalServiceToPlanGroupId(vendorCategory);
  if (groupId == null) return null;
  const categoryBudgetPhp = budgetByPlanGroup.get(groupId);
  if (categoryBudgetPhp == null) return null;
  return priceFitScore(startingPricePhp, categoryBudgetPhp);
}
