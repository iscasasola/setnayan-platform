import { Store } from 'lucide-react';
import { shopAlsoInLine } from '@/lib/shop-page-plan';

/**
 * "Also in <city> · <city>" — the shop's other branches, the line under the reach/facts row (owner 2026-11-13,
 * *"Show the branches as needed"*). Shared by the public shop page (`/v/[slug]`) and the dev lab
 * (`/dev/shop-plan-lab`, which the plan-preview miniatures draw from), so both say it one way. The rule is
 * `shopAlsoInLine` (lib/shop-page-plan.ts): no branch with a city → this renders NOTHING.
 */
export function ShopBranchesLine({
  cities,
  hqCity,
}: {
  cities: ReadonlyArray<string | null | undefined>;
  hqCity: string | null;
}) {
  const line = shopAlsoInLine(cities, hqCity);
  if (!line) return null;
  return (
    <p data-shop-branches="" className="inline-flex items-center gap-1 text-sm text-ink/60">
      <Store aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      {line}
    </p>
  );
}
