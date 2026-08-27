/**
 * A SUPPLIER READS THE RIGHT NOUN — the masked inquiry placeholder, for all
 * seventeen event types.
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 * `inquiryPlaceholderLabel` opened with the literal "A couple" for every event
 * type, so a funeral home reading an inquiry before accepting it was shown
 * *"A couple planning a funeral in Manila"*. This is the FIRST thing a supplier
 * reads about a job — the anonymised card that decides whether they answer at
 * all — and it is the sixth place this product has assumed every event is a
 * wedding.
 *
 * ── WHY THE HOST NOUN AND NOT THE ORGANISER NOUN ────────────────────────────
 * Measured in production 2026-08-27, FOUR of the seventeen seeded types carry
 * an `organizer_noun` that names the person the event is ABOUT rather than the
 * person planning it:
 *
 *   anniversary · birthday · debut → 'celebrant'      graduation → 'graduate'
 *
 * "A celebrant planning a debut" tells a supplier the debutante booked her own
 * 18th; her parents did. `host_noun` is the axis that already answers "who does
 * the admin work" (`defaultHostNoun` maps exactly these honoree nouns to
 * 'host'), and for a wedding BOTH nouns are 'couple' — which is precisely what
 * keeps this change byte-identical on the only type anyone has ever booked.
 *
 * ── WHY THE ARTICLE IS PART OF THE FIX ──────────────────────────────────────
 * The opener was a hardcoded "A " because "A couple" never had to change. Four
 * types carry the noun 'organizer', which renders "A organizer planning…" —
 * the same defect as the "a event"/"a anniversary" one caught one layer up in
 * `articleFor` the same week. It was found the same way: by RENDERING the
 * finished sentence for every type, never by reading the diff.
 *
 * ── WHAT THIS FILE PINS ─────────────────────────────────────────────────────
 * 1 · The seventeen types are DERIVED from `ANCHOR_BY_TYPE`, not hand-listed,
 *     with a floor — a scan that matched nothing must fail, and a new type
 *     added anywhere forces this table to be updated.
 * 2 · Every type × every one of the four branches renders grammatically, with
 *     the article agreeing with whichever noun it precedes.
 * 3 · The wedding literal does not move.
 * 4 · No type other than a wedding opens with "A couple".
 * 5 · The MECHANISM: `host_noun` wins, and `defaultHostNoun` covers a row that
 *     predates the column.
 * 6 · Every call site in the tree passes the noun — derived by scanning for the
 *     call, with a floor, comments stripped first.
 *
 * ── MUTATIONS, MEASURED (occurrence counts printed before → after) ──────────
 * See the PR body. Every assertion below was sabotaged and went RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ⚠ RELATIVE IMPORTS ON PURPOSE. Under `tsx --test`, an `@/…` alias import can
// resolve to an object with EMPTY named exports — a guard then runs zero checks
// and reports a pass. Every symbol is asserted below before anything uses it.
import { inquiryPlaceholderLabel, GENERIC_HOST_NOUN } from './inquiry-mask';
import { ANCHOR_BY_TYPE } from './event-anchor';
import { defaultHostNoun, HONOREE_NOUNS, toProfile } from './event-type-profile';
import { eventWordsFromProfile } from '../app/[slug]/_lib/event-words';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the imports actually resolved — a guard with empty exports proves nothing', () => {
  assert.equal(typeof inquiryPlaceholderLabel, 'function');
  assert.equal(typeof eventWordsFromProfile, 'function');
  assert.equal(typeof toProfile, 'function');
  assert.equal(typeof defaultHostNoun, 'function');
  assert.equal(GENERIC_HOST_NOUN, 'host');
  assert.ok(HONOREE_NOUNS instanceof Set && HONOREE_NOUNS.size >= 2);
  assert.ok(Object.keys(ANCHOR_BY_TYPE).length >= 17);
});

/**
 * THE SEVENTEEN TYPES, DERIVED. `ANCHOR_BY_TYPE` is the code's own complete map
 * of every event type; using it rather than a literal list means a type added
 * there without a noun decision fails this file instead of silently defaulting.
 */
const ALL_TYPES = Object.keys(ANCHOR_BY_TYPE).sort();

/**
 * The host noun each type resolves to, READ OUT OF PRODUCTION 2026-08-27:
 *
 *   select event_type, terminology->>'organizer_noun', terminology->>'host_noun'
 *     from event_type_profiles order by event_type;
 *
 * Recorded here because a unit test cannot reach the database, and the sentence
 * a supplier reads is worth pinning against the real seeds rather than against
 * the code fallbacks (which are broader — `fallbackFor` has five profiles for
 * seventeen types). The `organizer` column is kept alongside deliberately: it
 * is the value this change REJECTED, and seeing the two side by side is the
 * whole argument.
 */
const PROD_NOUNS: Record<string, { organizer: string; host: string }> = {
  anniversary: { organizer: 'celebrant', host: 'host' },
  birthday: { organizer: 'celebrant', host: 'host' },
  celebration: { organizer: 'host', host: 'host' },
  christening: { organizer: 'host', host: 'host' },
  corporate: { organizer: 'organizer', host: 'organizer' },
  date: { organizer: 'host', host: 'host' },
  debut: { organizer: 'celebrant', host: 'host' },
  funeral: { organizer: 'family', host: 'family' },
  gala_night: { organizer: 'organizer', host: 'organizer' },
  gender_reveal: { organizer: 'host', host: 'host' },
  graduation: { organizer: 'graduate', host: 'host' },
  hangout: { organizer: 'host', host: 'host' },
  reunion: { organizer: 'host', host: 'host' },
  simple_event: { organizer: 'host', host: 'host' },
  tournament: { organizer: 'organizer', host: 'organizer' },
  travel: { organizer: 'organizer', host: 'organizer' },
  wedding: { organizer: 'couple', host: 'couple' },
};

test('the seventeen types are derived, complete, and floored', () => {
  // FLOOR: a scan that matched nothing (or fewer than the seeded set) must fail
  // rather than vacuously pass every loop below.
  assert.ok(ALL_TYPES.length >= 17, `expected >= 17 event types, found ${ALL_TYPES.length}`);
  assert.deepEqual(
    ALL_TYPES,
    Object.keys(PROD_NOUNS).sort(),
    'ANCHOR_BY_TYPE and the production noun table disagree — a type was added ' +
      'or renamed without deciding what a supplier should read for it.',
  );
});

test('FOUR types name the honoree, and the host noun is what repairs them', () => {
  const honoree = ALL_TYPES.filter((t) => HONOREE_NOUNS.has(PROD_NOUNS[t].organizer));
  assert.deepEqual(
    honoree,
    ['anniversary', 'birthday', 'debut', 'graduation'],
    'the set of types whose organiser noun names the honoree has changed',
  );
  // FLOOR — if HONOREE_NOUNS were emptied, the list above would be empty and
  // this file would still "pass" every sentence check below.
  assert.ok(honoree.length >= 4);
  for (const t of honoree) {
    assert.notEqual(
      PROD_NOUNS[t].host,
      PROD_NOUNS[t].organizer,
      `${t}: host noun must differ from the honoree organiser noun`,
    );
    assert.equal(defaultHostNoun(PROD_NOUNS[t].organizer), PROD_NOUNS[t].host);
  }
});

/** The four branches the placeholder has. Named so failures are readable. */
const BRANCHES = [
  { name: 'type+city', city: 'Manila' as string | null, withType: true },
  { name: 'type only', city: null as string | null, withType: true },
  { name: 'city only', city: 'Manila' as string | null, withType: false },
  { name: 'neither', city: null as string | null, withType: false },
];

test('every type × every branch renders grammatically', () => {
  let rendered = 0;
  for (const type of ALL_TYPES) {
    for (const b of BRANCHES) {
      const label = inquiryPlaceholderLabel({
        eventType: b.withType ? type : null,
        city: b.city,
        hostNoun: b.withType ? PROD_NOUNS[type].host : null,
      });
      rendered += 1;
      // The opener is "A <noun> planning" or "An <noun> planning" — and the
      // article must AGREE. This is the assertion that catches "A organizer".
      const m = /^(An?) ([a-z]+) planning (an?) ([a-z ]+?)(?: in (.+))?$/.exec(label);
      assert.ok(m, `unparseable placeholder for ${type} [${b.name}]: ${label}`);
      const [, hostArticle, hostNoun, typeArticle, typeNoun] = m!;
      assert.equal(
        hostArticle,
        /^[aeiou]/.test(hostNoun) ? 'An' : 'A',
        `wrong article before "${hostNoun}" — ${type} [${b.name}]: ${label}`,
      );
      assert.equal(
        typeArticle,
        /^[aeiou]/.test(typeNoun) ? 'an' : 'a',
        `wrong article before "${typeNoun}" — ${type} [${b.name}]: ${label}`,
      );
      assert.equal(hostNoun, b.withType ? PROD_NOUNS[type].host : GENERIC_HOST_NOUN);
      // Identity can never appear: nothing identifying is a parameter.
      assert.ok(!/[&@]|https?:|\+63|S89[A-Z]-/.test(label), `identity-shaped: ${label}`);
    }
  }
  // FLOOR — 17 types × 4 branches.
  assert.equal(rendered, ALL_TYPES.length * BRANCHES.length);
  assert.ok(rendered >= 68, `only ${rendered} sentences rendered`);
});

test('only a wedding opens with "A couple"', () => {
  const openers = new Map<string, string>();
  for (const type of ALL_TYPES) {
    openers.set(
      type,
      inquiryPlaceholderLabel({
        eventType: type,
        city: 'Manila',
        hostNoun: PROD_NOUNS[type].host,
      }),
    );
  }
  // 🔒 THE WEDDING LITERAL — byte-identical to what shipped before the change.
  assert.equal(openers.get('wedding'), 'A couple planning a wedding in Manila');
  const coupled = ALL_TYPES.filter((t) => openers.get(t)!.startsWith('A couple'));
  assert.deepEqual(coupled, ['wedding'], `these types still say "A couple": ${coupled}`);
  // The two the defect was reported for, spelled out.
  assert.equal(openers.get('funeral'), 'A family planning a funeral in Manila');
  assert.equal(openers.get('corporate'), 'An organizer planning a corporate in Manila');
});

test('MECHANISM: host_noun wins, and a row predating it still resolves', () => {
  const row = (terminology: Record<string, unknown>) =>
    ({
      event_type: 'birthday',
      terminology,
      enabled_surfaces: null,
      marketplace_enabled: null,
      event_class: null,
      layer_mode: null,
      multi_day: null,
      onboarding_flow_key: null,
      role_set_key: null,
      template_pack_key: null,
      monogram_set_key: null,
      reveal_pack_key: null,
      budget_taxonomy_key: null,
      schedule_seed_key: null,
      statutory_pack_key: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  // A row that carries its own host_noun uses it.
  assert.equal(
    eventWordsFromProfile(toProfile(row({ organizer_noun: 'celebrant', host_noun: 'host' }))).host,
    'host',
  );
  // A row seeded BEFORE the column existed falls back through defaultHostNoun,
  // which is what turns the honoree noun into a plain host.
  assert.equal(
    eventWordsFromProfile(toProfile(row({ organizer_noun: 'celebrant' }))).host,
    'host',
  );
  // And a non-honoree noun is kept as-is — this is why a wedding is unaffected.
  assert.equal(eventWordsFromProfile(toProfile(row({ organizer_noun: 'couple' }))).host, 'couple');
  assert.equal(eventWordsFromProfile(toProfile(row({ organizer_noun: 'family' }))).host, 'family');
});

// ── THE SOURCE SCAN ────────────────────────────────────────────────────────
// Rule 6: every call site passes the noun. A typecheck failure is the real
// guard (the parameter is required with no default), but that only holds while
// the parameter STAYS required — this catches a future edit that gives it a
// default and re-opens the drift the required prop exists to prevent.

/** Strip comments — this module's docblocks quote the defect they fixed. */
const strip = (s: string) =>
  s
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

/** Every .ts/.tsx under app/ and lib/, excluding tests. Derived, not listed. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  return out;
}

test('every call site passes the organiser noun', () => {
  const CALL = 'inquiryPlaceholderLabel(';
  const sites: Array<{ file: string; text: string }> = [];
  let scanned = 0;
  for (const file of sourceFiles()) {
    const src = strip(readFileSync(file, 'utf8'));
    scanned += 1;
    let i = src.indexOf(CALL);
    while (i !== -1) {
      // Take the balanced argument list so a nested call cannot truncate it.
      let depth = 0;
      let j = i + CALL.length - 1;
      for (; j < src.length; j += 1) {
        if (src[j] === '(') depth += 1;
        else if (src[j] === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      sites.push({ file: relative(WEB, file), text: src.slice(i, j + 1) });
      i = src.indexOf(CALL, j);
    }
  }
  // FLOOR — a scan matching nothing must FAIL, not pass silently. There are six
  // rendering call sites plus the definition's own re-export shape.
  assert.ok(scanned > 500, `only scanned ${scanned} source files`);
  assert.ok(sites.length >= 6, `expected >= 6 call sites, found ${sites.length}`);

  for (const s of sites) {
    // The definition itself is not a call site.
    if (s.file === join('lib', 'inquiry-mask.ts')) continue;
    assert.ok(
      /hostNoun|INQUIRY_MASK_UNKNOWN/.test(s.text),
      `${s.file} calls inquiryPlaceholderLabel without an organiser noun:\n${s.text}`,
    );
  }
});

test('inquiry-mask.ts stays DEPENDENCY-FREE — the reason the noun is threaded', () => {
  // 🔑 THIS IS THE PREMISE OF THE WHOLE DESIGN. The module's docblock promises
  // it is "dependency-free (safe to import anywhere + unit-testable)", which is
  // exactly why the noun cannot be resolved here and must be passed in. If a
  // future edit adds an import, the honest fix becomes "just read the profile"
  // — and the required parameter stops earning its keep. Fail loudly instead.
  const raw = readFileSync(join(WEB, 'lib', 'inquiry-mask.ts'), 'utf8');
  const imports = strip(raw).match(/^\s*import\s/gm) ?? [];
  assert.equal(
    imports.length,
    0,
    `lib/inquiry-mask.ts must import nothing; found ${imports.length} import(s)`,
  );
  assert.doesNotMatch(strip(raw), /\brequire\(/, 'no runtime require() either');
  // FLOOR — the file must actually have been read.
  assert.ok(raw.length > 500, 'inquiry-mask.ts read back suspiciously short');
});

test('the parameter stays REQUIRED — no default may creep in', () => {
  const src = strip(readFileSync(join(WEB, 'lib', 'inquiry-mask.ts'), 'utf8'));
  // ⚠ SCOPED TO THE FUNCTION'S OWN PARAMETER LIST. A bare file-level match for
  // `hostNoun: string | null;` is ALSO satisfied by the exported
  // INQUIRY_MASK_UNKNOWN constant's type — so it would stay green with the
  // parameter made optional. That is the file-level-match trap this repo keeps
  // paying for; the parameter object is extracted first.
  const sig = /export function inquiryPlaceholderLabel\(input: \{([\s\S]*?)\}\): string \{/.exec(
    src,
  );
  assert.ok(sig, 'could not find the inquiryPlaceholderLabel parameter list');
  const params = sig![1];
  assert.match(params, /hostNoun: string \| null;/, 'hostNoun must be a required `string | null`');
  assert.doesNotMatch(params, /hostNoun\?:/, 'hostNoun must not become optional');
  // The two neighbouring params ARE optional — proving the extraction really
  // looked at the parameter list and not at some other block.
  assert.match(params, /eventType\?:/);
  assert.match(params, /city\?:/);
  assert.doesNotMatch(src, /hostNoun\?:/, 'hostNoun must not become optional anywhere');
  assert.doesNotMatch(
    src,
    /hostNoun[^;\n]*=\s*['"`]/,
    'hostNoun must not acquire a default — that is the drift the required prop prevents',
  );
  // The old hardcoded opener must not come back in any form.
  assert.doesNotMatch(
    src,
    /['"`]A couple planning/,
    'the hardcoded "A couple planning" opener is back',
  );
});
