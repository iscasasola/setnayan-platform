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
import {
  papicCapacityShort,
  papicFreeCameraCount,
  publicPapicLadder,
} from '@/lib/papic-tier-copy';
import { readPapicTierConfig } from '@/lib/papic-tier-config-read';

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
  /** Setnayan AI price string — one-time, wedding-anchored (owner 2026-07-10: "₱499"). */
  aiPrice: string;
  /** Legacy alias of aiPrice (one-time has no separate intro; kept for consumers). */
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
 * A row spread that renders green "Free" when the catalog rate resolves to 0
 * (an owner-locked-free SKU or a deactivated row), else the resolved price
 * string. Keeps display ↔ checkout consistent — "Free" only ever shows when the
 * catalog is actually free, never a hardcoded claim over a live paid row.
 */
function freeOrPrice(p: { v: string; rate: number }): { v: string; free?: boolean } {
  return p.rate === 0 ? { v: 'Free', free: true } : { v: p.v };
}

/**
 * Setnayan AI is a ONE-TIME, wedding-anchored purchase (owner 2026-07-10 · a
 * single ₱499 charge, access until the event date). The prior ₱499→₱799/28-day
 * subscription is retired, so there is no recurrence suffix.
 */
function aiPeriodSuffix(): string {
  return '';
}

export async function getHomePricingData(): Promise<PricingData> {
  // Parallel reads; helpers return [] on error so the overlay still renders.
  // getVendorPrices reuses the vendor catalog read (cache()d) for the tier prices.
  const [catalog, vendor, papicTierConfig] = await Promise.all([
    fetchV2CustomerCatalog(),
    getVendorPrices(),
    readPapicTierConfig(),
  ]);

  // Setnayan AI is a ONE-TIME, wedding-anchored purchase (owner 2026-07-10): a
  // single ₱499 charge from the SETNAYAN_AI catalog row, access until the event
  // date. The ₱499→₱799/28-day subscription (and its SETNAYAN_AI_RENEW row) is
  // retired, so there is no intro/renewal split — aiRegular === aiIntro, which
  // collapses any legacy two-tier consumer to the single price. The ₱499 fallback
  // renders only if the row is unreadable (CI / missing env), never a fresh hardcode.
  const ai = catalog.find((s) => s.service_code === 'SETNAYAN_AI');
  const aiRaw = Number(ai?.retail_price_php);
  const aiIntroPhp = Number.isFinite(aiRaw) && aiRaw > 0 ? aiRaw : 499;
  const aiRegularPhp = aiIntroPhp;
  const aiIntroPrice = peso(aiIntroPhp);
  const aiPrice = aiIntroPrice;

  // ── Papic group (per-camera / per-day; the rungs are derived below) ──
  const cameraBridge = priceOf(catalog, 'CAMERA_BRIDGE', 500); // owner 2026-07-08 (was 1299; rounded 499→500 2026-07-11)
  // Owner-locked FREE: Stories (2026-06-30) · Kwento + Pabati (2026-07-08).
  // Fallback 0 so an absent/zeroed catalog row renders "Free" via freeOrPrice(),
  // never a stale paid figure.
  const stories = priceOf(catalog, 'PAPIC_ADDON_STORIES', 0);
  const kwento = priceOf(catalog, 'KWENTO', 0);
  const pabati = priceOf(catalog, 'PABATI', 0);
  const liveWall = priceOf(catalog, 'LIVE_WALL', 2500);

  // ── Couple Website group ──
  const galleryUpload = priceOf(catalog, 'WEBSITE_GALLERY_UPLOAD', 100);
  const mapLink = priceOf(catalog, 'WEBSITE_MAP_LINKING', 100);
  const themes = priceOf(catalog, 'WEBSITE_THEMES', 1000);
  const subdomain = priceOf(catalog, 'EVENT_SUBDOMAIN', 999); // yourname.setnayan.com (owner 2026-07-10)
  // Website PRO REACTIVATED + repriced ₱3,500 (owner 2026-07-22): the umbrella
  // and the ONLY way to get Editorial PRO + the Cinematic Reveal, both now
  // bundle-only (is_active=false → their standalone rows are removed here so the
  // priceOf fallback can't reprint a stale standalone price).
  const websitePro = priceOf(catalog, 'COUPLE_WEBSITE_PRO', 3500);

  // ── Everything else ──
  const seating3d = priceOf(catalog, 'SEATING_3D', 2999);
  const monogram = priceOf(catalog, 'ANIMATED_MONOGRAM', 1000); // Monogram PRO — now includes Live Background
  const pakanta = priceOf(catalog, 'PAKANTA', 2499);
  const liveStudio = priceOf(catalog, 'PANOOD_SYSTEM', 2500); // Desktop Controller ₱2,500/day (Mobile ₱1,500/day is a separate SKU)

  // Papic rungs — DERIVED from papic_tier_config (title · daily capture-POINT
  // budget · wedding cap) priced from the live catalog. This file must never
  // spell a photo count, a clip count or a cap peso figure (owner 2026-07-20 ·
  // guarded by lib/papic-copy-guardrails.test.ts). A rung whose rate SKU is
  // absent drops out rather than rendering an invented price.
  const papicFreeCameras = papicFreeCameraCount(papicTierConfig);
  const papicLadderRows: PriceRow[] = publicPapicLadder(papicTierConfig)
    .map((row): PriceRow | null => {
      const sku = row.rateServiceCode
        ? catalog.find((s) => s.service_code === row.rateServiceCode)
        : undefined;
      const rate = sku ? Number(sku.retail_price_php) : NaN;
      if (!Number.isFinite(rate)) return null;
      return {
        n: `${row.displayTitle} · ${papicCapacityShort(row.pointsPerDay)}`,
        v: `${peso(rate)}/guest·day`,
        model: 'perGuestDay',
        rate,
        ...(row.weddingCapPhp != null ? { cap: row.weddingCapPhp } : {}),
      };
    })
    .filter((r): r is PriceRow => r !== null);

  const groups: PriceGroup[] = [
    {
      title: 'Papic: candid capture, all in one place',
      tinted: true,
      rows: [
        { n: 'Gallery view · camera filters', v: 'Free', free: true },
        {
          n: `First ${papicFreeCameras} camera${papicFreeCameras === 1 ? '' : 's'} · ${papicCapacityShort(
            papicTierConfig.free.pointsPerDay,
          )}`,
          v: 'Free',
          free: true,
        },
        ...papicLadderRows,
        {
          n: 'Camera Bridge · DSLR, all cameras',
          v: `${peso(cameraBridge.rate)}/day`,
          model: 'perDay',
          rate: cameraBridge.rate,
        },
        { n: 'Stories · add-on', ...freeOrPrice(stories) },
        { n: 'Kwento · whole event', ...freeOrPrice(kwento) },
        { n: 'Pabati · add-on', ...freeOrPrice(pabati) },
        {
          n: 'Live Photo Wall',
          v: `${peso(liveWall.rate)}/day`,
          model: 'perDay',
          rate: liveWall.rate,
        },
      ],
    },
    {
      title: 'Couple Website: one site · Save-the-Date · RSVP · Event · Editorial',
      tinted: true,
      rows: [
        { n: 'The whole 4-in-1 site + unlimited RSVP', v: 'Free', free: true },
        { n: 'Website PRO · Cinematic Reveal + Editorial PRO, one unlock', v: websitePro.v },
        { n: 'Photo gallery upload', v: galleryUpload.v },
        { n: 'Waze / Google Map link', v: mapLink.v },
        { n: 'Themes · RSVP + Event + Editorial', v: themes.v },
        { n: 'Custom subdomain · yourname.setnayan.com', note: '· coming soon', v: `${subdomain.v}/year` },
      ],
    },
    {
      title: 'Everything else, à la carte',
      rows: [
        { n: '3D Plan · full 3D + site integration', v: seating3d.v },
        { n: 'Animated Monogram · includes Live Background', v: monogram.v },
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
