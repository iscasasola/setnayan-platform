/**
 * the-ledger-reads-one-clock.test.ts — BA6's fence.
 *
 * The per-category ledger now shows a row's next-payment chip and a
 * roll-up of what is overdue / due soon (`lib/budget-ledger.ts` +
 * `_components/budget-ledger-table.tsx`). Every day count and every tier it
 * renders comes from `MoneyLine.dueState` / `MoneyBucket.due`, which are
 * themselves computed ONCE by `paymentDueState` in `setnayan-ai-triggers.ts`
 * and carried through `budget-truth.ts`.
 *
 * The defect this fences: a second definition of "due soon" or "overdue"
 * written locally — `if (d <= 7)`, `days > 30` — as a shortcut instead of
 * reading the state a line already carries. Two mechanisms computing the
 * same fact is exactly the class of bug this stream keeps finding (RULE 0 §8
 * in the repo CLAUDE.md): each passes its own test while disagreeing with
 * the other, and the page would start telling the couple something GRD-01's
 * email does not.
 *
 * ── HOW THE SOURCE PROPERTY PROVES IT CAN SEE ───────────────────────────────
 * A source guard that cannot match the line it was written to catch ships
 * inert and green. `findHardcodedDayThresholds` is run against HAND-WRITTEN
 * SABOTAGE as well as against the real files: if the detector cannot fail,
 * the test fails.
 *
 * ⚠ Comments are stripped with `stripComments` (`lib/strip-comments.ts`), the
 * ONE stripper — `scripts/lint-one-comment-stripper.mjs` fails CI on a
 * home-grown one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(HERE, '../../../../lib/budget-ledger.ts');
const TABLE = resolve(HERE, '_components/budget-ledger-table.tsx');

const libSrc = () => stripComments(readFileSync(LIB, 'utf8'));
const tableSrc = () => stripComments(readFileSync(TABLE, 'utf8'));

/**
 * Finds a day-ish identifier (`daysUntilDue`, `dueDays`, `d`ays…) compared
 * with `<` `>` `<=` `>=` `==` `===` against a bare digit literal, in either
 * order. `0` and `1` are excluded — those are the natural edges of "has the
 * date passed" and ordinary pluralization ("1 day" vs "N days"), not a
 * business threshold like BA5's 7-day window or 30-day horizon. Anything
 * else — 5, 7, 8, 14, 30, 31 — is exactly the shape of a re-invented
 * threshold and must be caught.
 */
function findHardcodedDayThresholds(src: string): string[] {
  const hits: string[] = [];
  const forward = /\b\w*days?\w*\s*(?:<=|>=|<|>|===?)\s*(\d+)\b/gi;
  const backward = /\b(\d+)\s*(?:<=|>=|<|>|===?)\s*\w*days?\w*\b/gi;
  for (const re of [forward, backward]) {
    for (const m of src.matchAll(re)) {
      const digits = m[1]!;
      if (digits === '0' || digits === '1') continue;
      hits.push(m[0]);
    }
  }
  return hits;
}

test('the detector can see the sabotage it exists to catch', () => {
  assert.deepEqual(
    findHardcodedDayThresholds('if (daysUntilDue <= 7) return "due_soon";'),
    ['daysUntilDue <= 7'],
  );
  assert.deepEqual(
    findHardcodedDayThresholds('const overdue = 30 < daysUntilDue;'),
    ['30 < daysUntilDue'],
  );
  assert.deepEqual(
    findHardcodedDayThresholds('if (dueInDays > 8) tier = "later";'),
    ['dueInDays > 8'],
  );
  // 0 and 1 are legitimate — the detector must not flag ordinary code that
  // merely uses this file's own helper, `daysUntilDueLabel`.
  assert.deepEqual(findHardcodedDayThresholds('if (daysUntilDue < 0) return "…";'), []);
  assert.deepEqual(findHardcodedDayThresholds('n === 1 ? "day" : "days"'), []);
});

test('lib/budget-ledger.ts never compares a day count against its own threshold', () => {
  const hits = findHardcodedDayThresholds(libSrc());
  assert.deepEqual(
    hits,
    [],
    `Found a locally re-derived day threshold: ${JSON.stringify(hits)}. Every band ` +
      `here must come from \`line.dueState\` / \`bucket.due\`, which are already ` +
      `computed by \`paymentDueState\` in setnayan-ai-triggers.ts — never a second ` +
      `comparison against a day-count literal.`,
  );
});

test('the ledger table never compares a day count against its own threshold', () => {
  const hits = findHardcodedDayThresholds(tableSrc());
  assert.deepEqual(
    hits,
    [],
    `Found a locally re-derived day threshold: ${JSON.stringify(hits)}. The table ` +
      `renders \`row.nextDue.state\` / \`ledger.totals\`; it must never re-derive ` +
      `a tier from a day count itself.`,
  );
});

test('neither file imports TRIGGER_THRESHOLDS, paymentDueState, or daysUntilDue directly', () => {
  // BA6's whole point: the page reads the STATE a line already carries
  // (`MoneyLine.dueState`, `MoneyBucket.due`) rather than reaching past
  // `budget-truth.ts` to re-run the clock itself. Importing the trigger
  // engine's primitives here would be the first step toward a second
  // definition, even if nothing hard-codes 7 or 30 yet.
  for (const src of [libSrc(), tableSrc()]) {
    assert.doesNotMatch(src, /from ['"]@\/lib\/setnayan-ai-triggers['"]/);
  }
});
