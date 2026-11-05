/**
 * GUARD — the plus/minus walks the REAL ladder, and types none of it.
 *
 * Owner, 2026-08-28, on the live card: *"we want a +- value and they will see
 * how much will be added. from 50 pesos to 10,000 pesos?"* — and the range was
 * his, measured right: the sixteen live rungs run ₱50 to ₱10,000.
 *
 * ⚠ THE PRICES ARE IN FLIGHT WHILE THIS SHIPS. The owner's own price sheet moves
 * the top rung from ₱10,000 to ₱11,200 in a separate open PR. So a peso figure
 * spelled anywhere in this control would quietly outrank him within the week —
 * which is the "never re-type a price, read the catalog" rule this project has
 * paid for more than once.
 *
 * 🔑 AND THE SUBMITTED FIELD MUST STAY THE SERVICE CODE. The server charges off
 * the code and re-reads the price itself. If this control ever posted an AMOUNT,
 * a tampered client would be naming its own price.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const STEPPER = readFileSync(join(PAPIC, '_components', 'credit-stepper.tsx'), 'utf8');
// 🎨 The credit card became the Buy more sheet (owner 2026-10-14): the ladder is
// read and SORTED in lib/papic-pool-rungs.ts, and drawn by papic-buy-form.tsx.
const CARD =
  readFileSync(join(PAPIC, '_components', 'papic-buy-form.tsx'), 'utf8') +
  readFileSync(join(PAPIC, '..', '..', '..', '..', '..', 'lib', 'papic-pool-rungs.ts'), 'utf8');

/** Comments stripped — a guard must never pass on the prose explaining it. */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const STEPPER_CODE = strip(STEPPER);
const FORM = readFileSync(join(PAPIC, '_components', 'papic-buy-form.tsx'), 'utf8');
const SHEETS = [
  { name: 'papic-buy-sheet.tsx', code: strip(readFileSync(join(PAPIC, '_components', 'papic-buy-sheet.tsx'), 'utf8')) },
  { name: 'iap-papic-sheet.tsx', code: strip(readFileSync(join(PAPIC, '..', '..', '..', '..', '_components', 'iap', 'iap-papic-sheet.tsx'), 'utf8')) },
];
const CARD_CODE = strip(CARD);

test('🚨 no peso figure and no credit count is spelled in the control', () => {
  // Any bare number of 2+ digits is suspect; the legitimate ones in this file are
  // pixel/size tokens inside class names, which are stripped out first.
  const withoutClasses = STEPPER_CODE.replace(/className=("[^"]*"|\{`[^`]*`\})/g, ' ')
    .replace(/aria-label="[^"]*"/g, ' ');
  const numbers = [...withoutClasses.matchAll(/\b\d{2,}\b/g)].map((m) => m[0]);
  assert.deepEqual(
    numbers,
    [],
    `figures are typed into the stepper: ${numbers.join(', ')}. Every price and credit count must ` +
      'arrive as a prop read from the catalog — the owner is moving the top rung this week.',
  );
});

test('🚨 the form still submits the service code, never an amount', () => {
  assert.match(
    STEPPER_CODE,
    /<input\s+type="hidden"\s+name="service_code"\s+value=\{rung\.serviceCode\}/,
    'the hidden field no longer carries the rung\'s service code — if it posts a price, the client is naming it',
  );
  assert.ok(
    !/name="(amount|price|php|points)"/.test(STEPPER_CODE),
    'the stepper posts an amount. The server must charge off the code and read the price itself.',
  );
});

test('🚨 the rungs are sorted so that + always costs more', () => {
  assert.match(
    CARD_CODE,
    /\.sort\(\([^)]*\)\s*=>\s*\(?a\.pricePhp[^)]*\)?\s*-\s*\(?b\.pricePhp/,
    'the card no longer sorts the rungs by price before handing them over. The catalog does not ' +
      'guarantee an order, and a ladder whose plus button goes DOWN is worse than the dropdown it replaced.',
  );
});

// RE-AIMED 2026-10-24 (owner, on the live sheet: *"it should just ask how much they want to add more and purchase …
// Make the texts and messages simpler here"*): the range line left the sheet for its ONE ⓘ. The ends are still read
// from the rungs — now in `ladderEnds`, which both sheets print inside the ⓘ by the title.
test('the ends of the ladder are read from the rungs, not described', () => {
  assert.match(
    STEPPER_CODE,
    /const floor = rungs\[0\]/,
    'the floor is no longer read from the first rung',
  );
  assert.match(
    STEPPER_CODE,
    /const ceiling = rungs\[rungs\.length - 1\]/,
    'the ceiling is no longer read from the last rung',
  );
  assert.match(STEPPER_CODE, /peso\(floor\.pricePhp\)/, 'the floor is no longer shown');
  assert.match(STEPPER_CODE, /peso\(ceiling\.pricePhp\)/, 'the ceiling is no longer shown');
  for (const sheet of SHEETS) {
    assert.match(sheet.code, /<InfoTip[\s\S]*?label="Add credits"[\s\S]*?ladderEnds\(rungs\)[\s\S]*?<\/InfoTip>/, `${sheet.name}: the range is not in the title's ⓘ`);
  }
});

/**
 * 🧾 THE SHEET ASKS ONE THING (owner 2026-10-24, on the live "Add credits" sheet): *"asked for how many photos each
 * doesn't need to show. it should just ask how much they want to add more and purchase. no need for not now because
 * there is (X) on upper right … the −[amount/value]+ is good already. New total: and purchase button."*
 *
 * So, on the web sheet AND the iPhone app's: "Add credits" (+ ⓘ, the sheet's ✕) · "You have N credits" · the stepper ·
 * "New total" · one button. This supersedes the 2026-10-23 "How many do I need?" helper (its component, its pure lib
 * and that lib's test were deleted with it, and `papicBuySizes` stopped reading guests for it).
 */
test('🚨 the Add credits sheet asks only how much — no helper, no range line, no "Not now"', () => {
  const all = [{ name: 'credit-stepper.tsx', code: STEPPER_CODE }, { name: 'papic-buy-form.tsx', code: strip(FORM) }, ...SHEETS];
  for (const { name, code } of all) {
    for (const gone of [/How many do I need/i, /How many photos each/i, /How much to add/i, /add any of them again later/, /label="Not now"/, /After this/, /<CreditNeed\b/]) {
      assert.ok(!gone.test(code), `${name} draws ${gone} again — the owner took it off the sheet on 2026-10-24`);
    }
  }
  assert.match(strip(FORM), /<span>New total<\/span>/, 'the web sheet no longer says "New total"');
  assert.match(SHEETS[1]!.code, /<span>New total<\/span>/, 'the iPhone sheet no longer says "New total"');
  assert.match(SHEETS[0]!.code, /`You have \$\{left\.toLocaleString\('en-PH'\)\} credits`/, 'the web sheet lost its one line');
  assert.match(SHEETS[1]!.code, /`You have \$\{left\.toLocaleString\('en-PH'\)\} credits`/, 'the iPhone sheet lost its one line');
  // The web button names the result; the iPhone's keeps Apple's word and Apple's price (never a web price).
  assert.match(strip(FORM), /`Add \$\{shown\.points\.toLocaleString\('en-PH'\)\} credits · \$\{shown\.priceLabel \?\?/);
  assert.match(SHEETS[1]!.code, /`Buy \$\{credits\(rung\.points\)\}`[\s\S]{0,80}rung\?\.priceLabel/);
});

test('🚨 the dropdown is gone from the card — one control, not two', () => {
  assert.ok(
    !/<select\b/.test(CARD_CODE),
    'a <select> is back on the pool card. Two controls over one ladder is how a person ends up ' +
      'setting one and paying for the other.',
  );
  assert.match(CARD_CODE, /<CreditStepper\b/, 'the card no longer renders the stepper at all');
});

test('both buttons stop at the ends, and say so out loud', () => {
  assert.match(STEPPER_CODE, /disabled=\{atFloor\}/, 'the minus button no longer stops at the cheapest rung');
  assert.match(STEPPER_CODE, /disabled=\{atCeiling\}/, 'the plus button no longer stops at the dearest rung');
  // Without a live region the two buttons never change their own labels, so a
  // screen-reader user presses "More" and is told nothing changed.
  assert.match(STEPPER_CODE, /aria-live="polite"/, 'the amount is no longer announced when it changes');
});
