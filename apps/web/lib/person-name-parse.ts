/**
 * person-name-parse.ts — the PURE full-name splitter.
 *
 * Turns ONE typed line into the five name parts the `guests` table stores:
 *
 *     "Atty. Bob Casasola Jr."
 *        → { prefix:'Atty.', firstName:'Bob', middleName:'',
 *            lastName:'Casasola', suffix:'Jr.' }
 *
 * WHY THIS EXISTS. Before it, every write path split a name with
 * `words[0] = first, words.slice(1) = last` (see `guest-parse.ts`), which
 * stored the honorific AS THE FIRST NAME. Measured on prod 2026-09-14:
 * **30 of 100 guests** had a bare title ("Mr.", "Atty.", "Judge") sitting in
 * `first_name`, and the guest this was reported on read
 * `first_name='Mr.', last_name='Antonio Loo'`.
 *
 * ── DESIGNED AGAINST THE REAL LIST, NOT AGAINST A GUESS ───────────────────
 * The prod guest list is a Philippine legal/academic roster, and every rule
 * below was derived from a row that actually exists in it. Do not "simplify"
 * one away without re-reading that data — each one is load-bearing:
 *
 *   • MULTI-WORD titles. "Associate Dean Cecilio Duka", "Regional Prosecutor
 *     Serafin S. Salazar", "IBP Governor Ellen F. Francisco", "Vice Dean Erik
 *     C. Lazo". A single-token honorific check tears these in half — which is
 *     exactly how `Associate` ended up as a first name. Matching is
 *     LONGEST-PHRASE-FIRST for this reason.
 *   • STACKED titles. "ED Atty. Gabriel dela Peña" carries two. The head is
 *     consumed in a loop, not once.
 *   • MIDDLE INITIALS. "Arnaldo M. Espinas", "Joseph C. Cerezo". The "M." must
 *     NOT be read as a suffix, and must not be glued onto either neighbour.
 *   • THE `Ma.` TRAP. "Ma. Teresita Sison-Baluis" — `Ma.` is María, a GIVEN
 *     name, and to a naive "abbreviation ending in a period" rule it is
 *     indistinguishable from `Mr.`. It is deliberately absent from the
 *     honorific vocabulary and glued FORWARD onto the name it belongs to.
 *   • PARTICLES. "dela Peña", "Dela Cruz", "de la Rosa" — the surname starts
 *     at the particle, not at the last word.
 *   • HYPHENATED MARRIED SURNAMES. "Rafal-Roble", "Jota-Javier",
 *     "Sacdalan-Tria" stay one token; "Sacdalan-dela Rosa" is a hyphenated
 *     particle that swallows the word after it.
 *   • THE `Sr.` COLLISION. Leading `Sr.` is Sister/Señor (a PREFIX); trailing
 *     `Sr.` is Senior (a SUFFIX). Position alone disambiguates, so the two
 *     vocabularies are consulted at different ends of the string.
 *
 * ── WHAT IT REFUSES TO DO ─────────────────────────────────────────────────
 * It never changes casing (`guest-name.ts` explains why: "de la Cruz", "Ng",
 * "McName" all break under naive Title-Case), never drops a token, and never
 * returns an empty `firstName` when the input had any word at all — the
 * `guests` table declares `first_name`/`last_name` NOT NULL, so an
 * over-eager title or suffix rule that ate the only word would turn a typo
 * into a failed INSERT. Both consumers BACK OFF rather than empty the name.
 *
 * Pure: no React, no DOM, no schema knowledge. Unit-tested via `tsx --test`.
 */

/** The five parts a typed line splits into. Every field is always a string. */
export type ParsedPersonName = {
  /** Honorific(s) before the name — "Atty.", "Associate Dean", "ED Atty.". */
  prefix: string;
  /** Given name, including a glued abbreviation like "Ma. Teresita". */
  firstName: string;
  /** Everything between first and last — usually an initial ("M."). */
  middleName: string;
  /** Family name, including any particle ("dela Peña") or hyphen. */
  lastName: string;
  /** Generational / post-nominal — "Jr.", "III", "CPA". */
  suffix: string;
};

/**
 * Honorifics that appear BEFORE a name, as lowercase space-joined phrases
 * with periods stripped (see `keyOf`). Multi-word entries are matched
 * longest-first, so "associate dean" wins over "dean".
 *
 * `sr` is here as Sister/Señor; it is ALSO in SUFFIX_KEYS as Senior. Position
 * decides which one applies — that is the whole point of two vocabularies.
 *
 * `ma` is deliberately NOT here. See the `Ma.` trap in the docblock.
 */
const PREFIX_KEYS = new Set<string>([
  // civil
  'mr', 'mrs', 'ms', 'miss', 'mx', 'sir', 'madam', 'maam', 'ginoo', 'gng',
  // professional
  'dr', 'dra', 'atty', 'engr', 'arch', 'ar', 'prof', 'cpa',
  // judicial / legal — the bulk of this roster
  'hon', 'judge', 'justice', 'chief justice', 'associate justice',
  'prosecutor', 'regional prosecutor', 'city prosecutor',
  'provincial prosecutor', 'asst prosecutor', 'assistant prosecutor',
  'fiscal', 'clerk of court', 'ombudsman', 'deputy ombudsman',
  'solicitor general', 'register of deeds',
  // bar / org office
  'ibp governor', 'ibp president', 'governor', 'vice governor',
  'comm', 'commissioner', 'chair', 'chairman', 'chairperson', 'chairwoman',
  'president', 'vice president', 'vp', 'treasurer', 'auditor',
  'secretary general', 'ed', 'executive director', 'dir', 'director',
  'asst director', 'assistant director', 'deputy director',
  // academic
  'dean', 'associate dean', 'assistant dean', 'asst dean', 'vice dean',
  'chancellor', 'vice chancellor', 'rector', 'principal', 'registrar',
  // government
  'sec', 'usec', 'asec', 'secretary', 'undersecretary',
  'assistant secretary', 'cong', 'congressman', 'congresswoman', 'rep',
  'representative', 'sen', 'senator', 'mayor', 'vice mayor', 'councilor',
  'kgd', 'kagawad', 'brgy capt', 'barangay captain', 'punong barangay',
  'amb', 'ambassador', 'consul', 'consul general',
  // religious
  'rev', 'fr', 'bro', 'sis', 'sr', 'msgr', 'bishop', 'archbishop',
  'cardinal', 'pastor', 'ptr', 'deacon', 'rabbi', 'imam', 'sheikh',
  // uniformed
  'capt', 'col', 'gen', 'lt', 'lt col', 'maj', 'maj gen', 'sgt', 'cpl',
  'adm', 'cmdr', 'ensign', 'pfc', 'pssg', 'pcol', 'plt col', 'pmaj',
  'pbgen', 'pgen', 'police colonel', 'police general',
]);

/** The longest prefix phrase, in words — bounds the lookahead window. */
const MAX_PREFIX_WORDS = 3;

/**
 * Post-nominals that appear AFTER a name. `sr`/`jr` are generational here;
 * roman numerals are handled separately by ROMAN_RE so "Louis XIV" style
 * input needs no vocabulary entry.
 */
const SUFFIX_KEYS = new Set<string>([
  'jr', 'sr', 'md', 'dds', 'dmd', 'cpa', 'phd', 'edd', 'jd', 'llm', 'llb',
  'esq', 'rn', 'rph', 'lpt', 'mba', 'ce', 'ee', 'me', 'pe', 'dvm', 'pt',
  'rmt', 'psy d', 'psyd', 'ret', 'afp', 'pnp',
]);

/** Generational roman numerals II–X (a lone "I" is far too likely a typo). */
const ROMAN_RE = /^(?:II|III|IV|V|VI|VII|VIII|IX|X)$/i;

/**
 * Given-name abbreviations that must glue FORWARD onto the next word rather
 * than be mistaken for an honorific. "Ma. Teresita" is one given name.
 */
const GIVEN_ABBR = new Set<string>(['ma', 'mo', 'jo', 'a', 'j']);

/**
 * Surname particles. The family name STARTS here, so "Gabriel dela Peña"
 * splits first='Gabriel', last='dela Peña' — never last='Peña'.
 */
const PARTICLES = new Set<string>([
  'de', 'del', 'dela', 'delas', 'delos', 'della', 'di', 'da', 'das', 'dos',
  'du', 'la', 'las', 'le', 'los', 'van', 'von', 'der', 'den', 'ter', 'ten',
  'bin', 'binti', 'binte', 'ibn', 'al', 'el', 'san', 'santa', 'santo',
  'sta', 'sto', 'mac', 'mc', 'ng', 'y', 'e',
]);

/** Lowercase a token and strip periods/commas so "Atty." matches "atty". */
function keyOf(word: string): string {
  return word.toLowerCase().replace(/[.,]/g, '').trim();
}

/** Join tokens into a lookup key for a multi-word phrase. */
function phraseKey(words: string[]): string {
  return words.map(keyOf).filter(Boolean).join(' ');
}

/**
 * Split a raw line into the five parts.
 *
 * Order matters: prefixes come off the HEAD first (so a leading "Sr." is read
 * as Sister before the suffix pass could ever see it), suffixes come off the
 * TAIL second, and only what survives is treated as the actual name.
 *
 * @param raw the line as typed. `null`/`undefined` yield all-empty parts.
 */
export function parsePersonName(raw: string | null | undefined): ParsedPersonName {
  const empty: ParsedPersonName = {
    prefix: '',
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
  };

  const str = String(raw ?? '').trim();
  if (!str) return empty;

  // A comma before a post-nominal ("Bob Casasola, Jr.") is punctuation, not a
  // separator — drop it so the suffix pass sees a plain trailing token. A
  // comma anywhere else is left alone: "Casasola, Bob" is a DIFFERENT
  // convention (surname-first) and guessing at it would silently swap names.
  let words = str.replace(/,\s*$/, '').split(/\s+/).filter(Boolean);

  // A title typed with NO space after its period — prod carries
  // "Mrs.Yolanda Brondial". Split it so the honorific pass below can see the
  // title as its own token. Guarded on the vocabulary, so an initial-heavy
  // name ("J.R.") and a surname containing a period are left intact.
  const glued = (words[0] ?? '').match(/^([A-Za-z]{2,12})\.([A-Za-z].*)$/);
  if (glued && PREFIX_KEYS.has(keyOf(glued[1] as string))) {
    words = [`${glued[1]}.`, glued[2] as string, ...words.slice(1)];
  }

  // ── 1. PREFIXES off the head, longest phrase first, repeating for stacks.
  const prefixWords: string[] = [];
  for (;;) {
    // Never let a title eat the entire line — `first_name` is NOT NULL, and a
    // guest genuinely typed as just "Judge" must still store as a name.
    const maxTake = Math.min(MAX_PREFIX_WORDS, words.length - 1);
    let took = 0;
    for (let n = maxTake; n >= 1; n--) {
      if (PREFIX_KEYS.has(phraseKey(words.slice(0, n)))) {
        took = n;
        break;
      }
    }
    if (took === 0) break;
    prefixWords.push(...words.slice(0, took));
    words = words.slice(took);
  }

  // ── 2. SUFFIXES off the tail. Same back-off rule: never empty the name.
  const suffixWords: string[] = [];
  while (words.length > 1) {
    const tail = words[words.length - 1] as string;
    if (SUFFIX_KEYS.has(keyOf(tail)) || ROMAN_RE.test(keyOf(tail))) {
      suffixWords.unshift(tail);
      words = words.slice(0, -1);
      continue;
    }
    break;
  }
  // "Ana Cruz, Jr." — the comma separating the name from its post-nominal is
  // punctuation and belongs to NEITHER part. Stripping it only here (rather
  // than globally) keeps a comma anywhere else intact, so surname-first input
  // is still left alone rather than silently re-read.
  if (suffixWords.length > 0 && words.length > 0) {
    const i = words.length - 1;
    words[i] = (words[i] as string).replace(/,$/, '');
  }

  // ── 3. Glue a given-name abbreviation onto the word it belongs to, so
  //       "Ma." + "Teresita" is ONE given name and never a first/middle pair.
  if (words.length > 1 && GIVEN_ABBR.has(keyOf(words[0] as string))
      && (words[0] as string).includes('.')) {
    words = [`${words[0]} ${words[1]}`, ...words.slice(2)];
  }

  // ── 4. Find where the surname starts.
  let lastStart = -1;
  for (let i = 1; i < words.length; i++) {
    const w = words[i] as string;
    // A bare particle: the surname begins here and runs to the end.
    if (PARTICLES.has(keyOf(w))) {
      lastStart = i;
      break;
    }
    // A HYPHENATED particle ("Sacdalan-dela") binds the word after it into
    // the surname — "Fely Sacdalan-dela Rosa" is Fely + Sacdalan-dela Rosa.
    const hyphenTail = w.includes('-') ? (w.split('-').pop() as string) : '';
    if (hyphenTail && PARTICLES.has(keyOf(hyphenTail)) && i + 1 < words.length) {
      lastStart = i;
      break;
    }
  }
  if (lastStart === -1) lastStart = Math.max(1, words.length - 1);

  const firstName = words[0] ?? '';
  const lastName = words.slice(lastStart).join(' ');
  const middleName = words.slice(1, lastStart).join(' ');

  return {
    prefix: prefixWords.join(' '),
    firstName,
    // A single word is a first name with no surname, never a bare surname.
    middleName: words.length > 1 ? middleName : '',
    lastName: words.length > 1 ? lastName : '',
    suffix: suffixWords.join(' '),
  };
}

/**
 * Re-join parsed parts into one display line, skipping empties. The inverse
 * of `parsePersonName` for every input it was designed against — used by the
 * list/print surfaces that want the full honorific form back.
 */
export function formatPersonName(parts: Partial<ParsedPersonName>): string {
  return [
    parts.prefix,
    parts.firstName,
    parts.middleName,
    parts.lastName,
    parts.suffix,
  ]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
