/**
 * the-home-reads-at-once.test.ts — the home board's reads start together.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * The launcher made about fifteen trips to the database ONE AFTER ANOTHER —
 * checklists, then decisions, then shop unread, then inquiries, then the admin
 * queues, then chapters, then stories, then people, then event types, then
 * heroes, then posters — although none of them needed another's answer. Each
 * trip waited for the last, so the page took 1.5-3 s to finish on every visit
 * (measured on prod 2026-09-29, the owner asking "why did it load so long").
 *
 * The fix starts every read as a promise and awaits them in ONE `Promise.all`.
 * The way it regresses is quiet: somebody adds the next read the way the old
 * ones were written — a plain `await` at the top of the page body — and it
 * works, passes every other test, and puts a whole round trip back in front
 * of every visitor.
 *
 * ─── What it checks ──────────────────────────────────────────────────────
 * Between the "EVERY READ BELOW STARTS AT ONCE" banner and "THE ONE WAIT", no
 * statement at the page body's own depth may `await`. An `await` INSIDE a
 * started read (deeper indentation) is fine — that is the read's own work,
 * running beside the others.
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
    'A read on the home board is awaited on its own, so every visit waits for it before the ' +
      'next read even starts. Start it as a promise (`const xRead = (async () => { … })();`) ' +
      'and add it to the one Promise.all under "THE ONE WAIT".',
  );
});
