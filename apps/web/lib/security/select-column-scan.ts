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
import { stripComments } from './source-text';

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

/* ───────────────────────────────────────────────────────────────────────────
 * `.from(REF)` — the OTHER half of the same defect.
 *
 * \U0001f6a8 #5020 TAUGHT `.select()` TO RESOLVE CONSTANTS AND LEFT `.from()` MATCHING A
 * QUOTED LITERAL ONLY, ONE LINE ABOVE IT. Same class, adjacent regex, missed
 * while writing three guards about literal-only matching. `FROM_RE` requires
 * `.from('t')`, so `.from(ALLOTMENT_STORAGE.table)` produces NO SITE — the
 * select is not checked-and-skipped, it is never enumerated. It cannot even
 * reach `KNOWN_UNRESOLVED_TABLES`, which lists relations that WERE enumerated
 * and could not be resolved. **An invisible gap is worse than an open one: a
 * ratchet cannot count what was never seen.**
 *
 * \U0001f511 AND THE PATTERN THAT CREATES IT IS ONE WE RECOMMEND. Collecting a
 * table name and its columns in one `*_STORAGE` object so a rename lands in a
 * single file is good practice — and it is exactly what makes `.from()`
 * unresolvable here. **The rename-safe pattern is the phantom-unguarded
 * pattern.** Anyone adopting that shape inherits both halves; this closes the
 * second one so they only get the good one.
 * ─────────────────────────────────────────────────────────────────────────── */

/** A `.from(REF).select(…)` whose table is named by an identifier, not a literal. */
export type RefSelectSite = {
  file: string;
  line: number;
  /** `ALLOTMENT_STORAGE.table` or `EVENT_TABLE` — as written. */
  ref: string;
  columns: string[];
};

/**
 * `.from(` receivers whose call is NOT a table read. Without this the scan is
 * mostly `Array.from(arr)` and `Buffer.from(bytes)` noise — harmless (an
 * unknown table is skipped) but it would drown the unresolved ratchet and make
 * it useless as a signal.
 */
const NOT_A_TABLE_RECEIVER = new Set([
  'Array', 'Buffer', 'Object', 'Set', 'Map', 'Promise', 'String', 'Number',
  'Date', 'Int8Array', 'Uint8Array', 'Float32Array', 'BigInt64Array',
]);

const FROM_REF_RE = /(?:([A-Za-z_$][\w$]*)\s*)?\.from\(\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\)/g;

/**
 * Module-level string constants a `.from()` could name — bare consts AND the
 * string properties of object literals, since `{ table: 'x' } as const` is the
 * shape the contract-module pattern produces.
 */
export type ScopedTableConstant = {
  name: string;
  file: string;
  table: string;
  exported: boolean;
};

export function extractTableConstants(sourceRaw: string, file: string): ScopedTableConstant[] {
  const source = stripComments(sourceRaw);
  const out: ScopedTableConstant[] = [];

  // const EVENT_TABLE = 'events';
  const bare = /(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*'([a-z0-9_]+)'\s*(?:as\s+const\s*)?;/g;
  let m: RegExpExecArray | null;
  while ((m = bare.exec(source))) {
    if (m[2] && m[3]) out.push({ name: m[2], file, table: m[3], exported: Boolean(m[1]) });
  }

  // const ALLOTMENT_STORAGE = { table: 'papic_guest_spend_ceilings', … } as const;
  const obj = /(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*\{([\s\S]*?)\}\s*(?:as\s+const\s*)?;/g;
  while ((m = obj.exec(source))) {
    const name = m[2];
    const body = m[3];
    if (!name || !body) continue;
    const exported = Boolean(m[1]);
    const prop = /([A-Za-z_$][\w$]*)\s*:\s*'([a-z0-9_]+)'/g;
    let q: RegExpExecArray | null;
    while ((q = prop.exec(body))) {
      if (q[1] && q[2]) out.push({ name: `${name}.${q[1]}`, file, table: q[2], exported });
    }
  }
  return out;
}

/** Every `.from(IDENTIFIER).select(…)` in one source string. */
export function extractRefSelectSites(source: string, file: string): RefSelectSite[] {
  const sites: RefSelectSite[] = [];
  const re = new RegExp(FROM_REF_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const receiver = m[1];
    const ref = m[2];
    if (!ref) continue;
    if (receiver && NOT_A_TABLE_RECEIVER.has(receiver)) continue;

    const window = source.slice(re.lastIndex, re.lastIndex + SELECT_WINDOW);
    const sel = SELECT_RE.exec(window);
    if (!sel) continue;
    // Same attribution guard as the literal scan: never reach past the next
    // `.from()`, in EITHER form, or the select attaches to the wrong chain.
    const nextLit = new RegExp(FROM_RE.source, 'i').exec(window);
    const nextRef = new RegExp(FROM_REF_RE.source, '').exec(window);
    const nextIdx = Math.min(nextLit ? nextLit.index : Infinity, nextRef ? nextRef.index : Infinity);
    if (nextIdx < sel.index) continue;

    const raw = sel[1] ?? sel[2] ?? sel[3] ?? '';
    if (raw.includes('${')) continue;
    const columns = parseSelectList(raw);
    if (columns.length === 0) continue;

    sites.push({ file, line: source.slice(0, m.index).split('\n').length, ref, columns });
  }
  return sites;
}

/**
 * Resolve `.from(REF)` sites against the constants of their OWN file.
 *
 * \u26a0 SAME-FILE ONLY, DELIBERATELY. A `.from(opts.table)` naming a function
 * PARAMETER is not statically knowable, and guessing it from a same-named
 * constant elsewhere would invent a table this code may never read. Unresolved
 * sites are RETURNED so the gap is on the books rather than invisible — the
 * failure this whole function exists to end.
 */
export function resolveRefSelectSites(
  refSites: readonly RefSelectSite[],
  constants: readonly ScopedTableConstant[],
): { resolved: SelectSite[]; unresolved: RefSelectSite[] } {
  /*
    ⚠ SCOPE, AND THE CASE THAT FORCED IT. My first cut resolved SAME-FILE ONLY —
    and it would have missed the exact defect that prompted this work:
    `ALLOTMENT_STORAGE` is declared in `lib/papic-guest-allotments.ts` and the
    `.from(ALLOTMENT_STORAGE.table)` sits in a component two directories away.
    A fix that does not cover its own motivating case is not a fix. Same-file
    first (local or exported), then any EXPORTED constant — a file-local const
    is genuinely invisible elsewhere, and resolving one across files would
    invent a binding the compiler rejects.
  */
  const sameFile = new Map<string, ScopedTableConstant>();
  const exported = new Map<string, ScopedTableConstant>();
  for (const c of constants) {
    sameFile.set(`${c.file}\u0000${c.name}`, c);
    if (c.exported && !exported.has(c.name)) exported.set(c.name, c);
  }
  const resolved: SelectSite[] = [];
  const unresolved: RefSelectSite[] = [];
  for (const site of refSites) {
    const hit =
      sameFile.get(`${site.file}\u0000${site.ref}`) ?? exported.get(site.ref);
    if (!hit) {
      unresolved.push(site);
      continue;
    }
    resolved.push({ file: site.file, line: site.line, table: hit.table, columns: site.columns });
  }
  return { resolved, unresolved };
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

/**
 * Resolve `.from('t').select(SOME_SELECT)` sites to the columns their constant
 * names, so the phantom check can see them.
 *
 * \u26a0 WHY THIS EXISTS — THE GUARD USED TO GO BLIND HERE, SILENTLY.
 * `extractSelectSites` only matches a QUOTED select argument (`SELECT_RE`
 * requires `'`, `"` or a backtick). Rewriting `.select('some_col')` as
 * `.select(SOME_COLUMNS)` produced NO SITE AT ALL — so the call was not
 * checked and not reported. It did not resolve the constant and pass; it
 * stopped looking. On 2026-08-30 a session made a legitimate T1 failure green
 * by exactly that move, with the runtime behaviour byte-identical: PostgREST
 * still received the same column name and still answered 42703. Only the
 * guard's vision changed.
 *
 * \U0001f511 A PROOF TOOL THAT FAILS OPEN IS WORSE THAN NO PROOF TOOL, because
 * its green is read as evidence. This is the same defect class as the
 * comment-stripper repaired in PR #5018 on the same day.
 *
 * UNRESOLVED constants are RETURNED, NOT DROPPED. A constant this module cannot
 * find a definition for (declared in a file the walk skips, or named outside
 * the `*_SELECT` / `*_COLUMNS` convention `extractSelectConstants` recognises)
 * is still a select this guard cannot check. Silently discarding it would
 * rebuild the very hole this function closes, one level up — so it is surfaced
 * and counted instead.
 */
export type ScopedSelectConstant = SelectConstant & { exported: boolean };

/*
  \u26a0 `as const` IS NOT DECORATION HERE. Two of this repo's three unresolvable
  constant selects were unresolvable ONLY because the declaration ends
  `… ' as const;` — `GUEST_CAPTURE_GATE_COLUMNS` in lib/papic-guest-window.ts,
  read by the guest-capture route and the guest page. Without the optional tail
  the whole declaration failed to match and two live selects stayed unchecked.
*/
const ANY_STRING_CONST_RE =
  /(export\s+)?const\s+([A-Z][A-Z0-9_]*_(?:SELECT|COLUMNS))\s*(?::[^=]*)?=\s*((?:'[^']*'|"[^"]*"|`[^`$]*`)(?:\s*\+\s*(?:'[^']*'|"[^"]*"|`[^`$]*`))*)\s*(?:as\s+const\s*)?;/g;
const ANY_ARRAY_CONST_RE =
  /(export\s+)?const\s+([A-Z][A-Z0-9_]*_(?:SELECT|COLUMNS))\s*(?::[^=]*)?=\s*\[([^\]]*)\]/g;

/**
 * Every canonical column list in one file — EXPORTED OR NOT — tagged with which.
 *
 * \u26a0 WHY THIS IS NOT `extractSelectConstants`. That one deliberately matches
 * only `export const`, because the omitted-column half of this file compares a
 * hand-typed list against a SHARED canonical constant, and a file-local list is
 * not shared. Widening it there would change what THAT guard reports. For the
 * phantom check the distinction is irrelevant: a file-local constant hides a
 * column name from the check exactly as well as an exported one does.
 *
 * \U0001f511 MEASURED 2026-08-30: 38 of the 75 canonical declarations in this
 * repo are file-local. Resolving only the exported half left 49 of 74
 * constant-referenced select sites unchecked — most of the hole.
 */
export function extractAllSelectConstants(sourceRaw: string, file: string): ScopedSelectConstant[] {
  const source = stripComments(sourceRaw);
  const out: ScopedSelectConstant[] = [];
  const seen = new Set<string>();

  const strRe = new RegExp(ANY_STRING_CONST_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = strRe.exec(source))) {
    const name = m[2];
    const body = m[3];
    if (!name || !body) continue;
    const joined = [...body.matchAll(/'([^']*)'|"([^"]*)"|`([^`$]*)`/g)]
      .map((q) => q[1] ?? q[2] ?? q[3] ?? '')
      .join('');
    const columns = parseSelectList(joined);
    if (columns.length === 0) continue;
    seen.add(name);
    out.push({ name, file, columns, exported: Boolean(m[1]) });
  }

  const arrRe = new RegExp(ANY_ARRAY_CONST_RE.source, 'g');
  while ((m = arrRe.exec(source))) {
    const name = m[2];
    if (!name || seen.has(name)) continue;
    const columns = [...(m[3] ?? '').matchAll(/'([a-z0-9_]+)'|"([a-z0-9_]+)"/g)].map(
      (q) => q[1] ?? q[2] ?? '',
    );
    if (columns.length === 0) continue;
    seen.add(name);
    out.push({ name, file, columns, exported: Boolean(m[1]) });
  }

  return out;
}

export function resolveConstantSelectSites(
  constantSites: readonly ConstantSelectSite[],
  constants: readonly ScopedSelectConstant[],
): { resolved: SelectSite[]; unresolved: ConstantSelectSite[] } {
  /*
    SCOPE MATTERS AND IS NOT COSMETIC. A file-local `const X_SELECT` is visible
    ONLY in its own file, so resolving a site in file B against a local constant
    in file A would invent a binding the compiler itself would reject. Same-file
    first (local or exported); otherwise an EXPORTED constant from anywhere.
  */
  const sameFile = new Map<string, ScopedSelectConstant>();
  const exported = new Map<string, ScopedSelectConstant>();
  for (const c of constants) {
    sameFile.set(`${c.file}\u0000${c.name}`, c);
    if (c.exported && !exported.has(c.name)) exported.set(c.name, c);
  }
  const resolved: SelectSite[] = [];
  const unresolved: ConstantSelectSite[] = [];
  for (const site of constantSites) {
    const constant =
      sameFile.get(`${site.file}\u0000${site.constant}`) ?? exported.get(site.constant);
    if (!constant) {
      unresolved.push(site);
      continue;
    }
    resolved.push({
      file: site.file,
      line: site.line,
      table: site.table,
      columns: constant.columns,
    });
  }
  return { resolved, unresolved };
}

/**
 * Every select the phantom check must examine: the LITERAL ones and the
 * CONSTANT-referenced ones resolved to their columns.
 *
 * One walk, because two walks drift — the same reasoning the omitted-column
 * half of this file already records about rival scanners.
 */
export function scanAllSelectSites(root: string = APP_ROOT): {
  literalSites: SelectSite[];
  constantSites: ConstantSelectSite[];
  constants: ScopedSelectConstant[];
  resolved: SelectSite[];
  unresolved: ConstantSelectSite[];
  refSites: RefSelectSite[];
  refResolved: SelectSite[];
  refUnresolved: RefSelectSite[];
  /** literal + constant-resolved + from-ref-resolved — what `findPhantomColumns` must be given. */
  sites: SelectSite[];
} {
  const literalSites: SelectSite[] = [];
  const constantSites: ConstantSelectSite[] = [];
  const constants: ScopedSelectConstant[] = [];
  const refSites: RefSelectSite[] = [];
  const tableConstants: ScopedTableConstant[] = [];

  for (const file of collectSourceFiles(root)) {
    let src: string;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(root, file);
    // NOT `if (src.includes('export const'))` — file-local lists carry no
    // `export`, and they are half the declarations in this repo.
    if (src.includes('const ')) {
      constants.push(...extractAllSelectConstants(src, rel));
      /*
        \u26a0 COLLECTED BEFORE THE `.from(` EARLY-EXIT, DELIBERATELY. A file can
        DECLARE the table constant and never read a table itself — which is
        exactly the contract-module shape: `lib/papic-guest-allotments.ts`
        exports ALLOTMENT_STORAGE and contains no `.from(` at all, while the
        component two directories away does the reading. Collecting after the
        early-exit skipped that file entirely and left the motivating case
        unresolved. Found by checking the fix against the defect that prompted
        it, not by reasoning about it.
      */
      tableConstants.push(...extractTableConstants(src, rel));
    }
    if (!src.includes('.from(')) continue;
    literalSites.push(...extractSelectSites(src, rel));
    constantSites.push(...extractConstantSelectSites(src, rel));
    refSites.push(...extractRefSelectSites(src, rel));
  }

  const { resolved, unresolved } = resolveConstantSelectSites(constantSites, constants);
  const fromRefs = resolveRefSelectSites(refSites, tableConstants);
  return {
    literalSites,
    constantSites,
    constants,
    resolved,
    unresolved,
    refSites,
    refResolved: fromRefs.resolved,
    refUnresolved: fromRefs.unresolved,
    sites: [...literalSites, ...resolved, ...fromRefs.resolved],
  };
}

/** Convenience: scan the app and diff it against the migrations in one call. */
export function scanForPhantomColumns(root: string = APP_ROOT): {
  sites: SelectSite[];
  phantoms: PhantomColumn[];
  schema: Map<string, TableSchema>;
  resolved: SelectSite[];
  unresolved: ConstantSelectSite[];
} {
  const schema = readSchema();
  const { sites, resolved, unresolved } = scanAllSelectSites(root);
  return { sites, phantoms: findPhantomColumns(sites, schema), schema, resolved, unresolved };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PART 2 — THE INVERSE: a hand-typed list that OMITS what the canonical
 *          `*_SELECT` constant includes.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Everything above answers "does this column exist?". This answers the question
 * underneath it — "is this list the SAME list the rest of the app uses?"
 *
 * THE BUG. On 2026-07-27 two pages hand-typed the column list for
 * `vendor_package_items` instead of using `VENDOR_PACKAGE_ITEM_SELECT`. One copy
 * left out `item_id`, so a removal filter (`removed_item_ids.has(i.item_id)`)
 * compared against `undefined` and could never match. The same copy left out
 * `is_required`, and an absent boolean reads as FALSE — so a line the vendor had
 * marked MANDATORY could be dropped from the receipt. Neither is a phantom
 * column. Every name in both lists is real, so the guard above sees nothing:
 * PostgREST returns rows, the query "works", and the page is quietly wrong.
 *
 * WHY THIS LIVES HERE AND NOT IN A RIVAL SCRIPT. It needs the same `.from()` →
 * `.select()` attribution, the same select-list parser, and the same limits. A
 * second scanner would drift from this one exactly the way the two column lists
 * drifted from each other — which would be a joke.
 *
 * WHY IT IS NOT "EVERY SELECT MUST USE THE CONSTANT". A narrow select is a
 * legitimate, often better, choice: `SECTION_CONTENT_EVENT_COLUMNS` names seven
 * `events` columns, and a page that needs `venue_name` alone should ask for
 * `venue_name` alone. Forcing the constant everywhere would over-fetch by
 * default and the rule would be ignored within a month. So the signal is not
 * "did not use the constant" — it is NEAR-COPY WITH A HOLE: a literal that
 * reproduces most of a canonical list and drops part of it. That shape is
 * almost always a paste that went stale, and it is exactly what happened.
 *
 * ADDITIONAL LIMITS ON TOP OF THE ONES ABOVE
 * ------------------------------------------
 *  A. The constant → table binding is LEARNED, not declared: a constant is
 *     bound to table `t` only because some `.from('t').select(CONST)` exists in
 *     the repo. A canonical list nobody has adopted yet guards nothing.
 *  B. Only identifiers ending `_SELECT` or `_COLUMNS` are treated as canonical.
 *     `COLS`, `FEATURED_FIELDS`, `SELECT_COLS` and friends are ignored — naming
 *     is the only declaration of intent available, and widening the pattern
 *     buys noise.
 *  C. Constant VALUES are read from `export const NAME = '…'` (single or
 *     concatenated string literals) and `export const NAME = [ '…' ] as const`.
 *     A computed value (`X.split(',')`) is not resolved and the constant is
 *     skipped.
 */

/** A `.from('t').select(SOME_CONSTANT)` — how a constant learns its table. */
export type ConstantSelectSite = {
  file: string;
  line: number;
  table: string;
  constant: string;
};

/** An exported canonical column list and the columns it names. */
export type SelectConstant = {
  name: string;
  /** apps/web-relative file that exports it */
  file: string;
  columns: string[];
};

export type OmittedColumn = {
  file: string;
  line: number;
  table: string;
  /** the canonical constant this literal is a near-copy of */
  constant: string;
  /** a column the constant names and the literal does not */
  column: string;
  /** how much of the constant the literal reproduced, 0–1 */
  overlap: number;
  /** `file\ttable\tconstant\tcolumn` — the stable key a baseline entry pins. */
  key: string;
};

/** Only these suffixes declare "this is the canonical list" — limit B. */
const CANONICAL_CONST_RE = /^[A-Z][A-Z0-9_]*_(SELECT|COLUMNS)$/;
/** …the same shape, searched for inside a select argument. */
const CANONICAL_CONST_SCAN_RE = /\b[A-Z][A-Z0-9_]*_(?:SELECT|COLUMNS)\b/g;

/**
 * WHAT COUNTS AS A NEAR-COPY — and why it is two-sided.
 *
 * A one-sided "the literal reproduces ≥N% of the constant" rule fails the real
 * bug. The vendor workspace's stale list was
 * `service_description, is_default_included, parent_option_id, display_order` —
 * only 3 of `VENDOR_PACKAGE_ITEM_SELECT`'s 9 columns, i.e. 33%. By that measure
 * it is a "narrow select" and legitimate. It was not: 3 of its 4 columns came
 * from the canonical list, so it was the canonical list TRIMMED, and the trim
 * took `item_id` (making a removal filter unmatchable) and `is_required`
 * (making a mandatory line vanish).
 *
 * So the question is asked from both ends, and either answer is enough:
 *   · the literal reproduces most of the CONSTANT  (a stale paste), or
 *   · the constant accounts for most of the LITERAL (the constant, trimmed).
 *
 * With a floor under the second one. Without it, any 3-column select whose
 * columns all appear in a 90-column export list scores 100% "of literal" and
 * gets accused of omitting 87 columns — measured, not imagined: that was the
 * first version's output for `VENDOR_PROFILE_EXPORT_SELECT`.
 *
 * Measured on this repo at these values: 104 facts across 24 sites, and the
 * historical workspace bug IS flagged. Loosening the constant-ratio to 0.3
 * one-sided pulls in 123 facts including plainly-legitimate narrow reads
 * (a page wanting `venue_name` accused of omitting `love_story`). These numbers
 * are the argument; re-run the guard before changing any of them.
 *
 * THE GREY ZONE, ADMITTED. A short literal whose columns ALL come from a
 * short-to-mid canonical list is flagged — 3 of 10, fully covered, is reported.
 * That is the same shape as the workspace bug and cannot be told apart from it
 * without knowing what the page needs. It is deliberate, and it is what the
 * baseline is for: it costs one reviewed line, not a red build.
 */

/**
 * Two shared column names between two lists on the same table is coincidence —
 * `event_id, created_at` is on almost everything. Three is a pattern.
 */
export const NEAR_COPY_MIN_SHARED = 3;

/** Below this share of the CONSTANT, the two lists are not about the same thing. */
export const NEAR_COPY_CONSTANT_FLOOR = 0.25;

/** At or above this share of the CONSTANT, the literal is a paste of it. */
export const NEAR_COPY_OF_CONSTANT = 0.5;

/** At or above this share of the LITERAL, the literal is the constant, trimmed. */
export const NEAR_COPY_OF_LITERAL = 0.6;

/** Is this literal select a near-copy of this canonical constant? */
export function isNearCopy(
  sharedColumns: number,
  constantColumns: number,
  literalColumns: number,
): boolean {
  if (sharedColumns < NEAR_COPY_MIN_SHARED) return false;
  if (constantColumns === 0 || literalColumns === 0) return false;
  const ofConstant = sharedColumns / constantColumns;
  if (ofConstant < NEAR_COPY_CONSTANT_FLOOR) return false;
  return ofConstant >= NEAR_COPY_OF_CONSTANT || sharedColumns / literalColumns >= NEAR_COPY_OF_LITERAL;
}

/**
 * The text between `.select(` and its matching `)`, plus the offset it starts
 * at. Returns null when the parens do not balance inside the window.
 */
function selectArgument(window: string): { text: string; index: number } | null {
  const open = /\.select\(/.exec(window);
  if (!open) return null;
  const start = open.index + open[0].length;
  let depth = 1;
  for (let i = start; i < window.length; i++) {
    const ch = window[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return { text: window.slice(start, i), index: open.index };
    }
  }
  return null;
}

/**
 * Canonical constants named at the TOP LEVEL of a select argument.
 *
 * Depth matters and it is the whole correctness argument here. In
 * `` `${VENDOR_PACKAGE_ITEM_SELECT}, parent_option_id` `` the constant lists
 * columns of the table being queried. In `` `id, items:t(${X})` `` it lists
 * columns of the EMBEDDED table `t`, and binding it to the outer table would be
 * a lie. Only depth 0 counts.
 */
function topLevelConstants(arg: string): string[] {
  let depth = 0;
  let level0 = '';
  for (const ch of arg) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) level0 += ch;
    else level0 += ' ';
  }
  return [...level0.matchAll(CANONICAL_CONST_SCAN_RE)].map((m) => m[0]);
}

/**
 * Every `.from('t').select(… CONST …)` in one source string.
 *
 * Unlike `extractSelectSites`, this strips comments first: `.select(` followed
 * by an explanatory comment and THEN the constant is a real shape in this repo
 * (`vendors/packages/actions.ts`), and a raw scan misses it. The original path
 * keeps reading raw source on purpose — see the note in ./source-text.
 */
export function extractConstantSelectSites(source: string, file: string): ConstantSelectSite[] {
  const src = stripComments(source);
  const sites: ConstantSelectSite[] = [];
  const fromRe = new RegExp(FROM_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(src))) {
    const table = m[1];
    if (!table) continue;
    const window = src.slice(fromRe.lastIndex, fromRe.lastIndex + SELECT_WINDOW);

    const arg = selectArgument(window);
    if (!arg) continue;

    // Same attribution guard as extractSelectSites: never reach past the next
    // `.from()`.
    const nextFrom = new RegExp(FROM_RE.source, 'i').exec(window);
    if (nextFrom && nextFrom.index < arg.index) continue;

    const line = src.slice(0, m.index).split('\n').length;
    for (const constant of topLevelConstants(arg.text)) {
      if (!CANONICAL_CONST_RE.test(constant)) continue;
      sites.push({ file, line, table, constant });
    }
  }
  return sites;
}

const EXPORT_STRING_CONST_RE =
  /export\s+const\s+([A-Z][A-Z0-9_]*_(?:SELECT|COLUMNS))\s*(?::[^=]*)?=\s*((?:'[^']*'|"[^"]*"|`[^`$]*`)(?:\s*\+\s*(?:'[^']*'|"[^"]*"|`[^`$]*`))*)\s*;/g;
const EXPORT_ARRAY_CONST_RE =
  /export\s+const\s+([A-Z][A-Z0-9_]*_(?:SELECT|COLUMNS))\s*(?::[^=]*)?=\s*\[([^\]]*)\]/g;

/**
 * Exported canonical column lists in one source string — limit C.
 * String form is parsed with the SAME `parseSelectList` the literals use, so a
 * constant and a literal can never be read by two different rules.
 */
export function extractSelectConstants(sourceRaw: string, file: string): SelectConstant[] {
  const source = stripComments(sourceRaw);
  const out: SelectConstant[] = [];
  const seen = new Set<string>();

  const strRe = new RegExp(EXPORT_STRING_CONST_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = strRe.exec(source))) {
    const name = m[1];
    const body = m[2];
    if (!name || !body) continue;
    const joined = [...body.matchAll(/'([^']*)'|"([^"]*)"|`([^`$]*)`/g)]
      .map((q) => q[1] ?? q[2] ?? q[3] ?? '')
      .join('');
    const columns = parseSelectList(joined);
    if (columns.length === 0) continue;
    seen.add(name);
    out.push({ name, file, columns });
  }

  const arrRe = new RegExp(EXPORT_ARRAY_CONST_RE.source, 'g');
  while ((m = arrRe.exec(source))) {
    const name = m[1];
    if (!name || seen.has(name)) continue;
    const columns = [...(m[2] ?? '').matchAll(/'([a-z0-9_]+)'|"([a-z0-9_]+)"/g)].map(
      (q) => q[1] ?? q[2] ?? '',
    );
    if (columns.length === 0) continue;
    seen.add(name);
    out.push({ name, file, columns });
  }

  return out;
}

/**
 * Compare every LITERAL select against the canonical constants bound to the
 * same table, and report the columns a near-copy left out.
 *
 * One fact per (file, table, constant, omitted column) — the granularity
 * matters: dropping one more column ADDS a line (a widening, which fails), and
 * fixing one REMOVES a line (a narrowing, which passes).
 */
export function findOmittedColumns(
  literalSites: readonly SelectSite[],
  constantSites: readonly ConstantSelectSite[],
  constants: readonly SelectConstant[],
): OmittedColumn[] {
  const byName = new Map(constants.map((c) => [c.name, c]));

  /** table → canonical constants some `.from(table).select(CONST)` uses. */
  const canonicalByTable = new Map<string, SelectConstant[]>();
  for (const site of constantSites) {
    const c = byName.get(site.constant);
    if (!c) continue;
    const list = canonicalByTable.get(site.table);
    if (!list) canonicalByTable.set(site.table, [c]);
    else if (!list.some((x) => x.name === c.name)) list.push(c);
  }

  const out: OmittedColumn[] = [];
  for (const site of literalSites) {
    const canon = canonicalByTable.get(site.table);
    if (!canon) continue;
    const have = new Set(site.columns);
    for (const c of canon) {
      const shared = c.columns.filter((col) => have.has(col)).length;
      if (!isNearCopy(shared, c.columns.length, site.columns.length)) continue;
      const missing = c.columns.filter((col) => !have.has(col));
      if (missing.length === 0) continue; // the literal is the constant, spelled out
      for (const column of missing) {
        out.push({
          file: site.file,
          line: site.line,
          table: site.table,
          constant: c.name,
          column,
          overlap: shared / c.columns.length,
          key: `${site.file}\t${site.table}\t${c.name}\t${column}`,
        });
      }
    }
  }
  return out;
}

/** Scan the app for near-copy selects that drop a canonical column. */
export function scanForOmittedColumns(root: string = APP_ROOT): {
  literalSites: SelectSite[];
  constantSites: ConstantSelectSite[];
  constants: SelectConstant[];
  omissions: OmittedColumn[];
} {
  const literalSites: SelectSite[] = [];
  const constantSites: ConstantSelectSite[] = [];
  const constants: SelectConstant[] = [];

  for (const file of collectSourceFiles(root)) {
    let src: string;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(root, file);
    if (src.includes('export const')) constants.push(...extractSelectConstants(src, rel));
    if (!src.includes('.from(')) continue;
    literalSites.push(...extractSelectSites(src, rel));
    constantSites.push(...extractConstantSelectSites(src, rel));
  }

  const omissions = findOmittedColumns(literalSites, constantSites, constants);
  omissions.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { literalSites, constantSites, constants, omissions };
}
