#!/usr/bin/env node
/**
 * lint-pool-config-global-columns.mjs
 *
 * `public.papic_event_pool_config` now holds TWO KINDS OF ROW, and only one of
 * them owns most of its columns.
 *
 *   • `config_key = 'default'` — the GLOBAL row. It owns every column.
 *   • `config_key = '<event_type>'` — a SIZING row, added by migration
 *     20271239794268 so a christening is not quoted a wedding's 150 credits a
 *     head. **Only `points_per_guest`, `floor_points` and `ceiling_points` are
 *     ever read from one.**
 *
 * The other columns — `soft_stop_pct`, `pass_service_codes`, `is_active`,
 * `camera_grant_points`, `free_grant_points`, `free_one_camera_points` — exist
 * on a sizing row only because they are NOT NULL. They are seeded copies and
 * they are INERT.
 *
 * ── WHY A GUARD AND NOT A COMMENT ───────────────────────────────────────────
 * Before the seed the table was a singleton, so `select free_grant_points from
 * papic_event_pool_config` could not be wrong — there was one row. Every reader
 * in the tree happened to pin `config_key = 'default'` anyway, which is the
 * ONLY reason seeding 17 rows changed no shipped behaviour (audited across
 * `apps/web` and `supabase/migrations`, TS and SQL, 2026-09-22).
 *
 * That audit is a fact about a moment. The NEXT reader of a global column is
 * the one that silently answers off a sizing row — and it would answer with a
 * plausible number, not an error, because a sizing row carries a real copy.
 * 🔑 A WRONG `free_grant_points` IS FREE CREDITS HANDED OUT BY THE WRONG RULE,
 * and nothing would say so. Making the nullability structural instead would
 * turn six shipped columns nullable in the generated TypeScript across every
 * unrelated reader — a far larger blast radius than the fact it documents.
 *
 * ── HOW IT DECIDES ──────────────────────────────────────────────────────────
 * Comments are stripped with the repo's ONE stripper first, so this docblock —
 * which names every banned column — is not itself a finding.
 *
 * For each file that mentions the table, every occurrence of a global column
 * name is examined inside a window around it, and that window must contain a
 * `config_key = 'default'` pin. **Every occurrence is checked and the count is
 * printed**: a guard anchored on the first match faces the wrong cell, and a
 * sabotage that lands 2 -> 1 must not stay green.
 *
 * ⚠ It judges only files that NAME the table. A read through a helper that hides
 * the table name is outside what this can be sure of, and a guard that cries
 * wolf teaches you to skim past the one time it is right.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './port-controls.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = join(WEB, '..', '..');

const TABLE = 'papic_event_pool_config';

/**
 * Kept in step with `POOL_CONFIG_GLOBAL_COLUMNS` in
 * apps/web/lib/papic-pool-sizing.ts — the list is asserted against this one by
 * the check at the bottom, so the two cannot drift.
 */
const GLOBAL_COLUMNS = [
  'soft_stop_pct',
  'pass_service_codes',
  'is_active',
  'camera_grant_points',
  'free_grant_points',
  'free_one_camera_points',
];

/**
 * ── WHAT COUNTS AS A READ ───────────────────────────────────────────────────
 * Only a SELECT. `ALTER TABLE ... ADD COLUMN`, a CHECK constraint, a
 * `COMMENT ON COLUMN`, an INSERT column list and an UPDATE all NAME a global
 * column without reading one off the wrong row, and a guard that flagged them
 * would be 62 findings of noise on code that has been correct for a year.
 *
 * So each candidate is a whole STATEMENT, extracted two ways:
 *   • SQL  — from the `SELECT` that precedes a `FROM public.papic_event_pool_config`
 *            up to the terminating `;`.
 *   • TS   — the PostgREST chain that follows `.from('papic_event_pool_config')`.
 * The statement must carry a `config_key = 'default'` pin.
 */
const PIN = /config_key['"`]?\s*(?:=|,)\s*['"`]default['"`]/;

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.turbo',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js|sql)$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * SQL `--` line comments, blanked to spaces so offsets stay true.
 *
 * ⚠ THIS IS NOT A SECOND COMMENT STRIPPER. `lib/strip-comments.ts` is the one
 * stripper and it is a JS/TS lexer — it does not know `--`, and this guard
 * reads `.sql` files whose entire rationale lives in `--` prose that names
 * every column here. Three lines of line-filtering is not a lexer and does not
 * attempt to be; a `--` inside a SQL string literal would be over-stripped,
 * which can only make this guard see LESS, never more, and the occurrence count
 * printed below is what would reveal it.
 */
function blankSqlLineComments(src) {
  return src
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i) + ' '.repeat(line.length - i);
    })
    .join('\n');
}

/** Every SELECT statement in `sql` that reads from the config table. */
function sqlSelectStatements(sql) {
  const out = [];
  const re = new RegExp(`FROM\\s+(?:public\\.)?${TABLE}\\b`, 'gi');
  let m;
  while ((m = re.exec(sql)) !== null) {
    const before = sql.slice(0, m.index);
    const selectAt = before.toUpperCase().lastIndexOf('SELECT');
    if (selectAt === -1) continue;
    const semi = sql.indexOf(';', m.index);
    out.push(sql.slice(selectAt, semi === -1 ? sql.length : semi));
  }
  return out;
}

/** Every PostgREST chain in `ts` that reads from the config table. */
function tsQueryChains(ts) {
  const out = [];
  const re = new RegExp(`\\.from\\(\\s*['"\`]${TABLE}['"\`]\\s*\\)`, 'g');
  let m;
  while ((m = re.exec(ts)) !== null) {
    // The chain ends at the first `;` — PostgREST builders are one expression.
    const semi = ts.indexOf(';', m.index);
    out.push(ts.slice(m.index, semi === -1 ? ts.length : semi));
  }
  return out;
}

const files = [
  ...walk(join(WEB, 'app')),
  ...walk(join(WEB, 'lib')),
  ...walk(join(ROOT, 'supabase', 'migrations')),
];

/**
 * TWO STATEMENTS DELIBERATELY READ THE WHOLE TABLE, and both are correct.
 *
 * They are apply-time RAISE guardrails asserting that *no row anywhere* lists a
 * purchased Papic bucket in `pass_service_codes` — a SET question, not a
 * per-celebration read, so pinning `config_key = 'default'` would NARROW them
 * and is the opposite of what they need. Both live in migrations that are
 * already applied in production, and an applied migration is never edited.
 *
 * This list may only SHRINK. A new entry needs the same kind of reason written
 * beside it, not a path.
 */
const WHOLE_TABLE_ASSERTIONS = new Map([
  [
    'supabase/migrations/20270828140000_papic_one_tiers.sql',
    'lock § 11 apply-time guardrail: no row may list a Papic One tier as a pass',
  ],
  [
    'supabase/migrations/20271129155172_papic_pool_ladder_extends_to_thirty_thousand.sql',
    'apply-time guardrail: no row may leak a PAPIC_GUEST* rung into pass_service_codes',
  ],
]);

const failures = [];
let statementsChecked = 0;
let occurrencesChecked = 0;

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  if (!raw.includes(TABLE)) continue;

  const rel = relative(ROOT, file);
  // 🚨 THIS GUARD AND THE MODULE THAT DECLARES THE LIST hold the column names
  // as DATA, not as a read.
  if (
    rel.endsWith('scripts/lint-pool-config-global-columns.mjs') ||
    rel.endsWith('lib/papic-pool-sizing.ts')
  ) {
    continue;
  }

  if (WHOLE_TABLE_ASSERTIONS.has(rel)) continue;

  const isSql = file.endsWith('.sql');
  const src = isSql ? blankSqlLineComments(raw) : stripComments(raw);
  const statements = isSql ? sqlSelectStatements(src) : tsQueryChains(src);

  for (const stmt of statements) {
    statementsChecked += 1;
    if (PIN.test(stmt)) continue;
    for (const col of GLOBAL_COLUMNS) {
      if (!new RegExp(`\\b${col}\\b`).test(stmt)) continue;
      occurrencesChecked += 1;
      const at = src.indexOf(stmt);
      const line = src.slice(0, at < 0 ? 0 : at).split('\n').length;
      failures.push(
        `${rel}:${line}  selects ${TABLE}.${col} without pinning config_key = 'default'`,
      );
    }
  }
  // Count the pinned ones too, so the number below is coverage and not failures.
  for (const stmt of statements) {
    if (!PIN.test(stmt)) continue;
    for (const col of GLOBAL_COLUMNS) {
      if (new RegExp(`\\b${col}\\b`).test(stmt)) occurrencesChecked += 1;
    }
  }
}

// The two lists must not drift. Read the TS constant as text rather than
// importing it — this script is plain node and the module is TypeScript.
const sizingSrc = readFileSync(join(WEB, 'lib', 'papic-pool-sizing.ts'), 'utf8');
const declAt = sizingSrc.indexOf('export const POOL_CONFIG_GLOBAL_COLUMNS');
const declared = declAt === -1
  ? []
  : [...sizingSrc.slice(declAt, sizingSrc.indexOf(');', declAt)).matchAll(/'([a-z_]+)'/g)].map(
      (m) => m[1],
    );
const missing = GLOBAL_COLUMNS.filter((c) => !declared.includes(c));
const extra = declared.filter((c) => !GLOBAL_COLUMNS.includes(c));
if (missing.length || extra.length) {
  failures.push(
    `POOL_CONFIG_GLOBAL_COLUMNS in lib/papic-pool-sizing.ts has drifted from this guard's list` +
      (missing.length ? ` — missing there: ${missing.join(', ')}` : '') +
      (extra.length ? ` — extra there: ${extra.join(', ')}` : ''),
  );
}

// 🔑 PRINT WHAT WAS SEARCHED. A zero from a harness is not evidence; a guard
// that silently searched nothing reads exactly like a guard that passed.
console.log(
  `[pool-config-global-columns] ${statementsChecked} statement(s) read ${TABLE}; ` +
    `${occurrencesChecked} global-column selection(s) examined.`,
);

if (statementsChecked === 0 || occurrencesChecked === 0) {
  console.error(
    `\n✗ searched nothing — ${statementsChecked} statements, ${occurrencesChecked} selections. ` +
      `The walk or the table name is wrong; this is a failure, not a pass.`,
  );
  process.exit(1);
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} unpinned selection(s) of a global column:\n`);
  for (const f of failures) console.error(`   ${f}`);
  console.error(
    `\n  Only points_per_guest / floor_points / ceiling_points may be read off a\n` +
      `  per-event-type row. Everything else lives on config_key = 'default'.\n` +
      `  Resolve sizing with papic_event_pool_sizing() or pickPoolSizing().\n`,
  );
  process.exit(1);
}

console.log('✓ every global column is read off the default row');
