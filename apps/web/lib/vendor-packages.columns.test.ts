/**
 * COLUMN-NAME GUARD for the vendor-package tables.
 *
 * Why this exists: this project has no generated Supabase types, so a column
 * name inside a `.select()` string or an `.insert()` key is unchecked text.
 * The authoring surface shipped asking for `label` when the column is
 * `option_label` — PostgREST 400s on an unknown column, so a vendor could
 * neither save nor reload a choice option, and nothing caught it: the DB tests
 * used the right name, the app code used the wrong one, and the two never met.
 *
 * This suite pins the names in ./vendor-packages to the CREATE TABLE that
 * actually built each table, plus every later ALTER. Falsifiable: change
 * `option_label` back to `label` in PACKAGE_ITEM_OPTION_COLUMNS (or in the
 * select list) and it goes red.
 *
 * Covers BOTH tables: `vendor_package_item_options`, and — since the recursive
 * customization migration — `vendor_package_items`, whose authoring select
 * gained four brand-new column names (parent_option_id / pick_min / pick_max /
 * max_extra_hours) that are unchecked text in exactly the same way.
 *
 * Pure module + one file read: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PACKAGE_ITEM_AUTHORING_COLUMNS,
  PACKAGE_ITEM_AUTHORING_SELECT,
  PACKAGE_ITEM_BRANCHING_SELECT,
  PACKAGE_ITEM_OPTION_COLUMNS,
  PACKAGE_ITEM_OPTION_SELECT,
  VENDOR_PACKAGE_ITEM_SELECT,
} from './vendor-packages';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '../../../supabase/migrations');
const CREATE_MIGRATION = join(
  MIGRATIONS_DIR,
  '20271006413374_vendor_package_credit_required_and_choice_options.sql',
);
/** `vendor_package_items` predates the options table by four months. */
const ITEMS_CREATE_MIGRATION = join(MIGRATIONS_DIR, '20260604110000_vendor_packages.sql');

/**
 * The column names in the `CREATE TABLE public.vendor_package_item_options`
 * block. Deliberately parsed from the migration rather than hard-coded — a
 * second hard-coded list would drift exactly the way the first one did.
 */
/**
 * Remove SQL comments and blank out string bodies, so the statement scanners
 * below see only real syntax.
 *
 * ⚠ THIS FIXED A LIVE HOLE IN THE GUARD (2026-07-28). `alterAddedColumns` ends
 * each `ALTER TABLE` at the first `;` it finds, and migration
 * 20270713100000_vendor_package_item_pricing_basis.sql opens with
 *
 *     ADD COLUMN IF NOT EXISTS pricing_basis TEXT NOT NULL DEFAULT 'fixed'
 *     -- replacement_value_centavos IS the line total; the resolver returns …
 *
 * — a semicolon inside a COMMENT. The scan therefore stopped 100 characters into
 * a 60-line statement and never saw `hour_base_centavos`, `min_hours`,
 * `extra_hour_centavos`, `transport_mode` or `transport_flat_centavos`. The guard
 * silently reported those five columns as NOT EXISTING, which is the failure mode
 * that matters here: a column-name guard that under-reports the schema will
 * happily red-flag a perfectly valid select and push the next author to delete
 * the test. Found by adding the `VENDOR_PACKAGE_ITEM_SELECT` assertions below,
 * which are the first to name `extra_hour_centavos`.
 *
 * Quote- and dollar-quote-aware, because blanking the inside of a string is what
 * stops a `--` or a `;` in COMMENT ON text doing the same damage in reverse.
 * String CONTENTS are replaced with spaces rather than deleted so every offset
 * outside them is preserved.
 */
function stripSqlNoise(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const two = sql.slice(i, i + 2);
    if (two === '--') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }
    if (two === '/*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[i] === "'") {
      out += ' ';
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          out += '  ';
          i += 2;
          continue;
        }
        if (sql[i] === "'") break;
        out += sql[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += ' ';
      i += 1;
      continue;
    }
    const dollar = /^\$[a-z_]*\$/i.exec(sql.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const body = sql.slice(i, end === -1 ? sql.length : end + tag.length);
      out += body.replace(/[^\n]/g, ' ');
      i += body.length;
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

/**
 * Columns added to the table by a LATER `ALTER TABLE … ADD COLUMN`.
 *
 * The table's shape is CREATE TABLE **plus every subsequent ALTER** — reading
 * only the CREATE would fail every column added after it (per-head pricing was
 * the first, migration 20271010956443) and push the next author toward deleting
 * this guard instead of trusting it.
 */
function alterAddedColumns(table: string): string[] {
  const names: string[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith('.sql')) continue;
    const sql = stripSqlNoise(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    // Each `ALTER TABLE …<table>` statement, to its `;`. `\b` matters: without
    // it the items pattern would also swallow vendor_package_item_options.
    const re = new RegExp(
      String.raw`ALTER\s+TABLE\s+(?:public\.)?${table}\b([\s\S]*?);`,
      'gi',
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      const body = m[1] ?? '';
      const add = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi;
      let a: RegExpExecArray | null;
      while ((a = add.exec(body)) !== null) if (a[1]) names.push(a[1]);
    }
  }
  return names;
}

function columnsInMigration(file: string, table: string): string[] {
  // Same stripping as the ALTER scan: an unbalanced paren inside a comment would
  // otherwise end the CREATE TABLE block early and drop real columns.
  const sql = stripSqlNoise(readFileSync(file, 'utf8'));
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`);
  assert.notEqual(start, -1, `CREATE TABLE for ${table} not found in ${file}`);

  // Walk from the opening paren to its match, so CHECK(...) and REFERENCES(...)
  // nested parens do not end the block early.
  const open = sql.indexOf('(', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.notEqual(end, -1, 'unbalanced parens in the CREATE TABLE block');

  const body = sql.slice(open + 1, end);
  const names: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    // Skip comments, blanks, and table-level constraint clauses.
    if (!line || line.startsWith('--')) continue;
    if (/^(CONSTRAINT|CHECK|UNIQUE|PRIMARY|FOREIGN|REFERENCES)\b/i.test(line)) {
      continue;
    }
    const m = /^([a-z_][a-z0-9_]*)\s+[A-Z]/.exec(line);
    if (m?.[1]) names.push(m[1]);
  }
  return names;
}

/** The table's real column set: CREATE TABLE plus every later ALTER. */
function allColumns(): Set<string> {
  return new Set([
    ...columnsInMigration(CREATE_MIGRATION, 'vendor_package_item_options'),
    ...alterAddedColumns('vendor_package_item_options'),
  ]);
}

/** The same, for `vendor_package_items`. */
function allItemColumns(): Set<string> {
  return new Set([
    ...columnsInMigration(ITEMS_CREATE_MIGRATION, 'vendor_package_items'),
    ...alterAddedColumns('vendor_package_items'),
  ]);
}

test('every column we name actually exists in the migrations', () => {
  const actual = allColumns();
  assert.ok(actual.size > 0, 'parsed no columns — the parser is broken');

  for (const col of PACKAGE_ITEM_OPTION_COLUMNS) {
    assert.ok(
      actual.has(col),
      `PACKAGE_ITEM_OPTION_COLUMNS names "${col}", which is not a column of ` +
        `vendor_package_item_options. Real columns: ${[...actual].join(', ')}`,
    );
  }
});

test('the label column is option_label — the exact bug this guards', () => {
  const actual = allColumns();
  assert.ok(actual.has('option_label'), 'expected an option_label column');
  assert.ok(
    !actual.has('label'),
    'a bare `label` column now exists — the guard below is stale, revisit it',
  );
  assert.ok(
    PACKAGE_ITEM_OPTION_COLUMNS.includes('option_label'),
    'PACKAGE_ITEM_OPTION_COLUMNS must carry option_label',
  );
});

test('the select list only names real columns', () => {
  const actual = allColumns();
  const selected = PACKAGE_ITEM_OPTION_SELECT.split(',').map((s) => s.trim());

  assert.ok(selected.length > 0, 'empty select list');
  for (const col of selected) {
    assert.ok(
      actual.has(col),
      `PACKAGE_ITEM_OPTION_SELECT asks for "${col}", which PostgREST will ` +
        `reject with a 400. Real columns: ${[...actual].join(', ')}`,
    );
  }
});

test('the select list stays a subset of the declared column set', () => {
  const declared = new Set<string>(PACKAGE_ITEM_OPTION_COLUMNS);
  for (const col of PACKAGE_ITEM_OPTION_SELECT.split(',').map((s) => s.trim())) {
    assert.ok(
      declared.has(col),
      `"${col}" is selected but missing from PACKAGE_ITEM_OPTION_COLUMNS — ` +
        'the two lists have drifted apart',
    );
  }
});

/* ── vendor_package_items — the recursive-customization columns ─────────────*/

test('every vendor_package_items column we name actually exists', () => {
  const actual = allItemColumns();
  assert.ok(actual.size > 0, 'parsed no columns — the parser is broken');

  for (const col of PACKAGE_ITEM_AUTHORING_COLUMNS) {
    assert.ok(
      actual.has(col),
      `PACKAGE_ITEM_AUTHORING_COLUMNS names "${col}", which is not a column of ` +
        `vendor_package_items. Real columns: ${[...actual].join(', ')}`,
    );
  }
});

test('the migration parser survives a semicolon inside a SQL comment', () => {
  // ⚠ ANTI-VACUITY, and it is guarding a bug this suite actually had. The ALTER
  // scan ends a statement at the first `;`, and 20270713100000's first ADD COLUMN
  // is followed by a comment containing one — so before `stripSqlNoise` the scan
  // stopped after ONE column and silently reported the other five as missing.
  // A column-name guard that under-reports the schema is worse than no guard: it
  // red-flags valid selects until someone deletes it.
  //
  // These five all live in that one truncated statement, so any regression in
  // the stripper shows up here rather than as a mystery failure in the select
  // tests below.
  const actual = allItemColumns();
  for (const col of [
    'pricing_basis',
    'hour_base_centavos',
    'min_hours',
    'extra_hour_centavos',
    'transport_flat_centavos',
  ]) {
    assert.ok(
      actual.has(col),
      `the migration parser lost "${col}" — it sits after a semicolon-in-a-comment ` +
        'in 20270713100000, which is exactly the truncation stripSqlNoise exists to stop',
    );
  }
});

test('the branching columns are the ones the migration actually added', () => {
  // Falsifiable in the direction that matters: rename a column in the migration
  // (or misspell one in the select) and this goes red instead of PostgREST
  // 400-ing a vendor mid-save.
  const actual = allItemColumns();
  for (const col of ['parent_option_id', 'pick_min', 'pick_max', 'max_extra_hours']) {
    assert.ok(actual.has(col), `expected a ${col} column on vendor_package_items`);
  }
  assert.ok(
    !actual.has('max_qty'),
    'a generic max_qty column now exists — this schema has no generic quantity ' +
      'concept, so either the design changed or the name is wrong; revisit ' +
      'max_extra_hours and its column comment before adding one',
  );
});

test('the authoring select list only names real vendor_package_items columns', () => {
  const actual = allItemColumns();
  const selected = PACKAGE_ITEM_AUTHORING_SELECT.split(',').map((s) => s.trim());

  assert.ok(selected.length > 0, 'empty select list');
  for (const col of selected) {
    assert.ok(
      actual.has(col),
      `PACKAGE_ITEM_AUTHORING_SELECT asks for "${col}", which PostgREST will ` +
        `reject with a 400. Real columns: ${[...actual].join(', ')}`,
    );
  }
});

test('the authoring select stays a subset of the declared item column set', () => {
  const declared = new Set<string>(PACKAGE_ITEM_AUTHORING_COLUMNS);
  for (const col of PACKAGE_ITEM_AUTHORING_SELECT.split(',').map((s) => s.trim())) {
    assert.ok(
      declared.has(col),
      `"${col}" is selected but missing from PACKAGE_ITEM_AUTHORING_COLUMNS — ` +
        'the two lists have drifted apart',
    );
  }
});

/* ── VENDOR_PACKAGE_ITEM_SELECT — the COUPLE-SIDE MONEY read ────────────────*/

/**
 * 💰 THE HIGHEST-STAKES SELECT IN THIS FILE, and until 2026-07-28 it had no
 * guard here at all.
 *
 * It is what `lockPackage` and `removeItemFromPackage` read their items with, so
 * a name in it that PostgREST rejects is a 400 on a money action — a booking
 * that cannot be made. That risk is precisely why the five branching columns
 * were withheld from it for so long, and why withholding them was itself a
 * money bug (a follow-up pick, a second pick and an extra hour all billed ₱0).
 * Now that they are in, this is the test that makes the trade safe: every name
 * is checked against the migrations that created the column.
 */
test('the couple-side money select only names real vendor_package_items columns', () => {
  const actual = allItemColumns();
  const selected = VENDOR_PACKAGE_ITEM_SELECT.split(',').map((s) => s.trim());

  assert.ok(selected.length > 0, 'empty select list');
  for (const col of selected) {
    assert.ok(
      actual.has(col),
      `VENDOR_PACKAGE_ITEM_SELECT asks for "${col}", which PostgREST will reject ` +
        `with a 400 — ON THE LOCK PATH, i.e. a booking nobody can make. ` +
        `Real columns: ${[...actual].join(', ')}`,
    );
  }
});

/**
 * 🔒 THE FIVE COLUMNS, WRITTEN OUT AS LITERAL STRINGS.
 *
 * ⚠ DO NOT "SIMPLIFY" THIS TO `PACKAGE_ITEM_BRANCHING_SELECT.split(',')`. That
 * is exactly what it used to be, and it made the guard VACUOUS: both constants
 * live in the same file, so a single plausible refactor — "extra_hour_centavos
 * is a pricing column, not a branching column" — dropped it from BOTH in
 * lockstep, the loop then iterated over four names instead of five, and 85 of 85
 * targeted tests passed while every extra hour silently went back to billing ₱0
 * at lock. A guard anchored to the thing it guards cannot fail.
 *
 * Written here as text, once, so the assertion has an independent anchor.
 */
const BRANCHING_COLUMNS_LITERAL = [
  'parent_option_id',
  'pick_min',
  'pick_max',
  'max_extra_hours',
  'extra_hour_centavos',
] as const;

test('the couple-side money select carries ALL FIVE branching columns (literal pin)', () => {
  // Falsifiable in the direction that costs money: drop any one of these from
  // VENDOR_PACKAGE_ITEM_SELECT and the corresponding shape silently returns to
  // billing ₱0 — the column reads `undefined`, the line looks top-level and
  // exactly-one, and no behavioural test notices because they all build
  // in-memory fixtures where the column is set by hand.
  const selected = new Set(VENDOR_PACKAGE_ITEM_SELECT.split(',').map((s) => s.trim()));
  for (const col of BRANCHING_COLUMNS_LITERAL) {
    assert.ok(
      selected.has(col),
      `VENDOR_PACKAGE_ITEM_SELECT no longer asks for "${col}". The charge path ` +
        'depends on it: without it a follow-up pick / an extra pick / an extra ' +
        'hour is priced at zero while the couple’s screen still shows its price.',
    );
  }
  assert.equal(BRANCHING_COLUMNS_LITERAL.length, 5, 'the literal list lost a name');
});

test('the branching constant still names exactly those five (literal pin)', () => {
  // The sibling constant is pinned to the SAME literal list, so trimming both
  // together — the tandem edit that defeated the old guard — now fails here
  // even if the select above were somehow satisfied.
  assert.deepEqual(
    PACKAGE_ITEM_BRANCHING_SELECT.split(',').map((s) => s.trim()).sort(),
    [...BRANCHING_COLUMNS_LITERAL].sort(),
  );
});

test('every one of the five is a real column, extra_hour_centavos included', () => {
  // `extra_hour_centavos` was the one column of the five with no literal pin in
  // any test, and it is also the one the migration parser used to lose (see the
  // semicolon-in-a-comment test above). Both holes, closed against the schema.
  const actual = allItemColumns();
  for (const col of BRANCHING_COLUMNS_LITERAL) {
    assert.ok(actual.has(col), `${col} is not a real vendor_package_items column`);
  }
});

test('the money select names no column twice', () => {
  // The old shape at three call sites was `${VENDOR_PACKAGE_ITEM_SELECT},
  // parent_option_id`. Folding the branching columns in made every one of those
  // a duplicate request, so they were removed — this stops one being re-added
  // out of habit, in the constant itself.
  const selected = VENDOR_PACKAGE_ITEM_SELECT.split(',').map((s) => s.trim());
  assert.equal(
    new Set(selected).size,
    selected.length,
    `VENDOR_PACKAGE_ITEM_SELECT repeats a column: ${selected.join(', ')}`,
  );
});
