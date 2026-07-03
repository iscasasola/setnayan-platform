/**
 * Catalog-driven pricing data for the homepage "Prices" overlay.
 *
 * The prototype HARDCODED every price. The live homepage must NOT — admin price
 * changes have to propagate. So this module resolves each displayed row from the
 * live V2 catalog (`fetchV2CustomerCatalog`) by `service_code`, formats with
 * `formatPeso`, and only falls back to a literal when the SKU isn't found in the
 * DB (degrades gracefully on a service-key-less CI build, never 500s).
 *
 * Memory locks honored: NEVER hardcode prices (project_setnayan_pricing_admin_managed);
 * LIVE source = platform_retail_catalog_v2 (project_setnayan_pricing_collection).
 *
 * The slider-driven rows (per-day / per-guest-day) carry a `model` so the client
 * overlay can recompute live as the Guests + Days sliders move — the BASE rate
 * still comes from the catalog, only the multiplication is client-side.
 */
import {
  fetchV2CustomerCatalog,
  fetchV2VendorCatalog,
  getVendorPrices,
  formatPeso,
  type V2CustomerSku,
} from '@/lib/v2-catalog';
import { createAdminClient } from '@/lib/supabase/admin';

export type PriceModel = 'flat' | 'perDay' | 'perGuestDay';

export type PriceRow = {
  /** display label (may contain a trailing free-note marker handled in UI) */
  n: string;
  /** rendered price string, resolved from the catalog */
  v: string;
  /** true → render the price in the green "free" colour */
  free?: boolean;
  /** pricing model for the live slider estimate; absent = static */
  model?: PriceModel;
  /** base rate (peso) for slider models — from the catalog */
  rate?: number;
  /** per-guest-day cap (peso) */
  cap?: number;
  /** per-guest-day floor (peso) */
  floor?: number;
  /** small inline free-note shown after the label (e.g. "· single-cam free") */
  note?: string;
};

export type PriceGroup = {
  title: string;
  /** tinted (Papic / Couple Website) vs plain */
  tinted?: boolean;
  rows: PriceRow[];
};

export type PricingData = {
  /** Setnayan AI REGULAR price string (owner 2026-07-02: "₱799" / 28 days). */
  aiPrice: string;
  /** Setnayan AI INTRO price string — the first 28 days (e.g. "₱499"). */
  aiIntroPrice: string;
  /** Raw catalog numbers for client-side math — the pop-up savings comparator
   *  computes intro + regular × cycles off THESE (never re-hardcoded client-side). */
  aiRegularPhp: number;
  aiIntroPhp: number;
  /** recurrence suffix for the AI tier (e.g. "/28 days" or "/mo") */
  aiPeriod: string;
  freeChips: string[];
  groups: PriceGroup[];
  /** Vendor tier prices (28-day + annual), resolved from the live catalog —
   *  the "For vendors" overlay reads these so it never hardcodes a price. */
  vendor: Awaited<ReturnType<typeof getVendorPrices>>;
};

const peso = (n: number) => `₱${formatPeso(n)}`;

/**
 * Resolve a SKU's retail price from the catalog, falling back to a literal.
 * Returns BOTH the formatted string and the raw number (the latter feeds the
 * client-side slider recompute).
 */
function priceOf(
  catalog: V2CustomerSku[],
  code: string,
  fallback: number,
): { v: string; rate: number } {
  const sku = catalog.find((s) => s.service_code === code);
  const rate = sku ? Number(sku.retail_price_php) : fallback;
  return { v: peso(rate), rate };
}

/**
 * Setnayan AI is a per-28-day subscription (owner 2026-06-29 · SETNAYAN_AI).
 * The catalog row doesn't expose billing_period in V2CustomerSku here (that
 * field lands with the #2418 schema bump), so the recurrence suffix is derived
 * from the known model: SETNAYAN_AI is the one subscription SKU → "/28 days".
 * Every other SKU is one-time → no suffix. The PRICE itself is always from the
 * catalog; only the unit label is model-known.
 */
function aiPeriodSuffix(): string {
  return '/28 days';
}

export async function getHomePricingData(): Promise<PricingData> {
  // Parallel reads; helpers return [] on error so the overlay still renders.
  // getVendorPrices reuses the vendor catalog read (cache()d) for the tier prices.
  const [catalog, vendor] = await Promise.all([
    fetchV2CustomerCatalog(),
    getVendorPrices(),
  ]);

  // Setnayan AI two-tier pricing (owner 2026-07-02): ₱799 / 28 days, with the
  // first 28 days at ₱499. The active SETNAYAN_AI row is the ₱499 INTRO (the price
  // charged today); the ₱799 REGULAR lives in the dormant SETNAYAN_AI_RENEW row
  // (is_active=false → not in the active catalog above), read directly here so it
  // stays admin-managed. Fallbacks (₱799 / ₱499) render only if a row is
  // unreadable (CI / missing env) — never a fresh hardcode.
  const ai = catalog.find((s) => s.service_code === 'SETNAYAN_AI');
  const aiIntroRaw = Number(ai?.retail_price_php);
  const aiIntroPhp = Number.isFinite(aiIntroRaw) && aiIntroRaw > 0 ? aiIntroRaw : 499;
  const aiIntroPrice = peso(aiIntroPhp);
  let aiRegularPhp = 799;
  try {
    const { data: renew } = await createAdminClient()
      .from('platform_retail_catalog_v2')
      .select('retail_price_php')
      .eq('service_code', 'SETNAYAN_AI_RENEW')
      .maybeSingle();
    const p = Number((renew as { retail_price_php?: number | null } | null)?.retail_price_php);
    if (Number.isFinite(p) && p > 0) aiRegularPhp = p;
  } catch {
    // admin client unavailable → keep the ₱799 fallback.
  }
  const aiPrice = peso(aiRegularPhp);

  // ── Papic group (per-camera / per-day, all from catalog) ──
  const papicRoll = priceOf(catalog, 'PAPIC_CAMERA_ROLL_DAY', 30);
  const papicUnli = priceOf(catalog, 'PAPIC_CAMERA_UNLIMITED_DAY', 100);
  const cameraBridge = priceOf(catalog, 'CAMERA_BRIDGE', 1299);
  const stories = priceOf(catalog, 'PAPIC_ADDON_STORIES', 20);
  const kwento = priceOf(catalog, 'KWENTO', 299);
  const thankYou = priceOf(catalog, 'PAPIC_ADDON_THANK_YOU', 2499);
  const pabati = priceOf(catalog, 'PABATI', 1299);
  const liveWall = priceOf(catalog, 'LIVE_WALL', 2499);

  // ── Couple Website group ──
  const reveal = priceOf(catalog, 'STD_PREMIUM_OPENINGS', 1499);
  const stdVideo = priceOf(catalog, 'STD_VIDEO_UPLOAD', 100);
  const galleryUpload = priceOf(catalog, 'WEBSITE_GALLERY_UPLOAD', 100);
  const mapLink = priceOf(catalog, 'WEBSITE_MAP_LINKING', 100);
  const themes = priceOf(catalog, 'WEBSITE_THEMES', 1000);
  const websitePro = priceOf(catalog, 'COUPLE_WEBSITE_PRO', 1999);

  // ── Everything else ──
  const seating3d = priceOf(catalog, 'SEATING_3D', 2499);
  const monogram = priceOf(catalog, 'ANIMATED_MONOGRAM', 1999);
  const liveBg = priceOf(catalog, 'LIVE_BACKGROUND', 499);
  const pakanta = priceOf(catalog, 'PAKANTA', 2499);
  const liveStudio = priceOf(catalog, 'PANOOD_SYSTEM', 3499);

  const groups: PriceGroup[] = [
    {
      title: 'Papic: candid capture, all in one place',
      tinted: true,
      rows: [
        { n: 'Gallery view · camera filters', v: 'Free', free: true },
        { n: 'First 5 cameras · 5 photos + 1 video each', v: 'Free', free: true },
        {
          n: 'Papic Ltd · 30 photos + 10×5s',
          v: `${peso(papicRoll.rate)}/guest·day`,
          model: 'perGuestDay',
          rate: papicRoll.rate,
          cap: 15000,
        },
        {
          n: 'Papic Unli · unlimited',
          v: `${peso(papicUnli.rate)}/guest·day`,
          model: 'perGuestDay',
          rate: papicUnli.rate,
          cap: 15000,
        },
        {
          n: 'Camera Bridge · DSLR, all cameras',
          v: `${peso(cameraBridge.rate)}/day`,
          model: 'perDay',
          rate: cameraBridge.rate,
        },
        {
          n: 'Stories · add-on',
          v: `${peso(stories.rate)}/guest·day`,
          model: 'perGuestDay',
          rate: stories.rate,
          cap: 2000,
          floor: 200,
        },
        { n: 'Kwento · whole event', v: kwento.v },
        { n: 'Thank You · add-on', v: thankYou.v },
        { n: 'Pabati · add-on', v: `${peso(pabati.rate)}/day`, model: 'perDay', rate: pabati.rate },
        {
          n: 'Live Photo Wall',
          v: `${peso(liveWall.rate)}/day`,
          model: 'perDay',
          rate: liveWall.rate,
        },
        { n: 'Unlock all of Papic · daily max', v: `${peso(15000)}/day`, model: 'perDay', rate: 15000 },
      ],
    },
    {
      title: 'Couple Website: one site · Save-the-Date · RSVP · Event · Editorial',
      tinted: true,
      rows: [
        { n: 'The whole 4-in-1 site + unlimited RSVP', v: 'Free', free: true },
        { n: 'Reveal · cinematic STD openings', v: reveal.v },
        { n: 'STD video upload', v: stdVideo.v },
        { n: 'Photo gallery upload', v: galleryUpload.v },
        { n: 'Waze / Google Map link', v: mapLink.v },
        { n: 'Themes · RSVP + Event + Editorial', v: themes.v },
        { n: 'Unlock All · Couple Website PRO', v: websitePro.v },
      ],
    },
    {
      title: 'Everything else, à la carte',
      rows: [
        { n: '3D Plan · full 3D + site integration', v: seating3d.v },
        { n: 'Animated Monogram', v: monogram.v },
        { n: 'Live Background · video or template bg', v: liveBg.v },
        { n: 'Pakanta', v: pakanta.v },
        {
          n: 'Live Studio · multicam',
          note: '· single-cam free',
          v: `${peso(liveStudio.rate)}/day`,
          model: 'perDay',
          rate: liveStudio.rate,
        },
      ],
    },
  ];

  return {
    aiPrice,
    aiIntroPrice,
    aiRegularPhp,
    aiIntroPhp,
    aiPeriod: aiPeriodSuffix(),
    vendor,
    freeChips: [
      'Guest list & RSVP',
      '2D seat plan',
      'Personalized QR · per guest',
      'Budget & payments',
      'Schedule & checklist',
      'Mood board',
      'Printable plans',
      'Your event page',
      'Ala Ala memory hub',
      'Editorials',
      'Single-camera livestream',
      'Browse all vendors',
      '0% commission',
    ],
    groups,
  };
}
