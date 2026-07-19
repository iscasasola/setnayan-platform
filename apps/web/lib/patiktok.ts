/**
 * Hard-coded scaffold catalogue of Patiktok vertical-reel templates.
 *
 * Iteration 0017 ships a TikTok-style mimic STATION (physical X-mark + guest
 * booth) as its full scope — see `0017_patiktok.md` for the complete spec.
 * This file backs the template gallery: a couple-facing gallery of pickable
 * vertical-reel templates that previews how the booth experience is staged.
 *
 * Each template renders as a CSS-painted 9:16 preview (palette + a styled
 * overlay) on the gallery page — same approach as the Save-the-Date V1
 * gallery so that no asset pipeline is needed at scaffold time.
 *
 * PRICING IS NOT IN THIS FILE. Patiktok is a SINGLE admin-managed SKU keyed
 * `PATIKTOK_COMPILER`, priced in the authoritative V2 retail catalog
 * (`platform_retail_catalog_v2`). The studio surface reads the display price via
 * `getCustomerSkuPrice('PATIKTOK_COMPILER')` and the checkout charge re-resolves
 * the same row server-side — never hardcoded here. The old 2026-05-16 dual-tier
 * per-day model (₱999 / ₱1,999 / ₱49 overage) was RETIRED 2026-06-29 and is NOT
 * restored. (Un-retire 2026-07-01.)
 */

export type PatiktokCategory =
  | 'save-the-date'
  | 'ceremony'
  | 'reception'
  | 'sde'
  | 'outro';

export type PatiktokTemplate = {
  slug: string;
  name: string;
  category: PatiktokCategory;
  /** Default mimic duration in seconds (spec range: 1–30s). */
  defaultDurationSec: number;
  /** Short blurb shown under the name. */
  vibe: string;
  /** 4 hex colors — left to right on the 9:16 preview swatch. */
  palette: [string, string, string, string];
  /** Tailwind font fragment for the overlay title ("font-serif italic", etc.). */
  fontClass: string;
  /** Lift hint shown under the title. */
  bestFor: string;
};

export const PATIKTOK_CATEGORIES: ReadonlyArray<{
  key: PatiktokCategory;
  label: string;
}> = [
  { key: 'save-the-date', label: 'Save-the-date' },
  { key: 'ceremony', label: 'Ceremony' },
  { key: 'reception', label: 'Reception' },
  { key: 'sde', label: 'Same-day edit' },
  { key: 'outro', label: 'Outro' },
];

/**
 * Canonical service_key for the single Patiktok SKU. Ownership reads orders
 * keyed on this code; the buy CTA creates an order under it; the price is the
 * `platform_retail_catalog_v2` row of the same code. Centralized so every
 * surface keys the one canonical SKU.
 */
export const PATIKTOK_SERVICE_KEY = 'PATIKTOK_COMPILER';

/** Per-booth-per-day soft cap on captured videos (UX guidance, not a charge). */
export const PATIKTOK_VIDEO_SOFT_CAP = 40;

export const PATIKTOK_TEMPLATES: readonly [
  PatiktokTemplate,
  PatiktokTemplate,
  ...PatiktokTemplate[]
] = [
  {
    slug: 'cebu-sunrise-reel',
    name: 'Cebu Sunrise',
    category: 'save-the-date',
    defaultDurationSec: 15,
    vibe: 'Warm cream + terracotta — daytime garden teaser.',
    palette: ['#FAF7F2', '#C97B4B', '#D8A076', '#824A2A'],
    fontClass: 'font-serif',
    bestFor: 'Tropical · daytime · pastel',
  },
  {
    slug: 'manila-old-world-reel',
    name: 'Manila Old World',
    category: 'save-the-date',
    defaultDurationSec: 12,
    vibe: 'Deep maroon + ivory — heritage church teaser.',
    palette: ['#F5EBD9', '#8B1E3F', '#5C0A20', '#C9A14B'],
    fontClass: 'font-serif italic',
    bestFor: 'Heritage · evening · formal',
  },
  {
    slug: 'mountain-vows',
    name: 'Mountain Vows',
    category: 'ceremony',
    defaultDurationSec: 20,
    vibe: 'Forest green + cream — Tagaytay / Baguio ceremony.',
    palette: ['#F4F0E6', '#2F4A3A', '#7C8C72', '#5C341D'],
    fontClass: 'font-serif',
    bestFor: 'Outdoor · cool-weather · rustic',
  },
  {
    slug: 'ocean-procession',
    name: 'Ocean Procession',
    category: 'ceremony',
    defaultDurationSec: 18,
    vibe: 'Ocean blue + sand — beach aisle walk.',
    palette: ['#F4F0E6', '#7BA3C7', '#34577A', '#D6BC8E'],
    fontClass: 'font-sans tracking-wide',
    bestFor: 'Beach · daytime · breezy',
  },
  {
    slug: 'dance-floor-anthem',
    name: 'Dance Floor Anthem',
    category: 'reception',
    defaultDurationSec: 25,
    vibe: 'Hot terracotta + black — first-dance high-energy clip.',
    palette: ['#0F0F0F', '#C9A14B', '#FAF7F2', '#7A1F2B'],
    fontClass: 'font-sans tracking-tight uppercase',
    bestFor: 'Evening · high-energy · ballroom',
  },
  {
    slug: 'cake-cut',
    name: 'Cake Cut',
    category: 'reception',
    defaultDurationSec: 10,
    vibe: 'Dusty pink + ivory — reception cake-cutting beat.',
    palette: ['#F7EDE4', '#D8A4A2', '#A86C6E', '#8AA88A'],
    fontClass: 'font-serif italic',
    bestFor: 'Reception · soft · romantic',
  },
  {
    slug: 'tropical-toast',
    name: 'Tropical Toast',
    category: 'reception',
    defaultDurationSec: 15,
    vibe: 'Palm green + coral — resort cocktail-hour vibe.',
    palette: ['#F4F0E6', '#2F8A6E', '#E26D5C', '#C9A14B'],
    fontClass: 'font-sans tracking-tight',
    bestFor: 'Tropical · vibrant · resort',
  },
  {
    slug: 'sde-fast-cut',
    name: 'SDE Fast-Cut',
    category: 'sde',
    defaultDurationSec: 30,
    vibe: 'Black + gold — same-day-edit hype cut.',
    palette: ['#0F0F0F', '#C9A14B', '#FAF7F2', '#3A2A1C'],
    fontClass: 'font-serif uppercase tracking-[0.3em] text-sm',
    bestFor: 'Same-day edit · evening · cinematic',
  },
  {
    slug: 'sde-slow-burn',
    name: 'SDE Slow Burn',
    category: 'sde',
    defaultDurationSec: 28,
    vibe: 'Sage + cream — golden-hour montage.',
    palette: ['#F7F0E2', '#A8B89A', '#D8A4A2', '#5C6A52'],
    fontClass: 'font-serif',
    bestFor: 'Same-day edit · daytime · soft',
  },
  {
    slug: 'filipiniana-outro',
    name: 'Filipiniana Outro',
    category: 'outro',
    defaultDurationSec: 8,
    vibe: 'Gold + maroon + terracotta — barong/saya credits.',
    palette: ['#F5EBD9', '#C9A14B', '#8B1E3F', '#C97B4B'],
    fontClass: 'font-serif italic',
    bestFor: 'Filipiniana · cultural · warm',
  },
  {
    slug: 'golden-hour-outro',
    name: 'Golden Hour Outro',
    category: 'outro',
    defaultDurationSec: 6,
    vibe: 'Orange + dusty rose — open-air, golden-hour close.',
    palette: ['#F7E8D8', '#E26D5C', '#D8A4A2', '#C9A14B'],
    fontClass: 'font-serif',
    bestFor: 'Outdoor · golden hour · earthy',
  },
  {
    slug: 'forest-credits',
    name: 'Forest Credits',
    category: 'outro',
    defaultDurationSec: 5,
    vibe: 'Deep green + gold + cream — estate-garden credits.',
    palette: ['#F4F0E6', '#1F3D2C', '#C9A14B', '#5C341D'],
    fontClass: 'font-serif',
    bestFor: 'Woodland · evening · regal',
  },
];

export function findPatiktokTemplate(slug: string): PatiktokTemplate | null {
  return PATIKTOK_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function categoryLabel(key: PatiktokCategory): string {
  return PATIKTOK_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
