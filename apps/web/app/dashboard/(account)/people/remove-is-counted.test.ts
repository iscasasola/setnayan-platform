/**
 * remove-is-counted.test.ts — every removal the People page can make COUNTS the
 * rows it changed (owner 2026-10-23, "why can't i delete anyone").
 *
 * The property: a removal write (a `.delete()`, or an `.update()` that sets
 * `deleted_at`) in the People actions returns its rows (`.select(…)`) and hands
 * them to `removalWriteResult`, which treats zero as a failure. A write that
 * returns nothing cannot tell "removed" from "matched nobody" — that is how ✕ →
 * Remove on a connection someone else had asked for closed the sheet, said
 * nothing, and left them on the list.
 *
 * The behaviour itself is held in the database by
 * `tests/db/people-remove-removes.db.test.ts` and in the logic by
 * `lib/people-remove.test.ts`; this file holds the WIRING, so a new removal
 * written next to these cannot quietly skip the count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const HERE = path.join(process.cwd(), 'app/dashboard/(account)/people');
const ACTIONS = ['actions.ts', 'dependent-actions.ts'];
const ROSTER = path.join(HERE, '_components/people-roster-view.tsx');

/** Each exported function's name and body — from its `export async function` to the closing brace at column 0 (prettier's shape). */
function exportedFunctions(src: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const re = /^export async function (\w+)\s*\(/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const close = src.indexOf('\n}\n', m.index);
    out.push({ name: m[1]!, body: src.slice(m.index, close === -1 ? src.length : close + 2) });
  }
  return out;
}

/** Strip // and /* *\/ comments so a comment can never satisfy a wiring check. */
function code(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

test('🔴 every People removal write returns its rows and is judged by removalWriteResult', () => {
  let writes = 0;
  for (const file of ACTIONS) {
    const src = readFileSync(path.join(HERE, file), 'utf8');
    for (const fn of exportedFunctions(src)) {
      const body = code(fn.body);
      // one statement per `await supabase…;`
      const statements = body.split(';').filter((st) => /\.from\(/.test(st));
      for (const st of statements) {
        const removal = /\.delete\(\)/.test(st) || /\.update\(\{\s*deleted_at\b/.test(st);
        if (!removal) continue;
        writes += 1;
        assert.match(
          st,
          /\.select\(/,
          `${file} › ${fn.name}: a removal write must return its rows (.select(…)) — without them "matched nobody" reads as "done"`,
        );
        assert.match(
          body,
          /removalWriteResult\(data, error\)/,
          `${file} › ${fn.name}: the removal's rows must be judged by removalWriteResult (zero rows = failure)`,
        );
      }
    }
  }
  console.log(`  removal writes checked: ${writes}`);
  assert.ok(writes >= 3, `expected the three People removals (connection · loved one · godparent), found ${writes}`);
});

test('🔴 withdrawConnection reaches a connection from EITHER side — not the declarer’s alone', () => {
  const src = readFileSync(path.join(HERE, 'actions.ts'), 'utf8');
  const fn = exportedFunctions(src).find((f) => f.name === 'withdrawConnection');
  assert.ok(fn, 'withdrawConnection is gone — this guard must move with it');
  const body = code(fn.body);
  assert.match(body, /\.or\(removableConnectionFilter\(myPerson\)\)/);
  assert.doesNotMatch(
    body,
    /\.eq\(\s*'from_person_id'/,
    'a declarer-only filter makes Remove a silent no-op for a connection the other person asked for',
  );
});

test('🔴 the roster’s Remove confirm goes through removeFromPeople — no id list that can come out empty', () => {
  const src = code(readFileSync(ROSTER, 'utf8'));
  const at = src.indexOf('data-testid="people-remove-confirm"');
  assert.ok(at > 0, 'the Remove confirm button is gone — this guard must move with it');
  const handler = src.slice(src.lastIndexOf('onClick={', at), at);
  assert.match(handler, /removeFromPeople\(rows, \(id\) => withdrawConnection\(id\)\)/);
  assert.doesNotMatch(handler, /\.filter\(Boolean\)/, 'filtering ids away turns "could not" into "nothing to do"');
  assert.doesNotMatch(handler, /return \{ ok: true \}/, 'the confirm may not invent its own success');
});
