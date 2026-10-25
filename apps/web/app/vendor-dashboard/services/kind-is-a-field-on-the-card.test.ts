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
import { PUBLISH_REQUIREMENTS } from '@/lib/service-publish-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';
const NEW_DOOR = 'app/vendor-dashboard/services/new/page.tsx';
const OLD_DOOR = 'app/vendor-dashboard/services/new/[category]/page.tsx';
// Since 2026-10-14 every door into the maker reads through ONE loader.
const LOADER = 'lib/service-card-maker.server.ts';

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

test('nothing saves without a kind — the one Create waits for it', () => {
  const src = read(MAKER);
  // `commitVendorService` throws on an empty category on every path. The one Create (owner 2026-10-08 Q3) cannot
  // post without one: the submit is stopped and the kind sheet opens instead.
  assert.match(src, /if \(!category\) \{\s*e\.preventDefault\(\);\s*setSheet\('kind'\);/, 'Create stopped waiting for a kind');
  // …and the status line names it first.
  assert.match(src, /hasKind: category\.length > 0/, 'the status line stopped counting the kind');
});

test('every per-kind editor reads the chosen kind', () => {
  const src = read(MAKER);
  for (const [what, re] of [
    ['the pricing basis', /<PricingBasisEditor\s+idPrefix="canvas"\s+category=\{category\}/],
    ["what's included", /<IncludedFlags\s+idPrefix="canvas"\s+category=\{category\}/],
    ['the customization list', /<CustomizationStep\s+categoryValue=\{category\}/],
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
  assert.match(src, /categoryOptions=\{ctx\.categoryOptions\}/, 'the new door stopped handing over the kinds');
  // Drawn from the SAME groups My Shop draws (in the one loader), never a second hand-typed list.
  const loader = read(LOADER);
  assert.match(loader, /SERVICE_GROUPS\.map/, 'the kinds stopped coming from the shared groups');
  assert.match(loader, /groupDisplayOptions\(/, 'the kinds stopped collapsing legacy keys that share a label');
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
  // ⚠ MATCHED BY WHAT IT IMPORTS, NOT BY ONE FORMATTING OF THE IMPORT LINE.
  // The original assertion pinned a single-line `import { a, b } from '…'`, so
  // adding a third name (`parentsOfKind`, when a card's kind became allowed to
  // be the shop's own coverage word) reflowed it to multi-line and the guard
  // went red for a reason that had nothing to do with the rule it protects.
  assert.match(
    save,
    /from '@\/lib\/vendor-category-parents'/,
    'the save went back to its own copy of the family rule',
  );
  for (const name of ['parentsOfKind', 'coverageParents']) {
    assert.match(save, new RegExp(`\\b${name}\\b`), `the save stopped asking ${name}`);
  }
  assert.ok(
    !/function parentsOfCategory/.test(save),
    'a second copy of parentsOfCategory is back in the save',
  );
  assert.ok(
    !/function parentsOfKind/.test(save),
    'a second copy of parentsOfKind is back in the save',
  );
  assert.ok(
    !/async function coverageParents/.test(save),
    'a second copy of coverageParents is back in the save',
  );
  assert.ok(read(RULE).length > 1000, 'the shared rule read back empty');
});

test('the chooser asks that rule, with the shop’s real caps', () => {
  const src = read(LOADER);
  assert.match(src, /standingForCategory\(/, 'the chooser stopped asking which kinds are allowed');
  // The caps have to be THIS shop's, including the founder override the save applies.
  assert.match(src, /tierCaps\(asVendorTier\(tierRow\?\.tier_state\)\)/, 'the chooser stopped reading the shop’s plan');
  assert.match(src, /is_founder === true/, 'the chooser stopped honouring the founder override');
  // Families come from cards ∪ coverages — the coverages are read once and their families derived, the SAME union
  // `coverageParents()` gives the save.
  assert.match(src, /\.\.\.\[\.\.\.coveredLeafSet\]\.map\(\(l\) => leaves\.folder\.get\(l\)\)/, 'the chooser stopped counting coverage families');
  assert.match(src, /ownCategories\.flatMap\(\(c\) => parentsOfKind\(c, leaves\)\)/, 'the chooser stopped counting card families');
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

test('every publish requirement is a FIRST question, before More settings', () => {
  // ⚖ The first questions ARE the gate (the 2026-10-14 prototype: "only the three things that make it visible are
  // open"). Derived from the gate, so a requirement that joins it fails here first.
  const src = read(MAKER);
  const FOLD_FOR_REQUIREMENT: Record<string, string | undefined> = {
    cover: 'photos',
    price: 'price',
    inclusions: 'included',
  };
  const more = src.indexOf('data="more"');
  assert.ok(more > 0, 'More settings is gone');
  for (const requirement of PUBLISH_REQUIREMENTS) {
    const fold = FOLD_FOR_REQUIREMENT[requirement];
    if (!fold) assert.fail(`the publish gate grew "${requirement}" and this guard has no first question for it`);
    const at = src.indexOf(`data="${fold}"`);
    assert.ok(at > 0, `the publish gate requires "${requirement}" and the maker has no "${fold}" question`);
    assert.ok(at < more, `"${requirement}" sits under More settings — a supplier would meet a hidden card`);
  }
});

test('the status line asks the publish gate, never a list of its own', () => {
  const src = read(MAKER);
  assert.match(src, /const status = makerStatus\(/, 'the status line stopped asking the shared rule');
  const lib = read('lib/service-card-maker.ts');
  assert.match(lib, /unmetPublishRequirements\(facts\)/, 'makerStatus stopped asking the publish gate');
  assert.match(lib, /'Hidden until:'/, 'the prototype’s words are gone');
});







test('a pre-filled kind says where it came from', () => {
  const src = read(MAKER);
  assert.match(src, /From your shop · change/, 'the pre-filled kind stopped explaining itself');
  assert.match(src, /setKindFromShop\(false\)/, 'picking a kind by hand still claims it came from the shop');
});

test('what was typed is held in the vendor’s own browser, never in a card row', () => {
  const src = read(MAKER);
  // 🔑 A SERVER AUTOSAVE WOULD MINT A JUNK CARD PER ABANDONED ATTEMPT — in the
  // shop's own list and in the caps that count cards. The keep is local.
  assert.match(src, /window\.localStorage\.setItem\(keepKey/, 'the keep stopped being written');
  assert.match(src, /keepStorageKey\(vendorProfileId\)/, 'the keep stopped being scoped to this shop');
  assert.ok(
    !/from '\.\.\/actions'[\s\S]{0,4000}autosave/i.test(src),
    'an autosave into the database appeared',
  );
});

test('every touch of storage is wrapped — it throws outright in some browsers', () => {
  const src = read(MAKER);
  // A card maker that white-screens because a convenience could not write is a
  // far worse product than one that quietly does not keep.
  for (const call of ['getItem', 'setItem', 'removeItem']) {
    const at = src.indexOf(`localStorage.${call}`);
    assert.ok(at > 0, `localStorage.${call} is gone`);
    const around = src.slice(Math.max(0, at - 400), at + 200);
    assert.match(around, /try \{/, `localStorage.${call} is no longer wrapped`);
  }
});

test('a kept card is offered, never restored behind their back', () => {
  const src = read(MAKER);
  assert.match(src, /Picked up where you left off\?/, 'the offer is gone — work would come back unasked');
  assert.match(src, /label="Pick up"/, 'the way to take it back is gone');
  assert.match(src, /label="Fresh"/, 'the way to refuse it is gone');
  assert.match(src, /offeredKeep && !keepDecided/, 'the offer stopped waiting to be answered');
});

test('saving clears the keep, and a copied or existing card never offers one', () => {
  const src = read(MAKER);
  assert.match(src, /addEventListener\('submit', clearKeep\)/, 'a saved card would keep offering its own draft back');
  assert.match(src, /if \(initial !== null \|\| isEdit\) return;/, 'a copied or existing card started offering an abandoned one');
});

test('restoring puts state through React and everything else through the DOM', () => {
  const src = read(MAKER);
  // Assigning a DOM value to a controlled input is overwritten on next render;
  // setting state for an uncontrolled editor field does nothing at all. Both
  // halves are needed, and the dispatched event is what makes the card SHOW it.
  assert.match(src, /if \(name === 'title'\) setTitle\(value\)/, 'the name stopped restoring through state');
  assert.match(src, /dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/, 'restored fields stopped telling the card');
});

// ---------------------------------------------------------------------------
// THE CARD PAINTS ITSELF, EXPLAINS ITSELF ONCE, AND SITS BESIDE THE QUESTION
// (owner 2026-08-28 · "build it")
// ---------------------------------------------------------------------------



test('the card on top is the SHIPPED face, painted from the live form', () => {
  const src = read(MAKER);
  // One card for couples and suppliers (owner 2026-09-08: "we want to show the actual service cards").
  assert.match(src, /import \{ ServiceCardFace \} from '\.\/service-card-face';/, 'the maker drew its own card');
  assert.match(src, /readSnapshot\(fd\)/, 'the face stopped reading the live form');
});

test('every painted state has a reduced-motion off switch', () => {
  // ⚠ ALL THREE CARRY A FROM-STATE (opacity 0 / scale) THAT MUST NEVER BE THE
  // RESTING STATE — without the guard, a supplier who asked for no motion gets
  // a card stuck invisible.
  const css = read('app/globals.css');
  for (const cls of ['sn-paint-in', 'sn-paint-cover', 'sn-paint-live']) {
    assert.match(css, new RegExp(`\\.${cls}\\s*\\{[^}]*animation`), `${cls} lost its animation`);
  }
  const reduced = css.slice(css.indexOf('.sn-paint-in    {'));
  const block = reduced.slice(reduced.indexOf('@media (prefers-reduced-motion: reduce)'));
  for (const cls of ['sn-paint-in', 'sn-paint-cover', 'sn-paint-live']) {
    assert.ok(block.slice(0, 400).includes(cls), `${cls} is not frozen under reduced motion`);
  }
});







test('the card name is written for them, and never over their typing', () => {
  const src = read(MAKER);
  assert.match(src, /`\$\{activeCategoryLabel\} by \$\{shopName\}`/, 'the name stopped being written from the kind');
  assert.match(src, /if \(titleTouched\.current\) return;/, 'the name would be rewritten under the cursor');
  assert.match(src, /titleTouched\.current = true;/, 'typing stopped claiming the name');
});

test('the covered band speaks the shop’s own words', () => {
  const src = read(MAKER);
  const door = read(LOADER);
  // SetnaProd's leaf is "Pabati"; a supplier is never asked to recognise their trade under a word they never chose
  // (owner 2026-08-28, "yes their own words"). The band's rows ARE the coverage words and their stored value is the leaf.
  assert.match(door, /const coverageKindOptions = vendorCoverages\.map\(/, 'the covered band stopped being built from the shop’s own coverage');
  assert.match(door, /leafLabel\(c\.canonical_service\)/, 'the coverage names stopped coming from the taxonomy');
  assert.match(door, /value: c\.canonical_service/, 'the band offers the shop’s words but stores something else');
  assert.match(src, /in your own words/, 'the covered band stopped saying whose words these are');
  // The 2026-10-14 heading: "Common for a caterer".
  assert.match(src, /heading=\{`Common for \$\{typeWord\}`\}/, 'the band lost its "Common for …" heading');
});

test('the full list is searchable, and says so when nothing matches', () => {
  const src = read(MAKER);
  assert.match(src, /type="search"/, 'the search over all kinds is gone');
  assert.match(src, /Nothing matches/, 'an empty search result says nothing at all');
});

test('every other field lives under More settings, and it starts shut', () => {
  const src = read(MAKER);
  const at = src.indexOf('data="more"');
  assert.ok(at > 0, 'More settings is gone');
  const head = src.slice(src.lastIndexOf('<Fold', at), at + 300);
  assert.match(head, /defaultOpen=\{discountSeed !== null\}/, 'More settings opens by itself — the wall coming back one row lower');
  // The prototype's folds, in its order (makerMore()).
  const folds = ['m-price', 'm-disc', 'm-inc', 'm-addons', 'm-gift', 'm-crew', 'm-terms', 'm-pay', 'm-who', 'm-details', 'm-comes', 'm-record', 'm-portfolio', 'm-live'];
  let last = at;
  for (const f of folds) {
    const i = src.indexOf(`data="${f}"`);
    assert.ok(i > last, `the "${f}" fold is missing or out of the prototype's order`);
    last = i;
  }
});

test('ONE Create: live when the gate is met, else saved not shown yet (owner 2026-10-08 Q3)', () => {
  const src = read(MAKER);
  assert.match(src, /const gateOpen = canPublishService\(facts\);/, 'Create stopped asking the shared gate');
  assert.match(src, /isEdit \? \(liveOn \? 'true' : 'false'\) : gateOpen \? 'true' : 'false'/, 'the one Create stopped deciding live / not shown yet from the gate');
  assert.match(src, /<input type="hidden" name="publish" value=\{publishValue\} \/>/, 'the publish answer stopped posting');
  assert.ok(!/Save as draft/.test(src), 'a second save button is back');
});


