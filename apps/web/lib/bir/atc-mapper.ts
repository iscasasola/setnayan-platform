/**
 * BIR Alphanumeric Tax Code (ATC) mapper.
 *
 * Maps a Setnayan vendor (and optionally a specific service the vendor
 * provided in the quarter) to the BIR ATC code that should appear on
 * their Form 2307 quarterly Certificate of Creditable Tax Withheld at
 * Source.
 *
 * V1 ruleset, per iteration 0026 spec § 5.1 + the BIR-Form-2307 brief:
 *
 *   1. Professional individuals (lawyers / CPAs / engineers / medical) →
 *      WI151 (5%) for gross income ≤ ₱720K, WI150 (10%) above. We default
 *      to WI151; per-vendor override happens via a future
 *      `vendor_profiles.ewt_rate_bps` field (not in V1).
 *
 *   2. Talent individuals (musicians / photographers classified as talent
 *      under RR 2-98) → WI080 (5%) ≤ ₱720K, WI081 (10%) above. Defaults
 *      to WI080.
 *
 *   3. Service-supplier vendors (the default — caterers / florists /
 *      coordinators / planners / DJs / hair-and-makeup / bridal / etc.):
 *      under RR 11-2018 as amended by RR 14-2018, a Top Withholding Agent
 *      withholds 2% from individuals (WI158) or 2% from corporations
 *      (WC158). Setnayan is designated a TWA per spec corpus
 *      a0fa3c7 § 5.1; both rows withhold at 200 bps (2%).
 *
 * Final source-of-truth: BIR RMC 8-2024 + RR 11-2018 + RR 14-2018.
 * Subject to confirmation with Setnayan's tax accountant per
 * 0026 § 10. Engineering exposes the rate as basis points so a
 * rate change is one constant edit, not a logic rewrite.
 */

/** Vendor TIN type — drives the W I / W C ATC family. */
export type VendorTinType = 'individual' | 'corporation';

/** BIR service category — drives the ATC family inside the TIN type. */
export type VendorBirServiceCategory =
  | 'professional'
  | 'talent'
  | 'service_supplier';

/** Minimal vendor shape the mapper consumes — keep this loose so call
 * sites can pass either a vendor_profiles row or a 2307-flavored view. */
export type AtcMapperVendorInput = {
  tin_type: VendorTinType | null | undefined;
  bir_service_category: VendorBirServiceCategory | null | undefined;
  /** Optional override — when set, the mapper returns this code verbatim. */
  atc_code_override?: string | null;
  /** Optional override — when set, the mapper returns this rate verbatim. */
  ewt_rate_bps_override?: number | null;
};

export type AtcMapperResult = {
  atc_code: string;
  /** Rate in basis points — 200 = 2.00%, 500 = 5.00%. */
  rate_bps: number;
  /** Human-readable description for the admin queue + audit log. */
  description: string;
};

/**
 * Default fallback when both `tin_type` and `bir_service_category` are
 * null on the vendor row. Most wedding vendors are individual service
 * suppliers under the TWA rule, so this is the conservative-correct
 * default — the alternative would be skipping the row entirely.
 */
const DEFAULT_TIN_TYPE: VendorTinType = 'individual';
const DEFAULT_CATEGORY: VendorBirServiceCategory = 'service_supplier';

/**
 * Map a vendor to the ATC code + rate that should appear on their 2307.
 *
 * Per spec, every field on the vendor input is optional — the mapper
 * gracefully falls back so a half-onboarded vendor still gets a sane
 * default (admin can then chase the vendor to fill in the gaps before
 * the next quarter's run).
 */
export function mapVendorToATC(
  vendor: AtcMapperVendorInput,
): AtcMapperResult {
  // Hard overrides win over rule-based mapping — admin sometimes negotiates
  // a different ATC with a specific vendor under a stand-alone agreement.
  if (vendor.atc_code_override && vendor.ewt_rate_bps_override != null) {
    return {
      atc_code: vendor.atc_code_override,
      rate_bps: vendor.ewt_rate_bps_override,
      description: 'Admin override',
    };
  }

  const tinType: VendorTinType = vendor.tin_type ?? DEFAULT_TIN_TYPE;
  const category: VendorBirServiceCategory =
    vendor.bir_service_category ?? DEFAULT_CATEGORY;

  if (tinType === 'corporation') {
    // Corporations don't have a low/high tier — the TWA rate applies
    // uniformly. Professional / talent / service-supplier all land on
    // WC158 (2%) under the Top Withholding Agent rule.
    return {
      atc_code: 'WC158',
      rate_bps: 200,
      description: 'Corporation — Top Withholding Agent 2% (WC158)',
    };
  }

  // Individual branch — three categories.
  if (category === 'professional') {
    // WI151 is the lower-tier (≤ ₱720K gross income) rate.
    return {
      atc_code: 'WI151',
      rate_bps: 500,
      description:
        'Professional (individual) — 5% creditable WT (WI151, ≤ ₱720K)',
    };
  }

  if (category === 'talent') {
    return {
      atc_code: 'WI080',
      rate_bps: 500,
      description:
        'Talent (individual) — 5% creditable WT (WI080, ≤ ₱720K)',
    };
  }

  // service_supplier (default) — TWA rule.
  return {
    atc_code: 'WI158',
    rate_bps: 200,
    description: 'Service supplier (individual) — Top Withholding Agent 2% (WI158)',
  };
}

/** Convert PHP centavos to a 2-decimal peso string for PDF rendering.
 * Pure helper — no I/O. */
export function centavosToPesoString(centavos: number): string {
  if (!Number.isFinite(centavos)) return '0.00';
  const pesos = Math.round(centavos) / 100;
  return pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
