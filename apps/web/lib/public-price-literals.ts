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
 *
 * ─── FOUR ENTRIES WERE RETIRED 2026-08-13, BY DELETING THE LITERALS ──────
 * A BASELINE IS A BILL, NOT A DECISION. Each line here is a standing promise
 * that somebody keeps a number in step by hand, and four of them turned out to
 * be avoidable — the figures were sitting in the catalog the whole time:
 *
 *   • `vendor-benefits.ts` ₱8,999 + `vendor-tier-matrix.tsx` ₱8,999 — declared
 *     on the reason that Custom "is not a DB catalog SKU (Custom is composed
 *     per plan)". **`vendor_custom_base` is an active row at exactly ₱8,999.**
 *     The stated justification for the exemption was factually wrong, and the
 *     number lived in THREE places (a display label, a regex that parsed it back
 *     out of that label, and the regex's fallback).
 *   • `vendor-benefits.ts` ₱999 — `vendor_branch_28day`, likewise active.
 *   • `app/pricing/page.tsx` ₱499 — the dangerous one. Declared `sku: null` as a
 *     "last-resort fallback", which is the category the runtime drift check
 *     deliberately does NOT verify. The live SETNAYAN_AI price was ₱2,499 by
 *     then: the undrifted "non-price" was FIVE TIMES off, on the page where
 *     somebody decides to pay. It now renders no figure at all when the catalog
 *     is unreadable.
 *
 * 🔑 THE `sku: null` CATEGORY IS WHERE A STALE PRICE HIDES. It exists for genuine
 * non-prices — a commission threshold, an illustrative budget — and nothing
 * checks anything in it. Before writing `sku: null`, ask whether the number is
 * a price that simply has no reachable SKU *yet*; if it is, it belongs in the
 * catalog, not here.
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

  // ── the ONE payment page · a BANK's fee, not ours ─────────────────────────
  {
    file: 'app/pay/[reference]/_components/pay-panel.tsx',
    literal: '₱10',
    sku: null,
    reason:
      "The InstaPay fee the payer's OWN bank charges to send into BDO (measured " +
      '2026-07-31: ₱2.17 sent + ₱10 fee). Setnayan neither sets nor receives it; ' +
      'it is on the page so a wallet payer picks the free GCash rail knowingly.',
  },
  {
    file: 'app/pay/[reference]/_components/pay-panel.tsx',
    literal: '₱15',
    sku: null,
    reason: 'Top of the same bank-side InstaPay fee range. Not a Setnayan charge.',
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
