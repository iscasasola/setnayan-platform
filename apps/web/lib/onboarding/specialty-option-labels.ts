/**
 * specialty-option-labels.ts — human words for the specialty screens' options.
 *
 * 🔴 THE DEFECT. Owner, 2026-08-20, on the birthday details screen: the chips
 * read `1st_birthday` and `adult_regular`. They were not a rendering mistake —
 * **the labels did not exist.** In `specialty-catalog.ts` a FIELD carries both a
 * `key` and a `label`, but an OPTION is a bare string, and `SpecialtyField`
 * has no slot for an option label at all. The renderer printed the only thing it
 * was ever given.
 *
 * Measured, because it is much bigger than the two chips he saw: **187 distinct
 * option values across every event type**, and every one of them renders raw —
 * `ninong`, `pamamanhikan`, `cord_yugal`, `summa_cum_laude`, `mythical_five`.
 * Fixing only the birthday two would have been a correction at one site, which
 * this project has repeatedly learned is not a correction.
 *
 * ── WHY A LOOKUP AND NOT A NEW OPTION TYPE ─────────────────────────────────
 * Widening `options` to `{ key, label }[]` is the tidier-looking change and is
 * the wrong one here:
 *   • the stored value IS the key — it is already written into
 *     `events.signature_details` on live rows, and `show_when` branches compare
 *     against it. Restructuring risks changing what is saved;
 *   • specs can be authored in the DATABASE (`event_type_onboarding`), which
 *     the code cannot enumerate, so a type change cannot reach them at all.
 * A lookup leaves every stored value untouched and covers DB-authored specs the
 * same day they appear.
 *
 * 🔑 AND THE FALLBACK IS THE LOAD-BEARING HALF. An unknown key — a new spec, a
 * DB-authored one, a typo — is humanised rather than printed raw, so no future
 * option can put a snake_case token in front of a customer. The dictionary makes
 * words RIGHT; the fallback makes them SAFE.
 */

/**
 * Words for the options the catalog ships today. Grouped by where they appear so
 * a reviewer can check them against a real screen.
 *
 * ⚠ The Filipino terms are the point of this file, not decoration: `ninong` is
 * not "Ninong" to somebody reading in English, and `palabunutan` is not
 * "Palabunutan". Each is given its own name with the local word kept, because
 * the local word is what the customer says out loud.
 */
export const SPECIALTY_OPTION_LABELS: Readonly<Record<string, string>> = {
  // ── Birthday · the milestone ladder + programme ──────────────────────────
  '1st_birthday': 'First birthday',
  '7th_birthday': '7th birthday',
  kids_regular: 'A kids’ birthday',
  '18th_debut': '18th (debut)',
  '21st_debut': '21st (debut)',
  '60th': '60th',
  '75th': '75th',
  '80th': '80th',
  '90th': '90th',
  '100th': '100th',
  adult_regular: 'An adult birthday',
  this_is_your_life: '“This Is Your Life”',
  apo_grandchildren_tribute: 'Tribute from the apo',
  children_apo_tribute: 'Tribute from children and apo',
  ancestral_tribute: 'Tribute to the elders',
  candle_blowing: 'Blowing the candles',
  blow_out: 'Blow-out',
  palabunutan: 'Palabunutan (raffle)',
  consuelo_de_bobo_prizes: 'Consuelo de bobo prizes',
  grand_raffle_major_prizes: 'Grand raffle',
  parlor_games: 'Parlour games',
  pinata: 'Piñata',
  balloon_pop: 'Balloon pop',
  confetti_cannon: 'Confetti cannon',
  smoke_powder: 'Smoke or powder',
  cake_cut: 'Cutting the cake',
  candle: 'Candle ceremony',
  testimonials: 'Testimonials',
  talent_show: 'Talent show',
  production_number: 'Production number',
  intermission_performers: 'Intermission performers',
  department_production_numbers: 'Department production numbers',
  games: 'Games',

  // ── Debut ────────────────────────────────────────────────────────────────
  classic_18_female: 'Classic 18s',
  male_debut_18_shots: '18 credits',
  intimate_9s: 'Intimate (9s)',
  coronation: 'Coronation',
  society_ball: 'Society ball',
  masquerade: 'Masquerade',
  red_carpet: 'Red carpet',
  grand_gala_dinner: 'Grand gala dinner',

  // ── Wedding · sponsors, rites and traditions ─────────────────────────────
  ninong: 'Ninong (godfather)',
  ninang: 'Ninang (godmother)',
  best_man: 'Best man',
  maid_of_honor: 'Maid of honour',
  matron_of_honor: 'Matron of honour',
  bridesmaid: 'Bridesmaid',
  groomsman: 'Groomsman',
  escort: 'Escort',
  flower_girl: 'Flower girl',
  ring_bearer: 'Ring bearer',
  bible_bearer: 'Bible bearer',
  banner_bearer: 'Banner bearer',
  arrhae_coin_bearer: 'Arrhae (coin) bearer',
  arrhae_coins: 'Arrhae — the 13 coins',
  cord_yugal: 'Cord and yugal',
  veil: 'Veil',
  unity_candle: 'Unity candle',
  wine_or_sand: 'Wine or sand ceremony',
  money_dance: 'Money dance',
  dove_release: 'Dove release',
  box_release: 'Butterfly or dove box',
  pamamanhikan: 'Pamamanhikan',
  vow_renewal: 'Renewing vows',
  surviving_sponsors_honored: 'Honouring the surviving sponsors',
  in_memoriam: 'In memoriam',
  family_tree_reveal: 'Family tree reveal',

  // ── Faith + rite ─────────────────────────────────────────────────────────
  catholic_baptism: 'Catholic baptism',
  catholic_mass: 'Catholic mass',
  christian: 'Christian',
  muslim_nikah: 'Muslim (nikah)',
  civil: 'Civil ceremony',
  interfaith: 'Interfaith',
  indigenous: 'Indigenous rite',
  infant_dedication: 'Infant dedication',
  kumpil_confirmation: 'Kumpil (confirmation)',
  combined_baptism_and_reception: 'Baptism and reception together',
  thanksgiving_mass: 'Thanksgiving mass',
  thanksgiving_pasasalamat: 'Pasasalamat (thanksgiving)',
  house_blessing: 'House blessing',
  grand_opening_blessing: 'Opening blessing',
  religious_ordination: 'Ordination',
  pilgrimage_visita_iglesia: 'Visita Iglesia',
  healing_recovery: 'Healing and recovery',

  // ── Graduation ───────────────────────────────────────────────────────────
  valedictorian: 'Valedictorian',
  salutatorian: 'Salutatorian',
  summa_cum_laude: 'Summa cum laude',
  magna_cum_laude: 'Magna cum laude',
  cum_laude: 'Cum laude',
  with_honors: 'With honours',
  topnotcher: 'Topnotcher',
  board_exam_passer: 'Board exam passer',
  bar_passer: 'Bar passer',
  moving_up_kinder: 'Moving up (kinder)',
  elementary: 'Elementary',
  jhs: 'Junior high',
  shs: 'Senior high',
  college: 'College',
  postgrad: 'Postgraduate',
  vocational_tesda: 'Vocational / TESDA',
  best_in_uniform: 'Best in uniform',

  // ── Anniversary ──────────────────────────────────────────────────────────
  silver_25: 'Silver — 25 years',
  pearl_30: 'Pearl — 30 years',
  ruby_40: 'Ruby — 40 years',
  golden_50: 'Golden — 50 years',
  diamond_60: 'Diamond — 60 years',
  platinum_70: 'Platinum — 70 years',
  company_anniversary: 'Company anniversary',
  foundation: 'Foundation day',

  // ── Reunion + homecoming ─────────────────────────────────────────────────
  family_clan: 'Family or clan',
  batch_alumni: 'Batch or alumni',
  school_homecoming: 'School homecoming',
  town_fiesta_homecoming: 'Town fiesta homecoming',
  balikbayan_homecoming: 'Balikbayan homecoming',
  welcome_homecoming: 'Welcome home',
  despedida_farewell: 'Despedida (farewell)',
  fraternity_sorority_org: 'Fraternity, sorority or org',
  barkada: 'Barkada',
  salo_salo: 'Salo-salo',
  family_bonding: 'Family bonding',
  general_assembly: 'General assembly',
  intimate_family: 'Close family only',

  // ── Corporate ────────────────────────────────────────────────────────────
  christmas_party: 'Christmas party',
  year_end_kickoff: 'Year-end kickoff',
  awards_night: 'Awards night',
  awarding_night: 'Awarding night',
  awarding: 'Awarding',
  service_awards: 'Service awards',
  employee_of_the_year: 'Employee of the year',
  leadership_award: 'Leadership award',
  team_building: 'Team building',
  team_building_activities: 'Team-building activities',
  conference_summit: 'Conference or summit',
  keynote: 'Keynote',
  product_launch: 'Product launch',
  sportsfest: 'Sportsfest',
  fundraiser_charity: 'Fundraiser',
  auction: 'Auction',
  company: 'Company',
  organization: 'Organisation',
  business: 'Business',
  promotion: 'Promotion',
  achievement: 'Achievement',

  // ── Tournament + sport ───────────────────────────────────────────────────
  basketball: 'Basketball',
  volleyball: 'Volleyball',
  badminton: 'Badminton',
  boxing: 'Boxing',
  billiards: 'Billiards',
  chess: 'Chess',
  esports: 'Esports',
  running_fun_run: 'Fun run',
  liga_season: 'Liga season',
  single_elimination: 'Single elimination',
  double_elimination: 'Double elimination',
  round_robin: 'Round robin',
  champion: 'Champion',
  runner_up: 'Runner-up',
  mvp: 'MVP',
  mythical_five: 'Mythical five',
  sportsmanship: 'Sportsmanship',
  muse: 'Muse',
  muse_of_the_league: 'Muse of the league',
  sports_ball: 'Sports ball',

  // ── Gender reveal ────────────────────────────────────────────────────────
  boy: 'A boy',
  girl: 'A girl',
  he_or_she: 'He or she',
  blue_pink: 'Blue or pink',
  neutral: 'Neutral',

  // ── Look, scale and role ─────────────────────────────────────────────────
  formal: 'Formal',
  black_tie: 'Black tie',
  filipiniana: 'Filipiniana',
  casual: 'Casual',
  intimate: 'Intimate',
  creative_theme: 'Creative theme',
  team_theme: 'Team theme',
  pageant: 'Pageant',
  entertainment: 'Entertainment',
  honeymoon: 'Honeymoon',
  wedding: 'Wedding',
  just_because: 'Just because',
  solo: 'On my own',
  lady: 'Lady',
  member: 'Member',
  organizer: 'Organiser',
  treasurer: 'Treasurer',
  other: 'Other',
  none: 'None',
  // ── Funeral · the rite and what follows ──────────────────────────────────
  // 🔑 `catholic_mass` is ALREADY IN THIS FILE (the christening rite) and is
  // deliberately re-used rather than duplicated as `funeral_mass` — the map is
  // keyed by the stored VALUE, so a second key for the same rite would be two
  // words for one thing and only one of them would ever be corrected.
  christian_service: 'Christian service',
  inc_service: 'INC service',
  muslim_rite: 'Muslim rite',
  memorial_service: 'Memorial service',
  no_rite: 'No religious rite',
  burial: 'Burial',
  cremation: 'Cremation',
  // Its own entry rather than the humanised fallback ("Undecided"), because in
  // the first days after a death this is the honest answer to most of the
  // screen and it should not read like an omission.
  undecided: 'Not decided yet',

};

/**
 * Humanise an option key we have no authored label for.
 *
 * This is what stops a snake_case token ever reaching a customer again — a spec
 * authored in the database, or a new option added to the catalog without a line
 * in the map above, degrades to readable words instead of to raw code.
 *
 * Ordinals keep their suffix lower-case ("18th", never "18Th"), and an
 * already-human string (a label with spaces or capitals) is returned untouched
 * so this can be applied to any option list without inspecting it first.
 */
export function humaniseOptionKey(key: string): string {
  if (/[A-Z\s]/.test(key)) return key;
  const words = key.split('_').filter(Boolean);
  if (words.length === 0) return key;
  return words
    .map((w, i) => {
      if (/^\d+(st|nd|rd|th)$/.test(w)) return w;
      if (i > 0) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/** The words to show for one option value. Never returns a raw snake_case key. */
export function specialtyOptionLabel(key: string): string {
  return SPECIALTY_OPTION_LABELS[key] ?? humaniseOptionKey(key);
}
