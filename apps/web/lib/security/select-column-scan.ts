/**
 * Static scanner for `supabase.from('t').select('a, b, c')` pairs, and the
 * columns among them that no migration ever declared on `t`.
 *
 * WHY THIS EXISTS
 * ---------------
 * PostgREST fails the WHOLE query with `42703 undefined_column` if ANY named
 * column is unknown — it does not skip the bad one. supabase-js reports that as
 * `{ data: null, error }`, and a downstream `?? []` / `?? null` then renders the
 * failure as "no rows". The result is a feature that silently does nothing, in
 * production, indefinitely. One misspelled column also takes the whole row with
 * it: a header that asked for `business_name, logo_url, city` loses the name and
 * the logo too, not just the city.
 *
 * A single sweep on 2026-07-26 found 26 such sites across apps/web. All 26 were
 * real. Several had been live for months. Nothing in the type system, the
 * linter, the test suite or code review catches this class, because a PostgREST
 * select list is a string and the tables live in another process.
 *
 * WHAT IT COMPARES AGAINST
 * ------------------------
 * `readSchema()` from ./migration-schema — the ONE parser the repo uses to
 * derive "what columns does table X have" from `supabase/migrations`. Reused,
 * not cloned: two parsers would disagree, and the disagreement would be
 * invisible. That also makes this guard work offline with no database.
 *
 * HONEST LIMITS — read these before trusting a green run
 * ------------------------------------------------------
 *  1. WINDOW HEURISTIC. A `.select()` is attributed to the nearest preceding
 *     `.from()` within SELECT_WINDOW characters, and only if no other `.from()`
 *     intervenes. Chained or nested builder code can defeat this. It is tuned to
 *     under-report: any ambiguity is dropped rather than guessed. (On the
 *     2026-07-26 sweep it produced zero misattributions across 26 findings, but
 *     that is evidence, not a proof.)
 *  2. INTERPOLATED SELECTS ARE SKIPPED ENTIRELY. `.select(`...${embed}...`)` is
 *     not analysed — the string is not known until runtime. Several large
 *     queries in this repo build their select list that way and are invisible
 *     here.
 *  3. DYNAMIC TABLE NAMES ARE INVISIBLE. Only a literal `.from('table')` is
 *     matched. `.from(tableName)` is skipped.
 *  4. UNKNOWN TABLES ARE SKIPPED, NOT FLAGGED. If `readSchema()` has never seen
 *     the table, every column on it is accepted. That is deliberate: VIEWS are
 *     invisible to the migration parser (it reads CREATE TABLE / ALTER TABLE …
 *     ADD COLUMN only), as are tables created inside DO blocks or via dynamic
 *     SQL. Flagging them would drown the signal. It also means reads against a
 *     view are NOT guarded.
 *  5. IT CHECKS SELECTS ONLY. `.insert()`, `.update()`, `.upsert()`, `.eq()`,
 *     `.order()` and `.in()` can all name a phantom column and are not covered.
 *     The same sweep found phantom columns in `.eq()` filters and in an
 *     `.insert()` payload; those were found by hand.
 *  6. TEST FILES ARE NOT SCANNED (`*.test.ts(x)` / `*.spec.ts(x)`). Two reasons,
 *     one principled and one practical. Principled: this guard exists because a
 *     phantom column is SILENT on a production render path — in a test the same
 *     mistake fails loudly the moment the test runs, which is the opposite
 *     problem and already handled. Practical: this guard's own fixtures name
 *     deliberately-phantom columns, and an exclusion beats an arms race with
 *     the detector.
 *  7. ⚠ THE MIGRATIONS CAN THEMSELVES BE WRONG ABOUT PRODUCTION. This is the
 *     sharpest limit and it is not theoretical. `CREATE TABLE IF NOT EXISTS`
 *     silently no-ops against a table that already exists in a different shape:
 *     the migration is recorded as applied, `db push` reports success, and the
 *     declared column never lands. Two such columns were found on 2026-07-26
 *     (`manpower_gigs.posted_by_user_id`, `concierge_abuse_flags.admin_notes`) —
 *     this guard considered BOTH valid, because the migration text declares
 *     them, while production 42703'd on both. A migration-derived guard cannot
 *     see that class. Only diffing the real database against the declared
 *     schema can, and nothing does that yet.
 *
 * So: green here means "no select names a column the migrations never
 * declared". It does not mean "every query works against production".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSchema, type TableSchema } from './migration-schema';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib/security
/** apps/web/lib/security → apps/web is two levels up. */
export const APP_ROOT = path.resolve(HERE, '..', '..');

/**
 * How far after a `.from('t')` we will look for its `.select(...)`.
 * Chosen to span the multi-line, heavily-commented builder chains in this repo
 * without reaching into the next statement. Widening it trades false negatives
 * for misattribution risk; do not raise it without re-reading limit 1.
 */
export const SELECT_WINDOW = 700;

const SKIP_DIRS = new Set(['.next', 'node_modules', '.git', 'dist', 'coverage']);

/**
 * Test files are OUT OF SCOPE — see limit 7. They also hold this guard's own
 * fixtures, which name deliberately-phantom columns.
 */
export function isTestFile(name: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(name);
}

const FROM_RE = /\.from\(\s*'([a-z0-9_]+)'\s*\)/gi;
const SELECT_RE = /\.select\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/;

/** Not real column names when they appear in a PostgREST select list. */
const NOT_A_COLUMN = new Set(['', '*', 'count']);

export type SelectSite = {
  file: string;
  line: number;
  table: string;
  columns: string[];
};

export type PhantomColumn = {
  file: string;
  line: number;
  table: string;
  column: string;
  /** `table.column`, the stable key an allow-list entry pins. */
  key: string;
};

/**
 * Split a PostgREST select list into its TOP-LEVEL column names.
 *
 * Embedded resources are dropped whole: in `event:events!inner(event_id, date)`
 * the parenthesised body belongs to another table, and the `event:events!inner`
 * prefix is a relationship name rather than a column of the outer table. Both
 * go. Aliases (`label:real_col`), casts (`col::text`), JSON paths (`col->>x`)
 * and modifier hints (`col!inner`) are reduced to the bare column.
 */
export function parseSelectList(select: string): string[] {
  const segments: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of select) {
    if (ch === '(') {
      depth++;
      buf = ''; // discard the relationship name that introduced the embed
    } else if (ch === ')') {
      depth--;
      buf = '';
    } else if (ch === ',' && depth === 0) {
      segments.push(buf);
      buf = '';
    } else if (depth === 0) {
      buf += ch;
    }
  }
  segments.push(buf);

  const cols: string[] = [];
  for (const raw of segments) {
    let c = raw.replace(/\s+/g, ' ').trim();
    // ORDER MATTERS. The cast `::` must go BEFORE the alias `:`, or `col::text`
    // is read as the alias `col` on an empty column name and silently vanishes
    // — a column that disappears here is a column this guard stops guarding.
    c = (c.split('::')[0] ?? '').trim(); // col::cast
    if (c.includes(':')) c = (c.split(':', 2)[1] ?? '').trim(); // alias:col
    c = (c.split('.')[0] ?? '').trim(); // table.col qualifier
    c = (c.split(/->|!/)[0] ?? '').trim(); // ->json / !inner
    if (NOT_A_COLUMN.has(c)) continue;
    if (!/^[a-z0-9_]+$/i.test(c)) continue;
    cols.push(c);
  }
  return cols;
}

/**
 * Extract every `.from('t')` → `.select('…')` pair in one source string.
 * Exported separately from the filesystem walk so the detector can be exercised
 * against fixtures with no repo state involved — see the guard's positive
 * control.
 */
export function extractSelectSites(source: string, file: string): SelectSite[] {
  const sites: SelectSite[] = [];
  const fromRe = new RegExp(FROM_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(source))) {
    const table = m[1];
    if (!table) continue;
    const window = source.slice(fromRe.lastIndex, fromRe.lastIndex + SELECT_WINDOW);

    const sel = SELECT_RE.exec(window);
    if (!sel) continue;

    // Only trust a `.select()` that comes before the NEXT `.from()`, otherwise
    // we would attach it to the wrong builder chain.
    const nextFrom = new RegExp(FROM_RE.source, 'i').exec(window);
    if (nextFrom && nextFrom.index < sel.index) continue;

    const raw = sel[1] ?? sel[2] ?? sel[3] ?? '';
    if (raw.includes('${')) continue; // interpolated — unknowable statically

    const columns = parseSelectList(raw);
    if (columns.length === 0) continue;

    sites.push({
      file,
      line: source.slice(0, m.index).split('\n').length,
      table,
      columns,
    });
  }
  return sites;
}

/** Recursively collect .ts/.tsx files under `root`, skipping build output. */
export function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !isTestFile(entry.name)
      ) {
        out.push(path.join(dir, entry.name));
      }
    }
  };
  walk(root);
  return out;
}

/** Every `.from().select()` pair under `root`, with repo-relative file paths. */
export function scanSelectSites(root: string = APP_ROOT): SelectSite[] {
  const sites: SelectSite[] = [];
  for (const file of collectSourceFiles(root)) {
    let src: string;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!src.includes('.from(')) continue;
    sites.push(...extractSelectSites(src, path.relative(root, file)));
  }
  return sites;
}

/**
 * Columns named in a select that the migration-derived schema does not have on
 * that table. Tables the schema has never heard of are skipped — see limit 4.
 */
export function findPhantomColumns(
  sites: readonly SelectSite[],
  schema: Map<string, TableSchema>,
): PhantomColumn[] {
  const out: PhantomColumn[] = [];
  for (const site of sites) {
    const table = schema.get(site.table);
    if (!table) continue;
    for (const column of site.columns) {
      if (table.cols.has(column)) continue;
      out.push({
        file: site.file,
        line: site.line,
        table: site.table,
        column,
        key: `${site.table}.${column}`,
      });
    }
  }
  return out;
}

/** Convenience: scan the app and diff it against the migrations in one call. */
export function scanForPhantomColumns(root: string = APP_ROOT): {
  sites: SelectSite[];
  phantoms: PhantomColumn[];
  schema: Map<string, TableSchema>;
} {
  const schema = readSchema();
  const sites = scanSelectSites(root);
  return { sites, phantoms: findPhantomColumns(sites, schema), schema };
}
