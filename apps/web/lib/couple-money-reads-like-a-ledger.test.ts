/**
 * The approved ledger archetype (`prototypes/archetype_data_roster_ledger_comparison_2026-08-01.html`,
 * owner-approved 2026-08-04, BINDING — port, never redraw) states its own rule:
 *
 *   > "Money rows, grouped by category, **every numeral right-aligned in Space
 *   > Mono like a bank book**. The running total is furniture."
 *
 * 🔑 RIGHT-ALIGNMENT ALONE DOES NOT MAKE A COLUMN LINE UP. Proportional figures
 * give ₱1,000 and ₱950 different widths, so the digits stagger even when the
 * right edges match. `tabular-nums` is what makes the figures equal-width.
 *
 * ⚖ WHAT THIS DELIBERATELY DOES **NOT** DEMAND — measured before writing, because
 * a guard that cries wolf teaches you to skim past the one time it is right:
 *   • a bare **₱ symbol** beside an input is not a numeral;
 *   • money inside a **sentence** ("₱4,500 in your build") is prose — forcing it
 *     mono would make the sentence read like a receipt;
 *   • the vendor CARDS' serif-italic price (`.price` / `.hprice`) is a different
 *     archetype's treatment, applied consistently, and is not a ledger row.
 * All three were read and cleared. This guard covers ROWS in a list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const BUILD_LOCKED = join(
  WEB,
  'app/dashboard/[eventId]/vendors/_components/build-locked.tsx',
);

test('the locked build\'s cost column uses equal-width figures', () => {
  const src = readFileSync(BUILD_LOCKED, 'utf8');

  // 🪤 THERE ARE THREE, NOT TWO — AND THE GUARD IS HOW I FOUND OUT. My scan
  // found two because the third is indented differently (`pesoFromPhp(r.cost) &&`
  // with no leading brace) and my grep keyed on the brace. I fixed two, wrote
  // this, and it went red. **A guard written from the same scan that found the
  // defects will inherit their blind spot — unless it re-derives the set, which
  // this one does by matching the RENDER, not the surrounding punctuation.**
  // ⚠ REPOINTED 2026-09-22, ON THIS GUARD'S OWN INSTRUCTION ("If a branch was
  // removed, delete its half of this assertion deliberately"). All three cost
  // rows moved into ONE component, `RowPrice`, because each of them rendered
  // NOTHING when the price was null — empty space indistinguishable from free,
  // from ₱0 and from a layout bug. The ledger property is unchanged and is now
  // stronger: there is a single render site, so the three cannot drift apart.
  //
  // 🔑 The blind-spot warning above still applies, one level up. This no longer
  // re-derives the set from the punctuation around each row; it asserts the set
  // has collapsed to one, AND that nothing renders a cost outside it.
  const mounts = [...src.matchAll(/<RowPrice /g)];
  assert.equal(
    mounts.length,
    3,
    `expected all three cost rows to mount RowPrice; found ${mounts.length}. ` +
      'A row that renders its own cost again is outside this guard.',
  );
  const renders = [...src.matchAll(/<span\n?\s*className=\{\[([\s\S]*?)\]/g)];
  assert.equal(renders.length, 1, 'RowPrice must be the ONE place a row cost is drawn');
  assert.match(
    renders[0]?.[1] ?? '',
    /\btabular-nums\b/,
    'the cost row renders proportional figures — ₱1,000 and ₱950 will not line up. ' +
      'The ledger archetype requires equal-width numerals.',
  );
  // 🪤 And the row must still STATE an absent price rather than drawing nothing,
  // which is the defect that consolidating these rows existed to fix.
  //
  // ⚠ THIS ONE READS CODE, NOT PROSE — and it caught me the first time. The
  // component's own comment QUOTES `pesoFromPhp(r.cost) &&` as the thing that
  // used to happen, so against the raw source this assertion convicted the fix
  // for explaining the defect. Same trap as `capped-rows.test.ts` hit in the
  // slice before this one: **a phrasing ban that cannot tell code from a comment
  // about code will eventually forbid explaining itself.** `stripComments` is
  // the repo's canonical one (`lint-one-comment-stripper.mjs` keeps it single).
  const code = stripComments(src);
  assert.match(code, /'No price recorded'/, 'a null price is drawn as nothing again');
  assert.doesNotMatch(
    code,
    /pesoFromPhp\(r\.cost\) &&/,
    'a row is back to rendering an empty space where the money goes',
  );
});

test('the guard is looking at a file that still renders costs', () => {
  // A test whose subject disappeared passes forever. Pin the thing it measures.
  const src = readFileSync(BUILD_LOCKED, 'utf8');
  assert.match(src, /pesoFromPhp/, 'build-locked no longer renders money — retire or repoint this guard');
});
