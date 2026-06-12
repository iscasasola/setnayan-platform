/**
 * V1 vendor-taxonomy metadata map. Powers the public marketplace at
 * `/vendors`, the dashboard planning grid, and the admin taxonomy viewer.
 *
 * 2026-05-31 — Shrunk from the 12-folder / ~196-tile structure to a
 * **10-parent / ~53-tile** wedding taxonomy (design lock:
 * `Vendor_Taxonomy_Shrink_2026-05-30.md`; CLAUDE.md decision log
 * 2026-05-30/31 "Vendor taxonomy shrink" rows). The shrink is a RE-GROUPING:
 *
 *   - The same ~200 canonical_service keys stay in the DB and in vendors'
 *     `services[]` arrays — NOTHING is re-tagged. Each canonical just gets
 *     re-pointed to one of 10 PARENTS plus one of ~53 visible TILES.
 *   - A tile groups several canonicals into one shopping decision (e.g.
 *     Bride's Attire = custom gown + rental + Filipiniana + modest variants).
 *     Religion / tradition / rental / dietary / shoot-type / cart-type are
 *     FACETS underneath a tile, never their own tile.
 *   - Officiants + pre-marriage paperwork LEAVE the marketplace
 *     (`marketplaceHidden`): officiants auto-resolve from the ceremony venue
 *     (Card 04, shipped 2026-05-29); paperwork lives in the Setnayan AI
 *     wizard. The keys stay in the map so admin/lookup consumers don't drop
 *     them into "Unmapped".
 *   - Setnayan first-party services fold UNDER their parent's tiles as an
 *     option (flagged `setnayan`), never as a standalone "★ Setnayan" tile.
 *
 * The DB table (canonical_service_schemas) has no folder/tile/phase column,
 * so this placement lives in code. Add a row here whenever a canonical is
 * added to the DB or the admin viewer drops it into "Unmapped".
 *
 * The legacy `MegaMenuColumn` (pre-2026-05-20) alias is kept below so any
 * straggler import still compiles; `WeddingFolder` now names the 10 parents.
 */

// ─── 10 parents ─────────────────────────────────────────────────────────────
/**
 * The 10 marketplace parents, ordered as the wedding's build sequence:
 * the place → who runs it → what's served → how it looks → the show →
 * capturing it → how you look → the extras → the paper → getting there.
 * (Locked 2026-05-31.) Browse order ≠ booking urgency — Photo & Video
 * (Documentary, #6) still books early via the Setnayan AI deadlines.
 */
export type WeddingFolder =
  | 'venue'
  | 'planning'
  | 'feast'
  | 'design'
  | 'program'
  | 'documentary'
  | 'look'
  | 'booths'
  | 'prints'
  | 'transport';

/** Canonical render order for the catalog (parent tabs). */
export const WEDDING_FOLDER_ORDER: ReadonlyArray<WeddingFolder> = [
  'venue',
  'planning',
  'feast',
  'design',
  'program',
  'documentary',
  'look',
  'booths',
  'prints',
  'transport',
];

/** Long human-readable label rendered as the parent section heading. */
export const WEDDING_FOLDER_LABEL: Record<WeddingFolder, string> = {
  venue: 'Venue',
  planning: 'Planning',
  feast: 'Feast',
  design: 'Design',
  program: 'Program',
  documentary: 'Documentary',
  look: 'Look',
  booths: 'Booths',
  prints: 'Prints',
  transport: 'Transport',
};

/** Short label rendered in the icon-tile strip + autocomplete dropdown. */
export const WEDDING_FOLDER_SHORT_LABEL: Record<WeddingFolder, string> = {
  venue: 'Venue',
  planning: 'Planning',
  feast: 'Feast',
  design: 'Design',
  program: 'Program',
  documentary: 'Documentary',
  look: 'Look',
  booths: 'Booths',
  prints: 'Prints',
  transport: 'Transport',
};

/** URL slug for catalog scroll-anchoring + `?folder=` scoping. */
export const WEDDING_FOLDER_SLUG: Record<WeddingFolder, string> = {
  venue: 'venue',
  planning: 'planning',
  feast: 'feast',
  design: 'design',
  program: 'program',
  documentary: 'documentary',
  look: 'look',
  booths: 'booths',
  prints: 'prints',
  transport: 'transport',
};

// ─── ~53 tiles ──────────────────────────────────────────────────────────────
/**
 * The visible shopping tiles. Each tile groups one or more canonical_services
 * into a single decision. `filipiniana_barongs` is a CROSS-VIEW (the same
 * terno/barong vendors as the attire tiles, surfaced via the tradition facet —
 * see FILIPINIANA_BARONG_CANONICALS), not a separate bucket.
 */
export type WeddingTile =
  // VENUE
  | 'reception'
  | 'ceremony_venue'
  // PLANNING
  | 'coordinator'
  // FEAST
  | 'cake'
  | 'catering'
  | 'stations'
  // DESIGN
  | 'stylist_decorator'
  | 'florist'
  | 'lights_sound'
  | 'dance_floor'
  | 'outdoor'
  | 'fireworks'
  | 'led_wall'
  | 'digital_services'
  // PROGRAM
  | 'live_band'
  | 'choir'
  | 'orchestra'
  | 'wedding_singer'
  | 'dj'
  | 'choreographer'
  | 'performers'
  | 'host_mc'
  // DOCUMENTARY
  | 'photo_video'
  | 'editorial'
  | 'livestream'
  // LOOK
  | 'brides_attire'
  | 'grooms_attire'
  | 'womens_attire'
  | 'mens_attire'
  | 'filipiniana_barongs'
  | 'hmua'
  | 'grooming'
  | 'wellness_fitness'
  | 'jewelleries_accessories'
  // BOOTHS
  | 'mobile_bar'
  | 'coffee_espresso'
  | 'mocktail'
  | 'food_truck'
  | 'dessert'
  | 'massage_chair'
  | 'food_cart'
  | 'photo_booth'
  | 'perfume_bar'
  | 'arcade_games'
  | 'henna_tattoo'
  | 'mini_nail_bar'
  | 'tarot_astrology_palmistry'
  | 'caricature_calligraphy_painting'
  | 'engraving_embroidery'
  // PRINTS
  | 'printing'
  | 'souvenir_giveaways'
  // TRANSPORT
  | 'bridal_car'
  | 'guest_shuttle'
  | 'escort';

/** Tile → its parent. */
export const TILE_PARENT: Record<WeddingTile, WeddingFolder> = {
  reception: 'venue',
  ceremony_venue: 'venue',
  coordinator: 'planning',
  cake: 'feast',
  catering: 'feast',
  stations: 'feast',
  stylist_decorator: 'design',
  florist: 'design',
  lights_sound: 'design',
  dance_floor: 'design',
  outdoor: 'design',
  fireworks: 'design',
  led_wall: 'design',
  digital_services: 'design',
  live_band: 'program',
  choir: 'program',
  orchestra: 'program',
  wedding_singer: 'program',
  dj: 'program',
  choreographer: 'program',
  performers: 'program',
  host_mc: 'program',
  photo_video: 'documentary',
  editorial: 'documentary',
  livestream: 'documentary',
  brides_attire: 'look',
  grooms_attire: 'look',
  womens_attire: 'look',
  mens_attire: 'look',
  filipiniana_barongs: 'look',
  hmua: 'look',
  grooming: 'look',
  wellness_fitness: 'look',
  jewelleries_accessories: 'look',
  mobile_bar: 'booths',
  coffee_espresso: 'booths',
  mocktail: 'booths',
  food_truck: 'booths',
  dessert: 'booths',
  massage_chair: 'booths',
  food_cart: 'booths',
  photo_booth: 'booths',
  perfume_bar: 'booths',
  arcade_games: 'booths',
  henna_tattoo: 'booths',
  mini_nail_bar: 'booths',
  tarot_astrology_palmistry: 'booths',
  caricature_calligraphy_painting: 'booths',
  engraving_embroidery: 'booths',
  printing: 'prints',
  souvenir_giveaways: 'prints',
  bridal_car: 'transport',
  guest_shuttle: 'transport',
  escort: 'transport',
};

/** Tile render order (grouped by parent, in parent order). */
export const WEDDING_TILE_ORDER: ReadonlyArray<WeddingTile> = [
  // VENUE
  'reception',
  'ceremony_venue',
  // PLANNING
  'coordinator',
  // FEAST
  'cake',
  'catering',
  'stations',
  // DESIGN
  'stylist_decorator',
  'florist',
  'lights_sound',
  'dance_floor',
  'outdoor',
  'fireworks',
  'led_wall',
  'digital_services',
  // PROGRAM
  'live_band',
  'choir',
  'orchestra',
  'wedding_singer',
  'dj',
  'choreographer',
  'performers',
  'host_mc',
  // DOCUMENTARY
  'photo_video',
  'editorial',
  'livestream',
  // LOOK
  'brides_attire',
  'grooms_attire',
  'womens_attire',
  'mens_attire',
  'filipiniana_barongs',
  'hmua',
  'grooming',
  'wellness_fitness',
  'jewelleries_accessories',
  // BOOTHS
  'mobile_bar',
  'coffee_espresso',
  'mocktail',
  'food_truck',
  'dessert',
  'massage_chair',
  'food_cart',
  'photo_booth',
  'perfume_bar',
  'arcade_games',
  'henna_tattoo',
  'mini_nail_bar',
  'tarot_astrology_palmistry',
  'caricature_calligraphy_painting',
  'engraving_embroidery',
  // PRINTS
  'printing',
  'souvenir_giveaways',
  // TRANSPORT
  'bridal_car',
  'guest_shuttle',
  'escort',
];

/** Tile heading + card label. */
export const WEDDING_TILE_LABEL: Record<WeddingTile, string> = {
  reception: 'Reception',
  ceremony_venue: 'Ceremony',
  coordinator: 'Coordinator / Planner',
  cake: 'Cake',
  catering: 'Catering',
  stations: 'Stations',
  stylist_decorator: 'Stylist / Decorator',
  florist: 'Florist',
  lights_sound: 'Lights & Sound',
  dance_floor: 'Dance Floor',
  outdoor: 'Outdoor',
  fireworks: 'Fireworks',
  led_wall: 'LED Wall',
  digital_services: 'Digital Services',
  live_band: 'Live Band',
  choir: 'Choir',
  orchestra: 'Orchestra',
  wedding_singer: 'Wedding Singer',
  dj: 'DJ',
  choreographer: 'Choreographer',
  performers: 'Performers',
  host_mc: 'Host / MC',
  photo_video: 'Photo & Video',
  editorial: 'Editorial',
  livestream: 'Livestream',
  brides_attire: "Bride's Attire",
  grooms_attire: "Groom's Attire",
  womens_attire: "Women's Attire",
  mens_attire: "Men's Attire",
  filipiniana_barongs: 'Filipiniana & Barongs',
  hmua: 'HMUA',
  grooming: 'Grooming',
  wellness_fitness: 'Wellness & Fitness',
  jewelleries_accessories: 'Jewelleries & Accessories',
  mobile_bar: 'Mobile Bar',
  coffee_espresso: 'Coffee / Espresso',
  mocktail: 'Mocktail',
  food_truck: 'Food Truck',
  dessert: 'Dessert',
  massage_chair: 'Massage Chair',
  food_cart: 'Food Cart',
  photo_booth: 'Photo Booth',
  perfume_bar: 'Perfume Bar',
  arcade_games: 'Arcade / Games',
  henna_tattoo: 'Henna / Tattoo',
  mini_nail_bar: 'Mini Nail Bar',
  tarot_astrology_palmistry: 'Tarot / Astrology / Palmistry',
  caricature_calligraphy_painting: 'Caricature / Calligraphy / Painting',
  engraving_embroidery: 'Engraving / Embroidery',
  printing: 'Printing',
  souvenir_giveaways: 'Souvenir / Giveaways',
  bridal_car: 'Bridal Car',
  guest_shuttle: 'Guest Shuttle',
  escort: 'Escort',
};

/** URL slug for tile-scoped vendor-grid (`?tile=`). */
export const WEDDING_TILE_SLUG: Record<WeddingTile, string> = {
  reception: 'reception',
  ceremony_venue: 'ceremony-venue',
  coordinator: 'coordinator',
  cake: 'cake',
  catering: 'catering',
  stations: 'stations',
  stylist_decorator: 'stylist-decorator',
  florist: 'florist',
  lights_sound: 'lights-sound',
  dance_floor: 'dance-floor',
  outdoor: 'outdoor',
  fireworks: 'fireworks',
  led_wall: 'led-wall',
  digital_services: 'digital-services',
  live_band: 'live-band',
  choir: 'choir',
  orchestra: 'orchestra',
  wedding_singer: 'wedding-singer',
  dj: 'dj',
  choreographer: 'choreographer',
  performers: 'performers',
  host_mc: 'host-mc',
  photo_video: 'photo-video',
  editorial: 'editorial',
  livestream: 'livestream',
  brides_attire: 'brides-attire',
  grooms_attire: 'grooms-attire',
  womens_attire: 'womens-attire',
  mens_attire: 'mens-attire',
  filipiniana_barongs: 'filipiniana-barongs',
  hmua: 'hmua',
  grooming: 'grooming',
  wellness_fitness: 'wellness-fitness',
  jewelleries_accessories: 'jewelleries-accessories',
  mobile_bar: 'mobile-bar',
  coffee_espresso: 'coffee-espresso',
  mocktail: 'mocktail',
  food_truck: 'food-truck',
  dessert: 'dessert',
  massage_chair: 'massage-chair',
  food_cart: 'food-cart',
  photo_booth: 'photo-booth',
  perfume_bar: 'perfume-bar',
  arcade_games: 'arcade-games',
  henna_tattoo: 'henna-tattoo',
  mini_nail_bar: 'mini-nail-bar',
  tarot_astrology_palmistry: 'tarot-astrology-palmistry',
  caricature_calligraphy_painting: 'caricature-calligraphy-painting',
  engraving_embroidery: 'engraving-embroidery',
  printing: 'printing',
  souvenir_giveaways: 'souvenir-giveaways',
  bridal_car: 'bridal-car',
  guest_shuttle: 'guest-shuttle',
  escort: 'escort',
};

/** Tiles grouped under each parent (derived from WEDDING_TILE_ORDER). */
export const WEDDING_TILES_BY_PARENT: Record<WeddingFolder, WeddingTile[]> =
  (() => {
    const map: Record<WeddingFolder, WeddingTile[]> = {
      venue: [],
      planning: [],
      feast: [],
      design: [],
      program: [],
      documentary: [],
      look: [],
      booths: [],
      prints: [],
      transport: [],
    };
    for (const tile of WEDDING_TILE_ORDER) {
      map[TILE_PARENT[tile]].push(tile);
    }
    return map;
  })();

/**
 * `filipiniana_barongs` is a cross-view, not a primary bucket: these
 * canonicals keep their primary role tile (Bride's / Groom's / Women's /
 * Men's Attire) AND surface under the Filipiniana & Barongs tile via the
 * tradition facet. vendor-counts.ts adds these to the tile's canonical set
 * explicitly so a vendor shows in both places — categorized once, two
 * discovery paths.
 */
export const FILIPINIANA_BARONG_CANONICALS: ReadonlyArray<string> = [
  'filipiniana_terno',
  'filipiniana_maria_clara',
  'filipiniana_balintawak',
  'barong_tagalog_custom',
  'barong_tagalog_rental',
  'maranao_wedding_attire',
  'tausug_wedding_attire',
  'yakan_wedding_attire',
  'muslim_modest_bridal',
  'inc_modest_bridal',
];

// ─── Legacy alias (pre-2026-05-20) ──────────────────────────────────────────
// Kept so any straggler import still compiles. New code: WeddingFolder above.
export type MegaMenuColumn = 1 | 2 | 3 | 4 | 5;
export const MEGA_MENU_COLUMN_LABEL: Record<MegaMenuColumn, string> = {
  1: 'Capture (Visual)',
  2: 'Music & Entertainment',
  3: 'Food & Beverage',
  4: 'Look — Attire / Beauty / Decor',
  5: 'Ceremony · Coordination · Logistics · Stationery · Travel',
};

/**
 * Phase tags from the master taxonomy doc. Used for the launch-phase badge
 * in the admin viewer. Not exhaustively typed — admins may see a stray
 * string if a new phase value isn't pre-declared here.
 */
export type TaxonomyPhase =
  | 'V1.1 base'
  | 'V1.1.1'
  | 'V1.1.2'
  | 'V1.1.3'
  | 'V1.1.4'
  | 'V1.1.5'
  | 'V1.1.6'
  | 'V1.2'
  | 'V1.3'
  | 'V1.4'
  | 'V1.5+';

/**
 * Faith vocabulary — TITLE-CASE keys, the client-side mirror of `faith_vocab`
 * (the DB source of truth, seeded identically). NEVER lowercase these: the
 * marketplace religion filter compares with strict `===`. `Civil` is the
 * civil/no-religion key (matches civil-officiant canonicals only).
 */
export const WEDDING_FAITH_KEYS = [
  'Catholic',
  'Christian',
  'Born Again',
  'INC',
  'Muslim',
  'Jewish',
  'Chinese',
  'Cultural',
  'Civil',
] as const;

export type WeddingFaithKey = (typeof WEDDING_FAITH_KEYS)[number];

export type TaxonomyEntry = {
  /** Parent placement (10-parent model, since 2026-05-31). */
  folder: WeddingFolder;
  /**
   * Visible tile this canonical rolls up into. Omitted when
   * `marketplaceHidden` is true (officiants / paperwork / deferred).
   */
  tile?: WeddingTile;
  /**
   * Pulled from the public marketplace. The key stays in the map so admin +
   * lookup consumers resolve it, but the catalog never renders it as a tile
   * and the vendor-grid never queries it. Officiants auto-resolve from the
   * ceremony venue (Card 04); paperwork lives in the Setnayan AI wizard.
   */
  marketplaceHidden?: true;
  phase: TaxonomyPhase;
  /**
   * Surfaces conditionally per events.ceremony_type — null = everyone.
   * Reserved for genuinely faith-restricted SERVICES (officiants / seminars /
   * counseling) — never food or cultural items (de-faith lock, 2026-06-11).
   */
  faith?: WeddingFaithKey;
  /** PH-specific category WedMeGood structurally lacks. */
  ph?: true;
  /** First-party Setnayan service insert (rendered as an option, never a tile). */
  setnayan?: true;
  /** Rental variant of a category (facet). */
  rental?: true;
  /** Dietary attribute (facet, pre-set by the couple's faith). */
  dietary?: 'halal' | 'alcohol_free';
  /** Filipiniana / cultural attire or decor (tradition facet). */
  tradition?: true;
  /**
   * Tiles the service ALSO surfaces under beyond its primary `tile`. PH
   * reality: hotels (accommodation) bundle catering, so they cross-list into
   * the Catering tile. Bucketing consumers emit the canonical into both the
   * primary tile and every secondary tile.
   */
  secondary_tiles?: ReadonlyArray<WeddingTile>;
};

/**
 * canonical_service → metadata. Add a row whenever a row is added to
 * canonical_service_schemas; the admin viewer drops unmapped keys into an
 * "Unmapped" bucket so you can spot drift.
 *
 * 200 entries (197 carried over from the 12-folder map + 3 new:
 * `orchestra`, `fireworks_pyro`, `led_video_wall`). The same canonical KEYS
 * are unchanged — vendors keep their `services[]` tags; this is a re-grouping.
 */
export const TAXONOMY_MAP: Record<string, TaxonomyEntry> = {
  // ════════════════════════════════════════════════════════════════════
  // VENUE — Reception + Ceremony are venue_directory / venue_setting backed.
  //   Officiants + pre-marriage + paperwork stay in the map but are
  //   marketplaceHidden (officiant auto-resolves from the ceremony venue;
  //   paperwork → Setnayan AI wizard).
  // ════════════════════════════════════════════════════════════════════
  catholic_priest:                   { folder: 'venue', marketplaceHidden: true, phase: 'V1.1 base', faith: 'Catholic' },
  civil_judge:                       { folder: 'venue', marketplaceHidden: true, phase: 'V1.1 base' },
  civil_mayor:                       { folder: 'venue', marketplaceHidden: true, phase: 'V1.1 base' },
  civil_justice_of_peace:            { folder: 'venue', marketplaceHidden: true, phase: 'V1.1 base' },
  inc_minister:                      { folder: 'venue', marketplaceHidden: true, phase: 'V1.3', faith: 'INC' },
  born_again_pastor:                 { folder: 'venue', marketplaceHidden: true, phase: 'V1.2', faith: 'Born Again' },
  charismatic_pastor:                { folder: 'venue', marketplaceHidden: true, phase: 'V1.2', faith: 'Christian' },
  mainline_protestant_pastor:        { folder: 'venue', marketplaceHidden: true, phase: 'V1.2', faith: 'Christian' },
  muslim_imam:                       { folder: 'venue', marketplaceHidden: true, phase: 'V1.4', faith: 'Muslim' },
  cultural_tribal_elder:             { folder: 'venue', marketplaceHidden: true, phase: 'V1.5+', faith: 'Cultural' },
  officiant_priest_minister:         { folder: 'venue', marketplaceHidden: true, phase: 'V1.1 base' },
  pre_cana_seminar:                  { folder: 'venue', marketplaceHidden: true, phase: 'V1.2', ph: true, faith: 'Catholic' },
  cfo_seminar:                       { folder: 'venue', marketplaceHidden: true, phase: 'V1.2', ph: true },
  inc_counseling:                    { folder: 'venue', marketplaceHidden: true, phase: 'V1.3', ph: true, faith: 'INC' },
  muslim_pre_wedding_counseling:     { folder: 'venue', marketplaceHidden: true, phase: 'V1.4', ph: true, faith: 'Muslim' },
  marriage_license_expediting:       { folder: 'venue', marketplaceHidden: true, phase: 'V1.2', ph: true },
  apostille_dfa_authentication:      { folder: 'venue', marketplaceHidden: true, phase: 'V1.3', ph: true },
  // Hotels = reception venues; keep the catering cross-list ("most hotels
  // also provide catering", owner directive 2026-05-22).
  accommodation:                     { folder: 'venue', tile: 'reception', phase: 'V1.1 base', secondary_tiles: ['catering'] },

  // ════════════════════════════════════════════════════════════════════
  // PLANNING — Coordinator / Planner (one tile; faith + service-type facets).
  // ════════════════════════════════════════════════════════════════════
  wedding_coordination:              { folder: 'planning', tile: 'coordinator', phase: 'V1.1 base' },
  wedding_planner_partial:           { folder: 'planning', tile: 'coordinator', phase: 'V1.2' },
  day_of_coordinator:                { folder: 'planning', tile: 'coordinator', phase: 'V1.1 base' },
  destination_wedding_specialist:    { folder: 'planning', tile: 'coordinator', phase: 'V1.2' },
  pamamanhikan_coordinator:          { folder: 'planning', tile: 'coordinator', phase: 'V1.2', ph: true },
  despedida_planner:                 { folder: 'planning', tile: 'coordinator', phase: 'V1.2', ph: true },
  sponsor_coordinator:               { folder: 'planning', tile: 'coordinator', phase: 'V1.2', ph: true },
  gender_separated_reception_coordinator: { folder: 'planning', tile: 'coordinator', phase: 'V1.4', faith: 'Muslim' },
  religious_venue_coordinator:       { folder: 'planning', tile: 'coordinator', phase: 'V1.3', ph: true },
  inc_wedding_coordinator:           { folder: 'planning', tile: 'coordinator', phase: 'V1.3', faith: 'INC' },
  mahr_coordination:                 { folder: 'planning', tile: 'coordinator', phase: 'V1.4', faith: 'Muslim' },
  setnayan_concierge:                { folder: 'planning', tile: 'coordinator', phase: 'V1.1 base', setnayan: true },
  // Travel + niche logistics leave the marketplace (wizard host-task / deferred).
  honeymoon_planner:                 { folder: 'planning', marketplaceHidden: true, phase: 'V1.1 base' },
  destination_wedding_travel_coordinator: { folder: 'planning', marketplaceHidden: true, phase: 'V1.2' },
  visa_wedding_logistics:            { folder: 'planning', marketplaceHidden: true, phase: 'V1.5+', ph: true },

  // ════════════════════════════════════════════════════════════════════
  // FEAST — the catered meal. Cake · Catering · Stations.
  //   Carts/booths/bars moved to BOOTHS (standalone hired experiences).
  // ════════════════════════════════════════════════════════════════════
  wedding_cake:                      { folder: 'feast', tile: 'cake', phase: 'V1.1 base' },
  catering:                          { folder: 'feast', tile: 'catering', phase: 'V1.1 base' },
  lechonero:                         { folder: 'feast', tile: 'catering', phase: 'V1.1 base', ph: true },
  halal_catering:                    { folder: 'feast', tile: 'catering', phase: 'V1.1.1', dietary: 'halal' },
  live_cooking_station:              { folder: 'feast', tile: 'stations', phase: 'V1.1.1' },

  // ════════════════════════════════════════════════════════════════════
  // DESIGN — Stylist · Florist · Lights & Sound · Dance Floor · Outdoor ·
  //   Fireworks · LED Wall.
  // ════════════════════════════════════════════════════════════════════
  stylist_decorator:                 { folder: 'design', tile: 'stylist_decorator', phase: 'V1.1 base' },
  decorator_general:                 { folder: 'design', tile: 'stylist_decorator', phase: 'V1.1 base' },
  capiz_native_decor:                { folder: 'design', tile: 'stylist_decorator', phase: 'V1.2', ph: true, tradition: true },
  hacienda_heritage_decor:           { folder: 'design', tile: 'stylist_decorator', phase: 'V1.2', ph: true, tradition: true },
  maranao_okir_decor:                { folder: 'design', tile: 'stylist_decorator', phase: 'V1.4', faith: 'Muslim', tradition: true },
  setnayan_custom_monogram:          { folder: 'design', tile: 'digital_services', phase: 'V1.1 base', setnayan: true },
  florals:                           { folder: 'design', tile: 'florist', phase: 'V1.1 base' },
  garden_wedding_florist:            { folder: 'design', tile: 'florist', phase: 'V1.2' },
  beach_wedding_florist:             { folder: 'design', tile: 'florist', phase: 'V1.2' },
  bridal_bouquet_specialty:          { folder: 'design', tile: 'florist', phase: 'V1.2' },
  lights_sound:                      { folder: 'design', tile: 'lights_sound', phase: 'V1.1 base' },
  led_dance_floor:                   { folder: 'design', tile: 'dance_floor', phase: 'V1.1.6' },
  generator_rental:                  { folder: 'design', tile: 'outdoor', phase: 'V1.2', rental: true },
  tent_rental:                       { folder: 'design', tile: 'outdoor', phase: 'V1.2', rental: true },
  mobile_restroom_rental:            { folder: 'design', tile: 'outdoor', phase: 'V1.2', rental: true },
  cooling_fans_misters:              { folder: 'design', tile: 'outdoor', phase: 'V1.2', rental: true },
  bug_repellent_station:             { folder: 'design', tile: 'outdoor', phase: 'V1.2' },
  wedding_day_weather_forecaster:    { folder: 'design', tile: 'outdoor', phase: 'V1.2', ph: true },
  parasol_hat_rental:                { folder: 'design', tile: 'outdoor', phase: 'V1.2', rental: true },
  outdoor_sound_system:              { folder: 'design', tile: 'outdoor', phase: 'V1.2' },
  outdoor_lighting_specialist:       { folder: 'design', tile: 'outdoor', phase: 'V1.2' },
  fireworks_pyro:                    { folder: 'design', tile: 'fireworks', phase: 'V1.2' },
  led_video_wall:                    { folder: 'design', tile: 'led_wall', phase: 'V1.2' },
  setnayan_pailaw:                   { folder: 'design', tile: 'digital_services', phase: 'V1.1 base', setnayan: true },

  // ════════════════════════════════════════════════════════════════════
  // PROGRAM — Live Band · Choir · Orchestra · Wedding Singer · DJ ·
  //   Choreographer · Performers · Host / MC. Setnayan music folds in.
  // ════════════════════════════════════════════════════════════════════
  live_band:                         { folder: 'program', tile: 'live_band', phase: 'V1.1.3' },
  band_live_music:                   { folder: 'program', tile: 'live_band', phase: 'V1.1.3' },
  choir_string_quartet:              { folder: 'program', tile: 'choir', phase: 'V1.1.3' },
  orchestra:                         { folder: 'program', tile: 'orchestra', phase: 'V1.2' },
  wedding_singer:                    { folder: 'program', tile: 'wedding_singer', phase: 'V1.1.3' },
  setnayan_pakanta:                  { folder: 'design', tile: 'digital_services', phase: 'V1.1 base', setnayan: true },  // re-grouped Program → Design › Digital Services (2026-06-03)
  dj:                                { folder: 'program', tile: 'dj', phase: 'V1.1.3' },
  entourage_choreographer:           { folder: 'program', tile: 'choreographer', phase: 'V1.2', ph: true },
  first_dance_choreographer:         { folder: 'program', tile: 'choreographer', phase: 'V1.2' },
  pre_cana_dance_trainer:            { folder: 'program', tile: 'choreographer', phase: 'V1.2', ph: true },
  acoustic_performer:                { folder: 'program', tile: 'performers', phase: 'V1.1.3' },
  wedding_entertainment:             { folder: 'program', tile: 'performers', phase: 'V1.1.3' },
  kulintang_ensemble:                { folder: 'program', tile: 'performers', phase: 'V1.4', ph: true, faith: 'Muslim' },
  rondalla_ensemble:                 { folder: 'program', tile: 'performers', phase: 'V1.5+', ph: true },
  folk_performer:                    { folder: 'program', tile: 'performers', phase: 'V1.5+', ph: true },
  host_emcee:                        { folder: 'program', tile: 'host_mc', phase: 'V1.1 base' },

  // ════════════════════════════════════════════════════════════════════
  // DOCUMENTARY — Photo & Video · Editorial · Livestream.
  //   Photographer / videographer / drone / SDE / pre-nup = facets inside
  //   Photo & Video. Setnayan capture/livestream fold in. Editorial is the
  //   published real-wedding feature (facet/info-backed, no canonical yet).
  // ════════════════════════════════════════════════════════════════════
  photography:                       { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base' },
  videography:                       { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base' },
  pre_nup_photographer:              { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base' },
  engagement_photographer:           { folder: 'documentary', tile: 'photo_video', phase: 'V1.1.2' },
  drone:                             { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base' },
  drone_videographer:                { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base' },
  same_day_edit:                     { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base' },
  family_day2_photographer:          { folder: 'documentary', tile: 'photo_video', phase: 'V1.1.2' },
  boudoir_photographer:              { folder: 'documentary', tile: 'photo_video', phase: 'V1.1.2' },
  studio_portrait_photographer:      { folder: 'documentary', tile: 'photo_video', phase: 'V1.1.2' },
  highlight_reel_specialist:         { folder: 'documentary', tile: 'photo_video', phase: 'V1.1.2' },
  pre_nup_shoot_locations:           { folder: 'documentary', tile: 'photo_video', phase: 'V1.2', ph: true },
  setnayan_papic:                    { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base', setnayan: true },
  setnayan_ai_edited_highlight:      { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base', setnayan: true },
  setnayan_save_the_date_mp4:        { folder: 'documentary', tile: 'photo_video', phase: 'V1.1 base', setnayan: true },
  setnayan_panood:                   { folder: 'documentary', tile: 'livestream', phase: 'V1.1 base', setnayan: true },

  // ════════════════════════════════════════════════════════════════════
  // LOOK — attire (4 role tiles + Filipiniana cross-view) + HMUA + Grooming
  //   + Wellness & Fitness + Jewelleries & Accessories.
  // ════════════════════════════════════════════════════════════════════
  // Bride's Attire
  bridal_gown_custom:                { folder: 'look', tile: 'brides_attire', phase: 'V1.1 base' },
  bridal_gown_rental:                { folder: 'look', tile: 'brides_attire', phase: 'V1.1.4', rental: true },
  filipiniana_terno:                 { folder: 'look', tile: 'brides_attire', phase: 'V1.1.4', ph: true, tradition: true },
  filipiniana_maria_clara:           { folder: 'look', tile: 'brides_attire', phase: 'V1.1.4', ph: true, tradition: true },
  filipiniana_balintawak:            { folder: 'look', tile: 'brides_attire', phase: 'V1.1.4', ph: true, tradition: true },
  muslim_modest_bridal:              { folder: 'look', tile: 'brides_attire', phase: 'V1.4', faith: 'Muslim', tradition: true },
  inc_modest_bridal:                 { folder: 'look', tile: 'brides_attire', phase: 'V1.3', faith: 'INC', tradition: true },
  maranao_wedding_attire:            { folder: 'look', tile: 'brides_attire', phase: 'V1.4', faith: 'Muslim', tradition: true },
  tausug_wedding_attire:             { folder: 'look', tile: 'brides_attire', phase: 'V1.4', faith: 'Muslim', tradition: true },
  yakan_wedding_attire:              { folder: 'look', tile: 'brides_attire', phase: 'V1.4', faith: 'Muslim', tradition: true },
  // Groom's Attire
  groom_suit_custom:                 { folder: 'look', tile: 'grooms_attire', phase: 'V1.1 base' },
  groom_suit_rental:                 { folder: 'look', tile: 'grooms_attire', phase: 'V1.1.4', rental: true },
  barong_tagalog_custom:             { folder: 'look', tile: 'grooms_attire', phase: 'V1.1.4', ph: true, tradition: true },
  barong_tagalog_rental:             { folder: 'look', tile: 'grooms_attire', phase: 'V1.1.4', ph: true, rental: true, tradition: true },
  // Women's Attire (entourage + family)
  bridesmaid_dress:                  { folder: 'look', tile: 'womens_attire', phase: 'V1.1 base' },
  junior_bridesmaid_dress:           { folder: 'look', tile: 'womens_attire', phase: 'V1.1.4' },
  mother_of_bride_gown:              { folder: 'look', tile: 'womens_attire', phase: 'V1.1 base' },
  flower_girl_dress:                 { folder: 'look', tile: 'womens_attire', phase: 'V1.1 base' },
  ninang_attire:                     { folder: 'look', tile: 'womens_attire', phase: 'V1.1.4', ph: true },
  // Men's Attire (entourage + family)
  groomsman_set:                     { folder: 'look', tile: 'mens_attire', phase: 'V1.1.4' },
  junior_groomsman:                  { folder: 'look', tile: 'mens_attire', phase: 'V1.1.4' },
  ninong_attire:                     { folder: 'look', tile: 'mens_attire', phase: 'V1.1.4', ph: true },
  ring_bearer_suit:                  { folder: 'look', tile: 'mens_attire', phase: 'V1.1.4' },
  // HMUA
  bridal_hmua:                       { folder: 'look', tile: 'hmua', phase: 'V1.1 base' },
  family_mua:                        { folder: 'look', tile: 'hmua', phase: 'V1.1 base' },
  bridal_hair_stylist:               { folder: 'look', tile: 'hmua', phase: 'V1.1 base' },
  touchup_mua:                       { folder: 'look', tile: 'hmua', phase: 'V1.1.5' },
  maternity_bride_mua:               { folder: 'look', tile: 'hmua', phase: 'V1.2' },
  mature_bride_mua:                  { folder: 'look', tile: 'hmua', phase: 'V1.2' },
  // Grooming
  groom_grooming:                    { folder: 'look', tile: 'grooming', phase: 'V1.2' },
  // Wellness & Fitness
  bridal_fitness:                    { folder: 'look', tile: 'wellness_fitness', phase: 'V1.2' },
  bridal_nutritionist:               { folder: 'look', tile: 'wellness_fitness', phase: 'V1.2' },
  bridal_dental:                     { folder: 'look', tile: 'wellness_fitness', phase: 'V1.2' },
  bridal_spa:                        { folder: 'look', tile: 'wellness_fitness', phase: 'V1.2' },
  bridal_dermatology:                { folder: 'look', tile: 'wellness_fitness', phase: 'V1.2' },
  // Jewelleries & Accessories
  engagement_ring:                   { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2' },
  wedding_ring:                      { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2' },
  bridal_jewellery:                  { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2' },
  bridal_jewellery_rental:           { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2', rental: true },
  floral_jewellery:                  { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2' },
  wedding_veil:                      { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2' },
  wedding_garter:                    { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2' },
  bridal_headpiece:                  { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2' },
  flower_girl_tiara:                 { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2' },
  sponsor_corsage:                   { folder: 'look', tile: 'jewelleries_accessories', phase: 'V1.2', ph: true },

  // ════════════════════════════════════════════════════════════════════
  // BOOTHS — standalone hired experiences (food carts, photo booths,
  //   wellness, mystic, craft). Setnayan Patiktok folds into Photo Booth.
  // ════════════════════════════════════════════════════════════════════
  // Drinks
  mobile_bar:                        { folder: 'booths', tile: 'mobile_bar', phase: 'V1.1 base' },
  whiskey_cigar_bar:                 { folder: 'booths', tile: 'mobile_bar', phase: 'V1.1.6' },
  coffee_booth:                      { folder: 'booths', tile: 'coffee_espresso', phase: 'V1.1 base' },
  tea_bar:                           { folder: 'booths', tile: 'coffee_espresso', phase: 'V1.1.6' },
  mocktail_bar:                      { folder: 'booths', tile: 'mocktail', phase: 'V1.1.1', dietary: 'alcohol_free' },
  mocktail_only_caterer:             { folder: 'booths', tile: 'mocktail', phase: 'V1.1.1', dietary: 'alcohol_free' },
  mocktail_booth_mini:               { folder: 'booths', tile: 'mocktail', phase: 'V1.1.6', dietary: 'alcohol_free' },
  // Food carts (cart-type facet)
  food_truck:                        { folder: 'booths', tile: 'food_truck', phase: 'V1.1.1' },
  dessert_station:                   { folder: 'booths', tile: 'dessert', phase: 'V1.1.1' },
  halo_halo_station:                 { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6', ph: true },
  ice_cream_cart:                    { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6' },
  crepe_pancake_station:             { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6' },
  cotton_candy_cart:                 { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6' },
  charcuterie_board:                 { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6' },
  mini_lechon_station:               { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6', ph: true },
  donut_wall_display:                { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6' },
  sorbetes_cart:                     { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6', ph: true },
  food_cart_generic:                 { folder: 'booths', tile: 'food_cart', phase: 'V1.1.6' },
  // Photo / tech booths (booth-type facet)
  photo_booth:                       { folder: 'booths', tile: 'photo_booth', phase: 'V1.1 base' },
  gif_booth:                         { folder: 'booths', tile: 'photo_booth', phase: 'V1.1.6' },
  polaroid_booth:                    { folder: 'booths', tile: 'photo_booth', phase: 'V1.1.6' },
  booth_360:                         { folder: 'booths', tile: 'photo_booth', phase: 'V1.1.6' },
  selfie_magic_mirror:               { folder: 'booths', tile: 'photo_booth', phase: 'V1.1.6' },
  setnayan_patiktok:                 { folder: 'booths', tile: 'photo_booth', phase: 'V1.1 base', setnayan: true },
  arcade_retro_games:                { folder: 'booths', tile: 'arcade_games', phase: 'V1.1.6' },
  vr_ar_station:                     { folder: 'booths', tile: 'arcade_games', phase: 'V1.1.6' },
  // Wellness / beauty booths
  perfume_bar:                       { folder: 'booths', tile: 'perfume_bar', phase: 'V1.1.6' },
  henna_tattoo_booth:                { folder: 'booths', tile: 'henna_tattoo', phase: 'V1.1.6' },
  muslim_henna_artist:               { folder: 'booths', tile: 'henna_tattoo', phase: 'V1.4', faith: 'Muslim' },
  massage_chair_station:             { folder: 'booths', tile: 'massage_chair', phase: 'V1.1.6' },
  hair_touchup_station:              { folder: 'booths', tile: 'massage_chair', phase: 'V1.1.6' },
  aromatherapy_station:              { folder: 'booths', tile: 'massage_chair', phase: 'V1.1.6' },
  mini_nail_bar:                     { folder: 'booths', tile: 'mini_nail_bar', phase: 'V1.1.6' },
  // Mystic
  tarot_astrology:                   { folder: 'booths', tile: 'tarot_astrology_palmistry', phase: 'V1.1.6' },
  palmistry_reader:                  { folder: 'booths', tile: 'tarot_astrology_palmistry', phase: 'V1.1.6' },
  // Craft (live artists, moved from Invitations & Keepsakes)
  wedding_portrait_painter:          { folder: 'booths', tile: 'caricature_calligraphy_painting', phase: 'V1.1.6' },
  caricature_artist:                 { folder: 'booths', tile: 'caricature_calligraphy_painting', phase: 'V1.1.6' },
  silhouette_artist:                 { folder: 'booths', tile: 'caricature_calligraphy_painting', phase: 'V1.1.6' },
  live_calligraphy:                  { folder: 'booths', tile: 'caricature_calligraphy_painting', phase: 'V1.1.6' },
  poetry_typewriter:                 { folder: 'booths', tile: 'caricature_calligraphy_painting', phase: 'V1.1.6' },
  keychain_engraving:                { folder: 'booths', tile: 'engraving_embroidery', phase: 'V1.1.6' },
  live_embroidery:                   { folder: 'booths', tile: 'engraving_embroidery', phase: 'V1.1.6' },

  // ════════════════════════════════════════════════════════════════════
  // PRINTS — Printing (stationery, print-item facet) · Souvenir / Giveaways.
  // ════════════════════════════════════════════════════════════════════
  invitation_print:                  { folder: 'prints', tile: 'printing', phase: 'V1.1 base' },
  invitation_digital:                { folder: 'prints', tile: 'printing', phase: 'V1.2' },
  wedding_cards_designer:            { folder: 'prints', tile: 'printing', phase: 'V1.2' },
  save_the_date_digital:             { folder: 'prints', tile: 'printing', phase: 'V1.2' },
  ceremony_program:                  { folder: 'prints', tile: 'printing', phase: 'V1.2' },
  place_card:                        { folder: 'prints', tile: 'printing', phase: 'V1.2' },
  menu_card:                         { folder: 'prints', tile: 'printing', phase: 'V1.2' },
  stationery_signage:                { folder: 'prints', tile: 'printing', phase: 'V1.1 base' },
  souvenirs_giveaways:               { folder: 'prints', tile: 'souvenir_giveaways', phase: 'V1.1 base' },
  pasalubong_box:                    { folder: 'prints', tile: 'souvenir_giveaways', phase: 'V1.2', ph: true },
  sponsor_token:                     { folder: 'prints', tile: 'souvenir_giveaways', phase: 'V1.2', ph: true },
  godchild_token:                    { folder: 'prints', tile: 'souvenir_giveaways', phase: 'V1.2', ph: true },

  // ════════════════════════════════════════════════════════════════════
  // TRANSPORT — Bridal Car (vehicle-type facet) · Guest Shuttle · Escort.
  // ════════════════════════════════════════════════════════════════════
  transportation_bridal_car:         { folder: 'transport', tile: 'bridal_car', phase: 'V1.1 base' },
  vintage_classic_vehicle:           { folder: 'transport', tile: 'bridal_car', phase: 'V1.2' },
  horse_drawn_carriage:              { folder: 'transport', tile: 'bridal_car', phase: 'V1.5+' },
  bridal_boat_yacht:                 { folder: 'transport', tile: 'bridal_car', phase: 'V1.5+' },
  transportation_guest_shuttle:      { folder: 'transport', tile: 'guest_shuttle', phase: 'V1.1 base' },
  motorcycle_escort:                 { folder: 'transport', tile: 'escort', phase: 'V1.5+' },
};
