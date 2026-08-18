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
  const rows = [...src.matchAll(/<span className="([^"]*)"[^>]*>\s*\{pesoFromPhp\(r\.cost\)\}/g)];
  assert.equal(
    rows.length,
    3,
    `expected all three cost rows; found ${rows.length}. ` +
      'If a branch was removed, delete its half of this assertion deliberately.',
  );
  for (const [, classes] of rows) {
    assert.match(
      classes ?? '',
      /\btabular-nums\b/,
      'a cost row renders proportional figures — ₱1,000 and ₱950 will not line up. ' +
        'The ledger archetype requires equal-width numerals.',
    );
  }
});

test('the guard is looking at a file that still renders costs', () => {
  // A test whose subject disappeared passes forever. Pin the thing it measures.
  const src = readFileSync(BUILD_LOCKED, 'utf8');
  assert.match(src, /pesoFromPhp/, 'build-locked no longer renders money — retire or repoint this guard');
});
