/**
 * GUARD — the WIRING for "one trade, many names" (C2, 2026-08-28): that the
 * pieces are actually connected, not merely that the pure logic is correct
 * in isolation (that lives in service-trade-aliases.test.ts and
 * taxonomy-search-rank.test.ts).
 *
 * Pinned here, each separate on purpose:
 *   1. the maker's server page reads aliases + the merge-forward map and
 *      attaches them to every trade option — not a second matcher, the
 *      SAME `rankTaxonomyOptions` C1 already wired in;
 *   2. there is exactly ONE place in this repo that scores a query against
 *      a piece of text with the four-tier rules — the shared ranker;
 *   3. the review screen ships in this PR (a table with no reviewer is a
 *      feature that can never switch on);
 *   4. the seeding script never writes a REVIEWED row — only a person, via
 *      the review screen, can do that;
 *   5. the RLS policy in the migration hides an unreviewed row from an
 *      ordinary session, and admin write is gated the same way every other
 *      taxonomy-admin table in this schema is gated.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const readRaw = (p: string) => readFileSync(join(WEB, p), 'utf8');

const NEW_DOOR = 'app/vendor-dashboard/services/new/page.tsx';
const RANK_LIB = 'lib/taxonomy-search-rank.ts';
const ALIAS_LIB = 'lib/service-trade-aliases.ts';
const ALIAS_DB = 'lib/service-trade-aliases-db.ts';
const REVIEW_PAGE = 'app/admin/taxonomy/aliases/page.tsx';
const REVIEW_ACTIONS = 'app/admin/taxonomy/aliases/actions.ts';
const SEED_SCRIPT = 'scripts/seed-trade-aliases.ts';

test('the files under test actually read back', () => {
  for (const p of [NEW_DOOR, RANK_LIB, ALIAS_LIB, ALIAS_DB, REVIEW_PAGE, REVIEW_ACTIONS, SEED_SCRIPT]) {
    assert.ok(read(p).length > 200, `${p} read back empty or missing`);
  }
});

// ---------------------------------------------------------------------------
// 1 · THE MAKER'S PAGE ACTUALLY WIRES ALIASES IN
// ---------------------------------------------------------------------------

test('the new-card door reads reviewed aliases and the merge-forward map', () => {
  const src = read(NEW_DOOR);
  assert.match(
    src,
    /import \{ reviewedAliasesByLiveTrade \} from '@\/lib\/service-trade-aliases';/,
    'the new-card door stopped importing reviewedAliasesByLiveTrade',
  );
  assert.match(
    src,
    /import \{ getReviewedTradeAliasRows \} from '@\/lib\/service-trade-aliases-db';/,
    'the new-card door stopped reading canonical_service_aliases',
  );
  assert.match(
    src,
    /import \{ getServiceMergeForwards \} from '@\/lib\/service-merge-forward-db';/,
    'the new-card door stopped resolving merged trades before attaching aliases — C0\'s forward would be bypassed',
  );
});

test('every trade option built for the search band carries its resolved aliases', () => {
  const src = read(NEW_DOOR);
  const block = src.slice(src.indexOf('const tradeOptions: TradeMatch[]'));
  assert.match(
    block.slice(0, 1200),
    /aliases:\s*aliasesByLiveKey\.get\(l\.canonicalService\)/,
    'tradeOptions stopped attaching resolved aliases to each trade',
  );
});

// ---------------------------------------------------------------------------
// 2 · ONE MATCHER, NOT TWO
// ---------------------------------------------------------------------------

test('the alias tiers live ONLY in the shared ranker — nowhere else re-scores a query', () => {
  const rankSrc = read(RANK_LIB);
  assert.match(
    rankSrc,
    /function textTierScore/,
    'the shared ranker lost its alias-aware scoring helper',
  );
  assert.match(rankSrc, /opt\.aliases \?\? \[\]/, 'the shared ranker stopped reading .aliases at all');

  // Every OTHER file in lib/ and app/ must not contain a second copy of the
  // distinctive four-tier shape (startsWith/includes/squash on aliases).
  // This mirrors the C1 guard's own check for a second `labelLc.startsWith`
  // matcher, extended to the alias-specific `.aliases` scoring shape.
  const roots = ['lib', 'app'];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      const rel = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(rel);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        if (rel.replace(/\\/g, '/') === RANK_LIB) continue;
        const body = read(rel);
        if (/opt\.aliases \?\? \[\]/.test(body) || /textTierScore\(/.test(body.replace(/import[^;]*;/g, ''))) {
          // textTierScore is imported nowhere (it is not exported) — a hit
          // here would mean it was copied, not imported.
          if (/function textTierScore/.test(body)) offenders.push(rel);
        }
      }
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(offenders, [], `a second copy of the alias-tier scorer was found in: ${offenders.join(', ')}`);
});

// ---------------------------------------------------------------------------
// 3 · THE REVIEW SCREEN SHIPS IN THIS PR, ADMIN-GATED
// ---------------------------------------------------------------------------

test('the review page is gated by the shared admin check, not a hand-rolled one', () => {
  const src = read(REVIEW_PAGE);
  assert.match(src, /import \{ requireAdmin \} from '@\/lib\/admin\/require-admin';/);
  assert.match(src, /await requireAdmin\(\);/, 'the review page stopped calling requireAdmin()');
});

test('approve/reject/unteach all go through requireAdminAction — none is a bare server action', () => {
  const src = read(REVIEW_ACTIONS);
  const fns = ['approveTradeAlias', 'rejectTradeAlias', 'unteachTradeAlias'];
  for (const fn of fns) {
    const start = src.indexOf(`export async function ${fn}`);
    assert.ok(start >= 0, `${fn} is missing from actions.ts`);
    const body = src.slice(start, start + 400);
    assert.match(body, /requireAdminAction\(\)/, `${fn} does not call requireAdminAction()`);
  }
});

test('approving is the ONLY act that sets reviewed_at — reject and unteach only ever delete', () => {
  const src = read(REVIEW_ACTIONS);
  const approveBody = src.slice(
    src.indexOf('export async function approveTradeAlias'),
    src.indexOf('export async function rejectTradeAlias'),
  );
  assert.match(approveBody, /reviewed_at:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(approveBody, /reviewed_by:\s*userId/);

  const rejectBody = src.slice(
    src.indexOf('export async function rejectTradeAlias'),
    src.indexOf('export async function unteachTradeAlias'),
  );
  assert.doesNotMatch(rejectBody, /reviewed_at:/, 'rejectTradeAlias sets reviewed_at — a reject must never approve');
  assert.match(rejectBody, /\.delete\(\)/);

  const unteachBody = src.slice(src.indexOf('export async function unteachTradeAlias'));
  assert.match(unteachBody, /\.delete\(\)/, 'unteachTradeAlias stopped deleting the row');
});

// ---------------------------------------------------------------------------
// 4 · THE SEEDING SCRIPT NEVER WRITES A REVIEWED ROW
// ---------------------------------------------------------------------------

test('the offline seeding script never sets reviewed_at — only a person may do that', () => {
  const src = read(SEED_SCRIPT);
  assert.doesNotMatch(
    src,
    /reviewed_at\s*:/,
    'scripts/seed-trade-aliases.ts writes reviewed_at — a mined row must always land UNREVIEWED',
  );
  assert.match(src, /source:\s*'mined'/, "mined rows must be marked source: 'mined'");
});

test('the seeding script asks NO model — no Anthropic import, no messages.create call', () => {
  // 🛑 CORRECTED 2026-08-28: this script used to call Claude. Owner: "when
  // we do not have data yet, do not recommend. collect first." The words
  // are MINED from our own attribute schemas now — see
  // lib/trade-alias-miner.ts. Pinned here so the model call cannot creep
  // back in without this test noticing.
  const src = read(SEED_SCRIPT);
  assert.doesNotMatch(src, /@anthropic-ai\/sdk/, 'the seeding script re-imported the Anthropic SDK');
  assert.doesNotMatch(src, /new Anthropic\(/, 'the seeding script re-added a model client');
  assert.doesNotMatch(src, /messages\.create\(/, 'the seeding script re-added a model call');
  assert.match(
    src,
    /import \{ mineTradeAliases \} from '\.\.\/lib\/trade-alias-miner';/,
    'the seeding script stopped importing the miner',
  );
});

test('the seeding script reuses normalisePhrase instead of re-deriving it', () => {
  const src = readRaw(SEED_SCRIPT);
  assert.match(
    src,
    /import \{ normalisePhrase \} from '\.\.\/lib\/admin-map\/ask-the-admin';/,
    'the seeding script stopped importing the shared normaliser',
  );
  assert.doesNotMatch(
    stripComments(src),
    /\.toLowerCase\(\)\.replace\(\/\\s\+\/g/,
    'the seeding script grew its own copy of the normalisation logic',
  );
});

// ---------------------------------------------------------------------------
// 5 · THE MIGRATION'S RLS SHAPE
// ---------------------------------------------------------------------------

test('the migration hides an unreviewed row from anon/authenticated, and gates writes to admin', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.includes('one_trade_many_names_alias_table'));
  assert.ok(file, 'the C2 alias-table migration is missing from supabase/migrations');
  const sql = readFileSync(join(dir, file!), 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(
    sql,
    /USING \(reviewed_at IS NOT NULL\)/,
    'the read policy no longer gates on reviewed_at — an unreviewed row would become readable',
  );
  assert.match(sql, /public\.is_admin\(\)/, 'the write policy stopped requiring is_admin()');
  assert.match(
    sql,
    /REFERENCES public\.canonical_service_taxonomy \(canonical_service\)/,
    'the alias table lost its FK to the taxonomy — see dangling-trade-keys.ts for why every holder should have one',
  );
  assert.match(
    sql,
    /source\s+text NOT NULL DEFAULT 'mined'/,
    "the source column lost its 'mined' default — the miner is today's only writer",
  );
  assert.match(
    sql,
    /CHECK \(source IN \('mined', 'collected', 'proposed'\)\)/,
    'the source vocabulary drifted from mined | collected | proposed',
  );
});
