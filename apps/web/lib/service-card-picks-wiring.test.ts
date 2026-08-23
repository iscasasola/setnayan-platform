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

test('the SHARED gate decides whether the section shows, not a copy per file', () => {
  // There are TWO shared predicates now, and the difference is deliberate:
  // `…ToTheShop` additionally opens on the documented-celebrations count, which
  // is a SHOP fact and so must not grow a "record" on a couple's view of a card
  // that has itself done nothing. Either is fine here; a hand-written
  // `bookedCount > 0` is not, and that is what this test exists to refuse.
  for (const f of [
    'app/_components/card-record-section.tsx',
    'app/vendor-dashboard/services/_components/services-manager.tsx',
    'app/v/[slug]/page.tsx',
  ]) {
    const src = code(f);
    assert.match(
      src,
      /cardRecordHasSomethingToSay(ToTheShop)?\(/,
      `${f} must ask one of the shared predicates`,
    );
    assert.doesNotMatch(
      src,
      /record\.bookedCount <= 0|cardRecord\.bookedCount > 0|rec\.bookedCount <= 0|rec\.documentedEvents > 0/,
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

test('the documented count is rendered, and labelled as a SHOP fact', () => {
  const section = code('app/_components/card-record-section.tsx');
  assert.equal(
    [...section.matchAll(/\{documentedEvents\}/g)].length,
    1,
    'the count must actually render',
  );
  // Captures are keyed on the vendor profile, so every card of a shop shows the
  // same number. Without the label a brand-new card reads as having documented
  // celebrations itself.
  assert.match(
    section,
    /documented · this shop/,
    'the count must say it is the shop’s, not this card’s',
  );
  // …and it opens the section only on the shop's own view.
  assert.match(
    section,
    /variant === 'vendor'\s*\?\s*cardRecordHasSomethingToSayToTheShop\(record\)\s*:\s*cardRecordHasSomethingToSay\(record\)/,
    'a shop fact must not open the record on a couple’s card',
  );
});
