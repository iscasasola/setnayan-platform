/**
 * COLUMN-NAME GUARD for vendor_package_item_options.
 *
 * Why this exists: this project has no generated Supabase types, so a column
 * name inside a `.select()` string or an `.insert()` key is unchecked text.
 * The authoring surface shipped asking for `label` when the column is
 * `option_label` — PostgREST 400s on an unknown column, so a vendor could
 * neither save nor reload a choice option, and nothing caught it: the DB tests
 * used the right name, the app code used the wrong one, and the two never met.
 *
 * This suite pins the names in ./vendor-packages to the CREATE TABLE that
 * actually built the table. Falsifiable: change `option_label` back to `label`
 * in PACKAGE_ITEM_OPTION_COLUMNS (or in the select list) and it goes red.
 *
 * Pure module + one file read: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PACKAGE_ITEM_OPTION_COLUMNS,
  PACKAGE_ITEM_OPTION_SELECT,
} from './vendor-packages';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(
  HERE,
  '../../../supabase/migrations',
  '20271006413374_vendor_package_credit_required_and_choice_options.sql',
);

/**
 * The column names in the `CREATE TABLE public.vendor_package_item_options`
 * block. Deliberately parsed from the migration rather than hard-coded — a
 * second hard-coded list would drift exactly the way the first one did.
 */
function columnsInMigration(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8');
  const start = sql.indexOf(
    'CREATE TABLE IF NOT EXISTS public.vendor_package_item_options',
  );
  assert.notEqual(start, -1, 'CREATE TABLE for the options table not found');

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

test('every column we name actually exists in the migration', () => {
  const actual = new Set(columnsInMigration());
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
  const actual = new Set(columnsInMigration());
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
  const actual = new Set(columnsInMigration());
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
