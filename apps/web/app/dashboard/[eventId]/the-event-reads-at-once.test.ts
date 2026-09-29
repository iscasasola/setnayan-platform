/**
 * the-event-reads-at-once.test.ts — the event overview's reads, and the event
 * layout's, start together.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * The event overview (`page.tsx`) waited on its reads ONE AFTER ANOTHER — the
 * Nikah guests, the finished-event summary, the day-of grid, the officiant, the
 * Papic viewer and nudge, the Setnayan AI offer, the store-shell check — though
 * none needed another's answer, and took ~1.4 s (measured on prod 2026-09-29).
 * The layout (`layout.tsx`) wraps EVERY event page, and after its one chrome
 * `Promise.all` it still awaited the profile, the referral toggle, the nav
 * registry and the store-shell check one at a time — four trips on every tap.
 *
 * Both now start each read as a promise and await them in ONE `Promise.all`.
 * The way it regresses is quiet: somebody adds the next read the way the old
 * ones were written — a plain `await` at the top of the function body — and
 * it works, passes every other test, and puts a whole round trip back in front
 * of every visitor.
 *
 * ─── What it checks ──────────────────────────────────────────────────────
 * In each file, between the "EVERY READ BELOW STARTS AT ONCE" banner and the
 * "─── THE ONE WAIT" banner, no statement at the function body's own depth may
 * `await`. An `await` INSIDE a started read (deeper indentation) is fine — that
 * is the read's own work, running beside the others.
 *
 * ⚠ The gates are deliberately OUTSIDE the region, above it: the layout's
 * membership check and the page's event-row `notFound()` must still finish
 * before any read they guard starts. That ordering is pinned elsewhere
 * (`the-notice-follows-the-payer.test.ts` for the layout), and here only as
 * "the region starts after the gate".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const START = 'EVERY READ BELOW STARTS AT ONCE';
const WAIT = '// ─── THE ONE WAIT';

/** The gate each region must follow — the last refusal before any read. */
const GATES: Record<string, string> = {
  'page.tsx': 'if (!event) notFound();',
  'layout.tsx': 'if (!moderator) {',
};

for (const file of ['page.tsx', 'layout.tsx'] as const) {
  const src = readFileSync(join(here, file), 'utf8');

  test(`${file}: the read block and its one wait are both there, in order, after the gate`, () => {
    const gate = src.indexOf(GATES[file]!);
    const a = src.indexOf(START);
    const b = src.indexOf(WAIT);
    assert.ok(gate > 0, `the gate "${GATES[file]}" is gone from ${file}`);
    assert.ok(a > 0, `the "${START}" banner is gone from ${file}`);
    assert.equal(src.indexOf(START, a + 1), -1, `"${START}" appears twice in ${file}`);
    assert.equal(src.indexOf(WAIT, b + 1), -1, `"${WAIT}" appears twice in ${file}`);
    assert.ok(b > a, `"${WAIT}" must come after "${START}" in ${file}`);
    assert.ok(
      a > gate,
      `the read block in ${file} now starts BEFORE its access gate — a read would run for a caller the gate refuses`,
    );
    // The statement DIRECTLY under the wait banner — nothing between them — is
    // `const [ … ] = await Promise.all([`. `[^;]` keeps a second statement from
    // hiding in the gap.
    const firstStatement = src.slice(b, src.indexOf('await Promise.all([', b) + 'await Promise.all(['.length);
    assert.match(
      firstStatement,
      /^\/\/ ─── THE ONE WAIT[^\n]*\n {2}const \[[^;]*\]\s*=\s*await Promise\.all\(\[$/,
      `the one wait in ${file} is no longer a single Promise.all`,
    );
  });

  test(`${file}: no read between them is awaited at the function body depth`, () => {
    const region = src.slice(src.indexOf(START), src.indexOf(WAIT));
    const offenders = region
      .split('\n')
      // Exactly two spaces = a statement of the component body itself.
      .filter((l) => /^ {2}\S/.test(l))
      .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
      .filter((l) => /\bawait\b/.test(l));
    assert.deepEqual(
      offenders,
      [],
      `A read in ${file} is awaited on its own, so every visit waits for it before the ` +
        'next read even starts. Start it as a promise (`const xRead = (async () => { … })();`) ' +
        'and add it to the one Promise.all under "THE ONE WAIT".',
    );
  });
}
