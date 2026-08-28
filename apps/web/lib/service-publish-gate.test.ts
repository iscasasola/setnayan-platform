/**
 * THE PUBLISH GATE — the rule, and the four places that must not hold a second
 * copy of it.
 *
 * Two halves:
 *   1. the rule itself (pure, fast, exhaustive), and
 *   2. a SOURCE CENSUS — every surface that decides whether a card may go live
 *      must ask `unmetPublishRequirements`, never re-derive the answer. That is
 *      the half that catches the regression this module was written for: a
 *      wizard that let Publish through on a card the save then bounced.
 *
 * ⚠ The file set below is DERIVED from what the repo actually does — the census
 * greps for every writer of `vendor_services.is_active` and asserts each one
 * routes through the shared gate. A hand-typed list is a list of the surfaces
 * somebody thought of.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  PUBLISH_COACH_MESSAGE,
  PUBLISH_REFUSAL_MESSAGE,
  PUBLISH_REQUIREMENTS,
  canPublishService,
  exclusiveIsSet,
  priceIsSet,
  unmetPublishRequirements,
} from './service-publish-gate';

// ════════════════════════════════════════════════════════════════════════════
// 1 · The rule
// ════════════════════════════════════════════════════════════════════════════

test('a complete card publishes', () => {
  assert.deepEqual(
    unmetPublishRequirements({ hasPrice: true, hasExclusive: true }),
    [],
  );
  assert.equal(canPublishService({ hasPrice: true, hasExclusive: true }), true);
});

test('no price is a REFUSAL, not a nudge — the rule this module reversed', () => {
  const unmet = unmetPublishRequirements({ hasPrice: false, hasExclusive: true });
  assert.deepEqual(unmet, ['price']);
  assert.equal(canPublishService({ hasPrice: false, hasExclusive: true }), false);
});

test('no Setnayan Exclusive still refuses — the shipped half is unchanged', () => {
  assert.deepEqual(
    unmetPublishRequirements({ hasPrice: true, hasExclusive: false }),
    ['exclusive'],
  );
});

test('a blank card names EVERYTHING it is missing, price first', () => {
  assert.deepEqual(
    unmetPublishRequirements({ hasPrice: false, hasExclusive: false }),
    ['price', 'exclusive'],
  );
});

test('every requirement has both sentences, and neither is empty', () => {
  for (const requirement of PUBLISH_REQUIREMENTS) {
    assert.ok(
      PUBLISH_REFUSAL_MESSAGE[requirement]?.trim().length > 0,
      `${requirement} has no server sentence`,
    );
    assert.ok(
      PUBLISH_COACH_MESSAGE[requirement]?.trim().length > 0,
      `${requirement} has no maker sentence`,
    );
  }
});

// ── priceIsSet — the one definition of "this card has a price" ──────────────

test('ZERO IS NOT A PRICE', () => {
  assert.equal(priceIsSet(0), false, '0 must not read as priced');
  assert.equal(priceIsSet(-1), false);
  assert.equal(priceIsSet(null), false);
  assert.equal(priceIsSet(undefined), false);
  assert.equal(priceIsSet(Number.NaN), false);
  assert.equal(priceIsSet(1), true);
  assert.equal(priceIsSet(85_000), true);
});

test('a blank or whitespace Exclusive is not set', () => {
  assert.equal(exclusiveIsSet(''), false);
  assert.equal(exclusiveIsSet('   '), false);
  assert.equal(exclusiveIsSet(null), false);
  assert.equal(exclusiveIsSet(undefined), false);
  assert.equal(exclusiveIsSet('Free extra hour'), true);
});

// ⛔ THE LINE THIS FEATURE MUST NEVER CROSS.
test('the gate cannot see how big the price is', () => {
  const cheap = unmetPublishRequirements({ hasPrice: true, hasExclusive: true });
  const dear = unmetPublishRequirements({ hasPrice: true, hasExclusive: true });
  assert.deepEqual(cheap, dear);
  // The facts the gate reads are BOOLEANS by construction — there is no number
  // in `PublishFacts` for a bigger figure to climb. If a future edit puts one
  // there, this assertion is where it should be argued out loud.
  const source = readFileSync(new URL('./service-publish-gate.ts', import.meta.url), 'utf8');
  const facts = source.slice(
    source.indexOf('export type PublishFacts'),
    source.indexOf('export function priceIsSet'),
  );
  assert.ok(facts.length > 0, 'PublishFacts not found — did the type move?');
  assert.ok(
    !/:\s*number/.test(facts),
    'PublishFacts took a number — the gate must never read the SIZE of a price',
  );
});

// ════════════════════════════════════════════════════════════════════════════
// 2 · The census — nobody keeps a second copy
// ════════════════════════════════════════════════════════════════════════════

const WEB = new URL('..', import.meta.url).pathname;

/** Every file under a tree, ignoring node_modules / .next. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Files that decide a card goes LIVE — found by what they DO, not by name.
 * A publish is a write of `is_active` to a true-ish value on vendor_services.
 */
function publishDecidingFiles(): string[] {
  const hits: string[] = [];
  for (const file of walk(join(WEB, 'app'))) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('vendor_services') && !src.includes('commitVendorService')) continue;
    // A publish decision is one of: the toggle action's own parse, the wizard's
    // Publish button, or the canvas maker's.
    const decides =
      /name="publish"\s+value="true"/.test(src) ||
      /const is_active =/.test(src);
    if (decides) hits.push(file);
  }
  return hits;
}

test('every surface that can publish a card asks the shared gate', () => {
  const files = publishDecidingFiles();
  assert.ok(
    files.length >= 3,
    `expected at least 3 publish-deciding files, found ${files.length} — ` +
      'the census stopped matching, which reads as a clean pass and is not one',
  );
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    // Either it asks the gate itself, or its Publish button is disabled from
    // card health, which asks the gate.
    const asks =
      src.includes('unmetPublishRequirements') || src.includes('scoreCardHealth');
    if (!asks) offenders.push(file.slice(WEB.length));
  }
  assert.deepEqual(
    offenders,
    [],
    'these can publish a card without asking lib/service-publish-gate.ts',
  );
});

/**
 * Slice out one function's body, so a guard cannot be satisfied by a DIFFERENT
 * function in the same file. `services/actions.ts` holds TWO publish paths —
 * `commitVendorService` (the maker's save) and `toggleVendorServiceActive` (the
 * on/off switch on the Services list) — and a file-level match is green when
 * only one of them asks.
 */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} not found — did it get renamed?`);
  const rest = source.slice(start + 10);
  const end = rest.indexOf('\nexport ');
  return end === -1 ? rest : rest.slice(0, end);
}

test('BOTH server publish paths ask the gate, not just the one somebody remembered', () => {
  const src = readFileSync(join(WEB, 'app/vendor-dashboard/services/actions.ts'), 'utf8');
  for (const name of ['commitVendorService', 'toggleVendorServiceActive']) {
    assert.ok(
      functionBody(src, name).includes('unmetPublishRequirements'),
      `${name} publishes a card without asking the shared gate`,
    );
  }
});

test("the wizard's Publish button is shut by the gate, not by its own two fields", () => {
  // 🪤 THIS ASSERTION EXISTS BECAUSE THE FILE-LEVEL ONE ABOVE WAS DECORATION.
  // Reverting `canPublish` to `hasPhoto && hasPerk` left the import and the
  // coach-message use in the same file, so the census stayed GREEN while the
  // button published priceless cards again. A file-level count cannot say which
  // EXPRESSION still asks.
  const src = readFileSync(
    join(WEB, 'app/vendor-dashboard/services/_components/service-wizard.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /const unmetToPublish = unmetPublishRequirements\(\{ hasPrice, hasExclusive: hasPerk \}\);/,
    'the wizard stopped deriving what is missing from the shared gate',
  );
  assert.match(
    src,
    /const canPublish = hasPhoto && unmetToPublish\.length === 0;/,
    'the wizard\'s Publish button no longer waits for the gate',
  );
});

test('the maker keeps Publish shut on a blocked card', () => {
  const src = readFileSync(
    join(WEB, 'app/vendor-dashboard/services/_components/canvas-maker.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /const blocked = health\.blockers\.length > 0/,
    'the maker stopped deriving "blocked" from card health blockers',
  );
  assert.match(
    src,
    /name="publish"\s+value="true"\s+disabled=\{blocked\}/,
    'the Publish button is no longer disabled by "blocked"',
  );
});

test('the first pass asks for every requirement the gate holds', () => {
  // 🔑 The pass IS the gate said out loud. A pass one question short hands a
  // supplier a finished-looking card and a shut Publish button.
  const src = readFileSync(
    join(WEB, 'app/vendor-dashboard/services/_components/canvas-maker.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /steps\.push\('media', 'price', 'excl'\)/,
    'the first pass no longer asks for a price',
  );
  assert.match(
    src,
    /passStep === 'price'\s*\?\s*snap\.hasPrice/,
    'the price step lets Continue through without a price',
  );
  assert.match(
    src,
    /footer=\{passStep === 'price' \? passFooter : null\}/,
    'the price step has no Continue button — the pass strands the supplier there',
  );
});

test('card health takes its blockers from the gate, not from its own opinion', () => {
  const src = readFileSync(join(WEB, 'lib/card-health.ts'), 'utf8');
  assert.ok(
    src.includes('unmetPublishRequirements'),
    'card-health.ts must ask the shared gate',
  );
  // The old rule, in the exact words that made it a hint. If this comes back,
  // the price quietly stopped blocking and the meter went on saying "Ready to
  // publish" over a card the save now refuses.
  assert.ok(
    !/hints\.push\(\{\s*\n?\s*code: 'no_price'/.test(src),
    'no_price is back in the HINTS lane — it is a blocker',
  );
});

test('the card face and the gate share ONE definition of "priced"', () => {
  const src = readFileSync(join(WEB, 'lib/canvas-form-snapshot.ts'), 'utf8');
  assert.ok(
    src.includes("from './service-publish-gate'"),
    'the card snapshot re-derives whether a card is priced',
  );
  assert.match(
    src,
    /return priceIsSet\(n\) \? n : null;/,
    'the money() reader stopped using priceIsSet — a typed 0 reads as a price again',
  );
});
