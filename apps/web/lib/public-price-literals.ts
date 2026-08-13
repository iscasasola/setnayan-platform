/**
 * public-price-literals.ts — the declared inventory of peso figures hardcoded
 * into PUBLIC (pre-sign-in) surfaces.
 *
 * WHY. Prices are admin-managed in `platform_retail_catalog_v2` /
 * `vendor_billing_catalog` and move often. Any peso figure typed into marketing
 * source is a promise we stop verifying the moment it is committed — and on
 * 2026-07-31 two of them were found badly stale on a live surface (the app-store
 * demo advertised the Animated Monogram at ₱2,499 when the catalog said ₱1,000,
 * and Pakanta at ₱3,499 when the catalog said ₱2,500).
 *
 * ⚠ THIS FILE IS NOT ITSELF THE GUARD. A hand-typed allow-list checked against
 * hand-typed source is two humans agreeing with each other — exactly the failure
 * that let llms.txt drift for three weeks (see llms-txt.ts). So the work is split
 * between two checkers, each looking at something it can actually see:
 *
 *   1. `public-price-literals.test.ts` (CI, no DB) — scans the public source and
 *      fails if a peso literal appears that is NOT declared here. This catches
 *      NEW hardcoding. It cannot judge correctness.
 *   2. `runSeoHealthChecks` (runtime, reads prod) — for every entry that declares
 *      a `sku`, asserts the literal still equals that SKU's live price. This
 *      catches DRIFT, and it is the half CI structurally cannot do.
 *
 * Adding an entry is deliberately a little annoying: you must say which SKU a
 * number mirrors, or state why it is not a price at all.
 */

export type PriceLiteral = {
  /** Path relative to apps/web. */
  file: string;
  /** The figure exactly as written in source, e.g. '₱1,000'. */
  literal: string;
  /**
   * The catalog `service_code` / `sku_code` this figure mirrors, or null when the
   * figure is not a SKU price at all (an illustrative budget, a free marker, a
   * commission threshold). A non-null value is what subjects it to the runtime
   * drift check.
   */
  sku: string | null;
  /** Why this literal is allowed to exist in source. */
  reason: string;
};

export const PUBLIC_PRICE_LITERALS: readonly PriceLiteral[] = [
  // ── app-store demo · the two that were found stale on 2026-07-31 ───────────
  {
    file: 'app/_components/app-store/studio-card-demo.tsx',
    literal: '₱1,000',
    sku: 'ANIMATED_MONOGRAM',
    reason: 'Monogram demo frame sells the single-price idea; the figure must be the real one.',
  },
  {
    file: 'app/_components/app-store/studio-card-demo.tsx',
    literal: '₱2,500',
    sku: 'PAKANTA',
    reason: 'Pakanta demo frame checkout button.',
  },
  {
    file: 'app/_components/app-store/studio-card-demo.tsx',
    literal: '₱85,000',
    sku: null,
    reason: 'Illustrative vendor quote inside a mock gallery tile — not a Setnayan SKU.',
  },

  // ── vendor marketing · real SKU prices in tier copy ────────────────────────
  {
    file: 'app/_components/home/vendor-benefits.ts',
    literal: '₱8,999',
    sku: 'vendor_custom_base',
    reason: 'Custom tier "from" floor in the shared VENDOR_CUSTOM_TIER label.',
  },
  {
    file: 'app/_components/home/vendor-benefits.ts',
    literal: '₱999',
    sku: 'vendor_branch_28day',
    reason: 'Additional-branch price named twice in the Custom tier dials.',
  },
  {
    file: 'app/vendors/_components/vendor-tier-matrix.tsx',
    literal: '₱8,999',
    sku: 'vendor_custom_base',
    reason: 'Fallback for the regex that reads the floor off VENDOR_CUSTOM_TIER.name.',
  },

  // ── non-SKU figures: commission thresholds, free markers, examples ─────────
  {
    file: 'app/vendors/_components/vendor-tier-matrix.tsx',
    literal: '₱100,000',
    sku: null,
    reason: 'Commission-tapering threshold (post-launch 5%→1%), not a purchasable price.',
  },
  {
    file: 'app/vendors/_components/vendor-grow-sections.tsx',
    literal: '₱100,000',
    sku: null,
    reason: 'Same commission-tapering threshold.',
  },
  {
    file: 'app/_components/home/vendor-benefits.ts',
    literal: '₱100,000',
    sku: null,
    reason: 'Same commission-tapering threshold.',
  },
  {
    file: 'app/vendors/page.tsx',
    literal: '₱100,000',
    sku: null,
    reason: 'Same commission-tapering threshold.',
  },
  {
    file: 'app/pricing/page.tsx',
    literal: '₱499',
    sku: null,
    reason:
      'Last-resort fallback when the Setnayan AI catalog row is unreadable; the live value is resolved from the catalog immediately above it.',
  },
  {
    file: 'app/onboarding/wedding/_components/onboarding-shell.tsx',
    literal: '₱30,000',
    sku: null,
    reason: 'Illustrative budget figure in onboarding copy — not a Setnayan SKU.',
  },

];

/** '₱1,000' → 1000. Returns null for anything unparseable. */
export function parsePesoLiteral(literal: string): number | null {
  const n = Number(literal.replace(/[₱,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Only the entries the runtime audit can verify against the live catalog. */
export function skuBackedLiterals(): readonly (PriceLiteral & { sku: string })[] {
  return PUBLIC_PRICE_LITERALS.filter((l): l is PriceLiteral & { sku: string } => l.sku !== null);
}

/**
 * '₱0' is universally allowed and not declared per-file: it is a FREE marker, can
 * never be stale, and appears across many surfaces where enumerating it would be
 * pure noise.
 */
export const ALWAYS_ALLOWED_LITERALS: ReadonlySet<string> = new Set(['₱0']);
