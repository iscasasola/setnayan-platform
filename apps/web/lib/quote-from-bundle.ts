/**
 * lib/quote-from-bundle.ts — 🧺 "START FROM A BUNDLE" ON THE QUOTE (owner 11 Nov 2026: *"they can load a bundle also and
 * edit from it."*).
 *
 * A saved Bundle Maker bundle becomes the quote's opening draft, priced by THE BUNDLE MAKER'S OWN SUMS
 * (`bundleSums` · `gatherInclusions` · `planDraftsOrDefault`, lib/bundle-sums.ts — the functions `savePackage` prices a
 * bundle with since #7479), never a second rule:
 *   · one line per card, AT ITS LOWEST (the card's price minus its best every-couple discount) — `cardLowest`;
 *   · what the couple gets: every inclusion of those cards, merged, as complimentary lines — `gatherInclusions`;
 *   · the bundle's EXTRA discount as the quote's Discount, with its reason;
 *   · the bundle's own payment plan (or a copy of the one default), in the quote's draft shape.
 * So the quote opens at the bundle's New total, and every line stays editable afterwards.
 *
 * ⚠ The bundle's STORED price (`total_price_centavos`) is what its card shows; a card price changed since the bundle
 * was saved moves the sums. Both figures travel so the quote can say so — never silently pick one.
 *
 * PURE: no I/O, no React. 🔒 lib/quote-from-bundle.test.ts
 */
import { bundleSums, gatherInclusions, planDraftsOrDefault, type BundleCardFacts, type BundlePlanDrafts } from './bundle-sums';
import type { QuoteSeedLine } from './quote-from-service-card';

export type QuoteBundleSeed = {
  name: string;
  /** The bundle's cards, in its order — picked on the quote so its offers and `serviceCardIds` know them. */
  cardIds: string[];
  lines: QuoteSeedLine[];
  /** The bundle's extra discount, in pesos (0 = none). */
  discountPhp: number;
  discountReason: string | null;
  plan: BundlePlanDrafts;
  /** The New total the sums reach today. */
  totalPhp: number;
  /** What the bundle was saved at; null when it has none stored. */
  savedTotalPhp: number | null;
  /** Cards with no price yet — the total cannot be trusted while any is listed. */
  unpriced: string[];
};

const flat = (label: string, php: number, free: boolean): QuoteSeedLine => ({
  label,
  basis: 'flat',
  free,
  flatPhp: free ? 0 : php,
  ratePhp: 0,
  minPax: 0,
  basePhp: 0,
  inclHours: 0,
  extraPhp: 0,
});

/** The bundle as the quote's opening draft. `cards` are the bundle's cards, in its order, as the shop reads them now. */
export function quoteSeedFromBundle(
  bundle: { name: string; extraDiscountCentavos: number | null; plan: BundlePlanDrafts | null; savedTotalCentavos: number | null },
  cards: readonly BundleCardFacts[],
  now: Date,
): QuoteBundleSeed {
  const sums = bundleSums(cards, Math.round((Number(bundle.extraDiscountCentavos) || 0) / 100), now);
  const lines: QuoteSeedLine[] = [
    // 🏷 Each card's line names its card, so an offer that reaches one card comes off that card's line only.
    ...sums.lines.map((l) => ({ ...flat(l.name, l.lowestPhp ?? 0, false), cardId: l.id })),
    ...gatherInclusions(cards).map((g) => flat(g.label, 0, true)),
  ];
  const name = bundle.name.trim() || 'Your bundle';
  return {
    name,
    cardIds: cards.map((c) => c.id),
    lines,
    discountPhp: sums.extraPhp,
    discountReason: sums.extraPhp > 0 ? `${name} · bundle price` : null,
    plan: planDraftsOrDefault(bundle.plan),
    totalPhp: sums.newTotalPhp,
    savedTotalPhp: bundle.savedTotalCentavos == null ? null : Math.round(Number(bundle.savedTotalCentavos) / 100),
    unpriced: sums.unpriced,
  };
}
