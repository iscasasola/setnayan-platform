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
const CARD = readFileSync(join(PAPIC, '_components', 'papic-pool-card.tsx'), 'utf8');

/** Comments stripped — a guard must never pass on the prose explaining it. */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const STEPPER_CODE = strip(STEPPER);
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
