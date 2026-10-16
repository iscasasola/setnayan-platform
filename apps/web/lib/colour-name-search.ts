/**
 * 🔎 A COLOUR BY ITS NAME — the colour picker's Custom field (owner 2026-10-16, live: *"color picker
 * still not working"* — he typed "burgund", meaning burgundy, and ✓ Use stayed grey, because the field
 * took ONLY a hex code and said nothing about it).
 *
 * The field now takes a NAME or a CODE. A code is what it always was (`cleanHexInput`). A name is looked
 * up, as he types, in OUR OWN colour names (`lib/color-names.ts`) — never a hex invented for the word:
 *
 *   · the curated wedding names (`WEDDING_NAMES`) and the 140 CSS names (`CSS_NAMES`), the wedding name
 *     winning where both spell the same word (`namedColor`'s own rule);
 *   · `COLOR_NAME_ALIASES` — the words the namer already redirects ("burgundy" → Garnet, "crimson" →
 *     Carmine);
 *   · `TYPED_COLOUR_WORDS` below — words a couple or stylist TYPES that are in neither table ("rose gold",
 *     "hunter green", "champagne" is NOT here: "Champagne Gold" already answers it). Each one points at
 *     the colour the namer itself calls the word's common reference colour — so the colour applied is
 *     always one of our named swatches, and the word only finds it.
 *
 * 🔑 THE RETIRED "BURGUNDY" (`color-names.ts`, MB5): it was taken OUT of the namer because it sat ΔE 4.1
 * from Garnet — one colour under two names. It stays retired as a NAME (no row is ever labelled
 * "Burgundy", and no burgundy hex comes back); it may still be TYPED, because that is the word a couple
 * uses, and it resolves to Garnet — the colour that replaced it — shown as "Garnet · for burgundy" so
 * the swap is said, not hidden. Same for every redirect: the row wears the colour's real name.
 *
 * Matching folds case, spaces, hyphens and accents (`foldColorName` — "dusty rose", "Dusty-Rose",
 * "dustyrose" are one word; "pina" finds Piña Cream) and ranks: the whole word · the start of the word ·
 * the start of one of its words ("gold" → Antique Gold) · anywhere inside it. A colour is listed once.
 * Nothing under two letters is looked up, and anything with a digit is a code, not a name.
 *
 * Held by `lib/the-colour-field-takes-a-name.test.ts`.
 */
import { COLOR_NAME_ALIASES, CSS_NAMES, WEDDING_NAMES, foldColorName } from './color-names';
import { cleanHexInput } from './mood-board-studio';

/** How many name matches the field lists under itself. */
export const NAME_MATCH_MAX = 6;

/**
 * Words people type that neither table holds, each with the common reference colour for the word
 * (`ref`, used ONLY to locate — never applied) and the name of OUR colour the namer places it on
 * (`name`). The guard re-runs `resolveColorName(ref)` for every row, so a row whose target drifts when
 * the tables change goes red instead of silently pointing a word at a colour nobody chose.
 */
export const TYPED_COLOUR_WORDS: readonly { word: string; ref: string; name: string }[] = [
  { word: 'army green', ref: '#4B5320', name: 'Bronze Olive' },
  { word: 'baby blue', ref: '#89CFF0', name: 'Sky Blue' },
  { word: 'bronze', ref: '#CD7F32', name: 'Burnt Orange' },
  { word: 'cabernet', ref: '#4C1C24', name: 'Oxblood' },
  { word: 'camel', ref: '#C19A6B', name: 'Bamboo Tan' },
  { word: 'caramel', ref: '#AF6E4D', name: 'Clay' },
  { word: 'cherry', ref: '#D2042D', name: 'Gumamela Red' },
  { word: 'copper', ref: '#B87333', name: 'Terracotta' },
  { word: 'dusty pink', ref: '#D8A1A4', name: 'Dusty Rose' },
  { word: 'ecru', ref: '#C2B280', name: 'Bamboo Tan' },
  { word: 'eggplant', ref: '#614051', name: 'Plum' },
  { word: 'hunter green', ref: '#355E3B', name: 'Banana Leaf Green' },
  { word: 'latte', ref: '#C5A582', name: 'Nude' },
  { word: 'marsala', ref: '#964F4C', name: 'Indian Red' },
  { word: 'merlot', ref: '#73343A', name: 'Garnet' },
  { word: 'oatmeal', ref: '#E0D6C4', name: 'Piña Cream' },
  { word: 'off white', ref: '#FAF9F6', name: 'Cream' },
  { word: 'old rose', ref: '#C08081', name: 'Dusty Rose' },
  { word: 'olive green', ref: '#708238', name: 'Moss' },
  { word: 'pastel blue', ref: '#A7C7E7', name: 'Sky Blue' },
  { word: 'pastel pink', ref: '#F8C8DC', name: 'Rose Petal' },
  { word: 'rose gold', ref: '#B76E79', name: 'Rosy Brown' },
  { word: 'ruby', ref: '#9B111E', name: 'Barn Red' },
  { word: 'sand', ref: '#C2B280', name: 'Bamboo Tan' },
  { word: 'sea foam', ref: '#93E9BE', name: 'Fern' },
  { word: 'tiffany blue', ref: '#0ABAB5', name: 'Palawan Teal' },
];

/** One name match: the colour (`name`, `hex` — always one of our named colours) and, for a redirect, the word that found it. */
export type NameMatch = { name: string; hex: string; typed?: string };

type Entry = NameMatch & { key: string; words: string[]; rank: number };

const byName = (name: string) => WEDDING_NAMES.find((n) => n.name === name) ?? CSS_NAMES.find((n) => n.name === name) ?? null;

let index: Entry[] | null = null;
function entries(): Entry[] {
  if (index) return index;
  const seen = new Map<string, Entry>();
  const add = (label: string, target: { name: string; hex: string } | null, rank: number, typed?: string) => {
    if (!target) return;
    const key = foldColorName(label);
    if (!key || seen.has(key)) return;
    const words = label.split(/[\s-]+/).map(foldColorName).filter(Boolean);
    seen.set(key, { key, words, rank, name: target.name, hex: target.hex.toUpperCase(), ...(typed ? { typed } : {}) });
  };
  /* Redirects first: a key they own is theirs (as in `namedColor`). The wedding table before CSS: it wins every shared word. */
  for (const [alias, target] of Object.entries(COLOR_NAME_ALIASES)) add(alias, byName(target), 1, alias);
  for (const w of TYPED_COLOUR_WORDS) add(w.word, byName(w.name), 1, w.word);
  for (const n of WEDDING_NAMES) add(n.name, n, 0);
  for (const n of CSS_NAMES) add(n.name, n, 2);
  index = [...seen.values()];
  return index;
}

/** Trailing words a couple adds that the name itself does not carry ("sage green", "navy blue"). */
const FAMILY_WORD = /(green|blue|pink|red|purple|violet|yellow|orange|brown|gr[ae]y|white|black|colou?r)$/;

function find(q: string, max: number): NameMatch[] {
  const tier = (e: Entry) =>
    e.key === q ? 0 : e.key.startsWith(q) ? 1 : e.words.some((w) => w.startsWith(q)) ? 2 : e.key.includes(q) ? 3 : -1;
  const hits = entries()
    .map((e) => ({ e, t: tier(e) }))
    .filter((h) => h.t >= 0)
    .sort((a, b) => a.t - b.t || a.e.rank - b.e.rank || a.e.key.localeCompare(b.e.key));
  const out: NameMatch[] = [];
  const hexes = new Set<string>();
  for (const { e } of hits) {
    if (hexes.has(e.hex)) continue;
    hexes.add(e.hex);
    out.push(e.typed ? { name: e.name, hex: e.hex, typed: e.typed } : { name: e.name, hex: e.hex });
    if (out.length >= max) break;
  }
  return out;
}

/** Our colours whose name matches what was typed, best first, at most `max`. A code or under two letters → none. */
export function colourNameMatches(raw: string, max = NAME_MATCH_MAX): NameMatch[] {
  const text = raw.trim();
  if (text.startsWith('#') || /\d/.test(text) || cleanHexInput(text)) return [];
  const q = foldColorName(text);
  if (q.length < 2) return [];
  const direct = find(q, max);
  if (direct.length > 0) return direct;
  /* "sage green" → Sage: the family word dropped, once, only when the whole phrase found nothing. */
  const stem = q.replace(FAMILY_WORD, '');
  return stem.length >= 2 && stem !== q ? find(stem, max) : [];
}

/**
 * What the Custom field holds, and what ✓ Use (and Enter) would set: a valid code wins; else the TOP
 * name match; else nothing, and Use stays off.
 */
export function customColourInput(raw: string): { code: string | null; matches: NameMatch[]; use: string | null } {
  const code = cleanHexInput(raw);
  const matches = code ? [] : colourNameMatches(raw);
  return { code, matches, use: code ?? matches[0]?.hex ?? null };
}

