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
  PACKAGE_ITEM_OPTION_COLUMNS,
  PACKAGE_ITEM_OPTION_SELECT,
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
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
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
  const sql = readFileSync(file, 'utf8');
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
