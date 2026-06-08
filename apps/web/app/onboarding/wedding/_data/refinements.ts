/**
 * refinements.ts — the onboarding "what kind of X?" refinement catalogue (owner
 * 2026-06-08, punch-list items 8 + 9).
 *
 * This is the SOURCE-OF-TRUTH DATA, lifted out of the hardcoded `REFINEMENTS`
 * const that used to live inside onboarding-shell.tsx. The onboarding reads it
 * **DB-first** via `getOnboardingRefinements()` (lib/onboarding-refinements.ts) —
 * an admin can edit options/photos/descriptions live — and this module is the
 * seed source + the behavior-preserving fallback when the DB read fails/empty.
 *
 * Each leaf gets (item 8): a MAIN photo (4:3) + a one-line couple-facing
 * description + a carousel of 4:3 OPTION photos. Photos are static /public
 * assets (committed, CDN-served) — `/onboarding/refinements/<leaf>/<slug>.webp`
 * for generated ones, `/onboarding/prefs/<key>.webp` reused for the three
 * PROJECTABLE leaves whose option keys feed projectRefinementsToPrefs.
 *
 * COVERT: every label/description is service-shaped — never names AI / editorial.
 */

export type RefineOption = {
  emoji: string;
  /** Display label. */
  label: string;
  /** Option key — for the 3 projectable leaves this is the production key
   *  (cuisine_… / pv_… / ceremony_…) that projectRefinementsToPrefs maps; for
   *  every other leaf key === label (rides the refinements JSONB only). */
  key: string;
  /** 4:3 photo URL (a /public path), or null → the card shows the emoji glyph. */
  photo: string | null;
};

export type RefineLeaf = {
  /** PICK_GROUPS leaf key (ceremony, catering, cake, …). */
  key: string;
  label: string;
  /** One-line couple-facing description shown under the main photo. */
  description: string;
  /** 4:3 hero photo URL for the top of the card. */
  mainPhoto: string;
  /** 'ceremony' → options are faith-adaptive (resolved via ceremonyOptsFor in
   *  the shell); the stored options array is empty for these. */
  dynamic?: 'ceremony';
  options: RefineOption[];
};

/** Slugify a label → filesystem-safe photo basename (MUST match the generator
 *  script scripts/gen-refinement-photos.workflow.js). */
export function refineSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const REF = (leaf: string) => (s: string) => `/onboarding/refinements/${leaf}/${refineSlug(s)}.webp`;
const PREFS = (key: string) => `/onboarding/prefs/${key}.webp`;
const MAIN = (leaf: string) => `/onboarding/refinements/${leaf}/_main.webp`;

/* Non-projectable option set helper: key === label, photo from /refinements/<leaf>/. */
const opts = (leaf: string, list: [string, string][]): RefineOption[] =>
  list.map(([emoji, label]) => ({ emoji, label, key: label, photo: REF(leaf)(label) }));

/* The 3 PROJECTABLE leaves keep their production option keys (so the recap +
   commit projection still work) + reuse the existing /prefs photos. */
const CUISINE: RefineOption[] = [
  { emoji: '🍲', label: 'Filipino', key: 'cuisine_filipino', photo: PREFS('cuisine_filipino') },
  { emoji: '🥢', label: 'Asian', key: 'cuisine_asian', photo: PREFS('cuisine_asian') },
  { emoji: '🌍', label: 'International', key: 'cuisine_international', photo: PREFS('cuisine_international') },
  { emoji: '🥘', label: 'Spanish', key: 'cuisine_spanish', photo: PREFS('cuisine_spanish') },
  { emoji: '🍝', label: 'Italian', key: 'cuisine_italian', photo: PREFS('cuisine_italian') },
  { emoji: '✨', label: 'Fusion', key: 'cuisine_fusion', photo: PREFS('cuisine_fusion') },
  // Synthetic Halal option — no /prefs photo; generated under /refinements/catering/.
  { emoji: '☪️', label: 'Halal', key: 'cuisine_halal', photo: REF('catering')('Halal') },
];
const PV: RefineOption[] = [
  { emoji: '📸', label: 'Photojournalistic', key: 'pv_photojournalistic', photo: PREFS('pv_photojournalistic') },
  { emoji: '🤍', label: 'Classic', key: 'pv_classic', photo: PREFS('pv_classic') },
  { emoji: '📰', label: 'Editorial', key: 'pv_editorial', photo: PREFS('pv_editorial') },
  { emoji: '🎞️', label: 'Fine-art / film', key: 'pv_fineart', photo: PREFS('pv_fineart') },
  { emoji: '🎬', label: 'Cinematic', key: 'pv_cinematic', photo: PREFS('pv_cinematic') },
];

export const REFINEMENTS_DATA: RefineLeaf[] = [
  // ── PROJECTABLE ──
  { key: 'ceremony', label: 'Ceremony venue', description: 'Where you’ll say your vows.', mainPhoto: MAIN('ceremony'), dynamic: 'ceremony', options: [] },
  { key: 'catering', label: 'Catering', description: 'The feast your guests will remember.', mainPhoto: MAIN('catering'), options: CUISINE },
  { key: 'photo_video', label: 'Photo & Video', description: 'How your day is captured to keep.', mainPhoto: MAIN('photo_video'), options: PV },
  // ── basics ──
  { key: 'coordinator', label: 'Coordinator', description: 'The calm hands running your day.', mainPhoto: MAIN('coordinator'), options: opts('coordinator', [['🗓️', 'Day-of'], ['📅', 'Month-of'], ['🧩', 'Partial'], ['🤝', 'Full-service'], ['✈️', 'Destination']]) },
  // ── extras ──
  { key: 'cake', label: 'Cake', description: 'The centerpiece sweet of your reception.', mainPhoto: MAIN('cake'), options: opts('cake', [['🎂', 'Classic tiered'], ['🌿', 'Naked / semi-naked'], ['🌸', 'Floral'], ['◻️', 'Modern minimalist'], ['✨', 'Themed']]) },
  { key: 'florist', label: 'Florist', description: 'The blooms that set your mood.', mainPhoto: MAIN('florist'), options: opts('florist', [['🌿', 'Lush & garden'], ['◻️', 'Minimalist'], ['🌴', 'Tropical'], ['🌾', 'Dried / pampas'], ['🤍', 'All-white']]) },
  { key: 'hmua', label: 'Hair & Makeup', description: 'How you’ll look and feel up close.', mainPhoto: MAIN('hmua'), options: opts('hmua', [['🌸', 'Soft glam'], ['🤍', 'Natural / no-makeup'], ['📰', 'Bold & editorial'], ['🏛️', 'Traditional'], ['💨', 'Airbrush']]) },
  { key: 'live_band', label: 'Live Band', description: 'The live sound of your celebration.', mainPhoto: MAIN('live_band'), options: opts('live_band', [['🎸', 'Acoustic'], ['🎷', 'Jazz / lounge'], ['🎤', 'Pop / Top 40'], ['🇵🇭', 'OPM'], ['🎻', 'Classical']]) },
  { key: 'bride_attire', label: "Bride's Attire", description: 'The gown you’ll walk in.', mainPhoto: MAIN('bride_attire'), options: opts('bride_attire', [['👰', 'Ball gown'], ['✨', 'A-line'], ['🌊', 'Mermaid'], ['🤍', 'Sheath'], ['🌺', 'Filipiniana']]) },
  { key: 'stylist', label: 'Stylist / Decorator', description: 'The look of your whole reception.', mainPhoto: MAIN('stylist'), options: opts('stylist', [['◻️', 'Modern minimalist'], ['🏛️', 'Traditional classic'], ['🪵', 'Rustic / industrial'], ['🌾', 'Bohemian'], ['💎', 'Luxe glamour'], ['🌿', 'Garden / organic'], ['🎭', 'Themed']]) },
  { key: 'stations', label: 'Food Stations', description: 'Live stations guests gather around.', mainPhoto: MAIN('stations'), options: opts('stations', [['🥘', 'Paella'], ['🍣', 'Sushi'], ['🍜', 'Ramen'], ['🔥', 'Grill / BBQ'], ['🍝', 'Pasta'], ['🍖', 'Carving'], ['🌮', 'Taco bar']]) },
  { key: 'groom_attire', label: "Groom's Attire", description: 'What the groom wears to wed.', mainPhoto: MAIN('groom_attire'), options: opts('groom_attire', [['🤵', 'Classic suit'], ['✨', 'Slim-fit suit'], ['🎩', 'Tuxedo'], ['🧥', 'Three-piece'], ['🌾', 'Barong (formal white)'], ['🪡', 'Embroidered barong'], ['👔', 'Polo barong']]) },
  { key: 'women_attire', label: "Women's Attire", description: 'Your entourage’s ladies’ looks.', mainPhoto: MAIN('women_attire'), options: opts('women_attire', [['👗', 'Long gown'], ['🍸', 'Cocktail'], ['🌺', 'Filipiniana'], ['🎨', 'Mix & match'], ['🤝', 'Coordinated set']]) },
  { key: 'men_attire', label: "Men's Attire", description: 'Your entourage’s gentlemen’s looks.', mainPhoto: MAIN('men_attire'), options: opts('men_attire', [['🤵', 'Matching suits'], ['🌾', 'Barong set'], ['🎩', 'Tux'], ['👔', 'Smart casual'], ['🎭', 'Themed']]) },
  { key: 'filipiniana', label: 'Filipiniana & Barongs', description: 'Heritage fabrics, woven by hand.', mainPhoto: MAIN('filipiniana'), options: opts('filipiniana', [['🌾', 'Piña'], ['🧵', 'Jusi'], ['🪡', 'Calado embroidery'], ['✨', 'Modern couture'], ['🧶', 'Regional weave']]) },
  { key: 'grooming', label: 'Grooming', description: 'Looking sharp for the big day.', mainPhoto: MAIN('grooming'), options: opts('grooming', [['💈', 'Haircut & style'], ['🧔', 'Beard grooming'], ['🧖', 'Skincare / facial'], ['💅', 'Mani-pedi'], ['🛁', 'Body treatments']]) },
  { key: 'jewelry', label: 'Jewellery & Accessories', description: 'The pieces you’ll keep forever.', mainPhoto: MAIN('jewelry'), options: opts('jewelry', [['💍', 'Engagement ring'], ['💞', 'Wedding bands'], ['💎', 'Bridal jewellery'], ['👰', 'Veil'], ['👑', 'Headpiece'], ['🎀', 'Garter']]) },
  { key: 'dj', label: 'DJ', description: 'Who keeps the dance floor moving.', mainPhoto: MAIN('dj'), options: opts('dj', [['🎤', 'Pop'], ['🎧', 'Dance / EDM'], ['🎙️', 'Hip-hop'], ['🇵🇭', 'OPM'], ['🎸', 'Classic rock'], ['📻', 'Throwback 80s/90s'], ['💃', 'K-pop']]) },
  { key: 'wedding_singer', label: 'Wedding Singer', description: 'The voice for your key moments.', mainPhoto: MAIN('wedding_singer'), options: opts('wedding_singer', [['🇵🇭', 'OPM'], ['🎶', 'Ballads'], ['🎤', 'Pop'], ['🎷', 'Jazz'], ['🎻', 'Classical'], ['🙏', 'Religious / liturgical'], ['🎭', 'Broadway']]) },
  { key: 'choir', label: 'Choir / Quartet', description: 'Live music for the ceremony.', mainPhoto: MAIN('choir'), options: opts('choir', [['🎶', 'Small choir'], ['🎼', 'Large choir'], ['🎻', 'String quartet'], ['🎻', 'String trio'], ['🎹', 'Chamber ensemble']]) },
  { key: 'choreographer', label: 'Choreographer', description: 'For a first dance to remember.', mainPhoto: MAIN('choreographer'), options: opts('choreographer', [['🌺', 'Traditional Filipino'], ['💃', 'Ballroom'], ['🩰', 'Contemporary'], ['🪅', 'Latin / salsa'], ['🕺', 'K-pop'], ['🎭', 'Broadway'], ['🎙️', 'Hip-hop']]) },
  { key: 'performers', label: 'Performers', description: 'The surprise that wows your guests.', mainPhoto: MAIN('performers'), options: opts('performers', [['🎩', 'Magician'], ['🔥', 'Fire dancer'], ['😂', 'Comedy'], ['🥁', 'Kulintang'], ['🎸', 'Rondalla'], ['🌺', 'Folk dancers']]) },
  { key: 'livestream', label: 'Livestream', description: 'Bring far-away loved ones in.', mainPhoto: MAIN('livestream'), options: opts('livestream', [['📹', '1080p standard'], ['🎥', '1080p premium'], ['📡', '4K']]) },
  { key: 'mobile_bar', label: 'Mobile Bar', description: 'Drinks that get the party going.', mainPhoto: MAIN('mobile_bar'), options: opts('mobile_bar', [['🍸', 'Full cocktail'], ['🍷', 'Beer & wine'], ['🍹', 'Mocktail only'], ['☕', 'Coffee-focused'], ['🥃', 'Whiskey & cigar'], ['🎭', 'Themed']]) },
  { key: 'coffee', label: 'Coffee / Espresso', description: 'A warm cup for your guests.', mainPhoto: MAIN('coffee'), options: opts('coffee', [['☕', 'Espresso bar'], ['🫗', 'Pour-over'], ['🌱', 'Specialty beans'], ['🍵', 'Tea bar'], ['✨', 'Both']]) },
  { key: 'mocktail', label: 'Mocktail Bar', description: 'Alcohol-free, all the fun.', mainPhoto: MAIN('mocktail'), options: opts('mocktail', [['🍓', 'Fruit'], ['🌿', 'Herbal'], ['🥂', 'Sparkling'], ['🍵', 'Tea-based'], ['🌴', 'Tropical'], ['🍮', 'Dessert']]) },
  { key: 'food_truck', label: 'Food Truck', description: 'A fun, casual late-night bite.', mainPhoto: MAIN('food_truck'), options: opts('food_truck', [['🍔', 'Burgers'], ['🍕', 'Pizza'], ['🌮', 'Tacos'], ['🥢', 'Asian fusion'], ['🇵🇭', 'Filipino street food'], ['🍦', 'Ice cream'], ['🍢', 'Grilled skewers']]) },
  { key: 'dessert', label: 'Dessert Station', description: 'A sweet spread to graze on.', mainPhoto: MAIN('dessert'), options: opts('dessert', [['🥐', 'Pastries'], ['🍬', 'Macarons'], ['🧁', 'Cupcakes'], ['🍫', 'Chocolate fountain'], ['🍭', 'Candy buffet'], ['🍩', 'Donut wall'], ['🥖', 'Churros'], ['🍚', 'Kakanin']]) },
  { key: 'food_cart', label: 'Food Cart', description: 'Nostalgic Filipino treats on wheels.', mainPhoto: MAIN('food_cart'), options: opts('food_cart', [['🍧', 'Halo-halo'], ['🍦', 'Ice cream'], ['🥞', 'Crepe / pancake'], ['🍬', 'Cotton candy'], ['🧀', 'Charcuterie'], ['🐷', 'Mini lechon'], ['🍨', 'Sorbetes']]) },
  { key: 'photo_booth', label: 'Photo Booth', description: 'Instant keepsakes for your guests.', mainPhoto: MAIN('photo_booth'), options: opts('photo_booth', [['📸', 'Traditional'], ['🔄', '360 booth'], ['🎞️', 'GIF'], ['🖼️', 'Polaroid / instax'], ['🪞', 'Magic mirror'], ['🎬', 'Patiktok']]) },
  { key: 'henna', label: 'Henna / Tattoo', description: 'Adornments with meaning.', mainPhoto: MAIN('henna'), options: opts('henna', [['🪬', 'Traditional Arabic'], ['◻️', 'Modern minimalist'], ['💍', 'Elaborate bridal'], ['🌙', 'Philippine Muslim']]) },
  { key: 'printing', label: 'Printing & Invites', description: 'The paper details guests hold.', mainPhoto: MAIN('printing'), options: opts('printing', [['💌', 'Invitations'], ['🗓️', 'Save-the-date'], ['📜', 'Program'], ['🪧', 'Place cards'], ['📋', 'Menu'], ['🪧', 'Signage']]) },
  { key: 'souvenirs', label: 'Souvenirs / Giveaways', description: 'A thank-you they’ll take home.', mainPhoto: MAIN('souvenirs'), options: opts('souvenirs', [['🍬', 'Edible'], ['🔑', 'Practical / keychain'], ['🗿', 'Decorative figurine'], ['🌺', 'Native Filipino'], ['🕯️', 'Candle DIY'], ['🪴', 'Succulent']]) },
  { key: 'bridal_car', label: 'Bridal Car', description: 'Your grand arrival and exit.', mainPhoto: MAIN('bridal_car'), options: opts('bridal_car', [['🚗', 'Luxury sedan'], ['🚙', 'Limousine'], ['🚘', 'Vintage / classic'], ['🚐', 'SUV'], ['🚌', 'Van / minivan'], ['🐴', 'Carriage'], ['🏍️', 'Motorcycle escort']]) },
  { key: 'guest_shuttle', label: 'Guest Shuttle', description: 'Getting everyone there together.', mainPhoto: MAIN('guest_shuttle'), options: opts('guest_shuttle', [['🚐', '12-pax van'], ['🚌', '24-pax minibus'], ['🚍', '48-pax bus'], ['🚎', '56-pax coaster']]) },
  { key: 'escort', label: 'Motorcycle Escort', description: 'A grand convoy through town.', mainPhoto: MAIN('escort'), options: opts('escort', [['🏁', 'Parade'], ['🏍️', 'Escort'], ['🚓', 'Police-style'], ['💠', 'Ceremonial diamond']]) },
  { key: 'outdoor', label: 'Outdoor Rentals', description: 'Everything an open-air venue needs.', mainPhoto: MAIN('outdoor'), options: opts('outdoor', [['⛺', 'Tent'], ['🔌', 'Generator'], ['🚻', 'Mobile restroom'], ['🌬️', 'Cooling fans / misters'], ['🔊', 'Outdoor sound'], ['💡', 'Outdoor lighting']]) },
];

/** Map keyed by leaf for O(1) lookup. */
export const REFINEMENTS_BY_KEY: Record<string, RefineLeaf> = Object.fromEntries(
  REFINEMENTS_DATA.map((l) => [l.key, l]),
);
