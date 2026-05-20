/**
 * V1.1 vendor-taxonomy metadata map. Used by the /admin/taxonomy viewer to
 * group canonical_service_schemas rows into the 5-column mega-menu structure
 * from `02_Specifications/Vendor_Taxonomy_V1_Master.md`.
 *
 * The DB table (canonical_service_schemas) doesn't have a column for
 * mega-menu placement or phase, so this lives in code. Keep in sync with the
 * master taxonomy doc when adding rows: each new canonical_service needs an
 * entry here OR the admin viewer drops it into the "Unmapped" bucket.
 */

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
  column: MegaMenuColumn;
  phase: TaxonomyPhase;
  /** Surfaces conditionally per events.ceremony_type — null = surfaces for everyone. */
  faith?: 'Catholic' | 'Christian' | 'INC' | 'Muslim' | 'Cultural';
  /** PH-specific category WedMeGood structurally lacks. */
  ph?: true;
  /** First-party Setnayan service insert. */
  setnayan?: true;
  /** Rental variant of a category. */
  rental?: true;
};

/**
 * canonical_service → metadata. Add a row here whenever a row is added to
 * canonical_service_schemas; the admin viewer drops unmapped keys into an
 * "Unmapped" bucket so you can spot drift.
 */
export const TAXONOMY_MAP: Record<string, TaxonomyEntry> = {
  // ---------- Column 1 — Capture ----------
  photography:                       { column: 1, phase: 'V1.1 base' },
  pre_nup_photographer:              { column: 1, phase: 'V1.1 base' },
  engagement_photographer:           { column: 1, phase: 'V1.1.2' },
  drone:                             { column: 1, phase: 'V1.1 base' },
  same_day_edit:                     { column: 1, phase: 'V1.1 base' },
  family_day2_photographer:          { column: 1, phase: 'V1.1.2' },
  boudoir_photographer:              { column: 1, phase: 'V1.1.2' },
  studio_portrait_photographer:      { column: 1, phase: 'V1.1.2' },
  setnayan_papic:                    { column: 1, phase: 'V1.1 base', setnayan: true },
  videography:                       { column: 1, phase: 'V1.1 base' },
  drone_videographer:                { column: 1, phase: 'V1.1 base' },
  highlight_reel_specialist:         { column: 1, phase: 'V1.1.2' },
  setnayan_ai_edited_highlight:      { column: 1, phase: 'V1.1 base', setnayan: true },
  pre_nup_shoot_locations:           { column: 1, phase: 'V1.2', ph: true },

  // ---------- Column 2 — Music & Entertainment ----------
  live_band:                         { column: 2, phase: 'V1.1.3' },
  band_live_music:                   { column: 2, phase: 'V1.1.3' },
  acoustic_performer:                { column: 2, phase: 'V1.1.3' },
  choir_string_quartet:              { column: 2, phase: 'V1.1.3' },
  kulintang_ensemble:                { column: 2, phase: 'V1.4', ph: true, faith: 'Muslim' },
  rondalla_ensemble:                 { column: 2, phase: 'V1.5+', ph: true },
  folk_performer:                    { column: 2, phase: 'V1.5+', ph: true },
  wedding_singer:                    { column: 2, phase: 'V1.1.3' },
  setnayan_pakanta:                  { column: 2, phase: 'V1.1 base', setnayan: true },
  setnayan_panood:                   { column: 2, phase: 'V1.1 base', setnayan: true },
  dj:                                { column: 2, phase: 'V1.1.3' },
  wedding_entertainment:             { column: 2, phase: 'V1.1.3' },
  host_emcee:                        { column: 2, phase: 'V1.1 base' },
  entourage_choreographer:           { column: 2, phase: 'V1.2', ph: true },
  first_dance_choreographer:         { column: 2, phase: 'V1.2' },
  pre_cana_dance_trainer:            { column: 2, phase: 'V1.2', ph: true },

  // ---------- Column 3 — Food & Beverage ----------
  catering:                          { column: 3, phase: 'V1.1 base' },
  lechonero:                         { column: 3, phase: 'V1.1 base', ph: true },
  live_cooking_station:              { column: 3, phase: 'V1.1.1' },
  halal_catering:                    { column: 3, phase: 'V1.1.1', faith: 'Muslim' },
  mocktail_only_caterer:             { column: 3, phase: 'V1.1.1', faith: 'INC' },
  food_truck:                        { column: 3, phase: 'V1.1.1' },
  wedding_cake:                      { column: 3, phase: 'V1.1 base' },
  dessert_station:                   { column: 3, phase: 'V1.1.1' },
  mobile_bar:                        { column: 3, phase: 'V1.1 base' },
  mocktail_bar:                      { column: 3, phase: 'V1.1.1', faith: 'INC' },
  coffee_booth:                      { column: 3, phase: 'V1.1 base' },
  halo_halo_station:                 { column: 3, phase: 'V1.1.6', ph: true },
  ice_cream_cart:                    { column: 3, phase: 'V1.1.6' },
  crepe_pancake_station:             { column: 3, phase: 'V1.1.6' },
  cotton_candy_cart:                 { column: 3, phase: 'V1.1.6' },
  charcuterie_board:                 { column: 3, phase: 'V1.1.6' },
  mini_lechon_station:               { column: 3, phase: 'V1.1.6', ph: true },
  whiskey_cigar_bar:                 { column: 3, phase: 'V1.1.6' },
  mocktail_booth_mini:               { column: 3, phase: 'V1.1.6', faith: 'INC' },
  tea_bar:                           { column: 3, phase: 'V1.1.6' },
  perfume_bar:                       { column: 3, phase: 'V1.1.6' },
  henna_tattoo_booth:                { column: 3, phase: 'V1.1.6' },
  massage_chair_station:             { column: 3, phase: 'V1.1.6' },
  mini_nail_bar:                     { column: 3, phase: 'V1.1.6' },
  hair_touchup_station:              { column: 3, phase: 'V1.1.6' },
  aromatherapy_station:              { column: 3, phase: 'V1.1.6' },
  photo_booth:                       { column: 3, phase: 'V1.1 base' },
  booth_360:                         { column: 3, phase: 'V1.1.6' },
  gif_booth:                         { column: 3, phase: 'V1.1.6' },
  polaroid_booth:                    { column: 3, phase: 'V1.1.6' },
  wedding_portrait_painter:          { column: 3, phase: 'V1.1.6' },
  caricature_artist:                 { column: 3, phase: 'V1.1.6' },
  silhouette_artist:                 { column: 3, phase: 'V1.1.6' },
  selfie_magic_mirror:               { column: 3, phase: 'V1.1.6' },
  live_calligraphy:                  { column: 3, phase: 'V1.1.6' },
  keychain_engraving:                { column: 3, phase: 'V1.1.6' },
  live_embroidery:                   { column: 3, phase: 'V1.1.6' },
  poetry_typewriter:                 { column: 3, phase: 'V1.1.6' },
  tarot_astrology:                   { column: 3, phase: 'V1.1.6' },
  palmistry_reader:                  { column: 3, phase: 'V1.1.6' },
  vr_ar_station:                     { column: 3, phase: 'V1.1.6' },
  arcade_retro_games:                { column: 3, phase: 'V1.1.6' },
  led_dance_floor:                   { column: 3, phase: 'V1.1.6' },
  setnayan_patiktok:                 { column: 3, phase: 'V1.1 base', setnayan: true },

  // ---------- Column 4 — Look ----------
  bridal_gown_custom:                { column: 4, phase: 'V1.1 base' },
  bridal_gown_rental:                { column: 4, phase: 'V1.1.4', rental: true },
  bridesmaid_dress:                  { column: 4, phase: 'V1.1 base' },
  mother_of_bride_gown:              { column: 4, phase: 'V1.1 base' },
  flower_girl_dress:                 { column: 4, phase: 'V1.1 base' },
  junior_bridesmaid_dress:           { column: 4, phase: 'V1.1.4' },
  filipiniana_terno:                 { column: 4, phase: 'V1.1.4', ph: true },
  filipiniana_maria_clara:           { column: 4, phase: 'V1.1.4', ph: true },
  filipiniana_balintawak:            { column: 4, phase: 'V1.1.4', ph: true },
  ninang_attire:                     { column: 4, phase: 'V1.1.4', ph: true },
  muslim_modest_bridal:              { column: 4, phase: 'V1.4', faith: 'Muslim' },
  inc_modest_bridal:                 { column: 4, phase: 'V1.3', faith: 'INC' },
  maranao_wedding_attire:            { column: 4, phase: 'V1.4', faith: 'Muslim' },
  tausug_wedding_attire:             { column: 4, phase: 'V1.4', faith: 'Muslim' },
  yakan_wedding_attire:              { column: 4, phase: 'V1.4', faith: 'Muslim' },
  groom_suit_custom:                 { column: 4, phase: 'V1.1 base' },
  groom_suit_rental:                 { column: 4, phase: 'V1.1.4', rental: true },
  barong_tagalog_custom:             { column: 4, phase: 'V1.1.4', ph: true },
  barong_tagalog_rental:             { column: 4, phase: 'V1.1.4', ph: true, rental: true },
  groomsman_set:                     { column: 4, phase: 'V1.1.4' },
  junior_groomsman:                  { column: 4, phase: 'V1.1.4' },
  ring_bearer_suit:                  { column: 4, phase: 'V1.1.4' },
  ninong_attire:                     { column: 4, phase: 'V1.1.4', ph: true },
  bridal_hmua:                       { column: 4, phase: 'V1.1 base' },
  family_mua:                        { column: 4, phase: 'V1.1 base' },
  bridal_hair_stylist:               { column: 4, phase: 'V1.1 base' },
  touchup_mua:                       { column: 4, phase: 'V1.1.5' },
  bridal_spa:                        { column: 4, phase: 'V1.2' },
  bridal_fitness:                    { column: 4, phase: 'V1.2' },
  bridal_nutritionist:               { column: 4, phase: 'V1.2' },
  bridal_dermatology:                { column: 4, phase: 'V1.2' },
  bridal_dental:                     { column: 4, phase: 'V1.2' },
  groom_grooming:                    { column: 4, phase: 'V1.2' },
  muslim_henna_artist:               { column: 4, phase: 'V1.4', faith: 'Muslim' },
  maternity_bride_mua:               { column: 4, phase: 'V1.2' },
  mature_bride_mua:                  { column: 4, phase: 'V1.2' },
  engagement_ring:                   { column: 4, phase: 'V1.2' },
  wedding_ring:                      { column: 4, phase: 'V1.2' },
  bridal_jewellery:                  { column: 4, phase: 'V1.2' },
  bridal_jewellery_rental:           { column: 4, phase: 'V1.2', rental: true },
  wedding_veil:                      { column: 4, phase: 'V1.2' },
  bridal_bouquet_specialty:          { column: 4, phase: 'V1.2' },
  wedding_garter:                    { column: 4, phase: 'V1.2' },
  bridal_headpiece:                  { column: 4, phase: 'V1.2' },
  sponsor_corsage:                   { column: 4, phase: 'V1.2', ph: true },
  flower_girl_tiara:                 { column: 4, phase: 'V1.2' },
  floral_jewellery:                  { column: 4, phase: 'V1.2' },
  stylist_decorator:                 { column: 4, phase: 'V1.1 base' },
  decorator_general:                 { column: 4, phase: 'V1.1 base' },
  florals:                           { column: 4, phase: 'V1.1 base' },
  garden_wedding_florist:            { column: 4, phase: 'V1.2' },
  beach_wedding_florist:             { column: 4, phase: 'V1.2' },
  capiz_native_decor:                { column: 4, phase: 'V1.2', ph: true },
  hacienda_heritage_decor:           { column: 4, phase: 'V1.2', ph: true },
  maranao_okir_decor:                { column: 4, phase: 'V1.4', faith: 'Muslim' },
  setnayan_pailaw:                   { column: 4, phase: 'V1.1 base', setnayan: true },
  setnayan_custom_monogram:          { column: 4, phase: 'V1.1 base', setnayan: true },

  // ---------- Column 5 — Ceremony / Coordination / Logistics / Stationery / Travel ----------
  catholic_priest:                   { column: 5, phase: 'V1.1 base', faith: 'Catholic' },
  civil_judge:                       { column: 5, phase: 'V1.1 base' },
  civil_mayor:                       { column: 5, phase: 'V1.1 base' },
  civil_justice_of_peace:            { column: 5, phase: 'V1.1 base' },
  inc_minister:                      { column: 5, phase: 'V1.3', faith: 'INC' },
  born_again_pastor:                 { column: 5, phase: 'V1.2', faith: 'Christian' },
  charismatic_pastor:                { column: 5, phase: 'V1.2', faith: 'Christian' },
  mainline_protestant_pastor:        { column: 5, phase: 'V1.2', faith: 'Christian' },
  muslim_imam:                       { column: 5, phase: 'V1.4', faith: 'Muslim' },
  cultural_tribal_elder:             { column: 5, phase: 'V1.5+', faith: 'Cultural' },
  officiant_priest_minister:         { column: 5, phase: 'V1.1 base' },
  pre_cana_seminar:                  { column: 5, phase: 'V1.2', ph: true, faith: 'Catholic' },
  cfo_seminar:                       { column: 5, phase: 'V1.2', ph: true },
  inc_counseling:                    { column: 5, phase: 'V1.3', ph: true, faith: 'INC' },
  muslim_pre_wedding_counseling:     { column: 5, phase: 'V1.4', ph: true, faith: 'Muslim' },
  marriage_license_expediting:       { column: 5, phase: 'V1.2', ph: true },
  apostille_dfa_authentication:      { column: 5, phase: 'V1.3', ph: true },
  wedding_coordination:              { column: 5, phase: 'V1.1 base' },
  wedding_planner_partial:           { column: 5, phase: 'V1.2' },
  day_of_coordinator:                { column: 5, phase: 'V1.1 base' },
  destination_wedding_specialist:    { column: 5, phase: 'V1.2' },
  pamamanhikan_coordinator:          { column: 5, phase: 'V1.2', ph: true },
  despedida_planner:                 { column: 5, phase: 'V1.2', ph: true },
  sponsor_coordinator:               { column: 5, phase: 'V1.2', ph: true },
  gender_separated_reception_coordinator: { column: 5, phase: 'V1.4', faith: 'Muslim' },
  religious_venue_coordinator:       { column: 5, phase: 'V1.3', ph: true },
  inc_wedding_coordinator:           { column: 5, phase: 'V1.3', faith: 'INC' },
  mahr_coordination:                 { column: 5, phase: 'V1.4', faith: 'Muslim' },
  setnayan_concierge:                { column: 5, phase: 'V1.1 base', setnayan: true },
  transportation_bridal_car:         { column: 5, phase: 'V1.1 base' },
  vintage_classic_vehicle:           { column: 5, phase: 'V1.2' },
  transportation_guest_shuttle:      { column: 5, phase: 'V1.1 base' },
  motorcycle_escort:                 { column: 5, phase: 'V1.5+' },
  horse_drawn_carriage:              { column: 5, phase: 'V1.5+' },
  bridal_boat_yacht:                 { column: 5, phase: 'V1.5+' },
  generator_rental:                  { column: 5, phase: 'V1.2', rental: true },
  tent_rental:                       { column: 5, phase: 'V1.2', rental: true },
  mobile_restroom_rental:            { column: 5, phase: 'V1.2', rental: true },
  cooling_fans_misters:              { column: 5, phase: 'V1.2', rental: true },
  outdoor_sound_system:              { column: 5, phase: 'V1.2' },
  outdoor_lighting_specialist:       { column: 5, phase: 'V1.2' },
  bug_repellent_station:             { column: 5, phase: 'V1.2' },
  wedding_day_weather_forecaster:    { column: 5, phase: 'V1.2', ph: true },
  parasol_hat_rental:                { column: 5, phase: 'V1.2', rental: true },
  lights_sound:                      { column: 5, phase: 'V1.1 base' },
  invitation_print:                  { column: 5, phase: 'V1.1 base' },
  invitation_digital:                { column: 5, phase: 'V1.2' },
  wedding_cards_designer:            { column: 5, phase: 'V1.2' },
  save_the_date_digital:             { column: 5, phase: 'V1.2' },
  setnayan_save_the_date_mp4:        { column: 5, phase: 'V1.1 base', setnayan: true },
  ceremony_program:                  { column: 5, phase: 'V1.2' },
  place_card:                        { column: 5, phase: 'V1.2' },
  menu_card:                         { column: 5, phase: 'V1.2' },
  stationery_signage:                { column: 5, phase: 'V1.1 base' },
  souvenirs_giveaways:               { column: 5, phase: 'V1.1 base' },
  pasalubong_box:                    { column: 5, phase: 'V1.2', ph: true },
  sponsor_token:                     { column: 5, phase: 'V1.2', ph: true },
  godchild_token:                    { column: 5, phase: 'V1.2', ph: true },
  honeymoon_planner:                 { column: 5, phase: 'V1.1 base' },
  destination_wedding_travel_coordinator: { column: 5, phase: 'V1.2' },
  visa_wedding_logistics:            { column: 5, phase: 'V1.5+', ph: true },
};
