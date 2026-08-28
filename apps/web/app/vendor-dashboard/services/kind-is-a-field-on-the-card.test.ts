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
  // ⚖ The steps ARE the gate. This guard is DERIVED from the gate rather than
  // hard-typed, so it keeps meaning as the gate changes: every requirement in
  // `PUBLISH_REQUIREMENTS` must have a question in the pass, and the pass must
  // ask nothing that is not either a requirement or one of the two the maker
  // owns for itself (the kind, and the cover photo the server never asks for).
  //
  // 🔑 IT ALREADY EARNED ITS KEEP ONCE. Its previous form pinned the literal
  // `steps.push('media', 'excl')` with the note "if a third question ever joins
  // them it is a product decision, not a tidy-up, and it fails here first" — and
  // on 2026-08-28 a price joined the publish gate and this is exactly where it
  // failed. The decision is the owner's (his own drawing: "Publish stays shut
  // until the price is in"); the guard did its job by making it be one.
  // ⚠ EVERY `steps.push(...)` in the memo, not the first one. A single-match
  // read finds `steps.push('intro')` and concludes the pass asks one question —
  // green for a pass that asks nothing the gate requires.
  const steps = [...src.matchAll(/steps\.push\(([^)]*)\)/g)].flatMap((m) =>
    [...m[1].matchAll(/'([a-z]+)'/g)].map((o) => o[1]),
  );
  assert.ok(steps.length >= 3, `the pass pushes only ${steps.length} steps — it stopped being the gate`);
  const SHEET_FOR_REQUIREMENT: Record<string, string> = { price: 'price', exclusive: 'excl' };
  for (const requirement of PUBLISH_REQUIREMENTS) {
    assert.ok(
      steps.includes(SHEET_FOR_REQUIREMENT[requirement]),
      `the publish gate requires "${requirement}" and the first pass never asks for it — ` +
        'a supplier finishes the pass and meets a shut Publish button',
    );
    // …and the question must be answerable-gated, or Continue walks past it.
    assert.match(
      src,
      new RegExp(`passStep === '${SHEET_FOR_REQUIREMENT[requirement]}'`),
      `the "${requirement}" question is in the pass with no Continue rule of its own`,
    );
  }
  const OWN = ['media', 'intro', 'kind'];
  const extras = steps.filter(
    (s) => !OWN.includes(s) && !Object.values(SHEET_FOR_REQUIREMENT).includes(s),
  );
  assert.deepEqual(
    extras,
    [],
    'the first pass grew a question that is not part of the publish gate — a product decision, not a tidy-up',
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
  // ⚠ Matches the guided branch's OPENING, not the whole class string: the
  // desktop column was added to that same branch later, and an assertion pinned
  // to the exact string would have failed for a change it does not care about.
  assert.match(src, /guided\s*\n?\s*\?[\s\S]{0,400}'max-h-\[58dvh\]/, 'the guided sheet stopped leaving the card room');
  // No meter over two unanswered questions.
  assert.match(src, /\{inPass \? null : \(\s*<HealthHeader/, 'the score came back during the first pass');
});

test('a pre-filled kind says where it came from', () => {
  const src = read(MAKER);
  assert.match(src, /from your shop · change/, 'the pre-filled kind stopped explaining itself');
  assert.match(src, /setKindFromShop\(false\)/, 'picking a kind by hand still claims it came from the shop');
});

// ---------------------------------------------------------------------------
// THE HALF-FINISHED CARD IS KEPT (owner 2026-08-28 · "add it")
// ---------------------------------------------------------------------------

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
  assert.match(src, /You left a card here/, 'the offer is gone — work would come back unasked');
  assert.match(src, /Pick up where I left off/, 'the way to take it back is gone');
  assert.match(src, /Start a fresh card/, 'the way to refuse it is gone');
  // An unanswered offer must not have a question opening on top of it.
  assert.match(
    src,
    /!\(offeredKeep && !keepDecided\)/,
    'the first pass stopped waiting for the offer to be answered',
  );
});

test('saving clears the keep, and a copied card never offers one', () => {
  const src = read(MAKER);
  assert.match(src, /addEventListener\('submit', clearKeep\)/, 'a saved card would keep offering its own draft back');
  assert.match(src, /if \(initial !== null\) return;/, 'a card started FROM another card started offering an abandoned one');
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

test('the card is explained once, ever — never to a shop on its fourth card', () => {
  const src = read(MAKER);
  assert.match(src, /if \(firstCardEver\) steps\.push\('intro'\)/, 'the first-card explainer is gone');
  const door = read(NEW_DOOR);
  assert.match(
    door,
    /firstCardEver=\{ownCategories\.length === 0\}/,
    'the explainer stopped asking whether this shop has ever made a card',
  );
  // It carries no field — it is the one screen that answers "what am I making?"
  assert.ok(
    !/id="canvas-intro"[\s\S]{0,1200}<input/.test(src),
    'the explainer grew a field — it is a sentence, not a question',
  );
});

test('a value arriving on the card is REMOUNTED, not class-toggled', () => {
  const src = read(MAKER);
  // 🔑 A CSS animation that has already run does not replay because the class is
  // set again. Keying each node on its own value is the whole mechanism; a
  // static className here would animate once and then never again.
  assert.match(src, /key=\{snap\.priceLine\} className="sn-paint-in"/, 'the price stopped landing visibly');
  assert.match(src, /key=\{comesWith\.join\('\|'\)\}/, 'what couples get stopped landing visibly');
  assert.match(src, /key=\{perk\.trim\(\)\.length > 0 \? 'perk-set' : 'perk-empty'\}/, 'the Exclusive stopped lighting up');
  assert.match(src, /key="cover-set" className="sn-paint-cover/, 'the cover stopped settling in');
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

test('the ready pulse cannot remount the card it sits on', () => {
  const src = read(MAKER);
  // Keying the CARD would remount the title input mid-typing. The wrapper costs
  // nothing inside it.
  assert.match(
    src,
    /key=\{blocked \? 'card-blocked' : 'card-ready'\} className=\{blocked \? undefined : 'sn-paint-live/,
    'the ready pulse moved onto the card itself, which remounts the name field',
  );
});

test('on a laptop the question sits beside the card, not over it', () => {
  const src = read(MAKER);
  assert.match(src, /lg:right-0[^']*lg:max-w-\[400px\]/, 'the guided panel stopped becoming a column on desktop');
  // Only the guided presentation moves — an ordinary edit is still a sheet.
  assert.match(src, /: 'max-h-\[78dvh\]'/, 'the normal sheet lost its own sizing');
});

// ---------------------------------------------------------------------------
// THE SHIPPED SCREEN MATCHES WHAT WAS DRAWN (owner 2026-08-28 · "make sure we
// achieve that output" — prototypes/service_card_wizard_2026-08-28.html rev 2)
// ---------------------------------------------------------------------------
//
// ⚖ EACH ONE IS A PROMISE THE DRAWING MAKES, not a preference. They are pinned
// separately so a regression names the promise it broke rather than "the maker
// changed".

test('Continue waits for the answer; skip never does', () => {
  const src = read(MAKER);
  // Drawn: "the Continue button stays off until the required thing on that sheet
  // exists". Letting it past an empty question only moves the same refusal
  // further from the field that fixes it.
  assert.match(src, /passStep === 'media'\s*\n?\s*\? snap\.hasCover/, 'the photo question stopped waiting for a photo');
  assert.match(
    src,
    /passStep === 'excl'[\s\S]{0,40}perk\.trim\(\)\.length > 0/,
    'the Exclusive question stopped waiting for a sentence',
  );
  assert.match(src, /disabled=\{!passAnswered\}/, 'Continue stopped waiting at all');
  // The escape must survive the gate, or it is a disabled button with no way past.
  assert.match(src, /Skip — I&rsquo;ll build it myself/, 'the skip went away with the gate');
});

test('the card name is written for them, and never over their typing', () => {
  const src = read(MAKER);
  assert.match(src, /`\$\{activeCategoryLabel\} by \$\{shopName\}`/, 'the name stopped being written from the kind');
  assert.match(src, /if \(titleTouched\.current\) return;/, 'the name would be rewritten under the cursor');
  assert.match(src, /titleTouched\.current = true;/, 'typing stopped claiming the name');
});

test('the covered band speaks the shop’s own words', () => {
  const src = read(MAKER);
  const door = read(NEW_DOOR);
  // 🔑 THE RULE IS UNCHANGED AND IS NOW MET MORE STRONGLY. SetnaProd's leaf is
  // "Pabati"; a supplier must never be asked to recognise their trade under a
  // word they never chose.
  //
  // When this was written no "Pabati" PILL existed — the pills bridged by
  // FAMILY — so the only way to say the shop's own word was to quote it in the
  // band's prose: `What you already do — your ${coverageNames…}`. The owner then
  // ruled on the vocabulary itself (2026-08-28, *"yes their own words"*), so the
  // band's pills ARE the coverage words now and their stored value is the leaf.
  // Keeping the old assertion would have pinned the WORKAROUND and rejected the
  // fix; quoting the names in prose as well would print *Pabati* twice, once as
  // text and once as the thing you press.
  assert.match(
    door,
    /const coverageKindOptions = vendorCoverages\.map\(/,
    'the covered band stopped being built from the shop’s own coverage',
  );
  assert.match(door, /leafLabel\(c\.canonical_service\)/, 'the coverage names stopped coming from the taxonomy');
  assert.match(door, /value: c\.canonical_service/, 'the band offers the shop’s words but stores something else');
  // The band still says whose words these are, and the names still reach the
  // maker for that sentence.
  assert.match(src, /in your own words/, 'the covered band stopped saying whose words these are');
  assert.match(door, /coverageNames=\{coverageNames\}/, 'the door stopped passing the coverage names');
});

test('the full list is searchable, and says so when nothing matches', () => {
  const src = read(MAKER);
  assert.match(src, /type="search"/, 'the search over all kinds is gone');
  assert.match(src, /Nothing matches/, 'an empty search result says nothing at all');
});

test('the optional depth is named under the card, and starts shut', () => {
  const src = read(MAKER);
  assert.match(src, /Make it richer — all optional, any time/, 'the optional list is gone');
  // ⚖ SHUT BY DEFAULT: the point of two questions is that a supplier can stop —
  // a list that greets them open is the wall coming back one section lower.
  const at = src.indexOf('Make it richer');
  const tag = src.lastIndexOf('<details', at);
  assert.ok(tag > 0 && !/\bopen\b/.test(src.slice(tag, at)), 'the optional list started open');
  // It opens the SAME sheets the card opens — one maker, listed twice.
  assert.match(src, /onClick=\{\(\) => setSheet\(row\.key\)\}/, 'the optional list stopped opening the shipped sheets');
});

test('the publish moment says the right thing in both directions', () => {
  const src = read(MAKER);
  assert.match(src, /Everything you have typed stays on this screen while you finish\./, 'the refusal stopped reassuring');
  assert.match(src, /Your card is ready\./, 'the ready state stopped saying so');
});

test('the explainer shows a card, because that is what it is explaining', () => {
  const src = read(MAKER);
  const intro = src.slice(src.indexOf('id="canvas-intro"'));
  const body = intro.slice(0, intro.indexOf('</CanvasSheet>'));
  assert.match(body, /from ₱44,999 per event/, 'the sample card is gone from the explainer');
  // Plainly somebody else's — never a fake card of theirs.
  assert.match(body, /Another supplier&rsquo;s card/, 'the sample stopped saying whose it is');
});
