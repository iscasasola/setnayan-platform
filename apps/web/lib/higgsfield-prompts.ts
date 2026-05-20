/**
 * Higgsfield prompt randomizer for the moodboard library.
 *
 * Per owner directive 2026-05-21: "we will create different samples from
 * higgsfield" + "in line to what needs to be created but in random
 * designs/ look. so we can just click generate and it will make one
 * everytime."
 *
 * Approach: each call to `generateRandomMoodboardPrompt()` picks a random
 * (asset_type × asset_subtype × stylistic variation) combination and
 * builds a Filipino-first prompt designed for clean color-range tagging
 * (solid hues in target regions, neutral elsewhere).
 *
 * Output is consumed by:
 *   - The admin "Generate" button on /admin/moodboard-library (shows the
 *     prompt + copies to clipboard; admin pastes into Higgsfield)
 *   - V1.x: a batch script that calls Higgsfield REST API directly +
 *     auto-uploads the result
 *
 * Library composition target per 0010 § "Library composition (target)":
 *   Filipino-first content — figures with Filipino features (mestizo,
 *   native, Chinese-Filipino across age + body type ranges) wearing
 *   typical Filipino-wedding guest attire. Venues span Filipino wedding
 *   contexts.
 */

export type AssetType = 'venue_scene' | 'figure_attire';

export type VenueSubtype = 'reception' | 'church' | 'cocktail';
export type FigureSubtype =
  | 'bride'
  | 'groom'
  | 'bridesmaid'
  | 'groomsman'
  | 'guest_female'
  | 'guest_male'
  | 'principal_sponsor_female'
  | 'principal_sponsor_male'
  | 'mother_of_bride'
  | 'mother_of_groom'
  | 'flower_girl'
  | 'ring_bearer';

export type AssetSubtype = VenueSubtype | FigureSubtype;

export type RandomMoodboardPrompt = {
  assetType: AssetType;
  assetSubtype: AssetSubtype;
  label: string;
  prompt: string;
  aspectRatio: '16:9' | '3:4';
  recommendedModel: 'soul_2' | 'nano_banana_pro';
  primaryAccentColor: string;
  primaryAccentRegion: string;
};

// ---- variation pools ----

const VENUE_RECEPTION_STYLES = [
  {
    setting: 'elegant Manila hotel ballroom',
    base: 'long banquet tables with crisp white tablecloths',
    feature: 'gold chiavari chairs and warm chandelier glow',
  },
  {
    setting: 'Tagaytay garden reception under string lights',
    base: 'rustic wooden tables with white linens',
    feature: 'cross-back wooden chairs and golden-hour glow',
  },
  {
    setting: 'Boracay beachside reception at twilight',
    base: 'long tables with sheer white linens on white sand',
    feature: 'driftwood chairs and tiki torch glow',
  },
  {
    setting: 'Batangas hacienda outdoor reception',
    base: 'long farm tables under capiz lanterns',
    feature: 'cane chairs and dusk lighting',
  },
  {
    setting: 'BGC industrial-loft reception',
    base: 'long communal tables with concrete floor underneath',
    feature: 'modern black metal chairs and pendant lights',
  },
];

const VENUE_CHURCH_STYLES = [
  {
    setting: 'San Agustin-style Catholic cathedral interior',
    base: 'long aisle with wooden pews',
    feature: 'tall stone columns and warm sconce lighting',
  },
  {
    setting: 'intimate provincial Catholic chapel',
    base: 'narrow aisle with white-cloth-draped wooden pews',
    feature: 'altar with capiz windows and candle glow',
  },
  {
    setting: 'modern non-denominational wedding chapel',
    base: 'minimalist aisle with light wood pews',
    feature: 'large clear-glass windows and natural daylight',
  },
];

const VENUE_COCKTAIL_STYLES = [
  {
    setting: 'rooftop cocktail hour overlooking Manila skyline at dusk',
    base: 'high-top round tables with white linens',
    feature: 'pendant string lights and city glow',
  },
  {
    setting: 'garden cocktail hour with lantern-lit pathways',
    base: 'scattered lounge furniture and high-top tables',
    feature: 'capiz lanterns and dappled twilight',
  },
];

const VENUE_ACCENTS = [
  { color: 'deep burgundy', region: 'drapery + table runners' },
  { color: 'dusty sage green', region: 'drapery + table runners' },
  { color: 'navy blue', region: 'drapery + table runners' },
  { color: 'blush pink', region: 'drapery + table runners' },
  { color: 'terracotta', region: 'drapery + table runners' },
  { color: 'emerald green', region: 'drapery + table runners' },
  { color: 'champagne gold', region: 'drapery + table runners' },
  { color: 'plum', region: 'drapery + table runners' },
];

// ---- figure variation pools ----

const FILIPINO_FEATURE_VARIANTS = [
  'mestizo Filipino features',
  'native Filipino features',
  'Chinese-Filipino features',
  'Spanish-Filipino mestizo features',
  'modern Manila urban Filipino features',
];

const FEMALE_GUEST_AGE_VARIANTS = [
  'in her late 20s',
  'in her early 30s',
  'in her mid 30s',
  'in her early 40s',
];

const MALE_GUEST_AGE_VARIANTS = [
  'in his late 20s',
  'in his early 30s',
  'in his mid 30s',
  'in his early 40s',
];

const FEMALE_GUEST_ATTIRE = [
  'a modern formal cocktail dress',
  'a long flowing evening gown',
  'a knee-length cocktail dress',
  'a modern Filipiniana dress with butterfly sleeves',
  'a traditional terno gown',
  'a chiffon midi cocktail dress',
];

const MALE_GUEST_ATTIRE = [
  'a barong tagalog over white slacks',
  'a modern fitted dark suit',
  'a navy blue three-piece suit',
  'an embroidered barong tagalog',
  'a charcoal grey modern suit',
];

const FIGURE_ACCENT_COLORS = [
  'emerald green',
  'deep burgundy',
  'navy blue',
  'blush pink',
  'dusty sage',
  'plum',
  'terracotta',
  'champagne',
  'royal blue',
  'forest green',
  'coral',
  'mustard yellow',
];

const BRIDE_GOWN_STYLES = [
  'an A-line wedding gown with subtle lace bodice',
  'a modern fitted mermaid wedding gown',
  'a ball gown wedding dress with full skirt',
  'a sheath silk wedding gown',
  'a modern Filipiniana wedding gown with butterfly sleeves',
];

const GROOM_ATTIRE_STYLES = [
  'a classic black tuxedo with bow tie',
  'a navy blue three-piece suit',
  'an embroidered white barong tagalog over white slacks',
  'a charcoal grey modern slim-fit suit',
  'a white tuxedo jacket with black trousers',
];

// ---- helpers ----

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const COMMON_TAIL =
  'professional event photography, photoreal, ultra detailed, sharp focus, ' +
  'the accent color regions are uniform solid tones with no patterns ' +
  '(for clean color isolation testing in the moodboard color range manipulator)';

const COMMON_PORTRAIT_TAIL =
  'photoreal full-body portrait, professional fashion photography, ' +
  'isolated subject on plain off-white studio background, ' +
  'natural confident pose, hands resting naturally, soft natural lighting, ' +
  'the outfit color is a single uniform solid tone for clean color isolation, ' +
  'ultra detailed, sharp focus, high quality';

// ---- main API ----

/**
 * Returns a fully populated random prompt for a moodboard library asset.
 * Each call randomizes type, subtype, accent color, and stylistic details.
 */
export function generateRandomMoodboardPrompt(): RandomMoodboardPrompt {
  // 60% venue, 40% figure — venues have richer color stories so they get
  // slightly more weight in the early library. Tunable.
  const assetType: AssetType = Math.random() < 0.6 ? 'venue_scene' : 'figure_attire';

  if (assetType === 'venue_scene') return randomVenuePrompt();
  return randomFigurePrompt();
}

function randomVenuePrompt(): RandomMoodboardPrompt {
  const subtype: VenueSubtype = pick(['reception', 'reception', 'reception', 'church', 'cocktail']);
  const accent = pick(VENUE_ACCENTS);

  let style;
  if (subtype === 'reception') style = pick(VENUE_RECEPTION_STYLES);
  else if (subtype === 'church') style = pick(VENUE_CHURCH_STYLES);
  else style = pick(VENUE_COCKTAIL_STYLES);

  const label = `${capitalize(accent.color)} ${subtype} · ${style.setting.split(' ').slice(0, 3).join(' ')}`;

  const prompt =
    `Wide-shot establishing photo of a Filipino wedding ${subtype} setup — ` +
    `${style.setting}, ${style.base}, vibrant solid ${accent.color} ${accent.region}, ` +
    `${style.feature}, no people in the shot, ${COMMON_TAIL}`;

  return {
    assetType: 'venue_scene',
    assetSubtype: subtype,
    label,
    prompt,
    aspectRatio: '16:9',
    recommendedModel: 'nano_banana_pro',
    primaryAccentColor: accent.color,
    primaryAccentRegion: accent.region,
  };
}

function randomFigurePrompt(): RandomMoodboardPrompt {
  // Within figure_attire, prioritize guests (most needed); other roles less often.
  const subtype: FigureSubtype = pick([
    'guest_female',
    'guest_female',
    'guest_female',
    'guest_male',
    'guest_male',
    'guest_male',
    'bridesmaid',
    'groomsman',
    'principal_sponsor_female',
    'principal_sponsor_male',
    'bride',
    'groom',
    'mother_of_bride',
    'mother_of_groom',
    'flower_girl',
    'ring_bearer',
  ]);

  const accent = pick(FIGURE_ACCENT_COLORS);
  const ethnicity = pick(FILIPINO_FEATURE_VARIANTS);

  let label: string;
  let prompt: string;

  switch (subtype) {
    case 'bride': {
      const gown = pick(BRIDE_GOWN_STYLES);
      label = `Filipino bride · ${gown.split(' ').slice(0, 4).join(' ')}`;
      prompt =
        `Photoreal full-body portrait of a Filipino bride in her late 20s with ${ethnicity}, ` +
        `wearing ${gown} in a uniform solid ivory tone, holding a small bouquet of white flowers, ` +
        `radiant smile, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'groom': {
      const attire = pick(GROOM_ATTIRE_STYLES);
      label = `Filipino groom · ${attire.split(' ').slice(0, 4).join(' ')}`;
      prompt =
        `Photoreal full-body portrait of a Filipino groom in his late 20s with ${ethnicity}, ` +
        `wearing ${attire} in a uniform solid tone, confident pose, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'bridesmaid': {
      const dress = pick(['a long chiffon bridesmaid dress', 'an A-line bridesmaid gown', 'a knee-length bridesmaid dress']);
      label = `Filipino bridesmaid · ${accent} ${dress.split(' ').slice(-3, -1).join(' ')}`;
      prompt =
        `Photoreal full-body portrait of a Filipino bridesmaid ${pick(FEMALE_GUEST_AGE_VARIANTS)} ` +
        `with ${ethnicity}, wearing ${dress} in a uniform solid ${accent} tone, ` +
        `holding a small bouquet, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'groomsman': {
      const attire = pick(['a fitted three-piece suit', 'a slim-fit dark suit', 'a barong tagalog']);
      label = `Filipino groomsman · ${attire.split(' ').slice(-2).join(' ')}`;
      prompt =
        `Photoreal full-body portrait of a Filipino groomsman ${pick(MALE_GUEST_AGE_VARIANTS)} ` +
        `with ${ethnicity}, wearing ${attire} in a uniform solid ${accent} tone (the jacket / barong is the accent), ` +
        `${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'guest_female': {
      const attire = pick(FEMALE_GUEST_ATTIRE);
      label = `Filipino female guest · ${accent} ${attire.split(' ').slice(-2).join(' ')}`;
      prompt =
        `Photoreal full-body portrait of a Filipino woman ${pick(FEMALE_GUEST_AGE_VARIANTS)} ` +
        `with ${ethnicity}, wearing ${attire} in a uniform solid ${accent} tone, ` +
        `warm friendly smile, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'guest_male': {
      const attire = pick(MALE_GUEST_ATTIRE);
      label = `Filipino male guest · ${accent} ${attire.split(' ').slice(0, 3).join(' ')}`;
      prompt =
        `Photoreal full-body portrait of a Filipino man ${pick(MALE_GUEST_AGE_VARIANTS)} ` +
        `with ${ethnicity}, wearing ${attire} in a uniform solid ${accent} tone (the jacket / barong is the accent), ` +
        `${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'principal_sponsor_female': {
      label = `Filipino principal sponsor (ninang) · ${accent}`;
      prompt =
        `Photoreal full-body portrait of a Filipino principal sponsor (ninang) in her late 50s ` +
        `with ${ethnicity}, wearing a traditional terno gown in a uniform solid ${accent} tone, ` +
        `dignified and elegant pose, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'principal_sponsor_male': {
      label = `Filipino principal sponsor (ninong) · ${accent}`;
      prompt =
        `Photoreal full-body portrait of a Filipino principal sponsor (ninong) in his late 50s ` +
        `with ${ethnicity}, wearing a formal embroidered barong tagalog in a uniform solid ${accent} tone, ` +
        `dignified pose, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'mother_of_bride':
    case 'mother_of_groom': {
      const role = subtype === 'mother_of_bride' ? 'mother of the bride' : 'mother of the groom';
      label = `Filipino ${role} · ${accent} terno`;
      prompt =
        `Photoreal full-body portrait of a Filipino ${role} in her late 50s ` +
        `with ${ethnicity}, wearing a modern terno gown in a uniform solid ${accent} tone, ` +
        `warm dignified pose, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'flower_girl': {
      label = `Filipino flower girl · ${accent}`;
      prompt =
        `Photoreal full-body portrait of a Filipino flower girl around 5-6 years old ` +
        `with ${ethnicity}, wearing a knee-length flower girl dress in a uniform solid ${accent} tone, ` +
        `holding a small basket of petals, sweet smile, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
    case 'ring_bearer': {
      label = `Filipino ring bearer · ${accent}`;
      prompt =
        `Photoreal full-body portrait of a Filipino ring bearer around 5-6 years old ` +
        `with ${ethnicity}, wearing a tiny fitted barong tagalog in a uniform solid ${accent} tone, ` +
        `holding a small pillow, sweet pose, ${COMMON_PORTRAIT_TAIL}`;
      break;
    }
  }

  return {
    assetType: 'figure_attire',
    assetSubtype: subtype,
    label,
    prompt,
    aspectRatio: '3:4',
    recommendedModel: 'soul_2',
    primaryAccentColor: accent,
    primaryAccentRegion: subtype.includes('guest') ? 'outfit' : `${subtype} attire`,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
