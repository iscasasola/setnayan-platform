/**
 * feature-pages/price.ts — turning a feature's catalogue CODES into the price
 * a page shows. PURE: the rows are read by `app/features/_feature-price.ts`
 * and handed in, so every rule here runs under `tsx --test`.
 *
 * 🔑 NEVER A TYPED NUMBER (CLAUDE.md price lock; DECISION_LOG 2026-10-01
 * "prices come from the catalogue"). A row that cannot be read renders
 * "See pricing" and NO structured-data Offer — a missing price is recoverable,
 * a confidently wrong one quoted by a search result is not.
 */
import { formatPeso } from '@/lib/v2-catalog-pure';
import type { FeatureLocale, FeaturePrice } from './types';

export type CatalogueRow = Readonly<{
  catalogue: 'retail' | 'supplier';
  code: string;
  php: number;
  /** `billing_period` (retail) or `offering_type` (supplier), verbatim. */
  period: string | null;
  active: boolean;
}>;

export type ResolvedFeaturePrice =
  | { kind: 'free' }
  | { kind: 'unknown' }
  | {
      kind: 'paid' | 'free-plus';
      lowPhp: number;
      highPhp: number;
      /** More than one usable row — the label says "From". */
      many: boolean;
      /** The recurrence of the LOWEST row, e.g. " / 28 days" — travels with the number. */
      suffix: Readonly<{ en: string; tl: string }>;
    };

const SUFFIX: Readonly<Record<string, { en: string; tl: string }>> = {
  per_28d: { en: ' / 28 days', tl: ' / 28 araw' },
  per_day: { en: ' / day', tl: ' / araw' },
  per_year: { en: ' / year', tl: ' / taon' },
  subscription_monthly: { en: ' / 28 days', tl: ' / 28 araw' },
  subscription_annual: { en: ' / year', tl: ' / taon' },
  vendor_addon_recurring: { en: ' / 28 days', tl: ' / 28 araw' },
  branch: { en: ' / 28 days', tl: ' / 28 araw' },
  seat: { en: ' / 28 days', tl: ' / 28 araw' },
  custom_addon: { en: ' / 28 days', tl: ' / 28 araw' },
  vendor_addon_per_event: { en: ' / event', tl: ' / event' },
};
const NO_SUFFIX = { en: '', tl: '' } as const;

/**
 * The usable rows for a price: right catalogue, named code, a real positive
 * figure, and ACTIVE — except the one ladder whose inactive rows are price
 * sources by design (Setnayan AI B/C/D, see `FeaturePrice`).
 */
export function resolveFeaturePrice(
  price: FeaturePrice,
  rows: readonly CatalogueRow[] | null,
): ResolvedFeaturePrice {
  if (price.kind === 'free') return { kind: 'free' };
  if (!rows) return { kind: 'unknown' };
  const usable = rows.filter(
    (r) =>
      r.catalogue === price.catalogue &&
      price.codes.includes(r.code) &&
      Number.isFinite(r.php) &&
      r.php > 0 &&
      (r.active || price.inactiveRowsArePrices === true),
  );
  if (usable.length === 0) return { kind: 'unknown' };
  const sorted = [...usable].sort((a, b) => a.php - b.php);
  const low = sorted[0]!;
  const high = sorted[sorted.length - 1]!;
  return {
    kind: price.kind,
    lowPhp: low.php,
    highPhp: high.php,
    many: usable.length > 1,
    suffix: (low.period && SUFFIX[low.period]) || NO_SUFFIX,
  };
}

/** The words on the page. One function, both locales. */
export function featurePriceLabel(p: ResolvedFeaturePrice, locale: FeatureLocale): string {
  const tl = locale === 'tl';
  if (p.kind === 'free') return tl ? 'Libre' : 'Free';
  if (p.kind === 'unknown') return tl ? 'Tingnan ang presyo' : 'See pricing';
  const fig = `₱${formatPeso(p.lowPhp)}${p.suffix[locale]}`;
  if (p.kind === 'free-plus') {
    return tl ? `Libre · may upgrade mula ${fig}` : `Free · upgrades from ${fig}`;
  }
  if (p.many) return tl ? `Mula ${fig}` : `From ${fig}`;
  return fig;
}

/**
 * The schema.org Offer for the page's SoftwareApplication. Free → a ₱0 Offer
 * (the honest machine-readable "free"; same form the product pages use).
 * Free-plus → ₱0 too: the feature itself costs nothing, the upgrade is a
 * different thing. A ladder → AggregateOffer low/high. Unknown → null, and the
 * caller emits no `offers` at all rather than a guess.
 */
export function featureOffer(p: ResolvedFeaturePrice, url: string): Record<string, unknown> | null {
  if (p.kind === 'unknown') return null;
  if (p.kind === 'free' || p.kind === 'free-plus') {
    return { '@type': 'Offer', price: '0', priceCurrency: 'PHP', url, availability: 'https://schema.org/InStock' };
  }
  if (p.many) {
    return {
      '@type': 'AggregateOffer',
      lowPrice: String(p.lowPhp),
      highPrice: String(p.highPhp),
      priceCurrency: 'PHP',
      url,
      availability: 'https://schema.org/InStock',
    };
  }
  return {
    '@type': 'Offer',
    price: String(p.lowPhp),
    priceCurrency: 'PHP',
    url,
    availability: 'https://schema.org/InStock',
  };
}
