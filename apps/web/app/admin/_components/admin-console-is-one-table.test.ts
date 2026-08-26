/**
 * admin-console-is-one-table.test.ts — the admin console gets ONE table.
 *
 * 108 admin routes. On 2026-08-17, 34 files under `app/admin` hand-rolled a raw
 * `<table>` and `app/admin/_components` held 13 files, none of them a table. The
 * markup was already a convention nobody could import — 13 tables opened with
 * `w-full text-left text-sm` and 12 carried the same header recipe — so the debt
 * was not that the tables looked different. It was that each one re-decided the
 * three things that are easy to get wrong: what a failed read looks like, what a
 * truncated read looks like, and whether a label is readable.
 *
 * Both regressions this file guards are SILENT. A 35th hand-rolled table looks
 * completely fine in isolation, and a page printing "nothing here" over a broken
 * query looks the most fine of all.
 *
 * 🛡 EVERY ASSERTION HERE WAS MUTATION-CHECKED — each rule broken on purpose,
 * the OCCURRENCE COUNT printed before and after to prove the sabotage landed,
 * and the test confirmed RED before being trusted. This repo has shipped guards
 * that passed while the thing they guard was gone; an unmeasured mutation proves
 * nothing, and a sabotage that does not land reads exactly like a pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN = resolve(HERE, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * Strip comments before matching.
 *
 * 🔑 NOT COSMETIC. Every converted surface carries a note naming the exact
 * string it removed — `data ?? []`, `text-terracotta`, `text-ink/55` — so a
 * guard reading raw source finds the defect inside the sentence announcing its
 * own removal and reports work that is already done. Measured on the three
 * surfaces converted here: raw source reports 6 offences, stripped source
 * reports 0, and 0 is the true number.
 */
const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

const read = (rel: string) => readFileSync(join(ADMIN, rel), 'utf8');
const ARCHETYPE = '_components/console-table.tsx';

const FAILS_CLOSED_ON_NULL: Array<{ file: string; varName: string; proof: RegExp }> = [
  {
    file: 'accounts/_surfaces/demo-vendors-surface.tsx',
    varName: 'profile',
    // The exemption is only valid while the value still feeds THIS decision.
    // Both implementations of the predicate return false on null
    // (`lib/demo-mode.ts` `if (!profile) return false`, `admin-predicate.ts`
    // `!!(profile?…)`), so null → false → denied.
    proof: /return isAdminProfile\(profile\)/,
  },
  {
    file: 'compliance/data-sheet/page.tsx',
    varName: 'me',
    // ⚠ THE PROOF PINS THE `notFound()`, NOT THE READ — and that distinction is
    // the whole lesson of the first version of this list. Pinned to the read, the
    // entry would survive deleting the very line that makes it safe. What makes
    // this read safe is `if (!(me?.is_internal || me?.is_team_member ||
    // me?.account_type === 'admin')) notFound()`: a null `me` fails every disjunct,
    // so the page is not found. Absence DENIES here; it does not render.
    // Classified by the lane-D session and confirmed by reading the guard.
    proof: /notFound\(\)/,
  },
];

/**
 * 🛑 THE EXEMPTION MUST PROVE ITSELF — and the first version of it did not.
 *
 * It was a bare `Set` of `file:varname` strings carrying its reason in a comment.
 * The lane-C session broke it in the only way that matters: replacing
 * `return isAdminProfile(profile)` with `return Boolean(profile)` left the guard
 * GREEN, and so did making that value feed a RENDERED expression instead of the
 * auth decision. **The cited reason could vanish while the exemption survived** —
 * and the key was `file:varname`, the one thing that will NOT change when the
 * failure mode does.
 *
 * 🔑 FOURTH INSTANCE OF THIS SHAPE IN ONE DAY: the `CONVERTED` list, the
 * hand-enumerated bill, `PRIVATE_SUBDIRS`, and this. **A list entry that decides
 * what gets checked has to be pinned to something measured.** So each entry now
 * carries a `proof` pattern that must still match the file; if it stops matching,
 * the exemption VOIDS and the read is reported like any other.
 */
function exemptionHolds(rel: string, varName: string, src: string): boolean {
  const e = FAILS_CLOSED_ON_NULL.find((x) => x.file === rel && x.varName === varName);
  if (!e) return false;
  return e.proof.test(src);
}


/**
 * The converted surfaces. The first tranche was deliberately the pure records
 * lists, where the whole page IS the table — those prove the archetype on real
 * data without re-deciding any page's composition. The files still on the bill
 * below are the remaining work, and every one of them is named.
 *
 * ⚠ THIS ARRAY IS A UNION ACROSS LANES. Four sessions convert different
 * directories and each adds its own lines here; on a merge conflict take BOTH
 * sides' additions rather than choosing between them. Never resolve by hand-
 * picking: re-measure which files still hand-roll a table and let rule 1 prove
 * it, because it fails in both directions — a line dropped for a file nobody
 * converted, and a line kept for one that was.
 */
const CONVERTED = [
  // The transactions ledger on /admin/money — every order ever, the settled
  // ones included. Wears the archetype, so it is bound by the error-vs-empty,
  // cap and colour rules like every other console table.
  'money/_components/transactions-ledger.tsx',
  // The judgement queues + the money desks, 2026-08-17.
  // ⚠ ON TWO OF THESE THE TABLE WAS NOT WHERE THE LIE WAS: /admin/fraud's queue and
  // /admin/approvals' pending list are <ul>s of cards; their <table> is the audit
  // trail at the bottom. Converting the table alone would have fixed the trail and
  // left a GREEN TICK over "No open fraud signals." exactly where it was.
  // 🔑 CONVERTING A FILE'S TABLE IS NOT THE SAME AS MAKING THAT FILE HONEST.
  'approvals/page.tsx',
  'budget-planner/page.tsx',
  'force-majeure/page.tsx',
  'fraud/page.tsx',
  // Lane A · the account surfaces (2026-08-17). Five files, SIX tables — the
  // users surface held two, so its bill line only came out when both were done.
  'accounts/_surfaces/demo-vendors-surface.tsx',
  'accounts/_surfaces/events-surface.tsx',
  'accounts/_surfaces/users-surface.tsx',
  'accounts/_surfaces/vendors-surface.tsx',
  'accounts/_surfaces/venues-surface.tsx',
  'pax-changes/page.tsx',
  'pricing/_surfaces/price-bands-surface.tsx',
  'receipts/page.tsx',
  // Lane C · the five /admin/studio surfaces, 2026-08-17. Two of them printed
  // "nothing here" over a refused read (referrals never dropped the error it
  // fetched; patiktok never even destructured one — the LANE DOC counted one
  // liar, and not-destructuring is not the absence of a defect). Two were
  // already honest via a discriminated loader result and gained a named refusal
  // plus a disclosed cap that had been hiding one call frame away in lib/. One
  // threw, which is honest and the least useful honest answer available.
  // storytellers-surface.tsx holds TWO tables and both are converted here.
  'studio/_surfaces/discount-codes-surface.tsx',
  'studio/_surfaces/patiktok-surface.tsx',
  'studio/_surfaces/real-stories-surface.tsx',
  'studio/_surfaces/referrals-surface.tsx',
  'studio/_surfaces/storytellers-surface.tsx',
  // The App Performance studio — six surfaces, seven tables. These are the
  // MEASUREMENT screens, where a zero printed over a refused read is not a
  // small error: it is a graph saying the business stopped.
  'app-performance/_components/expenses.tsx',
  'app-performance/_surfaces/browser-blocks-surface.tsx',
  'app-performance/_surfaces/funnels-surface.tsx',
  'app-performance/_surfaces/intelligence-surface.tsx',
  'app-performance/_surfaces/operations-surface.tsx',
  'app-performance/_surfaces/seo-surface.tsx',
  // ── Lane D · the last ten top-level pages (2026-08-17) ──────────────────
  'account-deletions/page.tsx',
  'completions/page.tsx',
  'compliance/data-sheet/page.tsx',
  'demo-vendors/inquiries/page.tsx',
  'disputes/page.tsx',
  'offline/_components/offline-diagnostic.tsx',
  'papic-storage/page.tsx',
  'settings/payment-methods/page.tsx',
  'vendor-partnerships/page.tsx',
  'website-media/media-table.tsx',
  // The learned-memory screen, 2026-08-26 — the assistant's own table.
  'search-memory/search-memory-table.tsx',
];

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE BILL, NAMED — and it can only shrink
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The files that still hand-roll a raw `<table>`, pinned EXACTLY. 31 at the
 * archetype's landing, 26 after lane A converted the five account surfaces.
 *
 * ⚖ A 27th file adopting a raw table FAILS. Converting one of these also FAILS,
 * telling you to delete its line. Never add a line to go green: each one is a
 * surface that re-decides error-vs-empty on its own, and 16 of the original 34
 * decided it wrong.
 *
 * A BASELINE IS A BILL, NOT A DECISION. This one is visible and directional.
 *
 * ⛔ `ugat/_components/ugat-console.tsx` is the one entry that is NOT owed. It
 * ships its own stylesheet (`ugat-console.css`, where `.ug-etable` is really
 * defined) and is a purpose-built graph console, not a records list. It is on
 * the list because the shape is present, not because a conversion is expected.
 *
 * 🪤 `offline/_components/offline-diagnostic.tsx` renders `className="m-table"`,
 * and there is NO `.m-table` anywhere in the repo — `.m-card` exists, so the
 * name reads plausible and styles nothing. A className that does not exist fails
 * the way everything else in this codebase fails: silently, with an absence as
 * the only symptom.
 */
const RAW_TABLE_BILL = [
  // ⛔ NOT OWED, AND NOT UNFINISHED — one of the TWO permanent residents here.
  // Its three tables were two records lists (categories of data subjects,
  // sub-processors — both CONVERTED, see the list above) and one `FieldTable`,
  // a printed FIELD SHEET of `<th scope="row">` label/value pairs, rendered five
  // times. ConsoleTable is a columns-with-headers records component: wearing it
  // there would add a visible "Field | Value" header row to a document the owner
  // prints and files with the NPC, and drop the row-header semantics a screen
  // reader uses to announce each field. Same call as ugat, recorded at the
  // component too. DO NOT force it to clear this line.
  //
  // 🔑 IT IS ON THIS LIST *AND* ON `CONVERTED`, AND THAT IS CORRECT — do not
  // "tidy" it off either one. It imports ConsoleTable (its two genuine lists are
  // converted) and it still holds a raw table (the field sheet). A partly
  // converted file genuinely belongs to both, and each rule sees it truthfully.
  'compliance/data-sheet/page.tsx',
  // ⛔ NOT OWED — the other permanent resident. Ships its own stylesheet
  // (`ugat-console.css`, where `.ug-etable` is really defined) and is a
  // purpose-built graph console, not a records list.
  'ugat/_components/ugat-console.tsx',
].sort();

test('no new hand-rolled table appears in the admin console', () => {
  const found: string[] = [];
  for (const file of walk(ADMIN)) {
    const rel = file.slice(ADMIN.length + 1);
    if (rel === ARCHETYPE) continue; // the archetype IS the one legitimate <table>
    if (/<table\b/.test(code(readFileSync(file, 'utf8')))) found.push(rel);
  }
  assert.deepEqual(
    found.sort(),
    RAW_TABLE_BILL,
    'A file NOT on this list has hand-rolled a table — render <ConsoleTable> ' +
      'instead; it owns error-vs-empty, the cap disclosure and the readable ' +
      'header. A file still ON the list that no longer matches has been ' +
      'converted — delete its line. Never add a line to go green.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · A FAILED READ CAN NEVER RENDER AS AN EMPTY LIST
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The defect the archetype exists to close, measured in production code today:
 * Supabase RESOLVES with `{ error }` instead of throwing, so a rejected query —
 * phantom column, stale enum value, unapplied migration, missing grant — arrives
 * as `data: null`. `(data ?? [])` turns that into an empty array, and the page
 * prints a calm sentence saying there is nothing here.
 *
 *   /admin/approvals   → "No approvals pending. Set na 'yan."
 *   /admin/fraud       → "No open fraud signals."
 *   /admin/pax-changes → "No pax-driven cost changes yet."  (now converted)
 *
 * These are the three assertions that say the mechanism is still wired, not just
 * that the words are still in the docblock. A sentence is not a mechanism.
 */
test('the archetype routes through the shared state resolver, not its own branch', () => {
  const src = code(read(ARCHETYPE));
  assert.match(
    src,
    /resolveSurfaceState\(/,
    'Precedence (error beats locked beats denied beats empty) belongs to the ' +
      'one tested resolver. A local `if (rows.length === 0)` is how every ' +
      'hand-rolled table got it wrong.',
  );
  assert.match(
    src,
    /error:\s*Boolean\(readError\)\s*\|\|\s*!measured/,
    'BOTH halves are required. `readError` catches a query Supabase refused; ' +
      '`!measured` catches rows that were never counted at all. Dropping ' +
      'either one restores the bug: an unmeasured list is not a zero-length one.',
  );
  assert.match(
    src,
    /rows:\s*Row\[\]\s*\|\s*null\s*\|\s*undefined/,
    'The type is the guard. If `rows` stops admitting null, every caller goes ' +
      'back to `?? []` at the read site and the distinction is lost before it ' +
      'ever reaches this component.',
  );
});

test('readPermitted is the literal true, so Empty cannot be claimed without proof', () => {
  const src = code(read(ARCHETYPE));
  assert.match(
    src,
    /readPermitted:\s*true;/,
    'Typed as the literal `true`, exactly as in EmptyState: an RLS denial and ' +
      'an empty read are the same `count: 0`, so there must be no way to pass ' +
      'a value you cannot write honestly. A production desk once printed "no ' +
      'requests yet" over three real pending rows.',
  );
});

test('every converted surface hands its read error to the table', () => {
  // POSITIVE CONTROL — rule 2 checks the component; this checks that real pages
  // actually feed it. A component that handles errors nobody passes it is a
  // mechanism never proven reachable.
  const offenders: string[] = [];
  for (const rel of CONVERTED) {
    const src = code(read(rel));
    if (!/readError=\{/.test(src)) offenders.push(`${rel} (no readError passed)`);
    // A BLANKET BAN ON `?? []` WAS BOTH TOO BLUNT AND TOO WEAK, and finding out
    // which cost a real defect. Too blunt: a LABEL lookup (business names, event
    // names, the evidence blob) legitimately falls back to an empty list — it does
    // not decide whether the surface is empty, so the primary read still governs
    // the state. Too weak: on /admin/fraud those label reads were swallowed
    // ENTIRELY, so a refused evidence read rendered every card with no evidence
    // at all — a flag that looks raised on no basis — and a rule that only
    // examined the primary read passed it.
    // ⇒ The invariant is not "never coerce", it is "never coerce a read whose
    // failure nothing can see". Every `X.data ?? []` must have X's error bound.
    for (const m of src.matchAll(/\b([A-Za-z_$][\w$]*)\.data\s*\?\?\s*\[\]/g)) {
      const holder = m[1];
      const bound =
        new RegExp(`'error'\\s+in\\s+${holder}\\b`).test(src) ||
        new RegExp(`\\b${holder}\\.error\\b`).test(src);
      if (!bound) offenders.push(`${rel} (${holder}.data ?? [] with ${holder}'s error never bound)`);
    }
    // 🪤 AND THE DESTRUCTURE-RENAME FORM WAS A BLIND SPOT IN THE RULE ABOVE.
    // `const { data: us } = await admin…` then `(us ?? [])` never writes
    // `us.data`, so the matcher could not see it — and /admin/approvals had TWO
    // of exactly that shape, both feeding the name of the person a four-eyes
    // request is ABOUT. This is the same miss lane D found in my original count:
    // I matched a spelling instead of the capability. Any read destructured
    // WITHOUT binding its error is an offence regardless of what happens next.
    for (const m of src.matchAll(/const\s*\{\s*data:\s*(\w+)\s*\}\s*=\s*await/g)) {
      // 🪤 AND THIS RULE CRIED WOLF ON ITS FIRST RUN, which is why the exemption
      // exists. `demo-vendors-surface`'s unbound read is an AUTHORISATION check
      // ending in `return isAdminProfile(profile)` — a refused read yields null,
      // yields false, and DENIES. That is the correct failure mode, and demanding
      // an error binding there would be noise on a read that is already safe by
      // construction. A guard that cries wolf teaches you to skim past the one
      // time it is right.
      // ⚖ The distinction is not "is the error bound" but WHAT AN ABSENCE MEANS:
      // absence that RENDERS as data is the defect; absence that DENIES is the fix.
      const holder = m[1] ?? '';
      if (exemptionHolds(rel, holder, src)) continue;
      offenders.push(`${rel} (const { data: ${holder} } destructured with no error bound)`);
    }
    // And the PRIMARY read must never be flattened at the read site.
    if (/\bconst\s+\w+\s*=\s*\(?data\s*\?\?\s*\[\]/.test(src)) {
      offenders.push(`${rel} (primary read flattened to [] before the table sees it)`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A converted surface must pass the `{ error }` Supabase resolved with, and ' +
      'must not flatten `null` to `[]` at the read site — flattening it there ' +
      `puts the lie in before the table can catch it. Offenders: ${offenders.join(', ')}`,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE SURFACES THAT WEAR IT
   ══════════════════════════════════════════════════════════════════════════ */

test('the converted surfaces actually import the archetype — a rule nothing satisfies is not a rule', () => {
  const wearing = CONVERTED.filter((rel) =>
    /_components\/console-table/.test(code(read(rel))),
  );
  assert.equal(
    wearing.length,
    CONVERTED.length,
    `Only ${wearing.length} of ${CONVERTED.length} converted surfaces import ` +
      'ConsoleTable. Rules 2 and 4 pass vacuously on a page that renders ' +
      'nothing — this is the check that says the table is actually worn.',
  );
});

/**
 * …AND THE LIST ITSELF WAS PINNED TO NOTHING. Found 2026-08-17 by sabotage,
 * while converting lane C: DELETING a line from `CONVERTED` left this file
 * GREEN — 10/10 — because every rule that matters iterates `CONVERTED`, and a
 * shorter list simply checks fewer files. So the error rule, the cap rule and
 * the colour rule could all be switched off for any surface, one line at a
 * time, and CI would never say a word. The bill above can only shrink; this
 * list could silently shrink too, and it is the half that does the work.
 *
 * 🔑 A GUARD WHOSE SUBJECT LIST IS HAND-MAINTAINED IS ONLY AS WIDE AS THAT
 * LIST — the same shape as the hand-enumerated door list that missed three
 * doors on 2026-08-17, and of the deny-list that went stale in #4364. The fix
 * is to DERIVE the membership instead of trusting it: wearing the archetype is
 * an observable fact about a file, so measure it.
 */
test('every admin file that wears the archetype is ON the converted list', () => {
  const wearing: string[] = [];
  for (const file of walk(ADMIN)) {
    const rel = file.slice(ADMIN.length + 1);
    if (rel === ARCHETYPE) continue;
    if (/_components\/console-table/.test(code(readFileSync(file, 'utf8')))) {
      wearing.push(rel);
    }
  }
  assert.deepEqual(
    wearing.sort(),
    [...CONVERTED].sort(),
    'A file imports ConsoleTable but is missing from CONVERTED, so it is exempt ' +
      'from the error-vs-empty rule, the cap rule and the colour rule while ' +
      'looking completely converted. Add it. And never delete a line to go ' +
      "green — deleting one is how a surface's read error stops being checked.",
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · NO SILENT CAPS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 21 of the original 34 tables `.limit(...)` their read and only 6 said so.
 * `/admin/approvals` caps recently-decided at 10 with no note; a demo-vendor
 * surface caps at 2000. Silent truncation reads as "this is all of it", which is
 * the wrong answer for anyone reconciling money or mediating a dispute.
 */
test('a capped read discloses its cap', () => {
  const offenders: string[] = [];
  for (const rel of CONVERTED) {
    const src = code(read(rel));
    if (/\.limit\(/.test(src) && !/cap=\{/.test(src)) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    'A converted surface that limits its read must pass the SAME constant as ' +
      '`cap`, so a full page says "there are more". Two hand-typed copies of ' +
      `the number is not a guard — pass the constant. Offenders: ${offenders.join(', ')}`,
  );
  // And the archetype must still be able to say it.
  assert.match(
    code(read(ARCHETYPE)),
    /There are more/,
    'ConsoleTable must keep the disclosure sentence; without it `cap` is a ' +
      'prop that does nothing and the caps go back to being silent.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · COLOUR, MEASURED IN BOTH THEMES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * TWO GOLDS, TWO RULES. The Tailwind slot named `terracotta` holds the atelier
 * GOLD #A9834B — 3.37:1 on the cream page, an AA failure at any text size. The
 * CTA terracotta #C24E25 (4.61:1) lives in the slot named `mulberry`. Inherited,
 * backwards, and it has now bitten three times: `text-terracotta` LOOKS like the
 * safe brand colour and is the unsafe one.
 *
 * A gold ICON is allowed (non-text needs 3:1) and so is the 4% row-hover tint,
 * which carries no glyph.
 */
test('neither the archetype nor a converted surface paints TEXT in the 3.37:1 gold', () => {
  const offenders: string[] = [];
  for (const rel of [ARCHETYPE, ...CONVERTED]) {
    const src = code(read(rel));
    const all = src.match(/text-terracotta\b(?!-)/g) ?? [];
    // 🪤 THE ICON EXEMPTION IS NOT A LOOPHOLE — it is the rule. Gold clears the
    // 3:1 non-text bar at 3.37:1, so a gold lucide glyph is correct and the
    // first cut of this test FAILED on one (the Gauge beside the price-bands
    // h1). A guard that cries wolf teaches you to skim past the one time it is
    // right, so the exemption is narrow: the class must be LAST in the string
    // and `strokeWidth` must immediately follow, which only a lucide icon does.
    const icons = src.match(/text-terracotta"\s+strokeWidth/g) ?? [];
    const asText = all.length - icons.length;
    if (asText > 0) offenders.push(`${rel} (${asText})`);
  }
  assert.deepEqual(
    offenders,
    [],
    'Reach for `text-mulberry` (#C24E25, 4.61:1) or `text-link` (#3B4E67, ' +
      `8.22:1). Offenders: ${offenders.join(', ')}`,
  );
});

test('the table header label clears AA in the light theme', () => {
  const src = code(read(ARCHETYPE));
  // MEASURED, not chosen: on this component's own `bg-ink/[0.03]` fill,
  // text-ink/55 is 3.24:1 light / 5.50:1 dark — a hard AA fail for 11px text in
  // the theme most people use, and it is the value ~12 shipped admin tables
  // still carry. text-ink/70 is 5.02:1 light / 8.32:1 dark. There is no
  // large-text exception at 11px.
  assert.match(
    src,
    /text-\[11px\] uppercase tracking-\[0\.12em\] text-ink\/70/,
    'The header keeps the shipped 11px uppercase structure and the CORRECTED ' +
      'alpha. Do not "restore" ink/55 for consistency with the unconverted ' +
      'tables — consistency with a measured AA failure is not a reason.',
  );
  assert.doesNotMatch(
    src,
    /uppercase tracking-\[0\.12em\] text-ink\/(?:45|50|55|60)\b/,
    'ink/45 · ink/50 · ink/55 · ink/60 all measure below 4.5:1 on the header ' +
      'fill in the light theme (2.48 · 2.9 · 3.24 · 3.72).',
  );
});

test('the state primitives this archetype adopted are AA in BOTH themes', () => {
  // These two shipped with ZERO consumers, so nothing was ever live — but the
  // console table is their first consumer, which makes them this file's problem.
  // A light-only contrast check waves both of these through.
  const empty = code(readFileSync(resolve(ADMIN, '..', '_components/states/empty-state.tsx'), 'utf8'));
  const error = code(readFileSync(resolve(ADMIN, '..', '_components/states/error-state.tsx'), 'utf8'));
  assert.doesNotMatch(
    empty,
    /text-ink\/45/,
    'EmptyState’s audit line measured 2.62:1 on cream at ink/45 — 9px text at ' +
      'well under the 4.5:1 floor. ink/70 is 5.29:1 light / 8.93:1 dark.',
  );
  assert.doesNotMatch(
    error,
    /text-ink\/45/,
    'ErrorState’s three beat labels measured 2.44:1 on their own mulberry/5 ' +
      'panel at ink/45. ink/70 is 4.94:1 light / 8.40:1 dark.',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   6 · THE ARCHETYPE OFFERS NO BUTTONS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 🔒 JUDGEMENT QUEUES GET NO BUTTON AT ALL — disputes, fraud, user reports,
 * erasure requests, integrity watch, concierge abuse, force majeure. A fast
 * button invites a wrong call at speed on exactly the queues where being wrong
 * costs most, and silence alone would read as an unfinished screen, so `note`
 * puts a SENTENCE where the controls would be.
 *
 * The archetype therefore has no actions API at all. A row that genuinely
 * settles on one click renders its own form inside its own `cell` — the caller
 * has to mean it. This is the rule that stops a future session "improving" the
 * console by adding a bulk-action bar to everything it converts.
 */
test('the archetype has no actions API and renders no page chrome of its own', () => {
  const src = code(read(ARCHETYPE));
  assert.doesNotMatch(
    src,
    /\bonRowAction\b|\bbulkActions\b|\browActions\b|\bactions\??:/,
    'No actions API. The action shape is decided by what the server action ' +
      'refuses to run without — reviews throw without an override reason, ' +
      'payouts need a method and a reference — never by a table prop that ' +
      'makes every queue look one-click.',
  );
  assert.match(
    src,
    /note\?:/,
    'Keep `note`: it is the slot where a judgement queue says in words why ' +
      'there is nothing to press. Its presence is the decision.',
  );
  assert.doesNotMatch(
    src,
    /<main\b/,
    'The admin shell renders no <main> of its own — do not copy another ' +
      'tree’s shell placement into it. This component is a fragment inside a ' +
      'page, not a page frame.',
  );
});
