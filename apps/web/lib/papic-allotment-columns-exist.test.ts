/**
 * GUARD — every column the sheet SELECTS is a column the migration DECLARES.
 *
 * 🚨 THIS EXISTS BECAUSE IT ALREADY HAPPENED. The sheet shipped selecting
 * `points` from `papic_guest_spend_ceilings`. The column is `ceiling_points`.
 * PostgREST refuses the whole query for one unknown column, so `data` came back
 * empty, every named guest read as un-named, and the couple would have been
 * shown the entire pot divided among everyone — a wrong number, silently, with
 * no error anywhere.
 *
 * 🔑 NOTHING ELSE IN THE LOCAL LOOP COULD SEE IT. The admin client is untyped,
 * so `tsc` has no opinion about column names. The unit tests exercise a pure
 * function that never touches a table. It was caught only by diffing the merged
 * migration against the branch — which is a thing a person has to remember to
 * do, and this file is the version that does not need remembering.
 *
 * ⚠ THE COLUMN LIST IS DERIVED FROM BOTH SIDES, NEVER TYPED HERE. A hand-typed
 * expectation is silent about whatever nobody typed into it — the same reason
 * `outcomes-are-shown.test.ts` derives its keys from the actions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALLOTMENT_STORAGE } from './papic-guest-allotments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const MIGRATIONS = resolve(WEB, '../../supabase/migrations');
const SHEET = join(
  WEB,
  'app/dashboard/[eventId]/studio/papic/_components/guest-allotments-choice.tsx',
);

/** The CREATE TABLE body for a table, from whichever migration declares it. */
function declaredColumns(table: string): Set<string> {
  const re = new RegExp(
    `CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
  );
  for (const name of readdirSync(MIGRATIONS)) {
    if (!name.endsWith('.sql')) continue;
    const m = re.exec(readFileSync(join(MIGRATIONS, name), 'utf8'));
    if (!m) continue;
    const cols = new Set<string>();
    for (const line of m[1]!.split('\n')) {
      const col = /^\s{2}([a-z_][a-z0-9_]*)\s+[A-Z]/.exec(line);
      if (col) cols.add(col[1]!);
    }
    return cols;
  }
  return new Set();
}

/** Every `.select('…')` in the sheet, as { table, columns }. */
function sheetSelects(): Array<{ near: string; columns: string[] }> {
  const src = readFileSync(SHEET, 'utf8');
  return [...src.matchAll(/\.select\(\s*'([^']+)'/g)].map((m) => ({
    near: m[1]!,
    // Strip PostgREST embedding and aliases — bare column names only.
    columns: m[1]!
      .split(',')
      .map((c) => c.trim().split(':').pop()!.trim())
      .filter((c) => c && !c.includes('(') && !c.includes('*')),
  }));
}

test('the ceilings table really has the columns the sheet asks for', () => {
  const declared = declaredColumns(ALLOTMENT_STORAGE.table);
  assert.ok(
    declared.size >= 4,
    `read no columns for ${ALLOTMENT_STORAGE.table} — the scan found nothing, which passes everything`,
  );
  assert.ok(declared.has('ceiling_points'), 'the amount column is ceiling_points');
  assert.ok(declared.has('guest_id') && declared.has('event_id'));

  // 🚨 THE BUG THIS FILE IS NAMED FOR: `points` is NOT a column on this table.
  assert.ok(
    !declared.has('points'),
    'if `points` ever becomes real, this guard has stopped describing the defect it exists for',
  );

  const ceilingSelect = sheetSelects().find((s) => s.columns.includes('ceiling_points'));
  assert.ok(ceilingSelect, 'the sheet must select ceiling_points from the ceilings table');
  for (const col of ceilingSelect.columns) {
    assert.ok(
      declared.has(col),
      `the sheet selects "${col}", which ${ALLOTMENT_STORAGE.table} does not declare — PostgREST refuses the WHOLE query for one unknown column, so this reads as an empty result rather than an error`,
    );
  }
});

test('the sheet counts the same guests the database counts', () => {
  const src = readFileSync(SHEET, 'utf8');
  // The resolver JOINs `guests` and excludes removed and declined people before
  // summing named ceilings. A sheet that counts them subtracts an absent
  // person's credits from the pot AND shrinks the divisor, quietly making
  // everybody else's share smaller than the arithmetic the couple was shown.
  // 🪤 ASSERT IT IS IN THE SELECT, NOT MERELY IN THE FILE. The first cut matched
  // /rsvp_status/ anywhere, and a sabotage that removed it from the `.select()`
  // SURVIVED — the word still appeared in the type annotation and the filter.
  // That failure is silent and total: PostgREST simply does not return the
  // field, `g.rsvp_status` is undefined, `?? ''` makes it `!== 'declined'`, and
  // EVERY declined guest counts as still coming.
  const guestSelect = sheetSelects().find((sel) => sel.columns.includes('guest_id') && sel.columns.includes('first_name'));
  assert.ok(guestSelect, 'the sheet must read the guest list');
  assert.ok(
    guestSelect.columns.includes('rsvp_status'),
    'the GUEST SELECT must ask for rsvp_status — without it every decliner silently counts as still coming',
  );
  assert.match(src, /!==\s*'declined'/, 'decliners must be excluded from the count');
  assert.match(
    src,
    /stillComing\.has\(/,
    'the named totals must be filtered to guests who are still coming',
  );
});
