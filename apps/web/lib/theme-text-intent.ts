/**
 * THE COUPLE'S OWN SENTENCE, READ — pure, deterministic, no network.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * `events.moodboard_theme_description` has been a real, saved, *inert* column
 * since 20271193183599. The Mood Board shows it, the vendor board shows it,
 * the concept PDF prints it on the cover — and NOTHING reads it. Its
 * placeholder invited exactly the sentence the owner typed:
 *
 *     "i want to feel christmas vibe with a hint of classy elegance"
 *
 * …and then did nothing with it. Owner's verdict: *"if this will not help me
 * generate a theme, remove it."* They chose to make it work. This module is
 * the "make it work": sentence in, a STRUCTURED READING out, expressed
 * entirely in vocabularies that already exist elsewhere in the app.
 *
 * ── 🛑 IT MAY ONLY EVER SELECT, NEVER INVENT ───────────────────────────────
 * Every value this module can emit is a member of a shipped vocabulary:
 *   · moods    → MOODBOARD_MOOD_TAGS      (lib/moodboard-templates.ts)
 *   · families → MOODBOARD_STYLE_FAMILIES (lib/moodboard-templates.ts)
 *   · colours  → WEDDING_NAMES / CSS_NAMES via `namedColor` (lib/color-names.ts)
 *   · motifs   → real (part, attribute, option) triples from RECEPTION_PARTS
 *                (lib/reception-scene.ts)
 * There is no path from here to free prose, to a hex we made up, or to an
 * option id that does not exist. `theme-text-intent.test.ts` walks the whole
 * dictionary and fails if any entry names a colour or an option the app does
 * not stock — so the dictionary cannot rot past the vocabulary it draws on.
 *
 * ── 🔑 WHAT IT DID NOT UNDERSTAND IS PART OF THE ANSWER ────────────────────
 * `unrecognised` is not diagnostics. It is shown to the couple. A reader that
 * silently drops the half of the sentence it could not parse is the same
 * defect as the inert field, only quieter: the couple would believe they had
 * been understood. Everything unconsumed and meaningful comes back.
 *
 * ── SCORE EVERY MATCH; NEVER STOP AT THE FIRST ─────────────────────────────
 * Couples code-switch and contradict themselves in one breath — "sosyal pero
 * chill", "simple lang pero engrande". A first-match-wins reader would report
 * exactly half of each of those and look confident doing it. Every matched
 * phrase contributes weight; opposed moods that BOTH survive are reported as
 * a `conflict`, for the couple to settle, not for us to silently resolve.
 *
 * Intensity is read too: "a HINT of classy elegance" is not the same claim as
 * "very classy" — see INTENSIFIERS/HEDGES. And a negation ("not too formal",
 * "ayaw namin ng dark") suppresses the phrase it governs instead of reading it
 * as a request for that very thing.
 *
 * Pure and deterministic: same string in, byte-identical reading out. The
 * model fallback lives in a separate server module (theme-text-intent-model.ts)
 * and is reached ONLY when this one finds nothing at all.
 */

import {
  MOODBOARD_MOOD_TAGS,
  MOODBOARD_STYLE_FAMILIES,
  type MoodboardMoodTag,
  type MoodboardStyleFamily,
} from './moodboard-templates';
import { namedColor } from './color-names';
import {
  isMultiAttribute,
  MAX_SELECTIONS_PER_ATTRIBUTE,
  RECEPTION_PARTS,
  type PartId,
} from './reception-scene';

// ── caps ──────────────────────────────────────────────────────────────────

/**
 * The hard length cap on anything this module reads.
 *
 * 280 is NOT a new number: it is `events_moodboard_theme_description_len_chk`
 * (migration 20271193183599) and `THEME_DESCRIPTION_MAX` in the mood-board
 * server actions, i.e. the longest description that can be stored at all.
 *
 * ⚠ IT IS ALSO THE CONTAINMENT BOUNDARY FOR THE MODEL ARM. This text is
 * couple-authored free input on its way toward a prompt, so it is an
 * injection surface, not merely a parsing problem. Slicing here — before any
 * matching, before any prompt is built — means no caller can hand the model
 * arm an unbounded document, whatever it was handed itself.
 */
export const THEME_TEXT_MAX_CHARS = 280;

/** Most unrecognised words we will show back. A wall of them is not feedback. */
export const UNRECOGNISED_MAX = 12;

/** Shortest leftover word worth reporting as "we didn't get this". */
const MIN_UNRECOGNISED_LENGTH = 3;

/** How many tokens forward a hedge/intensifier/negation reaches. Four covers
 *  "a hint of classy elegance" (hint → of · classy · elegance) without
 *  bleeding into the next clause. */
const MODIFIER_REACH = 4;

// ── the reading ───────────────────────────────────────────────────────────

export type ThemeIntentColour = { name: string; hex: string };

export type ThemeIntentMotif = {
  part: PartId;
  attribute: string;
  option: string;
  /** The option's own user-facing label from RECEPTION_PARTS — never invented. */
  label: string;
};

/** What one matched phrase contributed — the evidence behind every chip. */
export type ThemeIntentMatch = {
  /** The couple's own words, as they appear in their sentence. */
  phrase: string;
  /** 1 normally; lower under a hedge ("a hint of"), higher under "very". */
  weight: number;
};

export type ThemeTextReading = {
  /** Score-ordered, highest first. Members of MOODBOARD_MOOD_TAGS only. */
  moods: MoodboardMoodTag[];
  /** Score-ordered. Members of MOODBOARD_STYLE_FAMILIES only. */
  families: MoodboardStyleFamily[];
  colours: ThemeIntentColour[];
  motifs: ThemeIntentMotif[];
  /** Words we could not place — SHOWN to the couple, never swallowed. */
  unrecognised: string[];
  /** Opposed moods the sentence asked for at once, for the couple to settle. */
  conflicts: Array<[MoodboardMoodTag, MoodboardMoodTag]>;
  /** Phrases the couple ruled OUT ("not too formal") — read, then excluded. */
  excluded: string[];
  /** Honest statements about the reading, e.g. that we stock no Christmas
   *  themes. Curated strings from the dictionary — never model-written. */
  notes: string[];
  /** Every phrase that fired, with its weight. The chips' evidence. */
  matched: ThemeIntentMatch[];
  /** True when the input was longer than THEME_TEXT_MAX_CHARS and was cut. */
  truncated: boolean;
  /** Which arm produced this reading. `model` is set by the server fallback. */
  source: 'dictionary' | 'model' | 'none';
};

export function emptyReading(truncated = false): ThemeTextReading {
  return {
    moods: [],
    families: [],
    colours: [],
    motifs: [],
    unrecognised: [],
    conflicts: [],
    excluded: [],
    notes: [],
    matched: [],
    truncated,
    source: 'none',
  };
}

/** Did the dictionary arm find anything actionable? Drives the model fallback. */
export function readingIsEmpty(r: ThemeTextReading): boolean {
  return (
    r.moods.length === 0 &&
    r.families.length === 0 &&
    r.colours.length === 0 &&
    r.motifs.length === 0
  );
}

// ── the whitelist ─────────────────────────────────────────────────────────
//
// 🛑 THE ONE GATE EVERY UNTRUSTED SELECTION PASSES THROUGH. Two callers, one
// rule: the model arm validates what the MODEL said (theme-text-intent-model.ts)
// and the apply action validates what the BROWSER sent back after the couple
// removed chips (mood-board/actions.ts). Neither is trusted; both are filtered
// to values that provably exist in the shipped vocabularies. Anything else is
// dropped silently — a chip we cannot honour must not become a board edit.

export type ThemeSelection = {
  moods: MoodboardMoodTag[];
  families: MoodboardStyleFamily[];
  colours: ThemeIntentColour[];
  motifs: ThemeIntentMotif[];
};

export const EMPTY_SELECTION: ThemeSelection = {
  moods: [],
  families: [],
  colours: [],
  motifs: [],
};

/** Caps on one selection — a payload cannot ask us to fill the whole board. */
export const SELECTION_MAX = { moods: 3, families: 2, colours: 5, motifs: 6 } as const;

let motifIdIndex: Map<string, ThemeIntentMotif> | null = null;

/** `part.attribute=option` → the real motif, or null. Never invents a label. */
export function knownMotif(id: string): ThemeIntentMotif | null {
  if (!motifIdIndex) {
    const map = new Map<string, ThemeIntentMotif>();
    for (const part of RECEPTION_PARTS) {
      for (const attr of part.attributes) {
        for (const opt of attr.options) {
          map.set(`${part.id}.${attr.id}=${opt.id}`, {
            part: part.id,
            attribute: attr.id,
            option: opt.id,
            label: opt.label,
          });
        }
      }
    }
    motifIdIndex = map;
  }
  return typeof id === 'string' ? (motifIdIndex.get(id.trim()) ?? null) : null;
}

export function motifId(m: { part: string; attribute: string; option: string }): string {
  return `${m.part}.${m.attribute}=${m.option}`;
}

function pickStrings(v: unknown, max: number): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : [];
}

/**
 * Filter an arbitrary payload down to values that exist. The ONLY way a mood,
 * family, colour or motif enters the system from outside.
 *
 * `colours` accepts either a bare name or a `{ name }` object, and resolves
 * both through `namedColor` — an EXACT table lookup. A hex supplied by the
 * caller is IGNORED: we always re-derive it from the name we stock, so a
 * hostile payload cannot pair a familiar name with an arbitrary colour.
 */
export function validateThemeSelection(raw: unknown): ThemeSelection {
  if (!raw || typeof raw !== 'object') return EMPTY_SELECTION;
  const obj = raw as Record<string, unknown>;

  const moods = pickStrings(obj.moods, SELECTION_MAX.moods).filter(
    (m): m is MoodboardMoodTag => (MOODBOARD_MOOD_TAGS as readonly string[]).includes(m),
  );
  const families = pickStrings(obj.families, SELECTION_MAX.families).filter(
    (f): f is MoodboardStyleFamily => (MOODBOARD_STYLE_FAMILIES as readonly string[]).includes(f),
  );

  const rawColours = Array.isArray(obj.colours) ? obj.colours.slice(0, SELECTION_MAX.colours) : [];
  const colours: ThemeIntentColour[] = [];
  for (const c of rawColours) {
    const name =
      typeof c === 'string'
        ? c
        : c && typeof c === 'object' && typeof (c as { name?: unknown }).name === 'string'
          ? ((c as { name: string }).name)
          : null;
    if (!name) continue;
    const nc = namedColor(name);
    if (nc && !colours.some((x) => x.hex === nc.hex)) colours.push({ name: nc.name, hex: nc.hex });
  }

  const rawMotifs = Array.isArray(obj.motifs) ? obj.motifs.slice(0, SELECTION_MAX.motifs) : [];
  const motifs: ThemeIntentMotif[] = [];
  for (const m of rawMotifs) {
    const id =
      typeof m === 'string'
        ? m
        : m && typeof m === 'object'
          ? motifId(m as { part: string; attribute: string; option: string })
          : '';
    const known = knownMotif(id);
    if (!known) continue;
    // 🔑 HOW MANY TREATMENTS ONE ZONE MAY HOLD IS NOT THIS MODULE'S CALL —
    // it is `isMultiAttribute` / MAX_SELECTIONS_PER_ATTRIBUTE, the same rule
    // the reception editor and `sanitizeReceptionDesign` already enforce.
    // Hard-capping at one here read as safety and was actually a LIE: the
    // couple's own "christmas" chip set draws BOTH paper lanterns and fairy
    // lights — a real, shipped combination on a `multi: true` attribute — so a
    // 1-cap would have shown them two chips and silently applied one.
    const inZone = motifs.filter((x) => x.part === known.part && x.attribute === known.attribute);
    if (inZone.some((x) => x.option === known.option)) continue;
    const cap = isMultiAttribute(known.part, known.attribute) ? MAX_SELECTIONS_PER_ATTRIBUTE : 1;
    if (inZone.length >= cap) continue;
    motifs.push(known);
  }

  return {
    moods: Array.from(new Set(moods)),
    families: Array.from(new Set(families)),
    colours,
    motifs,
  };
}

export function selectionIsEmpty(s: ThemeSelection): boolean {
  return (
    s.moods.length === 0 &&
    s.families.length === 0 &&
    s.colours.length === 0 &&
    s.motifs.length === 0
  );
}

// ── normalisation ─────────────────────────────────────────────────────────

/**
 * The cache key AND the matching surface: lowercase, diacritics folded (so
 * "piña" and "pina" are one word to a couple typing on a phone keyboard),
 * every non-alphanumeric run collapsed to a single space.
 *
 * Applied AFTER the length cap, so the key can never be longer than the cap.
 */
export function normalizeThemeText(raw: string): string {
  return raw
    .slice(0, THEME_TEXT_MAX_CHARS)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ── vocabulary the dictionary draws on ────────────────────────────────────

type Contribution = {
  moods?: MoodboardMoodTag[];
  families?: MoodboardStyleFamily[];
  /** EXACT names from WEDDING_NAMES / CSS_NAMES — checked by the unit test. */
  colours?: string[];
  /** `part.attribute.option` triples — checked against RECEPTION_PARTS. */
  motifs?: Array<[PartId, string, string]>;
  /** A true thing worth saying about this match. */
  note?: string;
};

type IntentEntry = Contribution & { phrases: string[] };

/**
 * Words that carry no design meaning on their own. Consumed silently — they
 * are NOT "unrecognised", because reporting "we didn't understand: the, and,
 * ng" back to a couple is noise pretending to be honesty. Includes the
 * Tagalog function words a Taglish sentence is built out of.
 */
const STOPWORDS = new Set<string>([
  // English
  'i', 'we', 'me', 'my', 'mine', 'our', 'ours', 'us', 'you', 'your', 'a', 'an', 'the',
  'and', 'or', 'but', 'of', 'for', 'to', 'with', 'in', 'on', 'at', 'as', 'by', 'from',
  'is', 'am', 'are', 'be', 'being', 'been', 'was', 'were', 'it', 'its', 'that', 'this',
  'these', 'those', 'there', 'here', 'would', 'will', 'can', 'could', 'should', 'may',
  'want', 'wants', 'wanted', 'wanting', 'like', 'likes', 'love', 'loves', 'need', 'needs',
  'feel', 'feels', 'feeling', 'vibe', 'vibes', 'look', 'looks', 'looking', 'style',
  'theme', 'themes', 'wedding', 'weddings', 'reception', 'day', 'kind', 'sort', 'type',
  'something', 'some', 'thing', 'things', 'more', 'most', 'much', 'lot', 'lots', 'bit',
  'please', 'thanks', 'thank', 'go', 'going', 'get', 'have', 'has', 'had', 'make',
  'makes', 'do', 'does', 'us', 'all', 'both', 'also', 'too', 'so', 'if', 'when', 'about',
  'our', 'one', 'two', 'our', 'im', 'ive', 'were', 'dont', 'its',
  // Tagalog / Taglish connective tissue
  'na', 'ng', 'nang', 'sa', 'ang', 'mga', 'ay', 'si', 'ni', 'kay', 'ako', 'kami', 'tayo',
  'ko', 'namin', 'natin', 'niya', 'nila', 'yung', 'yun', 'ito', 'iyon', 'po', 'opo',
  'lang', 'lamang', 'pero', 'kaso', 'at', 'o', 'kasi', 'din', 'rin', 'para', 'gusto',
  'nga', 'ba', 'daw', 'raw', 'naman', 'yan', 'ganun', 'ganito', 'kung', 'pag', 'kapag',
  'sana', 'siguro', 'ata', 'eh', 'ha', 'nga',
]);

/**
 * Structural nouns every sentence about a wedding contains. Consumed like
 * stopwords, but kept in their own set because the reason differs and the
 * distinction matters: these ARE understood — they just do not narrow
 * anything. Telling a couple "we didn't understand: backdrop, table, colours"
 * would be false, and would bury the words we genuinely missed.
 */
const GENERIC_NOUNS = new Set<string>([
  'backdrop', 'table', 'tables', 'runner', 'chair', 'chairs', 'wall', 'walls',
  'ceiling', 'floor', 'aisle', 'entrance', 'stage', 'light', 'lights', 'lighting',
  'color', 'colors', 'colour', 'colours', 'palette', 'decor', 'decoration',
  'decorations', 'design', 'setup', 'venue', 'place', 'space', 'room', 'guest',
  'guests', 'motif', 'motifs', 'flower', 'flowers', 'floral', 'florals',
  'bulaklak', 'bloom', 'blooms', 'entourage', 'gown', 'suit', 'dress', 'attire',
  'kulay', 'lamesa', 'silya', 'ilaw', 'kasal',
]);

/** Scales the weight of matches that follow it. Consumed, not reported. */
const HEDGES = new Set<string>([
  'hint', 'touch', 'dash', 'slight', 'slightly', 'subtle', 'subtly', 'little',
  'konti', 'kaunti', 'konting', 'kaunting', 'medyo', 'bahagya', 'onti', 'onting',
]);

const INTENSIFIERS = new Set<string>([
  'very', 'really', 'super', 'extremely', 'totally', 'fully', 'highly',
  'sobra', 'sobrang', 'talaga', 'talagang', 'grabe', 'grabeng', 'napaka', 'ang',
]);

/** Suppresses the phrase it governs. "not too formal" must never read as
 *  a request for formal — the exact failure a first-match reader would ship. */
const NEGATIONS = new Set<string>([
  'not', 'no', 'never', 'without', 'avoid', 'less', 'nothing',
  'hindi', 'wag', 'huwag', 'ayaw', 'ayoko', 'walang', 'wala',
]);

const HEDGE_WEIGHT = 0.4;
const INTENSIFIER_WEIGHT = 1.5;

/**
 * Generic colour words → the CANONICAL stocked name they mean on a wedding
 * board. Not arbitrary: every right-hand value is an exact entry in
 * WEDDING_NAMES or CSS_NAMES (the unit test proves it), and the mapping
 * prefers the curated wedding name over the CSS primary wherever both exist —
 * a couple who types "red" wants Crimson, not #FF0000. Tagalog colour words
 * fold into the same canonical names.
 */
const COLOUR_WORDS: Record<string, string> = {
  // exact stocked names (self-mapping keeps one lookup path)
  ivory: 'Ivory', cream: 'Cream', blush: 'Blush', 'dusty rose': 'Dusty Rose',
  burgundy: 'Burgundy', terracotta: 'Terracotta', rust: 'Rust', gold: 'Gold',
  'champagne gold': 'Champagne Gold', champagne: 'Champagne Gold', mustard: 'Mustard',
  sage: 'Sage', emerald: 'Emerald', 'forest green': 'Forest Green',
  'sky blue': 'Sky Blue', navy: 'Navy', slate: 'Slate', lavender: 'Lavender',
  plum: 'Plum', charcoal: 'Charcoal', black: 'Black', white: 'White',
  silver: 'Silver', peach: 'Peach', coral: 'Coral', crimson: 'Crimson',
  teal: 'Teal', olive: 'Olive', maroon: 'Maroon', beige: 'Beige', tan: 'Tan',
  khaki: 'Khaki', wheat: 'Wheat', thistle: 'Thistle', turquoise: 'Turquoise',
  'pina cream': 'Piña Cream', 'capiz pearl': 'Capiz Pearl',
  'sampaguita white': 'Sampaguita White', 'narra brown': 'Narra Brown',
  'banana leaf green': 'Banana Leaf Green', 'waling waling purple': 'Waling-Waling Purple',
  'bamboo tan': 'Bamboo Tan',
  // generic English → the wedding-stocked equivalent
  red: 'Crimson', green: 'Forest Green', blue: 'Sky Blue', pink: 'Blush',
  purple: 'Plum', violet: 'Violet', yellow: 'Mustard', orange: 'Terracotta',
  brown: 'Narra Brown', grey: 'Charcoal', gray: 'Charcoal', nude: 'Beige',
  // Tagalog
  pula: 'Crimson', puti: 'White', itim: 'Black', berde: 'Forest Green',
  asul: 'Sky Blue', bughaw: 'Sky Blue', dilaw: 'Mustard', ginto: 'Gold',
  ginintuan: 'Gold', rosas: 'Blush', pilak: 'Silver', kayumanggi: 'Narra Brown',
};

/**
 * The curated phrase dictionary. Ordered only for readability — matching is
 * strictly longest-phrase-first across the whole set, so "forest green" can
 * never be shredded into "green", and "banana leaf green" wins over both.
 */
const ENTRIES: IntentEntry[] = [
  // ── seasonal / occasion ────────────────────────────────────────────────
  {
    phrases: ['christmas', 'xmas', 'pasko', 'kapaskuhan', 'noche buena', 'yuletide', 'holiday season'],
    moods: ['festive_celebratory'],
    colours: ['Crimson', 'Forest Green', 'Gold'],
    motifs: [['ceiling', 'treatment', 'lanterns'], ['ceiling', 'treatment', 'fairy_lights']],
    note:
      'We have no Christmas-specific themes in the library yet — measured across all 2,600: “christmas”, “parol” and “pasko” appear zero times. We read this as Festive & Celebratory, in Christmas colours.',
  },
  {
    phrases: ['parol', 'parols', 'star lantern', 'christmas lantern'],
    moods: ['festive_celebratory'],
    colours: ['Capiz Pearl', 'Gold'],
    motifs: [['ceiling', 'treatment', 'lanterns']],
  },
  {
    phrases: ['new year', 'new years', 'bagong taon', 'media noche', 'countdown'],
    moods: ['festive_celebratory', 'glam_luxurious'],
    colours: ['Gold', 'Silver', 'Black'],
    motifs: [['ceiling', 'treatment', 'fairy_lights']],
  },
  {
    phrases: ['valentine', 'valentines', 'hearts day', 'araw ng puso'],
    moods: ['romantic_ethereal', 'festive_celebratory'],
    colours: ['Blush', 'Crimson'],
  },
  {
    phrases: ['fiesta', 'pista', 'santacruzan', 'flores de mayo', 'barrio fiesta', 'handaan'],
    moods: ['festive_celebratory', 'maximalist_complex'],
    families: ['tropical heritage'],
    colours: ['Mustard', 'Crimson', 'Emerald'],
    motifs: [['ceiling', 'treatment', 'lanterns'], ['tables', 'linen', 'banig']],
  },
  {
    phrases: ['summer', 'tag init', 'summery', 'sunny', 'sunshine'],
    families: ['destination resort', 'boho beach'],
    colours: ['Sky Blue', 'Peach'],
  },
  {
    phrases: ['rainy season', 'tag ulan', 'habagat', 'monsoon', 'rainy', 'tag lamig'],
    moods: ['dark_moody', 'romantic_ethereal'],
    families: ['moody garden'],
    colours: ['Slate', 'Sage'],
    note: 'Rainy season reads as a moodier, indoor room — worth telling your venue coordinator too.',
  },

  // ── Filipino heritage ──────────────────────────────────────────────────
  {
    phrases: ['filipiniana', 'terno', 'maria clara', 'baro at saya'],
    moods: ['nostalgic_vintage'],
    families: ['vintage ilustrado', 'tropical heritage'],
    colours: ['Piña Cream', 'Capiz Pearl'],
  },
  {
    phrases: ['barong', 'barong tagalog'],
    families: ['vintage ilustrado', 'tropical heritage'],
    colours: ['Piña Cream'],
  },
  {
    phrases: ['pina', 'pina silk', 'jusi', 'pinilian'],
    families: ['vintage ilustrado'],
    colours: ['Piña Cream'],
  },
  {
    phrases: ['capiz', 'capiz shell', 'kapis'],
    families: ['tropical heritage'],
    colours: ['Capiz Pearl'],
    motifs: [['backdrop', 'style', 'capiz']],
  },
  {
    phrases: ['banig', 'abaca', 'rattan', 'sawali', 'nipa'],
    moods: ['organic_natural'],
    families: ['boho beach', 'tropical heritage'],
    colours: ['Bamboo Tan'],
    motifs: [['tables', 'linen', 'banig']],
  },
  {
    phrases: ['sampaguita'],
    families: ['tropical heritage'],
    colours: ['Sampaguita White'],
    motifs: [['tables', 'centerpiece', 'sampaguita']],
  },
  {
    phrases: ['ilang ilang', 'ylang ylang'],
    moods: ['romantic_ethereal', 'organic_natural'],
    families: ['tropical heritage'],
  },
  {
    phrases: ['hacienda', 'bahay na bato', 'ancestral house', 'casa'],
    moods: ['nostalgic_vintage'],
    families: ['vintage ilustrado'],
    colours: ['Narra Brown', 'Piña Cream'],
  },
  {
    phrases: ['ilustrado', 'old manila', 'colonial', 'intramuros'],
    moods: ['nostalgic_vintage', 'glam_luxurious'],
    families: ['vintage ilustrado'],
    colours: ['Narra Brown', 'Gold'],
  },
  {
    phrases: ['narra', 'acacia', 'molave', 'kamagong'],
    moods: ['organic_natural'],
    colours: ['Narra Brown'],
  },
  {
    phrases: ['banana leaf', 'monstera', 'dahon ng saging'],
    families: ['tropical heritage'],
    colours: ['Banana Leaf Green'],
    motifs: [['ceiling', 'treatment', 'banana_leaf']],
  },
  {
    phrases: ['waling waling', 'orchid', 'orchids'],
    families: ['tropical heritage'],
    colours: ['Waling-Waling Purple'],
  },
  {
    phrases: ['bamboo', 'kawayan'],
    moods: ['organic_natural'],
    families: ['boho beach'],
    colours: ['Bamboo Tan'],
  },

  // ── plain feeling words ────────────────────────────────────────────────
  {
    phrases: ['celebratory', 'celebration', 'party', 'festive', 'joyful', 'joyous', 'lively', 'merry', 'saya', 'masaya', 'masayang', 'salubong'],
    moods: ['festive_celebratory'],
  },
  {
    phrases: ['intimate', 'close knit', 'private', 'small gathering', 'micro'],
    moods: ['simple_understated', 'romantic_ethereal'],
    families: ['editorial cream'],
  },
  {
    phrases: ['cozy', 'cosy', 'warm', 'homey', 'homely', 'malapit sa puso'],
    moods: ['organic_natural', 'nostalgic_vintage'],
  },
  {
    phrases: ['grand', 'grandiose', 'engrande', 'bongga', 'extravagant', 'lavish', 'opulent', 'over the top', 'maluho'],
    moods: ['maximalist_complex', 'glam_luxurious'],
    families: ['bridgerton · regal'],
  },
  {
    phrases: ['simple', 'payak', 'plain', 'basic', 'no frills', 'pared back'],
    moods: ['simple_understated', 'minimalist'],
    families: ['elegant · simple · classic'],
  },
  {
    phrases: ['classy', 'sosyal', 'posh', 'sophisticated', 'upscale', 'high end', 'mayaman'],
    moods: ['glam_luxurious'],
    families: ['elegant · simple · classic'],
  },
  {
    phrases: ['elegant', 'elegance', 'eleganteng', 'graceful', 'timeless', 'classic', 'refined'],
    moods: ['simple_understated'],
    families: ['elegant · simple · classic'],
  },
  {
    phrases: ['chill', 'relaxed', 'laid back', 'laidback', 'casual', 'easygoing', 'presko'],
    moods: ['organic_natural', 'simple_understated'],
    families: ['boho beach'],
  },
  {
    phrases: ['romantic', 'romantiko', 'dreamy', 'soft', 'ethereal', 'tender'],
    moods: ['romantic_ethereal'],
    families: ['moody garden'],
  },
  {
    phrases: ['dramatic', 'moody', 'dark', 'sultry', 'mysterious', 'madilim'],
    moods: ['dark_moody'],
    families: ['moody garden'],
  },
  {
    phrases: ['bold', 'striking', 'vibrant', 'colorful', 'colourful', 'loud', 'graphic', 'makulay'],
    moods: ['bold_contrasting', 'maximalist_complex'],
  },
  {
    phrases: ['minimal', 'minimalist', 'clean', 'bare', 'less is more', 'uncluttered'],
    moods: ['minimalist'],
    families: ['modern minimalist'],
  },
  {
    phrases: ['modern', 'contemporary', 'sleek'],
    moods: ['minimalist'],
    families: ['modern minimalist'],
  },
  {
    phrases: ['industrial', 'loft', 'warehouse', 'raw concrete', 'exposed brick'],
    moods: ['bold_contrasting'],
    families: ['industrial loft'],
  },
  {
    phrases: ['vintage', 'retro', 'old school', 'antique', 'heirloom', 'nostalgic', 'sepia'],
    moods: ['nostalgic_vintage'],
    families: ['vintage ilustrado'],
  },
  {
    phrases: ['boho', 'bohemian', 'free spirited', 'earthy', 'rustic', 'natural', 'organic'],
    moods: ['organic_natural'],
    families: ['boho beach'],
  },
  {
    phrases: ['beach', 'beachside', 'seaside', 'coastal', 'sand', 'ocean', 'sea', 'dagat', 'island', 'baybayin'],
    families: ['boho beach', 'destination resort'],
    colours: ['Sky Blue', 'Ivory'],
  },
  {
    phrases: ['garden', 'outdoor', 'al fresco', 'alfresco', 'botanical', 'hardin', 'greenery'],
    moods: ['organic_natural'],
    families: ['moody garden'],
    motifs: [['backdrop', 'style', 'greenery'], ['ceiling', 'treatment', 'hanging_greenery']],
  },
  {
    phrases: ['tropical', 'tropiko', 'palm', 'coconut', 'niyog'],
    families: ['tropical heritage', 'destination resort'],
  },
  {
    phrases: ['regal', 'royal', 'bridgerton', 'regency', 'ballroom', 'palace', 'princess', 'maharlika'],
    moods: ['glam_luxurious'],
    families: ['bridgerton · regal'],
    motifs: [['ceiling', 'treatment', 'chandeliers']],
  },
  {
    phrases: ['whimsical', 'fairytale', 'fairy tale', 'storybook', 'magical', 'enchanted', 'playful', 'cute'],
    moods: ['whimsical_storybook'],
    motifs: [['ceiling', 'treatment', 'fairy_lights']],
  },
  {
    phrases: ['solemn', 'formal', 'traditional', 'quiet', 'calm', 'serene', 'tahimik', 'maaliwalas'],
    moods: ['simple_understated'],
  },
  {
    phrases: ['glam', 'glamorous', 'luxury', 'luxurious', 'luxe', 'gilded', 'gilded age'],
    moods: ['glam_luxurious'],
    colours: ['Gold'],
  },
  {
    phrases: ['editorial', 'magazine', 'gallery', 'muted', 'neutral', 'understated'],
    moods: ['simple_understated'],
    families: ['editorial cream'],
    colours: ['Cream'],
  },
  {
    phrases: ['destination', 'resort', 'out of town', 'getaway', 'staycation'],
    families: ['destination resort'],
  },

  // ── décor nouns → real reception options ───────────────────────────────
  { phrases: ['chandelier', 'chandeliers', 'crystal'], motifs: [['ceiling', 'treatment', 'chandeliers']] },
  { phrases: ['fairy lights', 'string lights', 'twinkle lights', 'bulb lights'], motifs: [['ceiling', 'treatment', 'fairy_lights']] },
  { phrases: ['floral wall', 'flower wall'], motifs: [['backdrop', 'style', 'floral_wall']] },
  { phrases: ['neon', 'neon sign'], motifs: [['backdrop', 'style', 'neon']] },
  { phrases: ['balloon', 'balloons', 'balloon wall'], moods: ['festive_celebratory'], motifs: [['backdrop', 'style', 'balloon']] },
  { phrases: ['moon gate', 'moongate', 'circular arch', 'round arch'], motifs: [['backdrop', 'style', 'moon_gate']] },
  { phrases: ['marquee', 'marquee letters', 'light up letters'], motifs: [['backdrop', 'style', 'marquee']] },
  { phrases: ['led wall', 'led screen', 'video wall'], motifs: [['backdrop', 'style', 'led']] },
  { phrases: ['draped', 'drape', 'drapes', 'drapery'], motifs: [['backdrop', 'style', 'draped'], ['ceiling', 'treatment', 'draped']] },
  { phrases: ['fringe', 'tassel', 'tassels'], motifs: [['backdrop', 'style', 'fringe']] },
  { phrases: ['sweetheart table', 'table for two'], motifs: [['stage', 'setup', 'sweetheart']] },
  { phrases: ['long table', 'head table', 'banquet table', 'harvest table'], motifs: [['stage', 'setup', 'long_head'], ['tables', 'shape', 'long']] },
  { phrases: ['round table', 'round tables'], motifs: [['tables', 'shape', 'round']] },
  { phrases: ['candle', 'candles', 'candlelit', 'candlelight', 'kandila'], moods: ['dark_moody'], motifs: [['tables', 'centerpiece', 'candles']] },
  { phrases: ['lantern', 'lanterns', 'paper lantern', 'paper lanterns', 'farol'], motifs: [['ceiling', 'treatment', 'lanterns']] },
  { phrases: ['chiavari', 'chiavari chairs'], motifs: [['tables', 'chairs', 'chiavari']] },
  { phrases: ['ghost chair', 'ghost chairs', 'acrylic chairs'], motifs: [['tables', 'chairs', 'ghost']] },
  { phrases: ['cross back', 'crossback'], motifs: [['tables', 'chairs', 'cross_back']] },
  { phrases: ['velvet'], moods: ['glam_luxurious'], motifs: [['tables', 'chairs', 'velvet']] },
  { phrases: ['sequin', 'sequins', 'sparkle', 'glitter'], moods: ['glam_luxurious', 'festive_celebratory'], motifs: [['tables', 'linen', 'sequin']] },
  { phrases: ['petal', 'petals', 'flower petals'], motifs: [['entrance', 'runner', 'petals']] },
  { phrases: ['cold spark', 'sparkler', 'sparklers', 'fireworks'], moods: ['festive_celebratory'], motifs: [['tunnel', 'style', 'cold_spark']] },
  { phrases: ['cherry blossom', 'sakura'], motifs: [['tunnel', 'style', 'cherry_blossom']] },
  { phrases: ['butterfly', 'butterflies', 'paruparo'], moods: ['whimsical_storybook'], motifs: [['tunnel', 'style', 'butterfly']] },
  { phrases: ['step and repeat', 'step repeat', 'photo wall', 'photobooth backdrop'], motifs: [['photo_wall', 'style', 'step_repeat']] },
  { phrases: ['seating chart', 'seat plan'], motifs: [['welcome_signage', 'style', 'framed_seating_chart']] },
  { phrases: ['guestbook', 'guest book'], motifs: [['welcome_signage', 'style', 'floral_guestbook']] },
  { phrases: ['uplighting', 'uplights', 'mood lighting'], motifs: [['walls', 'treatment', 'uplighting_only']] },
  { phrases: ['geometric'], motifs: [['ceiling', 'treatment', 'geometric']], families: ['modern minimalist'] },
];

/**
 * Moods that cannot both be the answer. Both are still REPORTED when both
 * fire — "sosyal pero chill" really does say both, and picking one for the
 * couple would be inventing the half we deleted. The pair is surfaced so they
 * can settle it.
 */
const OPPOSED_MOODS: Array<[MoodboardMoodTag, MoodboardMoodTag]> = [
  ['minimalist', 'maximalist_complex'],
  ['simple_understated', 'maximalist_complex'],
  ['minimalist', 'glam_luxurious'],
  // ⚠ NOT a pair: simple_understated ↔ glam_luxurious. "Classy elegance" is
  // exactly that combination and it is what the owner asked for — flagging it
  // as a contradiction would have told them their own sentence was confused.
  ['minimalist', 'bold_contrasting'],
  ['simple_understated', 'bold_contrasting'],
  ['dark_moody', 'romantic_ethereal'],
  ['dark_moody', 'whimsical_storybook'],
];

// ── the compiled dictionary (built once, lazily) ──────────────────────────

type CompiledPhrase = { tokens: string[]; contribution: Contribution };

let compiled: CompiledPhrase[] | null = null;

function compile(): CompiledPhrase[] {
  if (compiled) return compiled;
  const out: CompiledPhrase[] = [];
  for (const entry of ENTRIES) {
    const { phrases, ...contribution } = entry;
    for (const phrase of phrases) {
      const tokens = normalizeThemeText(phrase).split(' ').filter(Boolean);
      if (tokens.length > 0) out.push({ tokens, contribution });
    }
  }
  for (const [word, colourName] of Object.entries(COLOUR_WORDS)) {
    const tokens = normalizeThemeText(word).split(' ').filter(Boolean);
    if (tokens.length > 0) out.push({ tokens, contribution: { colours: [colourName] } });
  }
  // LONGEST FIRST — the whole reason "forest green" is not read as "green".
  out.sort((a, b) => b.tokens.length - a.tokens.length);
  compiled = out;
  return out;
}

/** Every dictionary phrase, for the guard test and for the model prompt's
 *  "these are the only words you may recognise" framing. */
export function themeIntentPhrases(): string[] {
  return compile().map((p) => p.tokens.join(' '));
}

// ── option-label resolution (never invented) ──────────────────────────────

let optionLabelIndex: Map<string, string> | null = null;
function optionLabel(part: string, attribute: string, option: string): string | null {
  if (!optionLabelIndex) {
    const map = new Map<string, string>();
    for (const p of RECEPTION_PARTS) {
      for (const a of p.attributes) {
        for (const o of a.options) map.set(`${p.id}.${a.id}.${o.id}`, o.label);
      }
    }
    optionLabelIndex = map;
  }
  return optionLabelIndex.get(`${part}.${attribute}.${option}`) ?? null;
}

// ── the read ──────────────────────────────────────────────────────────────

/**
 * Read a couple's sentence. Pure, deterministic, no network, no I/O.
 *
 * Everything it returns is a member of a shipped vocabulary; everything it
 * could not place comes back in `unrecognised`.
 */
export function readThemeText(raw: string): ThemeTextReading {
  const truncated = raw.length > THEME_TEXT_MAX_CHARS;
  const normalized = normalizeThemeText(raw);
  if (normalized.length === 0) return emptyReading(truncated);

  const tokens = normalized.split(' ').filter(Boolean);
  const consumed = new Array<boolean>(tokens.length).fill(false);

  // PASS 1 — modifiers. Recorded before matching so a hedge/negation that
  // precedes a phrase can govern it, and consumed so they never surface as
  // "unrecognised" words.
  const weightAt = new Array<number>(tokens.length).fill(1);
  const negatedAt = new Array<boolean>(tokens.length).fill(false);
  tokens.forEach((tok, i) => {
    const isHedge = HEDGES.has(tok);
    const isIntensifier = INTENSIFIERS.has(tok);
    const isNegation = NEGATIONS.has(tok);
    if (!isHedge && !isIntensifier && !isNegation) return;
    consumed[i] = true;
    for (let j = i + 1; j <= Math.min(tokens.length - 1, i + MODIFIER_REACH); j++) {
      if (isNegation) negatedAt[j] = true;
      else weightAt[j] = (weightAt[j] ?? 1) * (isHedge ? HEDGE_WEIGHT : INTENSIFIER_WEIGHT);
    }
  });

  // PASS 2 — longest-phrase-first matching over the unconsumed spans.
  const moodScore = new Map<MoodboardMoodTag, number>();
  const familyScore = new Map<MoodboardStyleFamily, number>();
  const colourOrder: string[] = [];
  const colourSeen = new Set<string>();
  const motifSeen = new Set<string>();
  const motifs: ThemeIntentMotif[] = [];
  const notes: string[] = [];
  // Collected with their token position, so both lists can be re-ordered to
  // read in the couple's own word order at the end — the matching loop walks
  // the DICTIONARY longest-first, which would otherwise report "engrande,
  // simple" for a sentence that says "simple lang pero engrande".
  const matchedAt: Array<ThemeIntentMatch & { at: number }> = [];
  const excludedAt: Array<{ phrase: string; at: number }> = [];

  for (const { tokens: phraseTokens, contribution } of compile()) {
    const n = phraseTokens.length;
    for (let i = 0; i + n <= tokens.length; i++) {
      let fits = true;
      for (let k = 0; k < n; k++) {
        if (consumed[i + k] || tokens[i + k] !== phraseTokens[k]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      for (let k = 0; k < n; k++) consumed[i + k] = true;

      const phrase = phraseTokens.join(' ');
      if (negatedAt[i]) {
        // Read, then deliberately excluded. The couple sees that we heard it.
        if (!excludedAt.some((e) => e.phrase === phrase)) excludedAt.push({ phrase, at: i });
        continue;
      }
      const weight = weightAt[i] ?? 1;
      matchedAt.push({ phrase, weight, at: i });

      for (const m of contribution.moods ?? []) {
        moodScore.set(m, (moodScore.get(m) ?? 0) + weight);
      }
      for (const f of contribution.families ?? []) {
        familyScore.set(f, (familyScore.get(f) ?? 0) + weight);
      }
      for (const name of contribution.colours ?? []) {
        if (colourSeen.has(name)) continue;
        colourSeen.add(name);
        colourOrder.push(name);
      }
      for (const [part, attribute, option] of contribution.motifs ?? []) {
        const key = `${part}.${attribute}.${option}`;
        if (motifSeen.has(key)) continue;
        const label = optionLabel(part, attribute, option);
        // A motif whose option no longer exists is DROPPED, never emitted with
        // a guessed label. The unit test makes this branch unreachable in a
        // healthy tree; it is here so a future rename degrades to silence
        // rather than to a fabricated chip.
        if (!label) continue;
        motifSeen.add(key);
        motifs.push({ part, attribute, option, label });
      }
      if (contribution.note && !notes.includes(contribution.note)) {
        notes.push(contribution.note);
      }
    }
  }

  // PASS 3 — what is left over and actually meant something.
  const unrecognised: string[] = [];
  const seenUnknown = new Set<string>();
  tokens.forEach((tok, i) => {
    if (consumed[i]) return;
    if (STOPWORDS.has(tok) || GENERIC_NOUNS.has(tok)) return;
    if (tok.length < MIN_UNRECOGNISED_LENGTH) return;
    if (/^\d+$/.test(tok)) return;
    if (seenUnknown.has(tok)) return;
    seenUnknown.add(tok);
    if (unrecognised.length < UNRECOGNISED_MAX) unrecognised.push(tok);
  });

  const byScoreDesc = <T>(scores: Map<T, number>, order: readonly T[]): T[] =>
    [...scores.entries()]
      // Ties break on the shipped vocabulary's own order, never on Map
      // insertion order — that is what makes this function deterministic
      // rather than merely repeatable within one process.
      .sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([k]) => k);

  const moods = byScoreDesc(moodScore, MOODBOARD_MOOD_TAGS);
  const families = byScoreDesc(familyScore, MOODBOARD_STYLE_FAMILIES);

  const moodSet = new Set(moods);
  const conflicts = OPPOSED_MOODS.filter(([a, b]) => moodSet.has(a) && moodSet.has(b));

  const colours: ThemeIntentColour[] = [];
  for (const name of colourOrder) {
    const nc = namedColor(name);
    // Same rule as motifs: a name the library no longer stocks is dropped,
    // never emitted with an invented hex.
    if (nc) colours.push({ name: nc.name, hex: nc.hex });
  }

  if (truncated) {
    notes.push(
      `We read the first ${THEME_TEXT_MAX_CHARS} characters — that is the most this field stores.`,
    );
  }

  const bySentenceOrder = <T extends { at: number }>(rows: T[]): T[] =>
    rows.slice().sort((a, b) => a.at - b.at);

  return {
    moods,
    families,
    colours,
    motifs,
    unrecognised,
    conflicts,
    excluded: bySentenceOrder(excludedAt).map((e) => e.phrase),
    notes,
    matched: bySentenceOrder(matchedAt).map(({ phrase, weight }) => ({ phrase, weight })),
    truncated,
    source: 'dictionary',
  };
}
