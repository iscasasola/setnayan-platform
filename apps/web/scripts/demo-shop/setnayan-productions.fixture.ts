/**
 * 🎬 SETNAYAN PRODUCTIONS — the demo supplier shop every plan picture on For Suppliers / For Coordinators is taken
 * from (and its own calling card and tarpaulins). Owner: Juan dela Cruz. Events production — photo, video, live
 * stream, lights and sound — based in Tagaytay, serving Metro Manila, Cavite and Laguna.
 *
 * DATA ONLY. `seed-demo-vendors.ts --showcase setnayan-productions --plan <plan>` writes it into a NON-PROD database
 * (the CLI's `assertNotProd` refuses production); `demo-shop-shots.mjs` photographs the real `/v/[slug]` page drawn
 * from it at each plan.
 *
 * ⚠ Not the owner's real shop "SetnaProd" (`/setnaprod`). Different slug, different owner, never in production.
 *
 * Pictures: every image is a STABLE KEY (`SP_IMAGE_SLOTS`), kept in `scripts/demo-shop/images/<key>.jpg` and served
 * by the app from a gitignored copy at `/demo-shop-local/<key>.jpg` (`SP_IMAGE_BASE`). The owner's Higgsfield photos
 * replace the placeholders by file name; nothing in the fixture changes.
 *
 * Prices: none are typed here. Each card's "starts at" is the FLOOR of the seed's own price profile for that trade
 * (`priceProfileFor` in seed-demo-vendors.ts) — the same numbers every other demo shop is drawn from.
 */

export const SP_SLUG = 'setnayan-productions';
export const SP_NAME = 'Setnayan Productions';
export const SP_OWNER = { first: 'Juan', last: 'dela Cruz', full: 'Juan dela Cruz', position: 'Owner · Director' } as const;
export const SP_OWNER_EMAIL = 'juan@setnayan-productions.demo.setnayan.local';
/** Fixed ids so a re-seed lands on the same rows (and the QR codes on the same address). */
export const SP_OWNER_USER_ID = '5e7a0000-0000-4000-8000-00000000a001';
export const SP_VENDOR_PROFILE_ID = '5e7a0000-0000-4000-8000-00000000b001';

/** The five plan levels the For Suppliers widget shows, in its order. `tier` is `vendor_profiles.tier_state`. */
export const SP_PLANS = [
  { plan: 'free', label: 'Free', tier: 'free', verified: false },
  { plan: 'verified', label: 'Verified', tier: 'verified', verified: true },
  { plan: 'solo', label: 'Solo', tier: 'solo', verified: true },
  { plan: 'pro', label: 'Pro', tier: 'pro', verified: true },
  { plan: 'ultra', label: 'Ultra', tier: 'enterprise', verified: true },
] as const;
export type SpPlan = (typeof SP_PLANS)[number]['plan'];

/** Every picture the shop uses — a stable file name, a size, and the words its placeholder carries. */
export const SP_IMAGE_SLOTS = [
  { key: 'sp-logo-mark', w: 800, h: 800, label: 'SP', from: '#2C2A29', to: '#5A4B36' },
  { key: 'sp-logo-wordmark', w: 1600, h: 500, label: 'Setnayan Productions', from: '#2C2A29', to: '#A9834B' },
  { key: 'sp-juan', w: 900, h: 1100, label: 'Juan dela Cruz', from: '#5A4B36', to: '#A9834B' },
  { key: 'sp-hero', w: 1920, h: 1080, label: 'Wedding · same-day edit', from: '#3B4E67', to: '#A9834B' },
  { key: 'sp-debut', w: 1200, h: 1200, label: 'Debut', from: '#8C6932', to: '#C24E25' },
  { key: 'sp-corporate', w: 1200, h: 1200, label: 'Corporate', from: '#2C2A29', to: '#3B4E67' },
  { key: 'sp-livestream', w: 1200, h: 1200, label: 'Live stream', from: '#3B4E67', to: '#2C2A29' },
  { key: 'sp-drone', w: 1200, h: 1200, label: 'Drone', from: '#5B7A8C', to: '#3B4E67' },
] as const;
export type SpImageKey = (typeof SP_IMAGE_SLOTS)[number]['key'];

export const SP_PROFILE = {
  tagline: 'Photo, video, live stream, lights and sound',
  location_city: 'Tagaytay',
  hq_region: 'CALABARZON',
  hq_address: 'Silang Crossing East, Tagaytay City, Cavite, Philippines',
  hq_latitude: 14.1153,
  hq_longitude: 120.9621,
  in_business_since_year: 2016,
  weddings_done_approx: 240,
  microsite_about:
    'We are a Tagaytay crew of photographers, filmmakers and technicians. One team covers the whole day — the photos, the film you watch at the reception, the live stream for family abroad, and the lights and sound in the hall. We serve Metro Manila, Cavite and Laguna.',
  /** Coverage the page's reach line reads. Owner brief: Metro Manila + Cavite + Laguna. */
  served_regions: ['Metro Manila', 'Cavite', 'Laguna'],
  contact_phone: '+63 917 000 0000',
  event_types: ['wedding', 'debut', 'corporate', 'birthday', 'concert'],
} as const;

/**
 * The five service cards, in the order the page lists them. `category` is the canonical service the marketplace
 * files it under; `profileKey` is the key `priceProfileFor` reads (its regexes predate two of these keys). `folder` is
 * the parent category it counts against (`TIER_CAPS[t].parentCategories`).
 */
export const SP_SERVICES = [
  { title: 'Same-day edit film', category: 'same_day_edit', profileKey: 'same_day_edit', folder: 'documentary', photo: 'sp-hero' },
  { title: 'Wedding photo + video', category: 'photography', profileKey: 'photography', folder: 'documentary', photo: 'sp-debut' },
  { title: 'Live stream', category: 'av_production', profileKey: 'av_production', folder: 'program', photo: 'sp-livestream' },
  { title: 'Lights and sound', category: 'lights_sound', profileKey: 'lights_and_sound', folder: 'design', photo: 'sp-corporate' },
  { title: 'Drone coverage', category: 'drone', profileKey: 'drone_video', folder: 'documentary', photo: 'sp-drone' },
] as const satisfies ReadonlyArray<{ title: string; category: string; profileKey: string; folder: string; photo: SpImageKey }>;

/** Portfolio order on the page. */
export const SP_PORTFOLIO: readonly SpImageKey[] = ['sp-hero', 'sp-debut', 'sp-corporate', 'sp-livestream', 'sp-drone', 'sp-juan'];

/**
 * Which cards are LIVE at a plan — the plan's own allowances, read from `TIER_CAPS`, never typed: a card is live only
 * while its parent category fits `parentCategories` and its leaf fits `servicesPerLeaf`. Free additionally shows ONE
 * live card (the owner brief: "Free: … 1 live service") — a new shop starts with one card; this is the fixture's
 * choice for the Free picture, not a plan rule, and says so.
 */
export function liveServiceTitles(
  plan: SpPlan,
  caps: { parentCategories: number; servicesPerLeaf: number },
): string[] {
  const parents: string[] = [];
  const perLeaf = new Map<string, number>();
  const live: string[] = [];
  for (const s of SP_SERVICES) {
    if (!parents.includes(s.folder)) {
      if (parents.length >= caps.parentCategories) continue;
      parents.push(s.folder);
    }
    const n = perLeaf.get(s.category) ?? 0;
    if (n >= caps.servicesPerLeaf) continue;
    perLeaf.set(s.category, n + 1);
    live.push(s.title);
  }
  return plan === 'free' ? live.slice(0, 1) : live;
}

/** Where the app serves the pictures from — `public/demo-shop-local/`, a gitignored copy of `images/`. */
export const SP_IMAGE_BASE = '/demo-shop-local';

/** Image URL for a key. `base` is {@link SP_IMAGE_BASE} unless DEMO_SHOP_IMAGE_BASE says otherwise. */
export function spImageUrl(base: string, key: SpImageKey): string {
  return `${base.replace(/\/+$/, '')}/${key}.jpg`;
}
