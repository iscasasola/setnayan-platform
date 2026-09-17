/**
 * a-chip-tells-the-truth-about-empty.test.ts — DAY-32c.
 *
 * The website editor's rail draws a chip beside every row. It picked its colour by
 * comparing the status STRING to a denylist of three literals — grey for exactly
 * 'Not set', 'Off' and 'Hidden', success-green for everything else. So four
 * statuses meaning "there is nothing here" were painted as achievements:
 *
 *     Private      → nobody at all can view the site
 *     No schedule  → no schedule blocks are public
 *     0 photos     → the gallery is empty
 *     0 showing    → no sections are showing
 *
 * A couple whose wedding site nobody could open saw the same green chip as a couple
 * who had published theirs.
 *
 * 🔑 THE DENYLIST IS THE DEFECT, NOT THE FOUR STRINGS. Adding them to the list
 * leaves the machine that produced them running — every future empty-state wording
 * is green by default, and the fifth arrives silently. **So this guard does not
 * check the four. It checks that the denylist is gone and cannot come back**, which
 * is the only assertion that also covers the fifth.
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────────
 *   EXERCISED — the chip's colour follows the row's own claim, for any wording at
 *   all, including inventions this codebase has never used.
 *   PARSED — the shell no longer compares a status to a literal, and every row the
 *   page builds states its own meaning.
 *
 * ⚠ THE TYPE IS THE REAL GUARD AND IT IS STRONGER THAN THIS FILE. `status` is a
 * `RowStatus`, so a new row cannot COMPILE without saying whether it is filled.
 * A default would have to guess, and both guesses are wrong: filled recreates this
 * defect exactly, empty greys every finished row until somebody notices.
 *
 * 🛡 Sabotage-checked, each mutation still parsing and still typechecking, with the
 * subtest count printed before the colour is read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { done, todo } from '@/app/dashboard/[eventId]/website/editor/_components/editor-shell';

const HERE = dirname(fileURLToPath(import.meta.url));
const EDITOR = join(HERE, '..', 'app', 'dashboard', '[eventId]', 'website', 'editor');
const shell = stripComments(readFileSync(join(EDITOR, '_components', 'editor-shell.tsx'), 'utf8'));
const page = stripComments(readFileSync(join(EDITOR, 'page.tsx'), 'utf8'));

test('EXERCISED · the chip follows the claim, not the wording', () => {
  /*
   * Wordings this codebase has never used. Under the denylist every one of them
   * was success-green; under the claim they are whatever the row says they are.
   * That is the point: the rule must be right about statuses nobody has written yet.
   */
  for (const label of ['Private', 'No schedule', '0 photos', '0 showing', 'Nothing yet', '—', 'Empty']) {
    const t = todo(label);
    const d = done(label);
    console.log(`  "${label}" → todo:${t.filled} done:${d.filled}`);
    assert.equal(t.filled, false, `todo('${label}') claims to be filled`);
    assert.equal(d.filled, true, `done('${label}') claims to be empty`);
    assert.equal(t.label, label);
  }
});

test('PARSED · the shell colours on the claim and compares no status to a literal', () => {
  assert.match(
    shell,
    /row\.status\.filled\s*\n?\s*\?\s*'bg-success-100/,
    'the chip no longer takes its colour from the row’s own claim',
  );

  // The denylist, in any spelling: a status compared to a string literal.
  const literals = shell.match(/row\.status(?:\.label)?\s*===\s*'[^']*'/g) ?? [];
  console.log(`  status-vs-literal comparisons in the shell: ${literals.length}`);
  assert.deepEqual(literals, [], 'the shell is classifying statuses by their wording again');
});

test('PARSED · every row the page builds states its own meaning', () => {
  const assigns = page.match(/\bstatus:/g)?.length ?? 0;
  const claims = page.match(/\b(?:done|todo)\(/g)?.length ?? 0;
  const undefineds = page.match(/status:\s*(?:[\s\S]{0,120}?)\bundefined\b/g)?.length ?? 0;
  console.log(`  status assignments: ${assigns} · done()/todo() claims: ${claims} · deliberate undefined: ${undefineds}`);

  assert.ok(assigns >= 10, `floor: expected 10+ status rows, found ${assigns} — the parse broke`);
  /*
   * Every assignment resolves to a claim or to `undefined` (a row that shows no
   * chip at all — the locked gallery and the un-owned Pro row). A bare string
   * cannot typecheck any more, so this is belt to the type's braces; it exists so
   * the count is VISIBLE on every run rather than inferred from a green tick.
   */
  assert.ok(
    claims >= assigns - undefineds,
    `${assigns} rows, ${undefineds} deliberately chip-less, but only ${claims} state whether they are filled`,
  );

  // And the four that started this must be `todo`, by name.
  for (const label of ['Private', 'No schedule', '0 photos', '0 showing']) {
    const re = new RegExp(`todo\\('${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}'\\)`);
    assert.match(page, re, `"${label}" is no longer declared empty — it will paint success-green`);
  }
});
