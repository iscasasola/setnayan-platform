import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import {
  AI_TIER_FALLBACK_PHP,
  AI_TIER_SKU,
  type AiPriceTier,
} from '@/lib/setnayan-ai-type-pricing';
import { FAMILY_DISCOUNT_DEFAULT_PCT } from '@/lib/onboarding-family-discount';
import {
  saveAiBandPrice,
  saveFamilyDiscount,
  setEventTypeBand,
} from '@/app/admin/pricing/price-control-actions';
import { AiBandsEditor, type AiBandView, type EventKindView } from '@/app/admin/pricing/_components/ai-bands-editor';

/**
 * SETNAYAN AI PRICES — what the assisted planner costs, by kind of celebration.
 *
 * ⚖ Owner 2026-08-28: *"we want to be able to set all events accordingly. a
 * price and a checkbox. If a checkbox is checked, it should not show to the
 * other prices. For start set the checkbox accordingly to the price they are
 * assigned to."*
 *
 * PORTED from the binding prototype
 * `prototypes/setnayan_ai_pricing_by_event_type_2026-08-28.html` — not redrawn.
 * Its structure is reproduced: the stat strip, the family-discount card, the
 * "no price chosen" tray pinned above the bands, five band cards with their
 * kinds as tick-chips, and Tier E rendered with NO price field at all.
 *
 * 🔑 FOUR THINGS THE PROTOTYPE ESTABLISHED THAT THIS PORT KEEPS:
 *  1. `wake` is shown as UNASSIGNED, not as a ₱899 decision — because nobody
 *     chose ₱899 for it; it falls through the default.
 *  2. The tray keeps a permanent slot, so the NEXT kind of celebration somebody
 *     adds arrives as a visible question instead of silently being sold at the
 *     middle price.
 *  3. Tier E means NOT OFFERED, not free. A "₱0" in a price column reads as a
 *     free version somebody could switch on, so E gets no price field.
 *  4. Four price rows exist but only ONE is sellable. Setnayan AI is one product
 *     with four prices, never four products — the bands are labelled as bands
 *     and there is no way here to "activate" the three price-source rows.
 */

type Props = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const BANDS: AiPriceTier[] = ['A', 'B', 'C', 'D', 'E'];

export async function AiPricesSurface(_props: Props) {
  await requireAdmin();
  const admin = createAdminClient();

  const [vocabRes, catalogRes, settingsRes] = await Promise.all([
    admin
      .from('event_type_vocab')
      .select('event_type, label_en, emoji, enabled, sort_order, ai_price_tier')
      .order('sort_order', { ascending: true }),
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, onboarding_price_php, is_active')
      .in('service_code', ['SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D']),
    admin.from('platform_settings').select('ai_signup_discount_pct').eq('id', 1).maybeSingle(),
  ]);

  // ⚠ Supabase RESOLVES with `{ error }`. Unchecked, a refused read renders as
  // "no kinds of celebration exist", which looks exactly like a clean screen.
  if (vocabRes.error) logQueryError('AdminAiPrices (vocab)', vocabRes.error);
  if (catalogRes.error) logQueryError('AdminAiPrices (catalog)', catalogRes.error);
  if (settingsRes.error) logQueryError('AdminAiPrices (settings)', settingsRes.error);

  const unreadable = Boolean(vocabRes.error || catalogRes.error);

  const catalogByCode = new Map(
    ((catalogRes.data ?? []) as {
      service_code: string;
      retail_price_php: number | string;
      onboarding_price_php: number | string | null;
      is_active: boolean;
    }[]).map((r) => [r.service_code, r]),
  );

  const discountPct =
    settingsRes.data?.ai_signup_discount_pct != null &&
    Number.isFinite(Number(settingsRes.data.ai_signup_discount_pct))
      ? Number(settingsRes.data.ai_signup_discount_pct)
      : FAMILY_DISCOUNT_DEFAULT_PCT.ai;

  const kinds: EventKindView[] = ((vocabRes.data ?? []) as {
    event_type: string;
    label_en: string | null;
    emoji: string | null;
    enabled: boolean | null;
    ai_price_tier: string | null;
  }[]).map((v) => ({
    eventType: v.event_type,
    label: v.label_en ?? v.event_type,
    emoji: v.emoji ?? '•',
    enabled: v.enabled !== false,
    band: (v.ai_price_tier as AiPriceTier | null) ?? null,
  }));

  const bands: AiBandView[] = BANDS.map((band) => {
    const sku = AI_TIER_SKU[band];
    const row = sku ? catalogByCode.get(sku) ?? null : null;
    return {
      band,
      serviceCode: sku,
      // Tier E has no SKU and therefore no price — deliberately null, never 0.
      regularPhp: row ? Number(row.retail_price_php) : sku ? AI_TIER_FALLBACK_PHP[band] : null,
      signupPhp:
        row && row.onboarding_price_php != null ? Number(row.onboarding_price_php) : null,
      isSellable: row ? row.is_active === true : false,
      kinds: kinds.filter((k) => k.band === band),
    };
  });

  const unassigned = kinds.filter((k) => k.band === null);

  return (
    <div>
      {/* The masthead renders its title for screen readers only (owner-locked);
          the visible lede lives in the editor below, where the numbers are. */}
      <PageMasthead title="Setnayan AI prices" />

      {unreadable && (
        <div className="mb-6 rounded-2xl border border-danger-300/60 bg-danger-50/80 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-danger-900">
            Prices couldn&apos;t load
          </p>
          <p className="mt-1 text-sm text-danger-900">
            This screen is showing what it could read, which may be incomplete. Refresh in a
            moment — don&apos;t save from here until it loads cleanly.
          </p>
        </div>
      )}

      <AiBandsEditor
        bands={bands}
        unassigned={unassigned}
        totalKinds={kinds.length}
        discountPct={discountPct}
        setBandAction={setEventTypeBand}
        saveDiscountAction={saveFamilyDiscount}
        savePriceAction={saveAiBandPrice}
      />
    </div>
  );
}
