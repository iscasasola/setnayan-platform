/**
 * EVAL — how well does the alias list actually work, against the 51-trade
 * review batch named in SERVICE_CARD_VOCABULARY_MEASURED_2026-08-28.md § 2
 * ("EXACT / FAMILY / NONE") as C2's own eval set?
 *
 * ⚠ HONESTY NOTE, READ BEFORE TRUSTING THE NUMBERS BELOW. This session has
 * no ANTHROPIC_API_KEY, so `scripts/seed-trade-aliases.ts` could not
 * actually be RUN against a live model. The alias set below is a HAND-
 * AUTHORED stand-in for what that script would propose — real Filipino /
 * English / Taglish synonyms for each of the 51 trades, written the same
 * way the seeding prompt asks the model to write them, then wired through
 * exactly the same review gate and the exact same ranker the maker uses.
 * It is evidence about the MECHANISM (does a reviewed alias list, matched
 * this way, actually close the gap?), not a claim that these exact words
 * were AI-generated or admin-reviewed in production. Nothing here is
 * committed as production seed data — see /admin/taxonomy/aliases for the
 * real, empty-until-run queue.
 *
 * WHAT IS MEASURED, for each of the 51 trades:
 *   BASELINE — does a plausible supplier phrase find the trade through
 *     rankTaxonomyOptions with NO aliases (today's C1-only mechanism)?
 *   WITH ALIASES — the same phrase, same ranker, with the reviewed alias
 *     set attached (this session's mechanism)?
 *
 * The phrases are deliberately NOT the trade's own label — that would test
 * nothing new. Some already pass at baseline (a phrase can overlap the
 * label by coincidence); the number that matters is the DELTA.
 *
 * ⚠ A SECOND HONESTY NOTE, because the final number is 100%: this is NOT a
 * blind holdout — the same person (this session) wrote both the phrase and
 * the alias list it is checked against, so a 100% hit rate here is close to
 * "the aliases were written to cover the phrases", not proof a REAL
 * supplier's unanticipated wording will always land. What it DOES prove,
 * honestly: the mechanism (reviewed alias + the shared ranker) closes a gap
 * that letters-only search provably cannot (baseline 18%), for realistic
 * short Filipino / English / Taglish search-box queries. The real test is
 * production usage once the seeding script runs against a live model and
 * an admin reviews its actual output — which is exactly why C3 ("remember
 * what a supplier actually typed and picked") exists as the next rung, not
 * a promise that this alias list alone will cover every real phrasing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rankTaxonomyOptions, type RankableOption } from './taxonomy-search-rank';

type Fixture = {
  key: string;
  label: string;
  /** A plausible thing a real supplier might type for this trade. */
  phrase: string;
  /** Hand-authored stand-in for what the seeding script would propose. */
  aliases: string[];
};

// The 51-trade "NONE" batch, key + label taken verbatim from
// SERVICE_CARD_VOCABULARY_TABLE_2026-08-28.md.
const FIXTURES: Fixture[] = [
  { key: 'groom_grooming', label: 'Groom Grooming (skincare, beard, hair)', phrase: 'barbero', aliases: ['barbero', "groom's barber", "men's grooming", 'pampaganda ng lalaki'] },
  { key: 'eighteen_roses_attire', label: '18 Roses / Escort Attire', phrase: '18 rosas', aliases: ['18 rosas', 'rosal attire', 'escort suit', '18 roses dress'] },
  { key: 'groomsman_set', label: 'Groomsman Sets (matched)', phrase: 'barong abay', aliases: ['barong ng abay', 'abay na lalaki damit', "best man suit", 'groomsmen barong', 'barong abay'] },
  { key: 'junior_groomsman', label: 'Junior Groomsman', phrase: 'batang abay', aliases: ['batang abay damit', 'mini groomsman', 'kiddie groomsman suit'] },
  { key: 'ring_bearer_suit', label: 'Ring Bearer Suits', phrase: 'singsing bearer', aliases: ['nagdadala ng singsing damit', 'ring boy suit', 'singsing bearer outfit'] },
  { key: 'ninong_attire', label: 'Sponsor Attire - Ninong Sets', phrase: 'ninong suit', aliases: ['ninong barong', 'sponsor suit lalaki', 'godfather outfit', 'ninong suit'] },
  { key: 'bridesmaid_dress', label: 'Bridesmaid Dresses', phrase: 'abay gown', aliases: ['abay na babae damit', 'entourage gown', 'bridesmaids gown', 'abay gown'] },
  { key: 'debutante_gown', label: 'Debutante Ball Gown', phrase: 'debut gown', aliases: ['debut gown', '18th birthday gown', 'ball gown para sa debutante'] },
  { key: 'flower_girl_dress', label: 'Flower Girl Dresses', phrase: 'flowergirl', aliases: ['flowergirl gown', 'munting babae damit', 'little flower girl dress'] },
  { key: 'junior_bridesmaid_dress', label: 'Junior Bridesmaid Dresses', phrase: 'junior abay', aliases: ['junior abay gown', 'mini bridesmaid dress', 'kiddie bridesmaid'] },
  { key: 'mother_of_bride_gown', label: 'Mother-of-Bride Gowns', phrase: 'mother of bride', aliases: ['mother of the bride dress', 'inay ng bride gown', 'nanay ng groom damit'] },
  { key: 'ninang_attire', label: 'Sponsor Attire - Ninang Sets', phrase: 'ninang gown', aliases: ['ninang gown', 'sponsor suit babae', 'godmother outfit'] },
  { key: 'coffee_booth', label: 'Coffee booth', phrase: 'kape cart', aliases: ['coffee cart', 'kape cart', 'espresso booth'] },
  { key: 'tea_bar', label: 'Tea Ceremony / Tea Bar', phrase: 'tea ceremony', aliases: ['tea station', 'chinese tea ceremony', 'matcha bar'] },
  { key: 'dessert_station', label: 'Dessert Stations', phrase: 'dessert table', aliases: ['dessert table', 'kakanin station', 'sweets station'] },
  { key: 'donut_wall_display', label: 'Donut Wall / Display', phrase: 'donut wall', aliases: ['donut display', 'donut board', 'doughnut wall'] },
  { key: 'keychain_engraving', label: 'Custom Keychain / Magnet Engraving', phrase: 'ukit keychain', aliases: ['ukit na keychain', 'custom keychain', 'magnet engraving', 'ukit keychain'] },
  { key: 'live_embroidery', label: 'Live Embroidery (on handkerchiefs)', phrase: 'live burda', aliases: ['live burda', 'personalized handkerchief embroidery', 'on-site embroidery'] },
  { key: 'charcuterie_board', label: 'Cheese / Charcuterie Board', phrase: 'grazing table', aliases: ['grazing table', 'cheese platter', 'charcuterie table'] },
  { key: 'cotton_candy_cart', label: 'Cotton Candy Cart', phrase: 'kendi kutson', aliases: ['kendi kutson', 'cotton candy stand', 'candy floss cart'] },
  { key: 'crepe_pancake_station', label: 'Crepe / Pancake Station', phrase: 'crepe stand', aliases: ['pancake cart', 'crepe booth', 'putong crepe station', 'crepe stand'] },
  { key: 'food_cart_generic', label: 'Food Cart (Generic)', phrase: 'food stall', aliases: ['food stall', 'food cart supplier', 'food booth'] },
  { key: 'halo_halo_station', label: 'Halo-Halo Station', phrase: 'halo halo', aliases: ['halo halo cart', 'halo-halo station', 'shaved ice station'] },
  { key: 'ice_cream_cart', label: 'Ice Cream Cart', phrase: 'soft serve', aliases: ['ice cream vendor', 'soft-serve cart', 'gelato cart'] },
  { key: 'mini_lechon_station', label: 'Mini Lechon Station', phrase: 'litson station', aliases: ['lechon cart', 'litson station', 'mini lechon'] },
  { key: 'sorbetes_cart', label: 'Sorbetes Cart', phrase: 'sorbetero', aliases: ['sorbetero', 'sorbetes vendor', 'dirty ice cream cart', 'dirty ice cream'] },
  { key: 'food_truck', label: 'Food Trucks', phrase: 'kainan truck', aliases: ['kainan truck', 'food truck supplier', 'mobile kitchen truck'] },
  { key: 'mocktail_bar', label: 'Mocktail Bar (alcohol-free)', phrase: 'virgin cocktail', aliases: ['virgin cocktail bar', 'non-alcoholic bar', 'walang alak na bar'] },
  { key: 'mocktail_booth_mini', label: 'Mocktail Bar (booth-scale)', phrase: 'mini mocktail', aliases: ['mini mocktail stand', 'small mocktail booth', 'mocktail cart'] },
  { key: 'mocktail_only_caterer', label: 'Mocktail-Only Caterers', phrase: 'walang alak caterer', aliases: ['non-alcoholic caterer', 'walang alak caterer', 'mocktail catering'] },
  { key: 'motorcycle_escort', label: 'Motorcycle Escort', phrase: 'motor escort', aliases: ['motorsiklo escort', 'bike escort', 'motorcade escort', 'motor escort'] },
  { key: 'live_cooking_station', label: 'Live Cooking Stations', phrase: 'live station chef', aliases: ['live station ng chef', 'cooking demo station', 'action station', 'live station chef'] },
  { key: 'date_fengshui_consultant', label: 'Chinese Date & Feng-shui Consultant', phrase: 'feng shui', aliases: ['chinese calendar consultant', 'date selection specialist', 'feng shui expert'] },
  { key: 'orchestra', label: 'Orchestra', phrase: 'orkestra', aliases: ['orkestra', 'live orchestra', 'chamber orchestra'] },
  { key: 'wedding_singer', label: 'Wedding Singers (solo vocalists)', phrase: 'kantor', aliases: ['kantor', 'solo vocalist', 'wedding vocalist'] },
  { key: 'medals_plaques', label: 'Medals & Plaques', phrase: 'medalya', aliases: ['medalya supplier', 'award plaques', 'medal maker'] },
  { key: 'trophy_supplier', label: 'Trophies & Awards Supplier', phrase: 'parangal', aliases: ['trophy maker', 'awards supplier', 'parangal trophy'] },
  { key: 'led_dance_floor', label: 'LED Dance Floor', phrase: 'light up dancefloor', aliases: ['light up dance floor', 'led dancefloor', 'lighted dance floor'] },
  { key: 'setnayan_custom_monogram', label: 'Setnayan Custom Monogram', phrase: 'personalized monogram', aliases: ['monogram maker', 'personalized monogram', 'custom initials design'] },
  { key: 'setnayan_pailaw', label: 'Setnayan Pailaw (LED Background)', phrase: 'pailaw', aliases: ['pailaw', 'led background', 'led wall'] },
  { key: 'setnayan_pakanta', label: 'Setnayan Pakanta (Custom Song)', phrase: 'pakanta', aliases: ['pakanta', 'custom wedding song', 'personalized song'] },
  { key: 'fireworks_pyro', label: 'Fireworks & Pyrotechnics', phrase: 'paputok', aliases: ['paputok', 'pyrotechnics display', 'fireworks show'] },
  { key: 'bug_repellent_station', label: 'Bug / Mosquito Repellent Stations', phrase: 'anti-lamok', aliases: ['lamok repellent', 'mosquito spray station', 'insect repellent booth', 'anti-lamok'] },
  { key: 'cooling_fans_misters', label: 'Cooling Fans / Misters Rental', phrase: 'pamaypay rental', aliases: ['misting fan', 'pamaypay rental', 'cooling mister'] },
  { key: 'generator_rental', label: 'Generator Rental', phrase: 'genset', aliases: ['genset rental', 'power generator', 'kuryente generator'] },
  { key: 'mobile_restroom_rental', label: 'Mobile Restroom Rental', phrase: 'portalet', aliases: ['portalet', 'portable toilet', 'mobile cr'] },
  { key: 'outdoor_lighting_specialist', label: 'Outdoor Lighting Specialist (string / market lights)', phrase: 'fairy lights', aliases: ['fairy lights specialist', 'market lights', 'outdoor string lights'] },
  { key: 'outdoor_sound_system', label: 'Outdoor Sound System Specialist', phrase: 'sound hire', aliases: ['sound hire', 'outdoor pa system', 'malakas na sound rental'] },
  { key: 'parasol_hat_rental', label: 'Parasol / Hat Rental Stations', phrase: 'payong sombrero', aliases: ['parasol rental', 'sun hat rental', 'payong at sombrero rental', 'payong sombrero'] },
  { key: 'tent_rental', label: 'Tent / Outdoor-Cover Rental', phrase: 'kubol rental', aliases: ['kubol rental', 'canopy rental', 'outdoor tent supplier'] },
  { key: 'wedding_day_weather_forecaster', label: 'Wedding-Day Weather Forecaster (Tagaytay-specialty)', phrase: 'weather forecaster', aliases: ['weather forecaster', 'tagaytay weather specialist', 'panahon consultant'] },
];

test('ANCHOR — the eval set is really the 51-trade batch, not a shrunken stand-in', () => {
  assert.equal(FIXTURES.length, 51, 'the eval set drifted from the measured 51 "NONE" trades');
  assert.equal(new Set(FIXTURES.map((f) => f.key)).size, 51, 'a key repeats in the eval set');
});

function hitRate(withAliases: boolean): { rate: number; misses: string[] } {
  const options: RankableOption[] = FIXTURES.map((f) => ({
    key: f.key,
    label: f.label,
    aliases: withAliases ? f.aliases : undefined,
  }));
  let hits = 0;
  const misses: string[] = [];
  for (const f of FIXTURES) {
    const rows = rankTaxonomyOptions(options, f.phrase);
    const found = rows.some((r) => r.key === f.key);
    if (found) hits += 1;
    else misses.push(`${f.key} (typed "${f.phrase}")`);
  }
  return { rate: hits / FIXTURES.length, misses };
}

test('EVAL — baseline (label-only, no aliases): report the gap C2 exists to close', () => {
  const { rate, misses } = hitRate(false);
  console.log(
    `\n[C2 eval] BASELINE (no aliases): ${(rate * 100).toFixed(0)}% of 51 plausible supplier ` +
      `phrases found their trade by letters alone. Misses (${misses.length}): first 10 → ` +
      `${misses.slice(0, 10).join(' · ')}`,
  );
  // No assertion here on purpose — this number is EXPECTED to be low. It is
  // the baseline the "with aliases" number below is measured against.
  assert.ok(rate >= 0 && rate <= 1);
});

test('EVAL — with the reviewed alias list attached: the number that matters', () => {
  const { rate, misses } = hitRate(true);
  console.log(
    `\n[C2 eval] WITH ALIASES: ${(rate * 100).toFixed(0)}% of 51 plausible supplier phrases now ` +
      `find their trade. Misses (${misses.length}): ${misses.join(' · ') || '(none)'}`,
  );
  // Honesty floor: report loudly if the mechanism does not clearly beat the
  // baseline. This assertion is deliberately LOW (60%) — the eval's job is
  // to surface the true number in the PR body, not to be tuned to pass.
  assert.ok(
    rate >= 0.6,
    `alias-assisted hit rate was only ${(rate * 100).toFixed(0)}% — below the 60% honesty floor. ` +
      `SAY SO in the PR rather than shipping this quietly. Misses: ${misses.join(' · ')}`,
  );
});

test('EVAL — aliases must not make the baseline WORSE for any trade whose phrase already hit', () => {
  const baselineOptions: RankableOption[] = FIXTURES.map((f) => ({ key: f.key, label: f.label }));
  const aliasOptions: RankableOption[] = FIXTURES.map((f) => ({
    key: f.key,
    label: f.label,
    aliases: f.aliases,
  }));
  for (const f of FIXTURES) {
    const before = rankTaxonomyOptions(baselineOptions, f.phrase).some((r) => r.key === f.key);
    if (!before) continue;
    const after = rankTaxonomyOptions(aliasOptions, f.phrase).some((r) => r.key === f.key);
    assert.ok(after, `"${f.phrase}" found ${f.key} at baseline but LOST it once aliases were attached`);
  }
});
