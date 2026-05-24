/**
 * Phase 0 Date Selection — positive-only auspicious-date library.
 *
 * Per CLAUDE.md 2026-05-22 owner directive: hosts pick their wedding date
 * through a guided flow whose entire emotional posture is positive-only.
 * The library NEVER tells the host "this date is bad." For sensitive
 * considerations (Holy Week, typhoon season, sukob with siblings, weekday
 * weddings, the 13th, etc.) it always finds a positive reframe.
 *
 * Architecture:
 *   - computeAuspiciousReasons(date, ceremonyType, meaningfulDates) returns
 *     an array of always-positive reason strings combining day-of-week,
 *     month, special-pattern matches (palindromes, holidays, solstices),
 *     ceremony-specific overlays, and resonance with the host's own
 *     meaningful dates.
 *   - suggestMeaningfulDates(meaningfulDates, ceremonyType, year) returns
 *     up to 5 date candidates for the "Help me pick a meaningful one"
 *     entry path — anchored around the host's honor/anniversary/birthday
 *     dates with positive day-of-week + month overlays.
 *
 * Brand voice rules per [[feedback_setnayan_no_dev_text_post_launch]]:
 * editorial restraint, no exclamation marks, no marketing jargon, mixed
 * EN/Tagalog texture allowed where it lands naturally. EN-only V1; TL/CEB
 * land V1.1 once the locale loader extends to data libraries.
 */

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type CeremonyType =
  | 'catholic'
  | 'civil'
  | 'inc'
  | 'christian'
  | 'muslim'
  | 'cultural'
  | 'mixed';

export type MeaningfulDateKind =
  | 'honor'
  | 'avoid'
  | 'anniversary'
  | 'birthday'
  | 'other';

export type MeaningfulDate = {
  date: string; // YYYY-MM-DD
  kind: MeaningfulDateKind;
  note?: string | null;
};

export type DateSuggestion = {
  /** YYYY-MM-DD */
  date: string;
  /** Always-positive headline */
  headline: string;
  /** 2-4 supporting reasons */
  reasons: string[];
};

// ----------------------------------------------------------------------------
// Day-of-week variant pools — 2026-05-24 owner directive: same day-of-week
// must NOT produce identical reasoning across two adjacent dates. Each day
// owns multiple framings; pick is deterministic from day-of-year so:
//   - same date → same reasons (no flicker on re-render)
//   - adjacent dates → different combinations (no "understudied" feeling)
// Variant 0 is the canonical headline copy that has shipped to date; new
// variants add Filipino-textured editorial framings that ladder beside it.
// ----------------------------------------------------------------------------

const DAY_OF_WEEK_VARIANTS: Record<number, ReadonlyArray<string>> = {
  // Sunday=0, Monday=1, ... Saturday=6
  0: [
    'Linggo — sacred and family-centered, with the highest attendance among older relatives',
    'Sunday weddings carry a soft Sabbath rhythm — the day is already turned toward devotion',
    'A Linggo ceremony catches the slow-Sunday pace · guests linger, conversations deepen',
    'Sunday afternoons fold golden light into outdoor portraits — quiet and unhurried',
    'Weekend capstone Linggo — guests get one last night together before flying home',
    'A Sunday wedding is gentle and unhurried — sermons and vows in the same emotional key',
  ],
  1: [
    'Lunes — the start of a new chapter, intimate weekday weddings have grown in popularity',
    'A Lunes ceremony cuts the work week open — your forever decision becomes the week\'s first one',
    'Off-peak Monday venues run at half capacity · the staff gives you their freshest attention',
    'Lunes weddings carry quiet conviction — every guest is there on purpose, not because of the calendar',
    'Pure-intent Lunes · no Saturday rush, no Sunday family-mass conflicts',
    'Monday weddings have grown into the bold modern choice — yours alone, on your own day',
  ],
  2: [
    'Martes ay tibay — strength and resilience for the couple',
    'Tuesday weddings settle into a steady mid-week mood · neither beginning nor weekend',
    'A Martes ceremony catches vendors at their freshest · the booking volume hasn\'t hit yet',
    'Pinoy tradition holds Tuesday as a day of building — the perfect tempo for foundations',
    'Off-cycle Martes · venues quiet, photographers attentive, every detail gets full focus',
    'Tuesday weddings feel like a secret · only the people who really matter make the trip',
  ],
  3: [
    'Mid-week balance — vendors often offer their best rates and quieter venues',
    'Miyerkules ceremonies live in the calendar\'s sweet spot · enough buildup, enough breathing room',
    'Hump-day weddings turn the dullest workday into the most-loved one · everyone needs the break',
    'A Wednesday ceremony catches vendors mid-stride · momentum without weekend overload',
    'Mid-week Miyerkules · the day everyone secretly waits for, made into a wedding',
    'Wednesday weddings have a quiet confidence — they don\'t need a weekend to feel big',
  ],
  4: [
    'Huwebes — favorite of European royal weddings, uncrowded venues at calmer pace',
    'Thursday ceremonies catch the rising weekend tide · Friday becomes the honeymoon\'s first morning',
    'Pre-Friday Huwebes · guests get a long weekend to rest, reminisce, and travel home',
    'A Thursday wedding feels like a soft countdown · the weekend is yours from sunset',
    'Royal-tradition Huwebes · Will and Kate picked this day for the same reason · uncrowded grace',
    'Huwebes weddings have a built-in afterglow · two recovery days before Monday returns',
  ],
  5: [
    'Biyernes evening — intimate and romantic, with the weekend ahead for guests to celebrate',
    'TGIF Biyernes · everyone arrives already in celebration mood, no workday weight left',
    'A Friday night ceremony catches the city slowing down · venue lights softer, hearts opening',
    'Biyernes weddings cut beautifully into a long weekend · guests linger, the celebration breathes',
    'Friday wedding magic — string lights, slow songs, no Monday to rush back to',
    'A Biyernes ceremony lets the after-party become a Saturday brunch · the weekend stretches',
  ],
  6: [
    'Sabado — the traditional Filipino wedding day, most-loved by families and guests alike',
    'Saturday weddings catch the day\'s full arc · midday ceremony, golden-hour portraits, evening reception',
    'Sabado · the classic for a reason · guests rested, venues at peak energy, no work tomorrow',
    'A Sabado ceremony gives families the full day · brunch with cousins, vows by sunset, dancing past midnight',
    'Wedding Saturday · the Philippines has honored this day for generations · you\'re joining a long lineage',
    'Sabado weddings carry a built-in afterparty · breakfast Sunday with family, then everyone flies home',
  ],
};

// ----------------------------------------------------------------------------
// Month variant pools — same per-date deterministic selection as day-of-week.
// Variant 0 is the canonical headline copy. The new variants thread different
// angles (cultural · weather · vendor calendar · emotional tone) so adjacent
// dates in the same month surface visibly different framings.
// ----------------------------------------------------------------------------

const MONTH_VARIANTS: Record<number, ReadonlyArray<string>> = {
  1: [
    'Bagong taon, bagong simula — fresh-start energy and a new beginning together',
    'January\'s cool clear air sharpens every photo · crisp light, longer evening receptions',
    'Enero ceremonies catch the year fully open · twelve months of marriage still ahead of you in this calendar',
    'Post-holiday January · guests rested, wallets refreshed, attendance peaks',
    'A January wedding becomes the year\'s first joyful headline — yours sets the tone',
  ],
  2: [
    'Buwan ng pag-ibig — romance is in the air, hearts full and open',
    'February evenings still hold the cool dry season · last comfortable outdoor reception window before summer',
    'Pebrero weddings carry Valentine\'s energy without the Feb-14 booking crush · all the romance, none of the rate spike',
    'Florists pour extra romance into February bouquets · the season\'s flowers are at their most generous',
    'A Pebrero ceremony lands inside love\'s own month · every detail reads as intentional',
  ],
  3: [
    'On the verge of summer — long sunset light makes for soft portraits',
    'Marso · transition month · the year stretches awake, photo skies at their clearest',
    'March weddings catch the last cool month before the summer celebration peak',
    'Pre-summer Marso · perfect outdoor reception weather, no rain to plan around',
    'A March ceremony feels poised at the edge of summer · momentum building, but the weather still gentle',
  ],
  4: [
    'Summer in full bloom — garden and beachside weddings shine in this season',
    'Abril weddings catch summer\'s sweet spot · vacation mode for everyone, schools out',
    'Pre-monsoon April · the year\'s peak Filipino wedding month for a reason · perfect light, perfect timing',
    'A summer-vacation Abril ceremony · destination weddings feel easy, everyone\'s already in beach mode',
    'April catches golden hour earlier · bridal portraits glow, ceremonies start in warm light',
  ],
  5: [
    'Flores de Mayo — floral abundance and the most colorful month',
    'Mayo ceremonies catch the year\'s warmth at its peak · classic Filipino summer wedding',
    'Late-summer May · last big sunshine month before the rains · vendors at their seasonal peak',
    'A Mayo wedding carries Flores de Mayo\'s floral legacy · the country is already in celebration rhythm',
    'May weddings feel celebratory by birthright · the fiesta month, made personal',
  ],
  6: [
    'June bride — the most celebrated wedding month worldwide',
    'Hunyo ceremonies join a centuries-old tradition · paper invitations, June bouquets, classic forever',
    'Early-rain Hunyo can be your friend · indoor receptions feel cozier, golden when it pours',
    'A June wedding lands in the world\'s most-romantic month · floral wreaths, soft fabrics, romantic forever',
    'Pre-school-year Hunyo · families gather before the school rhythms restart',
  ],
  7: [
    'Romantic showers — rain on a wedding is considered prosperity in many Filipino traditions',
    'Hulyo · the rainy-but-romantic month · indoor receptions glow softer when it pours',
    'July ceremonies have the most personal energy · only the people truly invited show up',
    'Mid-monsoon Hulyo · vendors aren\'t booked solid, every detail gets deep attention',
    'A July wedding feels like a brave bright spot in the rains · its own kind of beauty',
  ],
  8: [
    'Mid-year reset — refreshing breezes and softer vendor demand',
    'Late-monsoon Agosto · the rains often pause for the most photogenic afternoons',
    'August ceremonies catch the late-summer second wind · golden light, fewer crowds',
    'A Agosto wedding lands in the strong, steady month · vendors deliver, guests show up',
    'Pre-ber-month August · long buildup of anticipation before holiday season kicks in',
  ],
  9: [
    'Ber months begin — Christmas spirit on the horizon, joy already gathering',
    'Setyembre · the season of music · Pinoy Christmas songs begin to play across the country',
    'September weddings catch the year\'s mood lift · the calendar officially turns festive',
    'Cool-season Setyembre · the perfect outdoor reception weather returns after monsoon',
    'A September ceremony feels like the year\'s emotional second act · everything brightens',
  ],
  10: [
    'Crisp pre-holiday charm — photographer-favorite light and a calm atmosphere',
    'Oktubre · the autumn glow the Filipino calendar borrows · soft, warm, golden',
    'October ceremonies feel pre-holiday · families already in joy mode, but no Christmas chaos yet',
    'A Oktubre wedding catches the year\'s most photogenic light · cool dry mornings, warm evenings',
    'Mid-ber-month October · holiday energy building, vendors still flexible',
  ],
  11: [
    'Family-gathering season — everyone is in town and ready to celebrate',
    'Nobyembre · the warm-up to the holiday season · weddings here feel like the opening act',
    'November ceremonies catch the year\'s reflective light · softer, more inward, more sentimental',
    'A Nobyembre wedding honors All Saints meaning · family lineage, ancestor blessing, gratitude',
    'Late-ber-month November · the year winds down, hearts open wider',
  ],
  12: [
    'Wedding month of celebration — families are already in joy mode',
    'Disyembre · the year\'s most sentimental month · vows land harder, prayers sound deeper',
    'December ceremonies catch the warmth of every Christmas tradition · lanterns, parols, candles, songs',
    'Filipino Disyembre · families home from work and abroad · the biggest gathering season',
    'Year-end December · your wedding becomes the year\'s closing chapter · poetic timing, complete arc',
  ],
};

// ----------------------------------------------------------------------------
// Position-in-month flavor — adds a date-specific signal so first-week-of-
// month dates read different from end-of-month ones even when day-of-week +
// month match. Drives the "adjacent dates feel distinct" goal further.
// ----------------------------------------------------------------------------

function positionInMonthReason(date: Date): string | null {
  const day = date.getDate();
  if (day <= 7) {
    return 'Opening week of the month · invitations carry full lead time, vendors arrive fresh-energy';
  }
  if (day <= 14) {
    return 'Second-week pacing · the month is still wide-open, momentum just building';
  }
  if (day <= 21) {
    return 'Mid-month anchor · the calendar\'s most stable wedding slot, payroll cycles aligned for guests';
  }
  // 22 through end-of-month
  return 'Late-month timing · guests already in retrospective mood, the year-end energy lifts every toast';
}

/** Day-of-year (1-366) for the given date · stable in local TZ. Used as the
 *  variant-selection seed so the same date always picks the same variant
 *  pair AND adjacent dates pick different ones. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

// ----------------------------------------------------------------------------
// Numerology layer — 2026-05-24 owner directive: dates should also surface
// numerology, including for Catholic ceremonies (Filipino Catholic families
// commonly observe folk numerology alongside the sacrament · framed as
// CULTURAL overlay, not doctrinal).
//
// Math is classic Pythagorean numerology: digit-sum the date components,
// reduce to a single digit, EXCEPT the master numbers 11/22/33 which stay
// unreduced. Every reduced value has a positive framing — the library's
// positive-only rule still holds.
// ----------------------------------------------------------------------------

const NUMEROLOGY_MEANINGS: Record<number, string> = {
  1: 'Number 1 energy · leadership and fresh beginnings · the start of a new chapter, together',
  2: 'Number 2 · the partnership number · balance and harmony, made for vows',
  3: 'Number 3 · joy, creativity, expression · a celebration of voice and laughter',
  4: 'Number 4 · the foundation number · stability and security, a home being built',
  5: 'Number 5 · change and freedom · the adventure starts here',
  6: 'Number 6 · the family number · love, harmony, responsibility for each other',
  7: 'Number 7 · spirituality and intuition · the sacred witness of the day',
  8: 'Number 8 · abundance and achievement · prosperity flowing into the marriage',
  9: 'Number 9 · completion and compassion · old chapters closing, the new one wide open',
  11: 'Master number 11 · spiritual awakening and illumination · this date carries extra meaning',
  22: 'Master number 22 · the master builder · grand vision, lifelong foundation, this date carries quiet power',
  33: 'Master number 33 · the master teacher · compassion and healing, this date is rare and beloved',
};

function digitSum(s: string): number {
  let sum = 0;
  for (const c of s) {
    const n = Number(c);
    if (!Number.isNaN(n) && c >= '0' && c <= '9') sum += n;
  }
  return sum;
}

/** Reduce a positive integer to a single digit, except for the master
 *  numbers 11 / 22 / 33 which stay unreduced per classic Pythagorean
 *  numerology. */
function reduceToSingleOrMaster(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = digitSum(String(n));
  }
  return n;
}

/** Life-path number of the date · sum all digits of YYYYMMDD, reduce
 *  with master-number preservation. For 2026-12-18 → 2+0+2+6+1+2+1+8
 *  = 22 (master). */
function dateLifePath(date: Date): number {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return reduceToSingleOrMaster(digitSum(y + m + d));
}

/** Reduced day-of-month numerology · for 18 → 9. */
function dayNumber(date: Date): number {
  return reduceToSingleOrMaster(date.getDate());
}

/**
 * Returns numerology reasons for the date. Includes the life-path number
 * AND (when distinct) the day-of-month number. Adds a Filipino-Catholic
 * cultural note when ceremonyType === 'catholic' so the inclusion is
 * framed honestly as folk observance, not doctrine.
 */
function numerologyReasons(
  date: Date,
  ceremonyType: CeremonyType | null,
): string[] {
  const reasons: string[] = [];

  const lifePath = dateLifePath(date);
  const lifePathMeaning = NUMEROLOGY_MEANINGS[lifePath];
  if (lifePathMeaning) {
    reasons.push(`Life-path of your date · ${lifePathMeaning}`);
  }

  const dayN = dayNumber(date);
  // Only surface day-number when it adds new info (not just a duplicate
  // of the life-path reduction).
  if (dayN !== lifePath) {
    const dayMeaning = NUMEROLOGY_MEANINGS[dayN];
    if (dayMeaning) {
      reasons.push(`Day ${date.getDate()} resolves to ${dayN} · ${dayMeaning}`);
    }
  }

  // Filipino Catholic cultural overlay — honors both the sacrament and
  // the cultural overlay many Filipino families observe. Not claiming
  // Church doctrine.
  if (ceremonyType === 'catholic' && reasons.length > 0) {
    reasons.push(
      'Many Filipino Catholic families observe folk numerology alongside the sacrament · your date carries both layers',
    );
  }

  return reasons;
}

// ----------------------------------------------------------------------------
// Astrology layer — 2026-05-24 owner directive. Adds three computable
// celestial signals that surface alongside numerology:
//   1. Western zodiac (Sun sign) — by month-day boundary
//   2. Chinese year-of-the-X — by Gregorian year (12-year cycle, anchored
//      to a known reference year). Approximation: uses Jan 1 boundary
//      rather than the actual Lunar New Year boundary. Acceptable for V1.
//      Edge cases in Jan-Feb where the Lunar NY hasn't happened yet would
//      surface the previous year's animal in folk practice. V1.1 can swap
//      to a Lunar NY lookup table if precision is requested.
//   3. Lunar phase (new / waxing / full / waning) — Pythagorean lunar
//      math from a known reference new moon.
// True planetary alignment / ephemeris-grade astrology (Mercury retrograde,
// Saturn return, conjunctions) is out of V1 scope · those need ephemeris
// data the library doesn't have access to.
// ----------------------------------------------------------------------------

type ZodiacSign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

const ZODIAC_MEANINGS: Record<ZodiacSign, string> = {
  aries:
    'Aries season · courage, new beginnings, fire energy · weddings here carry bold momentum',
  taurus:
    'Taurus season · sensual beauty, comfort, lasting bonds · weddings here feel earthy and grounded',
  gemini:
    'Gemini season · joy, conversation, connection · weddings here are filled with laughter and stories',
  cancer:
    'Cancer season · home, family, deep care · weddings here center on belonging and warmth',
  leo:
    'Leo season · celebration, generosity, big love · weddings here radiate confidence',
  virgo:
    'Virgo season · care, attention, devotion · weddings here are crafted with intention to every detail',
  libra:
    'Libra season · balance, harmony, partnership · the marriage sign itself · weddings here feel inevitable',
  scorpio:
    'Scorpio season · depth, intensity, transformation · weddings here carry soul-deep meaning',
  sagittarius:
    'Sagittarius season · adventure, optimism, expansion · weddings here open a big journey ahead',
  capricorn:
    'Capricorn season · commitment, structure, legacy · weddings here are built to last generations',
  aquarius:
    'Aquarius season · innovation, friendship, vision · weddings here lead with originality and clarity',
  pisces:
    'Pisces season · imagination, deep love, soulful · weddings here feel poetic and dreamlike',
};

function westernZodiac(date: Date): ZodiacSign {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  // Standard Sun-sign boundaries (Western tropical zodiac).
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return 'aries';
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return 'taurus';
  if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return 'gemini';
  if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return 'cancer';
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return 'leo';
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return 'virgo';
  if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return 'libra';
  if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 'scorpio';
  if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 'sagittarius';
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return 'capricorn';
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return 'aquarius';
  return 'pisces'; // Feb 19 - Mar 20
}

type ChineseZodiacAnimal =
  | 'rat'
  | 'ox'
  | 'tiger'
  | 'rabbit'
  | 'dragon'
  | 'snake'
  | 'horse'
  | 'goat'
  | 'monkey'
  | 'rooster'
  | 'dog'
  | 'pig';

/** Year-of-the-X · 12-year cycle. 2020 = Rat (anchor). Approximation:
 *  uses Gregorian Jan 1 boundary, not the actual Lunar New Year.
 *  Acceptable for V1 wedding-date copy; V1.1 can refine. */
const CHINESE_ZODIAC_ORDER: ChineseZodiacAnimal[] = [
  'rat',
  'ox',
  'tiger',
  'rabbit',
  'dragon',
  'snake',
  'horse',
  'goat',
  'monkey',
  'rooster',
  'dog',
  'pig',
];

const CHINESE_ZODIAC_MEANINGS: Record<ChineseZodiacAnimal, string> = {
  rat: 'Year of the Rat · cleverness, prosperity, fresh resourcefulness · weddings here begin with abundance',
  ox: 'Year of the Ox · steadiness, dependable love, slow patient strength · weddings here build a lasting home',
  tiger:
    'Year of the Tiger · courage, vitality, fearless commitment · weddings here charge into a vivid future',
  rabbit:
    'Year of the Rabbit · gentleness, elegance, peaceful union · weddings here are tender and graceful',
  dragon:
    'Year of the Dragon · power, fortune, abundance · the most auspicious year for unions in Chinese tradition',
  snake:
    'Year of the Snake · wisdom, transformation, deep intuition · weddings here mark a thoughtful new chapter',
  horse:
    'Year of the Horse · freedom, passion, swift forward motion · weddings here gallop into adventure together',
  goat: 'Year of the Goat · gentleness, beauty, artistic harmony · weddings here are tender and full of grace',
  monkey:
    'Year of the Monkey · cleverness, joy, playful creativity · weddings here sparkle with laughter',
  rooster:
    'Year of the Rooster · confidence, honesty, generous celebration · weddings here are loud with love',
  dog: 'Year of the Dog · loyalty, devotion, family-first energy · weddings here center on steadfast love',
  pig: 'Year of the Pig · abundance, comfort, joyful generosity · weddings here are warm and lavish in spirit',
};

function chineseYear(date: Date): ChineseZodiacAnimal {
  // 2020 = Rat (index 0 in CHINESE_ZODIAC_ORDER)
  const year = date.getFullYear();
  const idx = ((year - 2020) % 12 + 12) % 12;
  return CHINESE_ZODIAC_ORDER[idx]!;
}

type LunarPhase = 'new' | 'waxing' | 'full' | 'waning';

const LUNAR_PHASE_MEANINGS: Record<LunarPhase, string> = {
  new: 'New moon energy · fresh starts and intention-setting · the perfect lunar timing for a vow',
  waxing:
    'Waxing moon · growth and momentum · energy building toward fullness · weddings here mark forward motion',
  full: 'Full moon · illumination and celebration · the most luminous lunar night for a ceremony',
  waning:
    'Waning moon · gratitude and settling in · weddings here carry quiet, completed energy',
};

/** Lunar phase classification via the canonical Pythagorean-lunar math:
 *  reference new moon at 2000-01-06 18:14 UTC, synodic month 29.530588853d.
 *  Returns 4-state phase (new/waxing/full/waning). Wide thresholds so each
 *  phase covers ~7 calendar days, giving adjacent dates SOME lunar variety
 *  but not flickering on every single day. */
function lunarPhase(date: Date): LunarPhase {
  const referenceNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const synodicMonthDays = 29.530588853;
  const daysSinceRef =
    (date.getTime() - referenceNewMoon) / (1000 * 60 * 60 * 24);
  const phasePos = ((daysSinceRef % synodicMonthDays) + synodicMonthDays) % synodicMonthDays;
  const fraction = phasePos / synodicMonthDays;
  // 0.00-0.06 + 0.94-1.00 = new (±2 day window around new moon)
  if (fraction < 0.06 || fraction > 0.94) return 'new';
  // 0.06-0.44 = waxing (~11 days)
  if (fraction < 0.44) return 'waxing';
  // 0.44-0.56 = full (±2 day window around full moon)
  if (fraction < 0.56) return 'full';
  // 0.56-0.94 = waning (~11 days)
  return 'waning';
}

/**
 * Returns astrology reasons for the date. Always includes Western zodiac
 * + Chinese year + lunar phase · they're computable from every date and
 * give the panel three more layers of meaning.
 */
function astrologyReasons(date: Date): string[] {
  const reasons: string[] = [];
  reasons.push(ZODIAC_MEANINGS[westernZodiac(date)]);
  reasons.push(CHINESE_ZODIAC_MEANINGS[chineseYear(date)]);
  reasons.push(LUNAR_PHASE_MEANINGS[lunarPhase(date)]);
  return reasons;
}

// ----------------------------------------------------------------------------
// Ceremony-specific overlays — surface relevant cultural touchpoints positively
// ----------------------------------------------------------------------------

/**
 * Returns a ceremony-specific positive overlay reason, when one applies for
 * this date. Examples: a Catholic wedding on a Saturday gets a note about
 * Saturday being the traditional sacrament day; a Muslim wedding on a Friday
 * (the day of Jumu'ah) gets a note about its spiritual weight.
 */
function ceremonyOverlay(date: Date, ceremonyType: CeremonyType | null): string | null {
  const dow = date.getDay(); // 0 = Sunday
  const month = date.getMonth() + 1;

  if (!ceremonyType) return null;

  if (ceremonyType === 'catholic') {
    if (dow === 6) {
      return 'Saturdays carry a long Catholic tradition of weddings — the parish calendar is built around them';
    }
    if (month === 5) {
      return 'Mary\'s month in Catholic tradition — a beautiful time to be wed under her patronage';
    }
    if (month === 10) {
      return 'October carries the rosary month tradition — a calm, prayerful season for sacrament';
    }
  }

  if (ceremonyType === 'civil') {
    // Civil weddings are flexible — most dates work; weekdays have a special quiet charm
    if (dow >= 1 && dow <= 4) {
      return 'A weekday civil ceremony is intimate and uncomplicated — beautiful in its simplicity';
    }
  }

  if (ceremonyType === 'inc') {
    if (dow === 4) {
      return 'Many INC weddings happen on Thursday evenings or weekends — your community will gather warmly';
    }
  }

  if (ceremonyType === 'christian') {
    if (dow === 0) {
      return 'A Sunday Christian wedding follows the Lord\'s Day rhythm — your congregation is already gathered in spirit';
    }
  }

  if (ceremonyType === 'muslim') {
    if (dow === 5) {
      return 'Biyernes carries the spiritual weight of Jumu\'ah — a deeply blessed day for the akad nikah';
    }
    if (dow === 6 || dow === 0) {
      return 'A weekend Muslim wedding gives families time to travel and stay for the walimah';
    }
  }

  if (ceremonyType === 'cultural') {
    // Cultural weddings often honor lunar / seasonal cues
    if (month === 1 || month === 2) {
      return 'A start-of-year cultural ceremony honors new-beginning traditions across Filipino tribes';
    }
    if (month === 11 || month === 12) {
      return 'A late-year cultural ceremony coincides with harvest and family-homecoming traditions';
    }
  }

  if (ceremonyType === 'mixed') {
    return 'A mixed-tradition wedding gives you the freedom to weave both your families\' rhythms together';
  }

  return null;
}

// ----------------------------------------------------------------------------
// Special-pattern matches — palindromes, holidays, symbolic dates
// ----------------------------------------------------------------------------

type SpecialPattern = {
  id: string;
  match: (date: Date) => boolean;
  reason: string;
};

function isPalindrome(date: Date): boolean {
  // MMDDYYYY palindrome check — e.g., 12/02/2021 (12022021 reversed = 12022021)
  // Also check MM/DD identical (12/12, 11/11)
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (m === d) return true;
  // Full digit palindrome of YYYYMMDD
  const ymd =
    String(date.getFullYear()) +
    String(m).padStart(2, '0') +
    String(d).padStart(2, '0');
  return ymd.split('').reverse().join('') === ymd;
}

const SPECIAL_PATTERNS: SpecialPattern[] = [
  {
    id: 'palindrome',
    match: isPalindrome,
    reason: 'A symmetrical date for a symmetrical union — easy for everyone to remember',
  },
  {
    id: 'valentines_week',
    match: (d) => d.getMonth() === 1 && d.getDate() >= 10 && d.getDate() <= 17,
    reason: 'Valentine\'s week glow — the whole week carries romance in the air',
  },
  {
    id: 'leap_day',
    match: (d) => d.getMonth() === 1 && d.getDate() === 29,
    reason: 'A leap-day wedding — your anniversary becomes a celebration every four years, and a tradition every year',
  },
  {
    id: 'fourteenth',
    match: (d) => d.getDate() === 14 && d.getMonth() === 1,
    reason: 'February 14 itself — the day of love',
  },
  {
    id: 'new_year_eve',
    match: (d) => d.getMonth() === 11 && d.getDate() === 31,
    reason: 'Year-end wedding — start the next year as a married couple',
  },
  {
    id: 'first_of_year',
    match: (d) => d.getMonth() === 0 && d.getDate() === 1,
    reason: 'New Year\'s Day — the freshest possible start to married life',
  },
  {
    id: 'rizal_day',
    match: (d) => d.getMonth() === 11 && d.getDate() === 30,
    reason: 'Rizal Day — a holiday weekend means guests have time to travel',
  },
  {
    id: 'independence_week',
    match: (d) => d.getMonth() === 5 && d.getDate() === 12,
    reason: 'Independence Day — a holiday weekend gives guests the time to celebrate fully',
  },
  {
    id: 'all_saints',
    match: (d) => d.getMonth() === 10 && d.getDate() === 1,
    reason: 'All Saints Day — family is already gathered for the holiday',
  },
  {
    id: 'spring_equinox',
    match: (d) => d.getMonth() === 2 && d.getDate() === 20,
    reason: 'Spring equinox — balance of day and night, a symbolic threshold',
  },
  {
    id: 'summer_solstice',
    match: (d) => d.getMonth() === 5 && d.getDate() === 21,
    reason: 'Summer solstice — the longest day of the year, the most light for portraits',
  },
];

// ----------------------------------------------------------------------------
// Sensitive reframes — turn potential negatives into positives
// ----------------------------------------------------------------------------

function sensitiveReframes(date: Date, ceremonyType: CeremonyType | null): string[] {
  const reasons: string[] = [];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = date.getDay();

  // Holy Week-ish window (broadly March-April for the moveable feast) —
  // reframe as honoring the Catholic family rhythm.
  if (ceremonyType === 'catholic' && (month === 3 || month === 4)) {
    reasons.push(
      'Many Catholic families celebrate around Holy Week — your ceremony can honor that rhythm beautifully',
    );
  }

  // Rainy / typhoon-ish months (June–November) — reframe.
  if (month >= 6 && month <= 11) {
    reasons.push(
      'Afternoon showers usually clear by evening — an indoor backup gives peace of mind, and rain on a wedding is prosperity in Filipino tradition',
    );
  }

  // 13th — reframe.
  if (day === 13) {
    reasons.push(
      'The 13th has become a quiet favorite among modern couples — uncommon, memorable, and yours alone',
    );
  }

  // Weekday — already covered in day-of-week positive, but add a budget angle.
  if (dow >= 1 && dow <= 4) {
    reasons.push(
      'Weekday weddings often unlock the best vendor rates and the calmest venues — your budget stretches further',
    );
  }

  return reasons;
}

// ----------------------------------------------------------------------------
// Meaningful-date resonance — surface positive matches with host's own dates
// ----------------------------------------------------------------------------

function meaningfulDateResonance(date: Date, meaningfulDates: MeaningfulDate[]): string[] {
  const reasons: string[] = [];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const ymd = `${date.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  for (const md of meaningfulDates) {
    if (md.kind === 'avoid') continue; // never surface avoid dates positively
    const [, mdMonth, mdDay] = md.date.split('-').map(Number);
    if (!mdMonth || !mdDay) continue;

    // Exact day match
    if (mdMonth === month && mdDay === day) {
      const noteSuffix = md.note ? ` — ${md.note}` : '';
      if (md.kind === 'birthday') {
        reasons.push(`Shares a birthday with someone meaningful to you${noteSuffix}`);
      } else if (md.kind === 'anniversary') {
        reasons.push(`Lands on the anniversary you wanted to honor${noteSuffix}`);
      } else if (md.kind === 'honor') {
        reasons.push(`Honors a date you flagged as meaningful${noteSuffix}`);
      } else {
        reasons.push(`Resonates with a date close to your heart${noteSuffix}`);
      }
    } else if (mdMonth === month) {
      // Same month — softer resonance
      const noteSuffix = md.note ? ` (${md.note})` : '';
      if (md.kind === 'birthday') {
        reasons.push(`Same month as a birthday meaningful to you${noteSuffix}`);
      } else if (md.kind === 'anniversary') {
        reasons.push(`Same month as an anniversary you wanted to honor${noteSuffix}`);
      } else if (md.kind === 'honor') {
        reasons.push(`Falls in the month you flagged as meaningful${noteSuffix}`);
      }
    }
  }

  return reasons;
}

// ----------------------------------------------------------------------------
// Main: compute all positive reasons for a given date
// ----------------------------------------------------------------------------

/**
 * Returns a deduplicated array of always-positive reasons for the given
 * date. Combines day-of-week + month + special patterns + ceremony overlay
 * + sensitive reframes + meaningful-date resonance. Never returns an empty
 * array — at minimum the day-of-week + month reasons surface, so any date
 * the host picks gets a warm reception.
 *
 * Order: meaningful-date resonance first (most personal), then ceremony
 * overlay (most specific cultural context), then special patterns
 * (uncommon delight), then day-of-week + month (always-applicable
 * baseline), then sensitive reframes (proactive reframing of common
 * Filipino-wedding concerns).
 *
 * Caller passes `meaningfulDates` array (can be empty). Library is pure —
 * no DB access, no side effects.
 */
/** Categorized group of reasons · drives the inline "Learn more about
 *  this date" expander in Card 01. Order is the surface order: personal
 *  first (most specific to host), numerology second (date-unique math),
 *  ceremony notes third (specific cultural context), special patterns
 *  fourth (uncommon delight), cultural fifth (always-applicable
 *  baseline), practical last (proactive reframes of common concerns). */
export type AuspiciousReasonCategory =
  | 'personal'
  | 'numerology'
  | 'astrology'
  | 'ceremony'
  | 'special_pattern'
  | 'cultural'
  | 'practical';

export type AuspiciousReasonGroup = {
  category: AuspiciousReasonCategory;
  /** Brand-voice section heading shown above the reasons in the
   *  "Learn more" expander · keep short, editorial restraint. */
  label: string;
  reasons: string[];
};

/**
 * Returns reasons GROUPED by category. Drives the Card 01 inline "Learn
 * more about this date" expander · also feeds the legacy flat-array
 * `computeAuspiciousReasons` below (kept for backwards compat with the
 * server action + /date-selection page).
 *
 * Empty-category groups are filtered out so consumers don't render
 * empty section headers.
 */
export function computeAuspiciousReasonsDetailed(
  date: Date,
  ceremonyType: CeremonyType | null,
  meaningfulDates: MeaningfulDate[] = [],
): AuspiciousReasonGroup[] {
  const groups: AuspiciousReasonGroup[] = [];

  // 1. Personal resonance (only when host flagged dates)
  const personal = meaningfulDateResonance(date, meaningfulDates);
  if (personal.length > 0) {
    groups.push({
      category: 'personal',
      label: 'Personal resonance',
      reasons: personal,
    });
  }

  // 2. Numerology (always present)
  const numerology = numerologyReasons(date, ceremonyType);
  if (numerology.length > 0) {
    groups.push({
      category: 'numerology',
      label: 'Numerology',
      reasons: numerology,
    });
  }

  // 3. Astrology (always present · Western zodiac + Chinese year + lunar phase)
  const astrology = astrologyReasons(date);
  if (astrology.length > 0) {
    groups.push({
      category: 'astrology',
      label: 'Astrology · stars & moon',
      reasons: astrology,
    });
  }

  // 4. Ceremony notes (only when ceremonyType + an applicable overlay)
  const ceremony: string[] = [];
  const overlay = ceremonyOverlay(date, ceremonyType);
  if (overlay) ceremony.push(overlay);
  if (ceremony.length > 0) {
    groups.push({
      category: 'ceremony',
      label: 'Ceremony notes',
      reasons: ceremony,
    });
  }

  // 5. Special patterns (palindromes, holidays, equinoxes)
  const patterns: string[] = [];
  for (const pattern of SPECIAL_PATTERNS) {
    if (pattern.match(date)) patterns.push(pattern.reason);
  }
  if (patterns.length > 0) {
    groups.push({
      category: 'special_pattern',
      label: 'Special patterns',
      reasons: patterns,
    });
  }

  // 6. Cultural meaning (day-of-week + month variants + position-in-month).
  //    Variants per day-of-week + per month are deterministically indexed
  //    by day-of-year so same date → same picks AND adjacent dates pick
  //    different combinations. +3 prime offset on month so the two
  //    selections advance independently.
  const cultural: string[] = [];
  const doy = dayOfYear(date);
  const dowVariants = DAY_OF_WEEK_VARIANTS[date.getDay()];
  if (dowVariants && dowVariants.length > 0) {
    const dowReason = dowVariants[doy % dowVariants.length];
    if (dowReason) cultural.push(dowReason);
  }
  const monthVariants = MONTH_VARIANTS[date.getMonth() + 1];
  if (monthVariants && monthVariants.length > 0) {
    const monthReason = monthVariants[(doy + 3) % monthVariants.length];
    if (monthReason) cultural.push(monthReason);
  }
  const positionReason = positionInMonthReason(date);
  if (positionReason) cultural.push(positionReason);
  if (cultural.length > 0) {
    groups.push({
      category: 'cultural',
      label: 'Cultural meaning',
      reasons: cultural,
    });
  }

  // 7. Practical reframes (sensitive concerns turned positive)
  const practical = sensitiveReframes(date, ceremonyType);
  if (practical.length > 0) {
    groups.push({
      category: 'practical',
      label: 'Practical notes',
      reasons: practical,
    });
  }

  return groups;
}

/**
 * Backwards-compat flat-array entry point. Returns deduplicated reasons
 * in the same surface order as the grouped function. Callers that only
 * want a flat list (server action, /date-selection page, legacy
 * AuspiciousChip) stay on this signature; callers that want the grouped
 * structure (Card 01 wizard's Learn-more expander) read the new
 * `computeAuspiciousReasonsDetailed` directly.
 */
export function computeAuspiciousReasons(
  date: Date,
  ceremonyType: CeremonyType | null,
  meaningfulDates: MeaningfulDate[] = [],
): string[] {
  const groups = computeAuspiciousReasonsDetailed(date, ceremonyType, meaningfulDates);
  const flat: string[] = [];
  for (const g of groups) {
    for (const r of g.reasons) flat.push(r);
  }
  // Deduplicate while preserving order
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const r of flat) {
    if (!seen.has(r)) {
      seen.add(r);
      deduped.push(r);
    }
  }
  return deduped;
}

// ----------------------------------------------------------------------------
// Suggested dates — for the "Help me pick a meaningful one" entry path
// ----------------------------------------------------------------------------

/**
 * Returns up to 5 date suggestions for the guided picker flow. Strategy:
 *   1. If the host flagged honor / anniversary / birthday dates, anchor
 *      suggestions on those dates (this year or next year).
 *   2. Fill remaining slots with high-resonance fallbacks for the host's
 *      ceremony type: Saturdays in Mary's month / Mar / Oct for Catholic,
 *      weekday quiet days for Civil, Fridays for Muslim, Sundays for
 *      Christian, etc.
 *   3. Ensure all candidates are in the future (not in the past).
 *   4. Avoid any "avoid"-flagged date OR same-month-as-avoid by default
 *      (the host can still pick anything in the calendar step).
 *
 * Returns suggestions sorted by reason-count desc (most resonant first).
 */
export function suggestMeaningfulDates(
  meaningfulDates: MeaningfulDate[],
  ceremonyType: CeremonyType | null,
  baseYear: number = new Date().getFullYear() + 1,
): DateSuggestion[] {
  const suggestions: DateSuggestion[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Set of YYYY-MM-DD strings to skip (exact avoid dates).
  const avoidExact = new Set(
    meaningfulDates.filter((m) => m.kind === 'avoid').map((m) => m.date),
  );
  // Set of MM strings to penalize (avoid months) — soft avoidance.
  const avoidMonths = new Set(
    meaningfulDates
      .filter((m) => m.kind === 'avoid')
      .map((m) => m.date.split('-')[1])
      .filter(Boolean) as string[],
  );

  function pushIfValid(date: Date) {
    if (date.getTime() < today.getTime()) return;
    const ymd = formatYMD(date);
    if (avoidExact.has(ymd)) return;
    if (suggestions.some((s) => s.date === ymd)) return; // dedupe by date

    const reasons = computeAuspiciousReasons(date, ceremonyType, meaningfulDates);
    if (reasons.length === 0) return;

    // Build headline from the most personal/specific reason available.
    const headline = pickHeadline(reasons);

    // Soft-deprioritize avoid-month suggestions: still surface them, but
    // they sort below others when reason counts tie.
    const inAvoidMonth = avoidMonths.has(String(date.getMonth() + 1).padStart(2, '0'));
    if (inAvoidMonth && suggestions.length >= 5) return;

    suggestions.push({
      date: ymd,
      headline,
      reasons: reasons.slice(0, 4), // cap at 4 supporting lines
    });
  }

  // 1. Anchor on honor / anniversary / birthday dates this year + next year
  for (const md of meaningfulDates) {
    if (md.kind === 'avoid') continue;
    const [, monthStr, dayStr] = md.date.split('-');
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!month || !day) continue;

    // This year + next year
    for (const year of [baseYear, baseYear + 1]) {
      const cand = new Date(year, month - 1, day);
      // Sanity check — JS Date will quietly normalize Feb 30 etc.
      if (cand.getMonth() === month - 1 && cand.getDate() === day) {
        pushIfValid(cand);
      }
    }
  }

  // 2. Ceremony-specific high-resonance fallbacks
  const fallbacks: Date[] = [];
  for (const yearOffset of [0, 1]) {
    const year = baseYear + yearOffset;

    if (ceremonyType === 'catholic' || ceremonyType === null) {
      // First Saturday of May (Mary's month)
      fallbacks.push(firstWeekdayOf(year, 4, 6));
      // First Saturday of October (Rosary month)
      fallbacks.push(firstWeekdayOf(year, 9, 6));
      // Second Saturday of December
      fallbacks.push(nthWeekdayOf(year, 11, 6, 2));
    }
    if (ceremonyType === 'civil') {
      // Quiet weekday: second Tuesday of February
      fallbacks.push(nthWeekdayOf(year, 1, 2, 2));
      // Second Wednesday of October
      fallbacks.push(nthWeekdayOf(year, 9, 3, 2));
    }
    if (ceremonyType === 'muslim') {
      // First Friday of Shawwal-equivalent (approximate: May)
      fallbacks.push(firstWeekdayOf(year, 4, 5));
      // First Friday of November
      fallbacks.push(firstWeekdayOf(year, 10, 5));
    }
    if (ceremonyType === 'inc' || ceremonyType === 'christian') {
      // Saturday wedding favored in both
      fallbacks.push(firstWeekdayOf(year, 4, 6));
      fallbacks.push(firstWeekdayOf(year, 10, 6));
    }
    if (ceremonyType === 'cultural' || ceremonyType === 'mixed') {
      // Family-gathering season
      fallbacks.push(firstWeekdayOf(year, 10, 6));
      fallbacks.push(firstWeekdayOf(year, 11, 6));
    }
    // Universal: First Saturday of June (June bride)
    fallbacks.push(firstWeekdayOf(year, 5, 6));
  }

  for (const f of fallbacks) {
    if (suggestions.length >= 8) break;
    pushIfValid(f);
  }

  // Sort by reason-count desc, then by date asc (closer first when tied)
  suggestions.sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) {
      return b.reasons.length - a.reasons.length;
    }
    return a.date.localeCompare(b.date);
  });

  return suggestions.slice(0, 5);
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the first occurrence of `weekday` (0=Sun..6=Sat) in the given
 * 0-indexed month of the given year.
 */
function firstWeekdayOf(year: number, monthZeroIndexed: number, weekday: number): Date {
  const d = new Date(year, monthZeroIndexed, 1);
  const offset = (weekday - d.getDay() + 7) % 7;
  d.setDate(1 + offset);
  return d;
}

/**
 * Returns the nth occurrence (1-indexed) of `weekday` in the given month.
 */
function nthWeekdayOf(
  year: number,
  monthZeroIndexed: number,
  weekday: number,
  n: number,
): Date {
  const first = firstWeekdayOf(year, monthZeroIndexed, weekday);
  const result = new Date(first);
  result.setDate(first.getDate() + (n - 1) * 7);
  return result;
}

/**
 * Picks the headline for a suggestion — first looks for a personal-meaning
 * line, then a special pattern, then falls back to the first reason. Keeps
 * suggestions feeling tailored without inventing copy.
 */
function pickHeadline(reasons: string[]): string {
  const personalSignals = [
    'shares a birthday',
    'lands on the anniversary',
    'honors a date',
    'resonates with a date',
    'same month as',
    'falls in the month',
  ];
  for (const r of reasons) {
    const lower = r.toLowerCase();
    if (personalSignals.some((p) => lower.includes(p))) {
      return r;
    }
  }
  // Special pattern signals
  const patternSignals = ['palindrome', 'symmetrical', 'leap-day', 'valentine', 'solstice', 'equinox'];
  for (const r of reasons) {
    const lower = r.toLowerCase();
    if (patternSignals.some((p) => lower.includes(p))) {
      return r;
    }
  }
  return reasons[0] ?? '';
}

/**
 * Day-of-week label for compact UI surfaces (auspicious chip subtitle, etc.)
 */
export function dayOfWeekLabel(date: Date): string {
  const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return labels[date.getDay()] ?? '';
}

/**
 * Pretty-print a YYYY-MM-DD string as "Friday, August 15, 2027".
 * Local-timezone safe: parses parts manually to avoid Date timezone drift.
 */
export function formatAuspiciousDate(ymd: string): string {
  const [yearStr, monthStr, dayStr] = ymd.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return ymd;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
