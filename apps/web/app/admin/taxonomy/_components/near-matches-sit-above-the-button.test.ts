/**
 * THE NEAR-MATCHES SIT ABOVE THE PROMOTE BUTTON (C4, 2026-08-28).
 *
 * ── WHY THE ORDER IS A RULE AND NOT A LAYOUT PREFERENCE ─────────────────────
 * The whole feature is a person in the middle. A queue with a suggestion
 * attached is a queue people stop reading, and if the answer can be accepted
 * without the alternatives having been read then the person in the middle has
 * been removed while appearing to still be there. The thing a reviewer must
 * meet FIRST is "here is what we already have that is close, and why we think
 * none of it is the same trade" — because the failure this guards against is
 * pressing Promote on a machine's tile guess and minting a duplicate of a trade
 * we already own. `promoteCategoryRequest`'s duplicate check is a SLUG match,
 * so nothing downstream will catch it.
 *
 * Drawn that way in prototypes/category_suggester_2026-08-28.html § "Step 5,
 * drawn": the near-matches block, then the row of buttons.
 *
 * ⚠ SOURCE MATCHING CANNOT SEE A MISSING IMPORT — run `tsc` beside this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { loadSources } from '@/lib/gate-writers';

/**
 * The Studio's source with COMMENTS STRIPPED, via the repo's own single
 * stripper.
 *
 * 🪤 A RAW READ WOULD LET A DOCBLOCK SATISFY THIS GUARD. Every rule here is
 * also written in prose a few lines from the code it governs — "the branch is
 * the weakest part of any draft" appears in the component's own header — so a
 * raw match would go green on the explanation while the sentence a reviewer
 * actually reads had been deleted. This guard asserts on what RENDERS.
 */
const WEB_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const src = (() => {
  const rel = 'app/admin/taxonomy/_components/taxonomy-studio.tsx';
  const found = loadSources(WEB_ROOT).find((f) => f.path === rel);
  assert.ok(found, `no source at ${rel} — did the Studio move?`);
  return found.code;
})();

/** The row of the four shipped outcome controls, inside the request `<li>`. */
const BUTTON_ROW = '<div className="flex flex-wrap items-end gap-2">';

function onlyIndexOf(needle: string): number {
  const count = src.split(needle).length - 1;
  assert.equal(count, 1, `expected exactly one "${needle}" — found ${count}`);
  return src.indexOf(needle);
}

test('the drafted near-matches render BEFORE the row of buttons', () => {
  const notes = onlyIndexOf('<RequestDraftNotes');
  const buttons = onlyIndexOf(BUTTON_ROW);
  assert.ok(
    notes < buttons,
    'the near-matches moved below the buttons — a reviewer can now accept the draft without reading them',
  );
});

test('the promote control is INSIDE that row, so the comparison above is the real order', () => {
  const buttons = onlyIndexOf(BUTTON_ROW);
  const promote = onlyIndexOf('<PromoteRequestForm');
  assert.ok(promote > buttons, 'the promote form left the button row');
});

test('the near-match block offers no control of its own — it is text a person reads', () => {
  const start = src.indexOf('function RequestDraftNotes(');
  assert.ok(start > 0, 'RequestDraftNotes is gone');
  const end = src.indexOf('\nfunction ', start + 1);
  const body = src.slice(start, end > 0 ? end : undefined);
  for (const control of ['<form', '<button', 'SubmitButton', 'onClick', 'action={']) {
    assert.equal(
      body.includes(control),
      false,
      `the near-match block grew a "${control}" — it may inform a decision, never make one`,
    );
  }
});

test('the branch is prefilled but never locked, and the screen says it is the weak part', () => {
  assert.match(src, /defaultValue=\{draft\?\.suggestedTileId \?\? ''\}/);
  assert.match(src, /promote under tile…/);
  // The caution the prototype draws, kept where a reviewer meets it.
  assert.match(src, /weakest part of any\n?\s*draft/);
});

test('an undrafted request still renders the four shipped outcomes and nothing extra', () => {
  // `RequestDraftNotes` returns null with no draft, so a queue with the flag
  // off is byte-identical to the one that shipped before C4.
  assert.match(src, /if \(!draft\) return null;/);
});
