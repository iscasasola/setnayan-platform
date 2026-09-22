/**
 * the-closing-copy-gets-the-whole-row.test.ts — THE CALLER MUST HAND OVER THE ROW.
 *
 * ── WHY THIS EXISTS, AND WHY THE OTHER TEST CANNOT DO IT ────────────────────
 * `thread-closing-copy.test.ts` executes the decision and proves the mapping.
 * It cannot prove the pages *reach* it with the right inputs. **A guard on the
 * call cannot see the argument.**
 *
 * Measured, not argued: with both pages edited to pass
 * `{ inquiry_status: thread.inquiry_status }` — dropping `archived_at`, the one
 * column a withdrawal is actually stored in — **all eight of those tests stayed
 * green**, and every withdrawal would have gone back to reading as a decline.
 * That is the original bug restored with no red light anywhere.
 *
 * TypeScript cannot catch it either: `ChatThreadRow.archived_at` is declared
 * optional (`archived_at?: string | null`, so a pre-migration mapper can
 * degrade to "not removed"), and an object literal that simply omits an
 * optional property type-checks. Making it required in `ClosingInput` would
 * make passing a real `thread` a type ERROR, which is worse.
 *
 * So the guard is structural and executable: **the first argument at every
 * `closingCopy(` call site is the bare identifier `thread`** — the whole row,
 * never a literal assembled by hand. There is then no field to forget.
 *
 * ⚠ This asserts a PROPERTY ("the row is passed whole"), not a phrasing. A
 * caller may rename nothing and reword nothing to get around it; it must
 * genuinely stop hand-building the argument.
 *
 * Sabotage watched red: change either page to
 * `closingCopy({ inquiry_status: thread.inquiry_status }, …)` → this fails while
 * the mapping tests stay green, which is the whole reason it exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Both thread pages. Neither may hand-build the argument. */
const CALLERS = [
  'app/dashboard/[eventId]/messages/[threadId]/page.tsx',
  'app/vendor-dashboard/messages/[threadId]/page.tsx',
];

/** The first argument of a call, read by balancing parens from the open paren. */
function firstArgument(src: string, at: number): string {
  let depth = 0;
  let i = at;
  for (; i < src.length; i += 1) {
    const c = src[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) break;
    } else if (c === ',' && depth === 1) break;
  }
  return src.slice(at + 1, i).trim();
}

test('every closingCopy call site hands over the whole thread row', () => {
  for (const rel of CALLERS) {
    const src = readFileSync(join(WEB, rel), 'utf8');

    // Count call sites by scanning EVERY occurrence, not just the first — a
    // guard anchored on the first match faces the wrong cell.
    const sites: string[] = [];
    let from = 0;
    for (;;) {
      const at = src.indexOf('closingCopy(', from);
      if (at === -1) break;
      sites.push(firstArgument(src, at + 'closingCopy'.length));
      from = at + 1;
    }

    assert.ok(
      sites.length >= 1,
      `${rel}: no closingCopy call site found — the page stopped using the one module, or this guard is looking at the wrong file`,
    );

    for (const [n, arg] of sites.entries()) {
      assert.equal(
        arg,
        'thread',
        `${rel}: call site ${n + 1} passes \`${arg}\` instead of the whole row. ` +
          'A hand-built literal can silently omit archived_at, which is the ONLY ' +
          'column a withdrawal is stored in — the mapping tests would stay green ' +
          'while every withdrawal reads as a decline again.',
      );
    }
  }
});

test('the module still reads archived_at at all', () => {
  const src = readFileSync(join(WEB, 'lib/thread-closing-copy.ts'), 'utf8');
  assert.match(
    src,
    /input\.archived_at/,
    'thread-closing-copy.ts no longer reads archived_at — a withdrawal is invisible to a status read',
  );
});
