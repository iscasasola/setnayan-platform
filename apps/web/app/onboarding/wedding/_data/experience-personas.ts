/**
 * experience-personas.ts — the onboarding EXPERIENCE QUIZ data + resolver (iteration
 * 0016 · the experience-first reorientation, owner 2026-06-21).
 *
 * THE MODEL. The onboarding's old job was "assess which vendors the couple needs."
 * The new job is "understand the EXPERIENCE the couple wants to create" — memorable
 * for themselves, their guests, or both — and let THAT derive everything. A short
 * 5-axis quiz resolves to a named persona; the persona derives:
 *   • picks       — the vendor CATEGORIES to line up (PICK_GROUPS keys)
 *   • services    — the in-app Setnayan SERVICES to surface (INAPP_KEYS)
 *   • feel        — the palette FEELS key (→ events.mood_feel_key + basic_moodboard)
 *   • refinements — per-leaf STYLE seeds (→ style_preferences.refinements, which the
 *                   deterministic matcher's 30% Refinement dimension already consumes)
 *
 * DETERMINISTIC by design — no LLM. resolvePersona() is a weighted overlap score
 * (for_whom dominates); derivePlanFromPersona() is pure data + an effort-based
 * breadth modifier. Same answers → same plan, always.
 *
 * ADMIN-TUNABLE shape: personas/axes are plain data (no logic baked into copy), so
 * a later admin surface can edit names/copy/mappings without touching the engine —
 * consistent with the "prices/menus/event-types are admin-driven" rule. V1 ships the
 * seed set here; the resolver reads whatever EXP_PERSONAS holds.
 *
 * KEY VALIDITY (load-bearing — verified against onboarding-shell.tsx):
 *   • picks/extras keys      → PICK_GROUPS_FALLBACK `cat` values
 *   • services keys          → INAPP_KEYS
 *   • feel keys              → FEELS keys (timeless/modern/boho/rustic/glam/royalty/filipiniana)
 *   • refinement option keys → the refinements.ts option `key`s (the pv_ / cuisine_ keys
 *     for the projectable leaves; key===label otherwise)
 */

/** The 5 quiz axes. for_whom is the headline (genuinely-new) axis. */
export type ExpAxisId = 'for_whom' | 'feel' | 'energy' | 'roots' | 'effort';
export type ExpForWhom = 'couple' | 'guests' | 'both';
export type ExpAxisAnswers = Partial<Record<ExpAxisId, string>>;

export type ExpOption = {
  /** Stored answer key (rides events.experience_axes). */
  key: string;
  title: string;
  desc: string;
};
export type ExpAxis = {
  id: ExpAxisId;
  eyebrow: string;
  question: string;
  sub: string;
  options: ExpOption[];
};

export const EXP_AXES: ExpAxis[] = [
  {
    id: 'for_whom',
    eyebrow: 'Your experience',
    question: 'What would make the day unforgettable?',
    sub: 'There’s no wrong answer — it just tells us where to focus.',
    options: [
      { key: 'couple', title: 'Our private memory', desc: 'A day we’ll relive forever — the film, the song, the keepsakes.' },
      { key: 'guests', title: 'Our guests’ experience', desc: 'Everyone leaves saying it was the best wedding they’ve been to.' },
      { key: 'both', title: 'Both, equally', desc: 'A day we treasure and our guests never forget.' },
    ],
  },
  {
    id: 'feel',
    eyebrow: 'The scale',
    question: 'How big does it feel?',
    sub: 'The mood you want the moment you walk in.',
    options: [
      { key: 'intimate', title: 'Intimate & personal', desc: 'Closest family and dearest friends — warm and unhurried.' },
      { key: 'midsize', title: 'Mid-size & warm', desc: 'A full room of the people you love, still personal.' },
      { key: 'grand', title: 'Grand & full-house', desc: 'A big celebration — the more the merrier.' },
    ],
  },
  {
    id: 'energy',
    eyebrow: 'The energy',
    question: 'What’s the energy of the day?',
    sub: 'How you want it to feel from start to finish.',
    options: [
      { key: 'calm', title: 'Calm & romantic', desc: 'Soft, sentimental, unhurried moments.' },
      { key: 'lively', title: 'Joyful & lively', desc: 'Music, dancing, and a packed dance floor.' },
      { key: 'refined', title: 'Elegant & refined', desc: 'Polished, timeless, and beautifully composed.' },
    ],
  },
  {
    id: 'roots',
    eyebrow: 'The style',
    question: 'Where does your wedding lean?',
    sub: 'How traditional or modern it feels.',
    options: [
      { key: 'tradition', title: 'Rooted in tradition', desc: 'Faith, family, and Filipino heritage at the heart.' },
      { key: 'modern', title: 'Modern & fresh', desc: 'Clean, current, and design-forward.' },
      { key: 'blend', title: 'A blend of both', desc: 'Honoring tradition with a modern touch.' },
    ],
  },
  {
    id: 'effort',
    eyebrow: 'The plan',
    question: 'How much do you want to do?',
    sub: 'We’ll size your plan to match — you can always add more later.',
    options: [
      { key: 'simple', title: 'Keep it simple', desc: 'The essentials, beautifully done.' },
      { key: 'balanced', title: 'A balanced plan', desc: 'The essentials plus a few special touches.' },
      { key: 'allout', title: 'Go all out', desc: 'Every detail, every wow moment.' },
    ],
  },
];

/** Every wedding gets these essentials regardless of persona (PICK_GROUPS keys). */
export const EXP_ESSENTIAL_PICKS: readonly string[] = ['reception', 'ceremony', 'coordinator', 'catering', 'photo_video', 'hmua'];

export type ExpPersona = {
  key: string;
  /** Couple-facing display name ("…couple"). */
  name: string;
  /** One-line couple-facing identity shown on the reveal. */
  tagline: string;
  /** The persona's primary for-whom (fallback when the answer is missing). */
  forWhom: ExpForWhom;
  /** Accepted answers per axis — the resolver scores answer∈accepted overlap. */
  ideal: Partial<Record<ExpAxisId, string[]>>;
  /** Palette FEELS key → events.mood_feel_key + basic_moodboard. */
  feel: string;
  /** Persona-specific EXTRA categories (beyond EXP_ESSENTIAL_PICKS) in priority order. */
  extras: string[];
  /** Signature in-app Setnayan services (INAPP_KEYS) in priority order. */
  services: string[];
  /** Per-leaf style refinement seeds (only applied for leaves that survive into picks). */
  refinementSeeds: Record<string, string[]>;
};

/* Array order = tie-break priority (earlier wins on an equal score). */
export const EXP_PERSONAS: ExpPersona[] = [
  {
    key: 'keepsake',
    name: 'Keepsake',
    tagline: 'A wedding built to be relived — your film, your song, your forever keepsakes.',
    forWhom: 'couple',
    ideal: { for_whom: ['couple'], feel: ['intimate', 'midsize'], energy: ['calm', 'refined'], roots: ['modern', 'blend'], effort: ['balanced', 'simple'] },
    feel: 'modern',
    extras: ['stylist', 'florist', 'bride_attire'],
    services: ['pakanta', 'sde', 'animated_monogram', 'papic_seats'],
    refinementSeeds: { photo_video: ['pv_cinematic', 'pv_fineart'], catering: ['cuisine_filipino'], stylist: ['Modern minimalist'] },
  },
  {
    key: 'big_celebration',
    name: 'Big Celebration',
    tagline: 'The wedding everyone talks about — packed dance floor, every guest part of the night.',
    forWhom: 'guests',
    ideal: { for_whom: ['guests'], feel: ['grand', 'midsize'], energy: ['lively'], roots: ['modern', 'blend'], effort: ['allout', 'balanced'] },
    feel: 'glam',
    extras: ['host_mc', 'dj', 'live_band', 'photo_booth', 'mobile_bar', 'lights_sound'],
    services: ['panood', 'papic_seats', 'live_photowall', 'pabati', 'papic_guest'],
    refinementSeeds: { catering: ['cuisine_filipino'], photo_video: ['pv_photojournalistic'], dj: ['Pop'] },
  },
  {
    key: 'best_of_both',
    name: 'Best of Both',
    tagline: 'A day you’ll treasure and your guests will never forget — beautifully balanced.',
    forWhom: 'both',
    ideal: { for_whom: ['both'], feel: ['midsize', 'grand'], energy: ['lively', 'refined'], roots: ['blend'], effort: ['balanced', 'allout'] },
    feel: 'timeless',
    extras: ['host_mc', 'stylist', 'dj', 'photo_booth'],
    services: ['papic_seats', 'advanced_website', 'sde', 'panood'],
    refinementSeeds: { photo_video: ['pv_classic'], catering: ['cuisine_filipino'] },
  },
  {
    key: 'intimate_romance',
    name: 'Intimate Romance',
    tagline: 'Small, soft, and deeply personal — every detail close to the heart.',
    forWhom: 'both',
    ideal: { for_whom: ['both', 'couple'], feel: ['intimate'], energy: ['calm'], roots: ['blend', 'tradition'], effort: ['simple', 'balanced'] },
    feel: 'boho',
    extras: ['florist', 'stylist', 'bride_attire'],
    services: ['advanced_website', 'sde', 'animated_monogram'],
    refinementSeeds: { florist: ['Lush & garden'], photo_video: ['pv_fineart'], catering: ['cuisine_filipino'] },
  },
  {
    key: 'modern_statement',
    name: 'Modern Statement',
    tagline: 'Clean, current, and design-forward — a wedding that looks like no one else’s.',
    forWhom: 'couple',
    ideal: { for_whom: ['couple', 'guests'], feel: ['midsize', 'grand'], energy: ['refined'], roots: ['modern'], effort: ['allout', 'balanced'] },
    feel: 'modern',
    extras: ['stylist', 'led_wall', 'lights_sound', 'dj', 'bride_attire'],
    services: ['live_background', 'animated_monogram', 'advanced_website', 'sde'],
    refinementSeeds: { stylist: ['Modern minimalist'], photo_video: ['pv_editorial'], catering: ['cuisine_fusion'] },
  },
  {
    key: 'rooted_tradition',
    name: 'Rooted Tradition',
    tagline: 'Faith, family, and heritage at the heart — and far-away loved ones brought close.',
    forWhom: 'guests',
    ideal: { for_whom: ['guests', 'both'], feel: ['midsize', 'grand'], energy: ['calm', 'refined'], roots: ['tradition'], effort: ['balanced', 'simple'] },
    feel: 'filipiniana',
    extras: ['choir', 'filipiniana', 'host_mc', 'florist'],
    services: ['panood', 'papic_seats', 'pakanta'],
    refinementSeeds: { catering: ['cuisine_filipino'], photo_video: ['pv_classic'], filipiniana: ['Piña'], choir: ['Small choir'] },
  },
];

export const EXP_PERSONA_BY_KEY: Record<string, ExpPersona> = Object.fromEntries(
  EXP_PERSONAS.map((p) => [p.key, p]),
);

/** for_whom dominates the resolve; the other four axes fine-tune within that intent. */
const FOR_WHOM_WEIGHT = 4;

/**
 * Resolve the persona from the 5-axis answers. Weighted overlap: for_whom counts
 * 4×, the other axes 1× each (so for-whom + one other beats four wrong-for-whom
 * matches). Deterministic; array order breaks ties (earlier persona wins).
 */
export function resolvePersona(answers: ExpAxisAnswers): string {
  let bestKey = EXP_PERSONAS[0]!.key;
  let bestScore = -1;
  for (const p of EXP_PERSONAS) {
    let score = 0;
    for (const axis of EXP_AXES) {
      const a = answers[axis.id];
      if (!a) continue;
      const accepted = p.ideal[axis.id];
      if (accepted && accepted.includes(a)) score += axis.id === 'for_whom' ? FOR_WHOM_WEIGHT : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = p.key;
    }
  }
  return bestKey;
}

export type DerivedPlan = {
  persona: ExpPersona;
  forWhom: ExpForWhom;
  /** Vendor categories to line up (essentials + effort-scaled extras). */
  picks: string[];
  /** In-app Setnayan services to pre-surface (effort-scaled). */
  services: string[];
  /** Palette FEELS key. */
  feel: string;
  /** Per-leaf refinement seeds, filtered to leaves that survived into picks. */
  refinements: Record<string, string[]>;
};

/**
 * Derive the full plan from a resolved persona + the answers. The `effort` axis
 * scales BREADTH (how many extras + services), so two couples on the same persona
 * but different effort get a right-sized plan. Pure + deterministic.
 */
export function derivePlanFromPersona(personaKey: string, answers: ExpAxisAnswers): DerivedPlan {
  const persona = EXP_PERSONA_BY_KEY[personaKey] ?? EXP_PERSONAS[0]!;
  const effort = answers.effort;

  const extrasLimit = effort === 'simple' ? 1 : effort === 'balanced' ? 3 : persona.extras.length;
  const svcLimit = effort === 'simple' ? 2 : effort === 'balanced' ? 3 : persona.services.length;

  const picks = Array.from(new Set([...EXP_ESSENTIAL_PICKS, ...persona.extras.slice(0, extrasLimit)]));
  const services = persona.services.slice(0, Math.max(2, svcLimit));

  // Only seed refinements for leaves that actually made it into picks.
  const pickSet = new Set(picks);
  const refinements: Record<string, string[]> = {};
  for (const [leaf, opts] of Object.entries(persona.refinementSeeds)) {
    if (pickSet.has(leaf)) refinements[leaf] = [...opts];
  }

  const forWhom = (answers.for_whom as ExpForWhom | undefined) ?? persona.forWhom;
  return { persona, forWhom, picks, services, feel: persona.feel, refinements };
}
