/**
 * Category-aware timeline lens — Vendor Portal data-link program ①
 * (corpus 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 1).
 *
 * Deterministic, rule-based relevance for the shared day-of timeline: which
 * blocks matter to a caterer vs a DJ vs a florist. A LENS, never a gate —
 * booked vendors keep full-timeline visibility (locked D2); this only ranks
 * and highlights. Pure TypeScript, no inference, shared by the vendor Brief
 * page and the .ics feed so both consume one rule base.
 */

export type TimelineRelevance = 'primary' | 'supporting' | 'context';

export type LensBlock = {
  label: string;
  block_type: string;
  start_at: string | null;
};

/** Categories that are on point for the whole event day. */
const ALWAYS_PRIMARY = new Set(['planner_coordinator', 'venue']);

/**
 * schedule_block_type × event_vendors.category → relevance. Static data, not
 * code — candidate for a taxonomy-driven table later (categories-DB-driven
 * rule), but V1 ships the map inline next to its only two consumers.
 */
const RELEVANCE_MAP: Record<string, { primary: string[]; supporting: string[] }> = {
  pre_ceremony: {
    primary: ['makeup_artist', 'hair_stylist', 'photographer', 'videographer'],
    supporting: ['florist', 'transportation', 'gown_designer', 'suit_designer'],
  },
  ceremony: {
    primary: ['officiant', 'church_fees', 'string_quartet', 'choir', 'florist', 'photographer', 'videographer'],
    supporting: ['transportation', 'rings', 'lights_and_sound'],
  },
  cocktails: {
    primary: ['catering', 'mobile_bar', 'string_quartet', 'photobooth'],
    supporting: ['photographer', 'videographer', 'band_dj'],
  },
  reception: {
    primary: ['reception_decor', 'lights_and_sound', 'led_screens'],
    supporting: ['catering', 'florist', 'photobooth', 'security'],
  },
  dinner: {
    primary: ['catering', 'cake_maker', 'mobile_bar'],
    supporting: ['host_emcee', 'photographer', 'videographer'],
  },
  program: {
    primary: ['host_emcee', 'band_dj', 'string_quartet', 'choir', 'lights_and_sound', 'led_screens'],
    supporting: ['photographer', 'videographer', 'photobooth'],
  },
  dancing: {
    primary: ['band_dj', 'lights_and_sound'],
    supporting: ['photographer', 'videographer', 'mobile_bar'],
  },
  send_off: {
    primary: ['transportation', 'photographer'],
    supporting: ['videographer', 'security', 'gifts_and_giveaways'],
  },
  after_party: {
    primary: ['band_dj', 'mobile_bar'],
    supporting: ['lights_and_sound', 'security'],
  },
};

/**
 * `custom` blocks carry no type signal — classify the LABEL with a static
 * keyword table (first match wins), then resolve the matched theme exactly
 * like a typed block. Plain regex; admits no match → 'context'.
 */
const CUSTOM_THEMES: { pattern: RegExp; primary: string[]; supporting: string[] }[] = [
  {
    pattern: /(cake|dessert)/i,
    primary: ['cake_maker', 'catering'],
    supporting: ['photographer', 'videographer'],
  },
  {
    pattern: /(dinner|lunch|breakfast|brunch|buffet|merienda|cocktail|canap|salu-?salo|kain|feast|food)/i,
    primary: ['catering', 'mobile_bar'],
    supporting: ['cake_maker', 'host_emcee'],
  },
  {
    pattern: /(first dance|dance|band|set ?list|dj\b|sound ?check|performance|serenade|harana|prod(uction)? number|song)/i,
    primary: ['band_dj', 'string_quartet', 'choir', 'lights_and_sound'],
    supporting: ['photographer', 'videographer', 'host_emcee'],
  },
  {
    pattern: /(photo|video|sde|same.?day|shoot|portrait)/i,
    primary: ['photographer', 'videographer'],
    supporting: ['makeup_artist', 'hair_stylist'],
  },
  {
    pattern: /(prep|makeup|hair|getting ready|robe)/i,
    primary: ['makeup_artist', 'hair_stylist'],
    supporting: ['photographer', 'videographer'],
  },
  {
    pattern: /(processional|vows|rites|mass|misa|unity|candle|veil|cord)/i,
    primary: ['officiant', 'church_fees', 'string_quartet', 'choir'],
    supporting: ['florist', 'photographer', 'videographer'],
  },
  {
    pattern: /(ingress|setup|set-?up|styling|decor)/i,
    primary: ['reception_decor', 'florist', 'lights_and_sound', 'led_screens', 'catering'],
    supporting: ['photobooth', 'mobile_bar'],
  },
  {
    pattern: /(toast|speech|program)/i,
    primary: ['host_emcee'],
    supporting: ['band_dj', 'photographer', 'videographer'],
  },
];

function resolve(
  rule: { primary: string[]; supporting: string[] } | undefined,
  categories: string[],
): TimelineRelevance {
  if (!rule) return 'context';
  if (categories.some((c) => rule.primary.includes(c))) return 'primary';
  if (categories.some((c) => rule.supporting.includes(c))) return 'supporting';
  return 'context';
}

/** Relevance of one block for a vendor org's booked categories. */
export function blockRelevance(block: LensBlock, bookedCategories: string[]): TimelineRelevance {
  if (bookedCategories.some((c) => ALWAYS_PRIMARY.has(c))) return 'primary';
  if (block.block_type === 'custom') {
    const theme = CUSTOM_THEMES.find((t) => t.pattern.test(block.label));
    return resolve(theme, bookedCategories);
  }
  return resolve(RELEVANCE_MAP[block.block_type], bookedCategories);
}

/**
 * Setup lead per category (minutes before the earliest primary slot). Static
 * trade norms — the output is always phrased as a SUGGESTION the vendor
 * confirms with the couple via the existing Suggest flow, never a write.
 */
const SETUP_LEAD_MINUTES: Record<string, number> = {
  catering: 180,
  reception_decor: 180,
  lights_and_sound: 150,
  led_screens: 150,
  florist: 120,
  mobile_bar: 120,
  photobooth: 90,
  band_dj: 90,
  cake_maker: 60,
  string_quartet: 60,
  choir: 60,
  security: 60,
  photographer: 30,
  videographer: 30,
  host_emcee: 30,
  transportation: 30,
};

export type CallTimeSuggestion = {
  /** ISO timestamp of the suggested arrival/setup start. */
  call_time: string;
  /** The earliest primary block the lead time was derived from. */
  anchor_label: string;
  anchor_start_at: string;
  lead_minutes: number;
  category: string;
};

/**
 * Earliest primary slot minus the category's setup lead. Null when the org
 * has no timed primary slot or no category with a known lead (venue and
 * coordinators are on site regardless — no call time for them).
 */
export function deriveCallTime(
  blocks: LensBlock[],
  bookedCategories: string[],
): CallTimeSuggestion | null {
  const top = bookedCategories
    .map((category) => ({ category, lead: SETUP_LEAD_MINUTES[category] }))
    .filter((x): x is { category: string; lead: number } => x.lead !== undefined)
    .sort((a, b) => b.lead - a.lead)[0];
  if (!top) return null;

  const anchor = blocks
    .filter((b) => b.start_at && blockRelevance(b, bookedCategories) === 'primary')
    .sort((a, b) => (a.start_at as string).localeCompare(b.start_at as string))[0];
  if (!anchor?.start_at) return null;

  return {
    call_time: new Date(new Date(anchor.start_at).getTime() - top.lead * 60_000).toISOString(),
    anchor_label: anchor.label,
    anchor_start_at: anchor.start_at,
    lead_minutes: top.lead,
    category: top.category,
  };
}
