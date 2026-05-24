/**
 * V1.1 vendor-taxonomy metadata map. Used by the public marketplace at
 * `/vendors` to render the 192-category catalog grouped by the 12 wedding-
 * folder structure documented in `02_Specifications/Vendor_Taxonomy_V1_Master.md`.
 *
 * The DB table (canonical_service_schemas) doesn't have a column for
 * folder placement or phase, so this lives in code. Keep in sync with the
 * master taxonomy doc when adding rows: each new canonical_service needs an
 * entry here OR the admin viewer drops it into the "Unmapped" bucket.
 *
 * 2026-05-20: Migrated from 5-column mega-menu to 12-folder PH-grounded
 * structure (see CLAUDE.md decision log). The legacy `MegaMenuColumn` alias
 * is preserved below as a no-op so any external import that hasn't migrated
 * yet still compiles — but new code should use `WeddingFolder`.
 */

/**
 * The 12 catalog folders, ordered by PH wedding booking timeline.
 *
 *   #1  ceremony                       — book 12-18+ months
 *   #2  reception                      — filter-only (no canonical_services)
 *   #3  planning_logistics_travel      — 12-18 months (planner first)
 *   #4  photo_video                    — 12+ months
 *   #5  catering                       — 9-12 months
 *   #6  attire                         — 6-9 months
 *   #7  hair_makeup                    — 6-12 months
 *   #8  music_program                  — 6-9 months
 *   #9  decor_florals_sound            — 4-6 months
 *   #10 rings_accessories              — 3-4 months
 *   #11 booths_stations                — 2-3 months
 *   #12 invitations_keepsakes          — 3-6 months
 */
export type WeddingFolder =
  | 'ceremony'
  | 'reception'
  | 'planning_logistics_travel'
  | 'photo_video'
  | 'catering'
  | 'attire'
  | 'hair_makeup'
  | 'music_program'
  | 'decor_florals_sound'
  | 'rings_accessories'
  | 'booths_stations'
  | 'invitations_keepsakes';

/** Canonical render order for the catalog. */
export const WEDDING_FOLDER_ORDER: ReadonlyArray<WeddingFolder> = [
  'ceremony',
  'reception',
  'planning_logistics_travel',
  'photo_video',
  'catering',
  'attire',
  'hair_makeup',
  'music_program',
  'decor_florals_sound',
  'rings_accessories',
  'booths_stations',
  'invitations_keepsakes',
];

/** Long human-readable label rendered as the section heading on `/vendors`. */
export const WEDDING_FOLDER_LABEL: Record<WeddingFolder, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  planning_logistics_travel: 'Planning, Logistics & Travel',
  photo_video: 'Photo & Video',
  catering: 'Catering',
  attire: 'Attire',
  hair_makeup: 'Hair & Makeup',
  music_program: 'Music & Program',
  decor_florals_sound: 'Decor, Florals & Sound',
  rings_accessories: 'Rings & Accessories',
  booths_stations: 'Booths & Stations',
  invitations_keepsakes: 'Invitations & Keepsakes',
};

/** Short label rendered in the folder-tabs chip strip + autocomplete dropdown. */
export const WEDDING_FOLDER_SHORT_LABEL: Record<WeddingFolder, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  planning_logistics_travel: 'Planning',
  photo_video: 'Photo & Video',
  catering: 'Catering',
  attire: 'Attire',
  hair_makeup: 'Hair & Makeup',
  music_program: 'Music',
  decor_florals_sound: 'Decor & Sound',
  rings_accessories: 'Rings',
  booths_stations: 'Booths',
  invitations_keepsakes: 'Invites',
};

/** URL hash slug for catalog scroll-anchoring. */
export const WEDDING_FOLDER_SLUG: Record<WeddingFolder, string> = {
  ceremony: 'ceremony',
  reception: 'reception',
  planning_logistics_travel: 'planning',
  photo_video: 'photo-video',
  catering: 'catering',
  attire: 'attire',
  hair_makeup: 'hair-makeup',
  music_program: 'music',
  decor_florals_sound: 'decor-sound',
  rings_accessories: 'rings',
  booths_stations: 'booths',
  invitations_keepsakes: 'invitations',
};

// ─── Legacy 5-column alias (pre-2026-05-20) ─────────────────────────────────
// Kept so external consumers that haven't migrated to WeddingFolder yet still
// compile. New code: use WeddingFolder + WEDDING_FOLDER_LABEL above.
export type MegaMenuColumn = 1 | 2 | 3 | 4 | 5;
export const MEGA_MENU_COLUMN_LABEL: Record<MegaMenuColumn, string> = {
  1: 'Capture (Visual)',
  2: 'Music & Entertainment',
  3: 'Food & Beverage',
  4: 'Look — Attire / Beauty / Decor',
  5: 'Ceremony · Coordination · Logistics · Stationery · Travel',
};

/**
 * Phase tags from the master taxonomy doc § "phase" column. Used for the
 * launch-phase badge in the admin viewer. Not exhaustively typed — admins
 * may see a stray string if a new phase value isn't pre-declared here.
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

export type TaxonomyEntry = {
  /** 12-folder placement (since 2026-05-20). */
  folder: WeddingFolder;
  phase: TaxonomyPhase;
  /** Surfaces conditionally per events.ceremony_type — null = surfaces for everyone. */
  faith?: 'Catholic' | 'Christian' | 'INC' | 'Muslim' | 'Cultural';
  /** PH-specific category WedMeGood structurally lacks. */
  ph?: true;
  /** First-party Setnayan service insert. */
  setnayan?: true;
  /** Rental variant of a category. */
  rental?: true;
  /**
   * Cross-listed folders the service ALSO surfaces under, beyond its primary
   * `folder`. Locked 2026-05-22 per owner directive *"most hotels also provide
   * catering"* — when a host searches Catering on the dashboard planning card,
   * hotel vendors (whose primary folder is planning_logistics_travel via the
   * `accommodation` canonical_service) should ALSO show up because Filipino
   * weddings routinely bundle catering with the hotel reception package.
   *
   * Bucketing consumers (apps/web/app/vendors/page.tsx CatalogView buckets +
   * apps/web/lib/vendor-counts.ts CANONICAL_SERVICES_BY_FOLDER) honor this
   * field by emitting the service into BOTH the primary folder and every
   * secondary folder — so a vendor whose services[] contains 'accommodation'
   * surfaces in the catering folder's FolderVendorsSection vendor query.
   *
   * Stay pragmatic: only add a cross-listing when it represents a real bundle
   * Filipino couples expect (hotel→catering, hotel→reception venue setting).
   * Speculative cross-listings (e.g. florist→stylist) belong in the vendor's
   * own services[] array, not in the taxonomy map.
   */
  secondary_folders?: ReadonlyArray<WeddingFolder>;
};

/**
 * canonical_service → metadata. Add a row here whenever a row is added to
 * canonical_service_schemas; the admin viewer drops unmapped keys into an
 * "Unmapped" bucket so you can spot drift.
 *
 * 192 entries total · zero new canonical_services in the 12-folder remap.
 */
export const TAXONOMY_MAP: Record<string, TaxonomyEntry> = {
  // ════════════════════════════════════════════════════════════════════
  // 1. CEREMONY — officiants + pre-marriage + paperwork (17)
  //    Faith-spine of the PH wedding. Couples lock this 12-18+ months out.
  // ════════════════════════════════════════════════════════════════════
  catholic_priest:                   { folder: 'ceremony', phase: 'V1.1 base', faith: 'Catholic' },
  civil_judge:                       { folder: 'ceremony', phase: 'V1.1 base' },
  civil_mayor:                       { folder: 'ceremony', phase: 'V1.1 base' },
  civil_justice_of_peace:            { folder: 'ceremony', phase: 'V1.1 base' },
  inc_minister:                      { folder: 'ceremony', phase: 'V1.3', faith: 'INC' },
  born_again_pastor:                 { folder: 'ceremony', phase: 'V1.2', faith: 'Christian' },
  charismatic_pastor:                { folder: 'ceremony', phase: 'V1.2', faith: 'Christian' },
  mainline_protestant_pastor:        { folder: 'ceremony', phase: 'V1.2', faith: 'Christian' },
  muslim_imam:                       { folder: 'ceremony', phase: 'V1.4', faith: 'Muslim' },
  cultural_tribal_elder:             { folder: 'ceremony', phase: 'V1.5+', faith: 'Cultural' },
  officiant_priest_minister:         { folder: 'ceremony', phase: 'V1.1 base' },
  pre_cana_seminar:                  { folder: 'ceremony', phase: 'V1.2', ph: true, faith: 'Catholic' },
  cfo_seminar:                       { folder: 'ceremony', phase: 'V1.2', ph: true },
  inc_counseling:                    { folder: 'ceremony', phase: 'V1.3', ph: true, faith: 'INC' },
  muslim_pre_wedding_counseling:     { folder: 'ceremony', phase: 'V1.4', ph: true, faith: 'Muslim' },
  marriage_license_expediting:       { folder: 'ceremony', phase: 'V1.2', ph: true },
  apostille_dfa_authentication:      { folder: 'ceremony', phase: 'V1.3', ph: true },

  // ════════════════════════════════════════════════════════════════════
  // 2. RECEPTION — 0 canonical_services (filter-only via venue_setting enum)
  //    Reception folder surfaces venue_setting filter facets (banquet_hall ·
  //    garden · beach · destination · heritage · outdoor_tent · civil_registrar)
  //    without backing canonical_services. V1.2 venue iteration adds dedicated
  //    venue records with per-location calendars + day-rates.
  // ════════════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════════════
  // 3. PLANNING, LOGISTICS & TRAVEL (28)
  //    Coordinators + transport + outdoor rentals + travel. Planners book
  //    12-18 months out; rentals/travel slip into 1-3 months.
  // ════════════════════════════════════════════════════════════════════
  // Coordinators
  wedding_coordination:              { folder: 'planning_logistics_travel', phase: 'V1.1 base' },
  wedding_planner_partial:           { folder: 'planning_logistics_travel', phase: 'V1.2' },
  day_of_coordinator:                { folder: 'planning_logistics_travel', phase: 'V1.1 base' },
  destination_wedding_specialist:    { folder: 'planning_logistics_travel', phase: 'V1.2' },
  pamamanhikan_coordinator:          { folder: 'planning_logistics_travel', phase: 'V1.2', ph: true },
  despedida_planner:                 { folder: 'planning_logistics_travel', phase: 'V1.2', ph: true },
  sponsor_coordinator:               { folder: 'planning_logistics_travel', phase: 'V1.2', ph: true },
  gender_separated_reception_coordinator: { folder: 'planning_logistics_travel', phase: 'V1.4', faith: 'Muslim' },
  religious_venue_coordinator:       { folder: 'planning_logistics_travel', phase: 'V1.3', ph: true },
  inc_wedding_coordinator:           { folder: 'planning_logistics_travel', phase: 'V1.3', faith: 'INC' },
  mahr_coordination:                 { folder: 'planning_logistics_travel', phase: 'V1.4', faith: 'Muslim' },
  setnayan_concierge:                { folder: 'planning_logistics_travel', phase: 'V1.1 base', setnayan: true },
  // Transport
  transportation_bridal_car:         { folder: 'planning_logistics_travel', phase: 'V1.1 base' },
  vintage_classic_vehicle:           { folder: 'planning_logistics_travel', phase: 'V1.2' },
  transportation_guest_shuttle:      { folder: 'planning_logistics_travel', phase: 'V1.1 base' },
  motorcycle_escort:                 { folder: 'planning_logistics_travel', phase: 'V1.5+' },
  horse_drawn_carriage:              { folder: 'planning_logistics_travel', phase: 'V1.5+' },
  bridal_boat_yacht:                 { folder: 'planning_logistics_travel', phase: 'V1.5+' },
  // Outdoor rentals & infrastructure
  generator_rental:                  { folder: 'planning_logistics_travel', phase: 'V1.2', rental: true },
  tent_rental:                       { folder: 'planning_logistics_travel', phase: 'V1.2', rental: true },
  mobile_restroom_rental:            { folder: 'planning_logistics_travel', phase: 'V1.2', rental: true },
  cooling_fans_misters:              { folder: 'planning_logistics_travel', phase: 'V1.2', rental: true },
  bug_repellent_station:             { folder: 'planning_logistics_travel', phase: 'V1.2' },
  wedding_day_weather_forecaster:    { folder: 'planning_logistics_travel', phase: 'V1.2', ph: true },
  parasol_hat_rental:                { folder: 'planning_logistics_travel', phase: 'V1.2', rental: true },
  // Travel & accommodation
  honeymoon_planner:                 { folder: 'planning_logistics_travel', phase: 'V1.1 base' },
  destination_wedding_travel_coordinator: { folder: 'planning_logistics_travel', phase: 'V1.2' },
  visa_wedding_logistics:            { folder: 'planning_logistics_travel', phase: 'V1.5+', ph: true },
  // 23rd planning-card (2026-05-22) — hotels + room blocks. Some hotels
  // include accommodation in their vendor_packages cascade (see
  // 20260604110000 hotel-package seed + the 2026-05-22 follow-up seed that
  // adds the 'accommodation' line item to Sofitel · Shangri-La · Conrad ·
  // Marriott · Discovery Primea · Manila Hotel).
  //
  // 2026-05-22 (catering cross-listing) — `secondary_folders: ['catering']`
  // surfaces hotel/accommodation vendors under the Catering folder too.
  // PH wedding reality: most hotels bundle catering with the reception
  // package, so couples searching catering on the dashboard planning card
  // should see Manila Marriott, Sofitel, Shangri-La etc. inline with the
  // dedicated catering vendors. Owner directive verbatim: "most hotels also
  // provide catering."
  accommodation:                     { folder: 'planning_logistics_travel', phase: 'V1.1 base', secondary_folders: ['catering'] },

  // ════════════════════════════════════════════════════════════════════
  // 4. PHOTO & VIDEO (15)
  //    Couples book 12+ months out — top suppliers are scarcest.
  // ════════════════════════════════════════════════════════════════════
  photography:                       { folder: 'photo_video', phase: 'V1.1 base' },
  pre_nup_photographer:              { folder: 'photo_video', phase: 'V1.1 base' },
  engagement_photographer:           { folder: 'photo_video', phase: 'V1.1.2' },
  drone:                             { folder: 'photo_video', phase: 'V1.1 base' },
  same_day_edit:                     { folder: 'photo_video', phase: 'V1.1 base' },
  family_day2_photographer:          { folder: 'photo_video', phase: 'V1.1.2' },
  boudoir_photographer:              { folder: 'photo_video', phase: 'V1.1.2' },
  studio_portrait_photographer:      { folder: 'photo_video', phase: 'V1.1.2' },
  setnayan_papic:                    { folder: 'photo_video', phase: 'V1.1 base', setnayan: true },
  videography:                       { folder: 'photo_video', phase: 'V1.1 base' },
  drone_videographer:                { folder: 'photo_video', phase: 'V1.1 base' },
  highlight_reel_specialist:         { folder: 'photo_video', phase: 'V1.1.2' },
  setnayan_ai_edited_highlight:      { folder: 'photo_video', phase: 'V1.1 base', setnayan: true },
  setnayan_save_the_date_mp4:        { folder: 'photo_video', phase: 'V1.1 base', setnayan: true },
  pre_nup_shoot_locations:           { folder: 'photo_video', phase: 'V1.2', ph: true },

  // ════════════════════════════════════════════════════════════════════
  // 5. CATERING (20)
  //    PH weddings are food-first. Lechonero is a named cultural anchor.
  // ════════════════════════════════════════════════════════════════════
  catering:                          { folder: 'catering', phase: 'V1.1 base' },
  lechonero:                         { folder: 'catering', phase: 'V1.1 base', ph: true },
  live_cooking_station:              { folder: 'catering', phase: 'V1.1.1' },
  halal_catering:                    { folder: 'catering', phase: 'V1.1.1', faith: 'Muslim' },
  mocktail_only_caterer:             { folder: 'catering', phase: 'V1.1.1', faith: 'INC' },
  food_truck:                        { folder: 'catering', phase: 'V1.1.1' },
  wedding_cake:                      { folder: 'catering', phase: 'V1.1 base' },
  dessert_station:                   { folder: 'catering', phase: 'V1.1.1' },
  mobile_bar:                        { folder: 'catering', phase: 'V1.1 base' },
  mocktail_bar:                      { folder: 'catering', phase: 'V1.1.1', faith: 'INC' },
  coffee_booth:                      { folder: 'catering', phase: 'V1.1 base' },
  tea_bar:                           { folder: 'catering', phase: 'V1.1.6' },
  whiskey_cigar_bar:                 { folder: 'catering', phase: 'V1.1.6' },
  halo_halo_station:                 { folder: 'catering', phase: 'V1.1.6', ph: true },
  ice_cream_cart:                    { folder: 'catering', phase: 'V1.1.6' },
  crepe_pancake_station:             { folder: 'catering', phase: 'V1.1.6' },
  cotton_candy_cart:                 { folder: 'catering', phase: 'V1.1.6' },
  charcuterie_board:                 { folder: 'catering', phase: 'V1.1.6' },
  mini_lechon_station:               { folder: 'catering', phase: 'V1.1.6', ph: true },
  mocktail_booth_mini:               { folder: 'catering', phase: 'V1.1.6', faith: 'INC' },
  // 3 booth sub-categories added 2026-05-24 per owner directive · CLAUDE.md
  // 2026-05-24 row "Branch conflict coordination" + BRANCH_CONFLICTS_2026-05-24.md
  donut_wall_display:                { folder: 'catering', phase: 'V1.1.6' },
  sorbetes_cart:                     { folder: 'catering', phase: 'V1.1.6', ph: true },
  food_cart_generic:                 { folder: 'catering', phase: 'V1.1.6' },

  // ════════════════════════════════════════════════════════════════════
  // 6. ATTIRE (23)
  //    Bridal + groom + sponsors + faith-modest variants. Custom orders
  //    take 3-6 months — couples book 6-9 months ahead.
  // ════════════════════════════════════════════════════════════════════
  bridal_gown_custom:                { folder: 'attire', phase: 'V1.1 base' },
  bridal_gown_rental:                { folder: 'attire', phase: 'V1.1.4', rental: true },
  filipiniana_terno:                 { folder: 'attire', phase: 'V1.1.4', ph: true },
  filipiniana_maria_clara:           { folder: 'attire', phase: 'V1.1.4', ph: true },
  filipiniana_balintawak:            { folder: 'attire', phase: 'V1.1.4', ph: true },
  muslim_modest_bridal:              { folder: 'attire', phase: 'V1.4', faith: 'Muslim' },
  inc_modest_bridal:                 { folder: 'attire', phase: 'V1.3', faith: 'INC' },
  maranao_wedding_attire:            { folder: 'attire', phase: 'V1.4', faith: 'Muslim' },
  tausug_wedding_attire:             { folder: 'attire', phase: 'V1.4', faith: 'Muslim' },
  yakan_wedding_attire:              { folder: 'attire', phase: 'V1.4', faith: 'Muslim' },
  bridesmaid_dress:                  { folder: 'attire', phase: 'V1.1 base' },
  junior_bridesmaid_dress:           { folder: 'attire', phase: 'V1.1.4' },
  mother_of_bride_gown:              { folder: 'attire', phase: 'V1.1 base' },
  flower_girl_dress:                 { folder: 'attire', phase: 'V1.1 base' },
  ninang_attire:                     { folder: 'attire', phase: 'V1.1.4', ph: true },
  ninong_attire:                     { folder: 'attire', phase: 'V1.1.4', ph: true },
  groom_suit_custom:                 { folder: 'attire', phase: 'V1.1 base' },
  groom_suit_rental:                 { folder: 'attire', phase: 'V1.1.4', rental: true },
  barong_tagalog_custom:             { folder: 'attire', phase: 'V1.1.4', ph: true },
  barong_tagalog_rental:             { folder: 'attire', phase: 'V1.1.4', ph: true, rental: true },
  groomsman_set:                     { folder: 'attire', phase: 'V1.1.4' },
  junior_groomsman:                  { folder: 'attire', phase: 'V1.1.4' },
  ring_bearer_suit:                  { folder: 'attire', phase: 'V1.1.4' },

  // ════════════════════════════════════════════════════════════════════
  // 7. HAIR & MAKEUP (13)
  //    Top PH MUAs book 6-12 months out. Family makeup is PH-distinct
  //    (multi-generational glam for mothers, sisters, aunts).
  // ════════════════════════════════════════════════════════════════════
  bridal_hmua:                       { folder: 'hair_makeup', phase: 'V1.1 base' },
  family_mua:                        { folder: 'hair_makeup', phase: 'V1.1 base' },
  bridal_hair_stylist:               { folder: 'hair_makeup', phase: 'V1.1 base' },
  touchup_mua:                       { folder: 'hair_makeup', phase: 'V1.1.5' },
  bridal_spa:                        { folder: 'hair_makeup', phase: 'V1.2' },
  bridal_fitness:                    { folder: 'hair_makeup', phase: 'V1.2' },
  bridal_nutritionist:               { folder: 'hair_makeup', phase: 'V1.2' },
  bridal_dermatology:                { folder: 'hair_makeup', phase: 'V1.2' },
  bridal_dental:                     { folder: 'hair_makeup', phase: 'V1.2' },
  groom_grooming:                    { folder: 'hair_makeup', phase: 'V1.2' },
  muslim_henna_artist:               { folder: 'hair_makeup', phase: 'V1.4', faith: 'Muslim' },
  maternity_bride_mua:               { folder: 'hair_makeup', phase: 'V1.2' },
  mature_bride_mua:                  { folder: 'hair_makeup', phase: 'V1.2' },

  // ════════════════════════════════════════════════════════════════════
  // 8. MUSIC & PROGRAM (16)
  //    Live performers + DJ + MC + choreographers + cultural ensembles.
  //    host_emcee lives here (folded with Music per Option A).
  // ════════════════════════════════════════════════════════════════════
  live_band:                         { folder: 'music_program', phase: 'V1.1.3' },
  band_live_music:                   { folder: 'music_program', phase: 'V1.1.3' },
  acoustic_performer:                { folder: 'music_program', phase: 'V1.1.3' },
  choir_string_quartet:              { folder: 'music_program', phase: 'V1.1.3' },
  wedding_singer:                    { folder: 'music_program', phase: 'V1.1.3' },
  dj:                                { folder: 'music_program', phase: 'V1.1.3' },
  wedding_entertainment:             { folder: 'music_program', phase: 'V1.1.3' },
  host_emcee:                        { folder: 'music_program', phase: 'V1.1 base' },
  kulintang_ensemble:                { folder: 'music_program', phase: 'V1.4', ph: true, faith: 'Muslim' },
  rondalla_ensemble:                 { folder: 'music_program', phase: 'V1.5+', ph: true },
  folk_performer:                    { folder: 'music_program', phase: 'V1.5+', ph: true },
  entourage_choreographer:           { folder: 'music_program', phase: 'V1.2', ph: true },
  first_dance_choreographer:         { folder: 'music_program', phase: 'V1.2' },
  pre_cana_dance_trainer:            { folder: 'music_program', phase: 'V1.2', ph: true },
  setnayan_pakanta:                  { folder: 'music_program', phase: 'V1.1 base', setnayan: true },
  setnayan_panood:                   { folder: 'music_program', phase: 'V1.1 base', setnayan: true },

  // ════════════════════════════════════════════════════════════════════
  // 9. DECOR, FLORALS & SOUND (14)
  //    Stylist + florals + cultural décor + lights/sound. All event-design.
  // ════════════════════════════════════════════════════════════════════
  stylist_decorator:                 { folder: 'decor_florals_sound', phase: 'V1.1 base' },
  decorator_general:                 { folder: 'decor_florals_sound', phase: 'V1.1 base' },
  florals:                           { folder: 'decor_florals_sound', phase: 'V1.1 base' },
  garden_wedding_florist:            { folder: 'decor_florals_sound', phase: 'V1.2' },
  beach_wedding_florist:             { folder: 'decor_florals_sound', phase: 'V1.2' },
  capiz_native_decor:                { folder: 'decor_florals_sound', phase: 'V1.2', ph: true },
  hacienda_heritage_decor:           { folder: 'decor_florals_sound', phase: 'V1.2', ph: true },
  maranao_okir_decor:                { folder: 'decor_florals_sound', phase: 'V1.4', faith: 'Muslim' },
  setnayan_pailaw:                   { folder: 'decor_florals_sound', phase: 'V1.1 base', setnayan: true },
  setnayan_custom_monogram:          { folder: 'decor_florals_sound', phase: 'V1.1 base', setnayan: true },
  lights_sound:                      { folder: 'decor_florals_sound', phase: 'V1.1 base' },
  outdoor_sound_system:              { folder: 'decor_florals_sound', phase: 'V1.2' },
  outdoor_lighting_specialist:       { folder: 'decor_florals_sound', phase: 'V1.2' },
  led_dance_floor:                   { folder: 'decor_florals_sound', phase: 'V1.1.6' },

  // ════════════════════════════════════════════════════════════════════
  // 10. RINGS & ACCESSORIES (11)
  //     Rings + bridal jewellery + sponsor corsage (PH-specific).
  // ════════════════════════════════════════════════════════════════════
  engagement_ring:                   { folder: 'rings_accessories', phase: 'V1.2' },
  wedding_ring:                      { folder: 'rings_accessories', phase: 'V1.2' },
  bridal_jewellery:                  { folder: 'rings_accessories', phase: 'V1.2' },
  bridal_jewellery_rental:           { folder: 'rings_accessories', phase: 'V1.2', rental: true },
  wedding_veil:                      { folder: 'rings_accessories', phase: 'V1.2' },
  bridal_bouquet_specialty:          { folder: 'rings_accessories', phase: 'V1.2' },
  wedding_garter:                    { folder: 'rings_accessories', phase: 'V1.2' },
  bridal_headpiece:                  { folder: 'rings_accessories', phase: 'V1.2' },
  sponsor_corsage:                   { folder: 'rings_accessories', phase: 'V1.2', ph: true },
  flower_girl_tiara:                 { folder: 'rings_accessories', phase: 'V1.2' },
  floral_jewellery:                  { folder: 'rings_accessories', phase: 'V1.2' },

  // ════════════════════════════════════════════════════════════════════
  // 11. BOOTHS & STATIONS (16) — Setnayan signature category
  //     Photo / tech / wellness / mystic booths. Carved out from old col 3
  //     so couples browsing for catering don't see VR/AR & tarot readers.
  // ════════════════════════════════════════════════════════════════════
  photo_booth:                       { folder: 'booths_stations', phase: 'V1.1 base' },
  gif_booth:                         { folder: 'booths_stations', phase: 'V1.1.6' },
  polaroid_booth:                    { folder: 'booths_stations', phase: 'V1.1.6' },
  booth_360:                         { folder: 'booths_stations', phase: 'V1.1.6' },
  selfie_magic_mirror:               { folder: 'booths_stations', phase: 'V1.1.6' },
  vr_ar_station:                     { folder: 'booths_stations', phase: 'V1.1.6' },
  arcade_retro_games:                { folder: 'booths_stations', phase: 'V1.1.6' },
  perfume_bar:                       { folder: 'booths_stations', phase: 'V1.1.6' },
  henna_tattoo_booth:                { folder: 'booths_stations', phase: 'V1.1.6' },
  massage_chair_station:             { folder: 'booths_stations', phase: 'V1.1.6' },
  mini_nail_bar:                     { folder: 'booths_stations', phase: 'V1.1.6' },
  hair_touchup_station:              { folder: 'booths_stations', phase: 'V1.1.6' },
  aromatherapy_station:              { folder: 'booths_stations', phase: 'V1.1.6' },
  tarot_astrology:                   { folder: 'booths_stations', phase: 'V1.1.6' },
  palmistry_reader:                  { folder: 'booths_stations', phase: 'V1.1.6' },
  setnayan_patiktok:                 { folder: 'booths_stations', phase: 'V1.1 base', setnayan: true },

  // ════════════════════════════════════════════════════════════════════
  // 12. INVITATIONS & KEEPSAKES (19)
  //     Stationery + live craft booths + souvenirs/tokens. Sponsor + godchild
  //     tokens are PH-distinct keepsake traditions.
  // ════════════════════════════════════════════════════════════════════
  invitation_print:                  { folder: 'invitations_keepsakes', phase: 'V1.1 base' },
  invitation_digital:                { folder: 'invitations_keepsakes', phase: 'V1.2' },
  wedding_cards_designer:            { folder: 'invitations_keepsakes', phase: 'V1.2' },
  save_the_date_digital:             { folder: 'invitations_keepsakes', phase: 'V1.2' },
  ceremony_program:                  { folder: 'invitations_keepsakes', phase: 'V1.2' },
  place_card:                        { folder: 'invitations_keepsakes', phase: 'V1.2' },
  menu_card:                         { folder: 'invitations_keepsakes', phase: 'V1.2' },
  stationery_signage:                { folder: 'invitations_keepsakes', phase: 'V1.1 base' },
  wedding_portrait_painter:          { folder: 'invitations_keepsakes', phase: 'V1.1.6' },
  caricature_artist:                 { folder: 'invitations_keepsakes', phase: 'V1.1.6' },
  silhouette_artist:                 { folder: 'invitations_keepsakes', phase: 'V1.1.6' },
  live_calligraphy:                  { folder: 'invitations_keepsakes', phase: 'V1.1.6' },
  keychain_engraving:                { folder: 'invitations_keepsakes', phase: 'V1.1.6' },
  live_embroidery:                   { folder: 'invitations_keepsakes', phase: 'V1.1.6' },
  poetry_typewriter:                 { folder: 'invitations_keepsakes', phase: 'V1.1.6' },
  souvenirs_giveaways:               { folder: 'invitations_keepsakes', phase: 'V1.1 base' },
  pasalubong_box:                    { folder: 'invitations_keepsakes', phase: 'V1.2', ph: true },
  sponsor_token:                     { folder: 'invitations_keepsakes', phase: 'V1.2', ph: true },
  godchild_token:                    { folder: 'invitations_keepsakes', phase: 'V1.2', ph: true },
};
