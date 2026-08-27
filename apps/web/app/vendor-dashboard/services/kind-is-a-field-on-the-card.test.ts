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

// ---------------------------------------------------------------------------
// THE CHOOSER OFFERS WHAT THIS SHOP MAY ACTUALLY LIST (owner 2026-08-28)
// ---------------------------------------------------------------------------
//
// *"so many categories? should the choices be only for the service we actually
// cover and not all?"* — and the caps were already enforced, just too late: the
// save refuses AFTER the card is authored, by redirecting the work away. The
// rule now answers in one place and is asked twice.

const RULE = 'lib/vendor-category-parents.ts';
const SAVE = 'app/vendor-dashboard/services/actions.ts';

test('one definition of the rule, asked by both the chooser and the save', () => {
  // 🔑 TWO COPIES OF A PERMISSION RULE ALWAYS DRIFT, and the copy on the screen
  // would be the optimistic one — offering a kind the save refuses is exactly
  // the defect being fixed. So the save must IMPORT it, not keep its own.
  const save = read(SAVE);
  assert.match(
    save,
    /import \{ parentsOfCategory, coverageParents \} from '@\/lib\/vendor-category-parents'/,
    'the save went back to its own copy of the family rule',
  );
  assert.ok(
    !/function parentsOfCategory/.test(save),
    'a second copy of parentsOfCategory is back in the save',
  );
  assert.ok(
    !/async function coverageParents/.test(save),
    'a second copy of coverageParents is back in the save',
  );
  assert.ok(read(RULE).length > 1000, 'the shared rule read back empty');
});

test('the chooser asks that rule, with the shop’s real caps', () => {
  const src = read(NEW_DOOR);
  assert.match(src, /standingForCategory\(/, 'the chooser stopped asking which kinds are allowed');
  // The caps have to be THIS shop's, including the founder override the save
  // applies — a chooser reading the default tier would grey a founder's list.
  assert.match(src, /tierCaps\(asVendorTier\(tierRowTyped\?\.tier_state\)\)/, 'the chooser stopped reading the shop’s plan');
  assert.match(src, /is_founder === true/, 'the chooser stopped honouring the founder override');
  // Families come from cards ∪ coverages — coverage is the source of truth, and
  // a coverage-first shop (zero cards) is the common case.
  assert.match(src, /coverageParents\(supabase/, 'the chooser stopped counting coverage families');
});

test('a refused kind is disabled, not merely greyed', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /disabled=\{locked\}/,
    'a locked kind became pressable again — it would be refused after the whole card was written',
  );
  assert.match(src, /const locked = opt\.standing === 'locked';/, 'the pill stopped reading the standing');
  // One sentence for the whole greyed set, not one per pill.
  assert.match(src, /lockedWhy/, 'the greyed kinds stopped explaining themselves');
});

test('a one-trade shop is asked nothing', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /coveredChoices\.length === 1 \? \(coveredChoices\[0\]\?\.value \?\? ''\) : ''/,
    'the single covered kind stopped pre-filling — a question with one answer is not a question',
  );
  // …and it is still editable: the region and its sheet do not disappear.
  assert.match(src, /canChooseKind = categoryOptions\.length > 0/, 'pre-filling started hiding the chooser');
});

// ---------------------------------------------------------------------------
// THE FIRST PASS — TWO ANSWERS, THEN IT IS LIVE (owner 2026-08-28)
// ---------------------------------------------------------------------------
//
// *"i want it to be as simple as possible… so they do not feel bombarded"*, then
// on the drawn shape: *"looks better"*. A blank card asks only the two things
// the publish gate has ever required, one at a time, with the card visible above
// painting itself. Everything else was always optional and only LOOKED required
// because it was all on screen at once.

test('the pass asks the publish gate and nothing else', () => {
  const src = read(MAKER);
  // ⚖ The steps ARE the gate: cover photo · Setnayan Exclusive. If a third
  // question ever joins them it is a product decision, not a tidy-up, and it
  // fails here first.
  assert.match(
    src,
    /steps\.push\('media', 'excl'\)/,
    'the first pass started asking for something other than the two required things',
  );
  // The kind is asked ONLY when the shop's own record cannot answer it.
  assert.match(src, /if \(!category\) steps\.push\('kind'\)/, 'the pass started asking a shop that already knows');
});

test('the pass is only ever the blank card on the new-card door', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /if \(!canChooseKind \|\| initial !== null\) return \[\];/,
    'the first pass leaked onto the [category] door or onto a copied card',
  );
  // Frozen at mount: answering must not renumber the question on screen.
  assert.match(src, /const \[passIndex, setPassIndex\] = useState/, 'the pass stopped tracking where it is');
});

test('every question can be left, and leaving lands on the whole card', () => {
  const src = read(MAKER);
  assert.match(src, /Skip &rsquo;|Skip — I&rsquo;ll build it myself/, 'the skip out of the pass is gone');
  assert.match(src, /onClose=\{inPass \? leavePass : \(\) => setSheet\(null\)\}/, 'closing a guided sheet stopped leaving the pass');
  // Continue is never a gate — a vendor with nothing to add here moves on and
  // meets the real gate at Publish.
  assert.ok(
    !/disabled=\{[^}]*inPass/.test(src),
    'the pass grew a gate of its own — the publish gate is the only gate',
  );
});

test('the card stays visible while it paints, and is not graded mid-build', () => {
  const src = read(MAKER);
  // The guided sheet drops the dark veil; every later edit is still a modal.
  assert.match(src, /guided\s*\n?\s*\? 'absolute inset-0 cursor-default'/, 'the first pass started veiling the card it is painting');
  assert.match(src, /guided \? 'max-h-\[58dvh\]' : 'max-h-\[78dvh\]'/, 'the guided sheet stopped leaving the card room');
  // No meter over two unanswered questions.
  assert.match(src, /\{inPass \? null : \(\s*<HealthHeader/, 'the score came back during the first pass');
});

test('a pre-filled kind says where it came from', () => {
  const src = read(MAKER);
  assert.match(src, /from your shop · change/, 'the pre-filled kind stopped explaining itself');
  assert.match(src, /setKindFromShop\(false\)/, 'picking a kind by hand still claims it came from the shop');
});
