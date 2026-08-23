/**
 * THE PICKS ARE ACTUALLY REACHABLE — the wiring, not the numbers.
 *
 * Every pure rule above passes whether or not anything renders the block or
 * stamps the link. These assertions hold the three joints that would each turn
 * this feature into a gate with no handle — the shape this project has already
 * shipped five times, where a mechanism is built, correct, and unreachable.
 *
 * Source-scanned, comments stripped first: each file carries prose naming the
 * exact strings hunted here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const code = (p: string) =>
  readFileSync(join(ROOT, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

test('the link is STAMPED when the maker mints a card’s package', () => {
  const actions = code('app/vendor-dashboard/services/actions.ts');
  assert.match(
    actions,
    /vendorServiceId: typeof savedId === 'string' && savedId\.length > 0 \? savedId : null,/,
    'without this the column exists and stays empty — a link nothing writes',
  );
  const pkgs = code('app/vendor-dashboard/packages/actions.ts');
  assert.equal(
    [...pkgs.matchAll(/vendor_service_id: input\.vendorServiceId \?\? null,/g)].length,
    1,
    'the CREATE branch must write it — and only the create branch',
  );
});

test('the block is RENDERED, with its own denominator', () => {
  const section = code('app/_components/card-record-section.tsx');
  assert.equal(
    [...section.matchAll(/optionPicks\.map\(/g)].length,
    1,
    'the picks must actually render',
  );
  assert.match(section, /of the last\{' '\}/, 'and each line must carry its denominator');
});

test('ONE gate decides whether the section shows, not four copies', () => {
  for (const f of [
    'app/_components/card-record-section.tsx',
    'app/vendor-dashboard/services/_components/services-manager.tsx',
    'app/v/[slug]/page.tsx',
  ]) {
    const src = code(f);
    assert.match(
      src,
      /cardRecordHasSomethingToSay\(/,
      `${f} must ask the shared predicate`,
    );
    assert.doesNotMatch(
      src,
      /record\.bookedCount <= 0|cardRecord\.bookedCount > 0|rec\.bookedCount <= 0/,
      `${f} still carries its own copy of the gate — a card whose only record is its picks would be hidden`,
    );
  }
});

test('the headline claim is not printed when the count is zero', () => {
  const section = code('app/_components/card-record-section.tsx');
  // "Booked 0× on Setnayan" beside "4 of the last 6 couples chose" is the
  // product contradicting itself, and bookedCount genuinely cannot see a
  // package booking.
  assert.match(
    section,
    /\{bookedCount > 0 \? \(/,
    'the booked line must be conditional on a real count',
  );
});
