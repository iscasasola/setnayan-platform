/**
 * the-checklist-reads-at-once.test.ts — the checklist page's reads start together.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * After its two gates (who is this · are they a member), the checklist made
 * its trips to the database ONE AFTER ANOTHER — the seed, the event row, the
 * rows, the profile, the budget check, the suggestions, the vendors — although
 * most of them needed nothing from the one before. Each waited for the last,
 * and the page took about a second (measured on prod 2026-09-29).
 *
 * The fix starts every read as a promise and awaits them in ONE `Promise.all`.
 * It regresses quietly: the next read gets written the way the old ones were
 * — a plain `await` at the top of the page body — and it works, passes every
 * other test, and puts a whole round trip back in front of every visit.
 *
 * ─── What it checks ──────────────────────────────────────────────────────
 * Between the "EVERY READ BELOW STARTS AT ONCE" banner and "THE ONE WAIT", no
 * statement at the page body's own depth may `await`. An `await` INSIDE a
 * started read (deeper indentation) is fine — that is the read's own work.
 * And the one ordering that MUST survive: the seed is a write, so it finishes
 * before the rows are read — inside the same started promise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'page.tsx'), 'utf8');

const START = 'EVERY READ BELOW STARTS AT ONCE';
const WAIT = 'THE ONE WAIT';

test('the read block and its one wait are both still there, in order', () => {
  const a = src.indexOf(START);
  const b = src.indexOf(WAIT);
  assert.ok(a > 0, `the "${START}" banner is gone from page.tsx`);
  assert.ok(b > a, `"${WAIT}" must come after "${START}"`);
  // The first statement after the banner: `const [ … ] = await Promise.all([`.
  const firstStatement = src.slice(b, src.indexOf(';', b));
  assert.match(
    firstStatement,
    /\]\s*=\s*await Promise\.all\(\[/,
    'the one wait is no longer a single Promise.all',
  );
});

test('no read between them is awaited at the page body depth', () => {
  const region = src.slice(src.indexOf(START), src.indexOf(WAIT));
  const offenders = region
    .split('\n')
    // Exactly two spaces = a statement of the page body itself.
    .filter((l) => /^ {2}\S/.test(l))
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .filter((l) => /\bawait\b/.test(l));
  assert.deepEqual(
    offenders,
    [],
    'A read on the checklist is awaited on its own, so every visit waits for it before the ' +
      'next read even starts. Start it as a promise (`const xRead = (async () => { … })();`) ' +
      'and add it to the one Promise.all under "THE ONE WAIT".',
  );
});

test('the seed still finishes before the rows are read, in the same started promise', () => {
  const region = src.slice(src.indexOf(START), src.indexOf(WAIT));
  const open = region.indexOf('const rawRowsRead = (async () => {');
  assert.ok(open >= 0, 'the rows are no longer read in `rawRowsRead`');
  // The started promise ends at the first `})();` after it opens.
  const body = region.slice(open, region.indexOf('})();', open));
  const seed = body.indexOf('await ensureChecklistSeeded(eventId);');
  const rows = body.indexOf('fetchChecklistItems(supabase, eventId)');
  assert.ok(seed >= 0, 'the seed (a WRITE) left the promise that reads the rows');
  assert.ok(rows > seed, 'the rows must be read AFTER the seed finishes, or a fresh task is missing');
  assert.equal(
    (src.match(/fetchChecklistItems\(/g) ?? []).length,
    1,
    'a second read of the rows would not be ordered after the seed',
  );
});
