/**
 * /pricing and /pricing/plan read OUR prices here — one read, two pages (owner 2026-10-25: "Yes, build this pricing
 * page and the questionnaire into the app"; prototype `pricing_ours_only_2026-10-25`, index.html revision 5 + quiz.html).
 *
 * 🔑 EVERY PESO COMES FROM `platform_retail_catalog_v2`: the customer catalogue (`fetchV2CustomerCatalog`) plus the rows
 * it leaves out on purpose (`readPricingExtras`: the eleven Event Hub Pro parts and Setnayan AI's band rows). Nothing
 * here types a price. A row that is missing, inactive or unreadable comes back `null` / absent — and the pages draw NO
 * figure for it (a missing price is recoverable; a confidently wrong one is not).
 *
 * Numbers only. The pages format them (`formatPeso`).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchV2CustomerCatalog, type V2CustomerSku } from '@/lib/v2-catalog';
import { resolveAiPrices } from '@/app/_components/home/pricing-data';
import { HUB_PARTS, HUB_PART_SKUS } from '@/lib/hub-parts';
import { AI_TIER_SKU } from '@/lib/setnayan-ai-type-pricing';

/**
 * The rows /pricing reads that `fetchV2CustomerCatalog` leaves out ON PURPOSE: the eleven Event Hub Pro parts (listed
 * inside Event Hub Pro's "Just the parts you need") and Setnayan AI's price-source rows B · C · D (is_active=false —
 * they price an event type, they are not sold on their own). Read-only; an unreadable read returns no rows, and a
 * missing row draws no figure.
 */
type PricingExtraRow = {
  service_code: string;
  retail_price_php: number | null;
  onboarding_price_php: number | null;
  is_active: boolean | null;
};
export async function readPricingExtras(): Promise<PricingExtraRow[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const aiCodes = Object.values(AI_TIER_SKU).filter((c): c is string => c !== null);
  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, retail_price_php, onboarding_price_php, is_active')
    .in('service_code', [...HUB_PART_SKUS, ...aiCodes]);
  if (error || !data) {
    if (error) console.error('[supabase-error] app/(shell)/pricing/_pricing-reads.ts · from:platform_retail_catalog_v2 (parts + AI tiers)', error);
    return [];
  }
  return (data as PricingExtraRow[]).map((r) => ({
    service_code: r.service_code,
    retail_price_php: r.retail_price_php == null ? null : Number(r.retail_price_php),
    onboarding_price_php: r.onboarding_price_php == null ? null : Number(r.onboarding_price_php),
    is_active: r.is_active,
  }));
}

/** A product with the regular price and, when the row carries a lower one, the "while you set up your event" price. */
export type TwoPrices = { regular: number; signup: number | null };
export type AiBand = 'A' | 'B' | 'C' | 'D';

export type OurPrices = {
  /** Event Hub Pro — COUPLE_WEBSITE_PRO. */
  pro: TwoPrices | null;
  /** The Event Hub Pro parts that have an active, priced row, in `HUB_PARTS` order. */
  hubParts: Array<{ id: string; name: string; php: number }>;
  /** Papic credit rungs (PAPIC_GUEST*), cheapest first — the label is the row's own words ("add 100 credits"). */
  papicRungs: Array<{ label: string; php: number; signup: number | null }>;
  /** Live Watch — LIVE_STUDIO. Absent from the catalogue read while its launch switch is off. */
  liveWatch: number | null;
  /** Patiktok — PATIKTOK_COMPILER, with whether its row bills per day. */
  patiktok: { php: number; perDay: boolean } | null;
  /** Thank-you film — PAPIC_ADDON_THANK_YOU. */
  thankYou: number | null;
  /** Music Maker — PAKANTA. */
  musicMaker: number | null;
  /** Setnayan AI by event-type band (AI_TIER_SKU), each through the shared two-price resolver. */
  ai: Partial<Record<AiBand, TwoPrices>>;
};

const usable = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

function twoPrices(row: { retail_price_php: number | null; onboarding_price_php: number | null } | null | undefined): TwoPrices | null {
  // The SAME resolver the nav overlay uses: NULL sign-up = no discount, a sign-up at/above regular is ignored,
  // an unreadable row = no figure.
  const p = resolveAiPrices(row ? { retail_price_php: Number(row.retail_price_php), onboarding_price_php: row.onboarding_price_php } : null);
  if (p.regularPhp <= 0) return null;
  return { regular: p.regularPhp, signup: p.hasSignupPrice ? p.introPhp : null };
}

/** Build `OurPrices` from the two reads — pure, so a test can hand it rows. */
export function ourPricesFrom(customerSkus: readonly V2CustomerSku[], extras: readonly PricingExtraRow[]): OurPrices {
  const row = (code: string) => customerSkus.find((s) => s.service_code === code);
  const php = (code: string): number | null => {
    const r = row(code);
    const n = r ? Number(r.retail_price_php) : NaN;
    return usable(n) ? n : null;
  };
  const extraByCode = new Map(extras.map((r) => [r.service_code, r]));

  const hubParts = HUB_PARTS.flatMap((part) => {
    const r = extraByCode.get(part.sku);
    const n = r && r.is_active ? Number(r.retail_price_php) : NaN;
    return usable(n) ? [{ id: part.id, name: part.name, php: n }] : [];
  });

  const papicRungs = customerSkus
    .filter((s) => /^PAPIC_GUEST(_|$)/.test(s.service_code)) // gitleaks:allow — catalog service_codes, not secrets
    .map((s) => {
      const p = Number(s.retail_price_php);
      const signup = usable(s.onboarding_price_php) && s.onboarding_price_php < p ? s.onboarding_price_php : null;
      return {
        label: s.title.replace(/^Papic(\s+Pool)?\s*[—-]\s*/i, '').replace(/\s*\(per event\)\s*$/i, ''),
        php: p,
        signup,
      };
    })
    .filter((r) => usable(r.php))
    .sort((a, b) => a.php - b.php);

  const patiktokRow = row('PATIKTOK_COMPILER');
  const patiktokPhp = php('PATIKTOK_COMPILER');

  const ai: Partial<Record<AiBand, TwoPrices>> = {};
  for (const band of ['A', 'B', 'C', 'D'] as const) {
    const code = AI_TIER_SKU[band];
    const r = code === 'SETNAYAN_AI' ? row('SETNAYAN_AI') : code ? extraByCode.get(code) : undefined;
    const prices = twoPrices(r ?? null);
    if (prices) ai[band] = prices;
  }

  return {
    pro: twoPrices(row('COUPLE_WEBSITE_PRO') ?? null),
    hubParts,
    papicRungs,
    liveWatch: php('LIVE_STUDIO'),
    patiktok: patiktokPhp != null ? { php: patiktokPhp, perDay: patiktokRow?.billing_period === 'per_day' } : null,
    thankYou: php('PAPIC_ADDON_THANK_YOU'),
    musicMaker: php('PAKANTA'),
    ai,
  };
}

/** Both reads, in parallel. Each degrades to "no rows" on error, so the page still renders (with no figure). */
export async function readOurPrices(): Promise<{ prices: OurPrices; customerSkus: V2CustomerSku[] }> {
  const [customerSkus, extras] = await Promise.all([fetchV2CustomerCatalog(), readPricingExtras()]);
  return { prices: ourPricesFrom(customerSkus, extras), customerSkus };
}

/** "₱70 adds 100 credits, ₱700 adds 1,000" — the two round rungs (100 · 1,000 · 10,000 credits), else the first two. */
export function papicRungWords(rungs: OurPrices['papicRungs'], fmt: (n: number) => string): string {
  const creditsOf = (label: string) => Number((/([\d,]+)\s+credits?/i.exec(label)?.[1] ?? '').replace(/,/g, ''));
  const round = rungs.filter((b) => {
    const n = creditsOf(b.label);
    return n >= 100 && Number.isInteger(Math.log10(n));
  });
  return (round.length >= 2 ? round : rungs)
    .slice(0, 2)
    .map((b, i) => `₱${fmt(b.php)} ${b.label.replace(/^add\b/i, 'adds').replace(i > 0 ? /\s+credits?$/i : /$^/, '')}`)
    .join(', ');
}
