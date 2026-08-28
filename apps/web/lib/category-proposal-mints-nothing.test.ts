/**
 * THE MODEL MUST HAVE NO PATH TO THE MINT (C4, 2026-08-28).
 *
 * ── WHY THIS IS A TEST AND NOT A PARAGRAPH ──────────────────────────────────
 * A category leaf is close to permanent. `vendor_coverages.canonical_service`
 * carries NO foreign key at all (see lib/dangling-trade-keys.ts), so removing a
 * trade later strands the shops that listed under it with nothing in the
 * database able to report it. `promoteCategoryRequest`'s only duplicate check
 * is a SLUG match, so a machine minting freely would happily create
 * "Sorbetes Cart" beside the existing "Ice Cream Cart". And the owner's
 * standing rule (one-person admin plan, 2026-07-11) is that the assistant may
 * prepare and may hold back but may never be the thing that lets a publish
 * through — a public category is a publish.
 *
 * A docblock saying so is not a mechanism. These are the assertions.
 *
 * ⚠ SOURCE MATCHING CANNOT SEE A MISSING IMPORT — run `tsc` beside this file
 * (trap 4 of § 6 of the plan, which bit this stream on 2026-08-28).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { loadSources } from './gate-writers';

const WEB_ROOT = join(import.meta.dirname, '..');

/**
 * Every non-test source in the app, COMMENTS ALREADY STRIPPED, indexed by path.
 *
 * 🪤 THE STRIPPING IS LOAD-BEARING AND THIS GUARD FAILED WITHOUT IT ON ITS FIRST
 * RUN. Every ported file here carries a docblock naming the very strings it must
 * not contain — that is the whole point of the docblocks — so a raw-source match
 * reports the defect it just documented. `loadSources` is the repo's own single
 * stripper (lib/gate-writers.ts); a second hand-typed one here would be the
 * two-hand-typed-things failure in miniature.
 */
const SOURCES = new Map(loadSources(WEB_ROOT).map((s) => [s.path, s.code]));

function read(rel: string): string {
  const code = SOURCES.get(rel);
  assert.ok(code !== undefined, `no source at ${rel} — did the file move?`);
  return code;
}

/** Everything C4 added or that reaches its drafting path. */
const C4_MODULES = [
  'lib/category-proposal-draft.ts',
  'lib/category-proposal-draft-server.ts',
  'lib/category-proposal-flag.ts',
];

/**
 * The FILES ALLOWED TO NAME THE MINT AT ALL, with the reason each is here.
 *
 * 🔑 DERIVED, NOT DESCRIBED: the census below scans every non-test source in
 * the app and fails on anything not on this bill, so a new path to the mint —
 * including one added by a later session — has to be argued for in a diff.
 * Two of these are real call sites; three only carry the NAME as data, and a
 * generated inventory is not a caller.
 */
const MAY_NAME_THE_MINT: Record<string, string> = {
  'app/admin/taxonomy/actions.ts': 'the definition itself — admin-gated, audit-logged',
  'app/admin/taxonomy/_components/taxonomy-studio.tsx':
    'CALL SITE: the queue form a person submits',
  'app/admin/taxonomy/_components/prepared-job-card.tsx':
    'CALL SITE: the ⌘K prepared-job card, also a form a person submits',
  'app/admin/taxonomy/_components/prepared-jobs.ts': 'names the job in the ⌘K job list (data)',
  'lib/admin-map/admin-jobs.generated.ts': 'the scanned admin job inventory (generated data)',
  'lib/admin-map/prefill-consumers.ts': 'names which jobs accept a prefill (data)',
};

test('no C4 module can reach the mint, in any spelling', () => {
  for (const rel of C4_MODULES) {
    const code = read(rel);
    for (const forbidden of [
      'promoteCategoryRequest',
      'createCanonicalLeaf',
      'canonical_service_schemas',
      'canonical_service_taxonomy',
      'createTaxonomyNode',
    ]) {
      assert.equal(
        code.includes(forbidden),
        false,
        `${rel} names "${forbidden}" — the drafter must have no path to minting a category`,
      );
    }
  }
});

test('the drafter writes ONE table, and it is the drafts table', () => {
  const code = read('lib/category-proposal-draft-server.ts');
  const tables = [...code.matchAll(/\.from\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(tables)],
    ['taxonomy_category_request_drafts'],
    'the drafter touched a table other than its own',
  );
});

test('the pure draft module reaches no database and no network', () => {
  const code = read('lib/category-proposal-draft.ts');
  for (const forbidden of ['createAdminClient', 'createClient', 'Anthropic', 'fetch(', 'server-only']) {
    assert.equal(code.includes(forbidden), false, `the pure module names "${forbidden}"`);
  }
});

test('the census of everything that names the mint matches the bill exactly', () => {
  const found = [...SOURCES.entries()]
    .filter(([, code]) => code.includes('promoteCategoryRequest'))
    .map(([path]) => path)
    .sort();
  assert.deepEqual(
    found,
    Object.keys(MAY_NAME_THE_MINT).sort(),
    'a file gained (or lost) a reference to the mint — add it to MAY_NAME_THE_MINT with a reason, or remove the reference',
  );
});

test('the mint still refuses a request that is not pending, and still audits', () => {
  // The four shipped outcomes are NOT rebuilt by C4; this pins that the one
  // control a draft sits beside is unchanged in the ways that matter.
  const code = read('app/admin/taxonomy/actions.ts');
  assert.match(code, /const user = await requireAdmin\(\)/);
  assert.match(code, /That request was already resolved/);
  assert.match(code, /already exists — use Map instead of Promote/);
  assert.match(code, /action: 'taxonomy\.request_promote'/);
});

test('the reviewer may correct the minted NAME, and a bad correction is refused not ignored', () => {
  // Without a reader the drafted "clean name" would be decoration — a stored
  // value nothing consumes, the shape this repo keeps paying for.
  const code = read('app/admin/taxonomy/actions.ts');
  assert.match(code, /proposed_label_override/);
  assert.match(code, /Name must be 2–80 characters/);
  assert.match(code, /const canonical = slugify\(mintLabel, '_'\);/);
  assert.match(code, /display_name_en: mintLabel,/);
  const studio = read('app/admin/taxonomy/_components/taxonomy-studio.tsx');
  assert.match(studio, /name="proposed_label_override"/);
});
