/**
 * kind-is-a-field-on-the-card.test.ts — the create button opens the CARD.
 *
 * 🔴 THE COMPLAINT, IN THE OWNER'S WORDS (2026-08-28): *"when i click create
 * service card. i just bounces to a page for a link to service card. we want it
 * to directly go to a page to create a service card."* The press landed on My
 * Shop with a drawer of category links — reachable, and still a page ABOUT
 * making a card rather than the card. The kind of service is asked for ON the
 * card now, which is the owner-locked shape of that screen (2026-07-27, "THE
 * MAKER IS ZERO STEPS — THE CARD IS THE FORM").
 *
 * ⚖ WHAT IS PINNED HERE, AND WHY EACH ONE IS SEPARATE. Four things have to hold
 * at once and a guard that checks one passes while the screen is broken:
 *   1. the posted category is the STATE, or the vendor's choice never leaves;
 *   2. NOTHING saves without a kind — `commitVendorService` throws on an empty
 *      one, on the draft path too, so an enabled button hands them a raw error;
 *   3. every per-kind editor reads the state, or the price basis and the
 *      customization list stay drawn for a kind nobody chose;
 *   4. the OLD entrance is unchanged — `/services/new/[category]` passes no
 *      options, so that screen has no chooser and cannot grow one by accident.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';
const NEW_DOOR = 'app/vendor-dashboard/services/new/page.tsx';
const OLD_DOOR = 'app/vendor-dashboard/services/new/[category]/page.tsx';

// ⚠ Asserted first: a guard reading an empty file runs zero real checks and
// reports a pass. Every count below is measured against a file this size.
test('the files under test actually read back', () => {
  assert.ok(read(MAKER).length > 5000, 'the maker read back empty');
  assert.ok(read(NEW_DOOR).length > 500, 'the new door read back empty');
  assert.ok(read(OLD_DOOR).length > 500, 'the old door read back empty');
});

test('the posted category is the vendor’s choice, not the prop', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /<input type="hidden" name="category" value=\{category\} \/>/,
    'the form went back to posting the prop — a kind chosen on the card would never be saved',
  );
  // NO NEW FIELD NAMES (lib/canvas-field-parity.test.ts pins the whole set).
  // The chooser is buttons and state; exactly one input carries the category.
  const named = src.match(/name="category"/g) ?? [];
  assert.equal(named.length, 1, `the maker posts ${named.length} category fields, expected 1`);
});

test('nothing saves without a kind — publish AND draft', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /const needsCategory = category\.length === 0;/,
    'the maker stopped noticing that no kind was chosen',
  );
  assert.match(
    src,
    /const blocked = health\.blockers\.length > 0 \|\| needsCategory;/,
    'Publish stopped waiting for a kind',
  );
  // The draft button is the one that bites: it has no health gate at all, so
  // without its own check it posts an empty category straight into a throw.
  assert.match(
    src,
    /value="false"\s*\n\s*disabled=\{needsCategory\}/,
    'Save as draft stopped waiting for a kind — it would hand the vendor a raw error',
  );
  // And the screen says why, rather than showing two dead buttons.
  assert.match(src, /Tell us what kind of service this is/, 'the blocked state stopped explaining itself');
});

test('every per-kind editor reads the chosen kind', () => {
  const src = read(MAKER);
  for (const [what, re] of [
    ['the pricing basis', /<PricingBasisEditor\s+idPrefix="canvas"\s+category=\{category\}/],
    ["what's included", /<IncludedFlags\s+idPrefix="canvas"\s+category=\{category\}/],
    ['the customization list', /<CustomizationStep categoryValue=\{category\}/],
  ] as const) {
    assert.match(src, re, `${what} stopped following the chosen kind`);
  }
  // "Comes with" bundles the shop's OTHER cards — the chosen kind has to drop
  // out of it, or the card is offered as bundling itself.
  assert.match(src, /otherCategories\.filter\(\(c\) => c\.value !== category\)/, 'the bundle list stopped excluding this card’s own kind');
  assert.ok(
    !/\{otherCategories\.map\(/.test(src),
    'the bundle list went back to rendering the unfiltered prop',
  );
});

test('the new door opens the maker with no kind chosen, and hands it the list', () => {
  const src = read(NEW_DOOR);
  assert.match(src, /categoryValue=""/, 'the new door started pre-picking a kind');
  assert.match(src, /categoryOptions=\{categoryOptions\}/, 'the new door stopped handing over the kinds');
  // Drawn from the SAME groups My Shop draws, never a second hand-typed list.
  assert.match(src, /SERVICE_GROUPS\.map/, 'the kinds stopped coming from the shared groups');
  assert.match(src, /groupDisplayOptions\(/, 'the kinds stopped collapsing legacy keys that share a label');
});

test('the old door is untouched — a route-chosen kind has nothing to choose', () => {
  const src = read(OLD_DOOR);
  assert.ok(
    !/categoryOptions/.test(src),
    'the [category] route started passing options — that screen already knows the kind',
  );
  assert.match(src, /categoryValue=\{cat\}/, 'the [category] route stopped fixing the kind from its URL');
});
