/**
 * Guards for the two identity-block chips added by the Warm Editorial Archive
 * port (spec § 3.5, E1 + E2). Both are claims a stranger reads on a public URL,
 * and both are one careless edit away from becoming a lie that nothing throws:
 *
 *   E1 "✓ Verified" — if its gate is ever loosened to a truthiness check, or to
 *   `!== 'unverified'`, a `pending_review` / `demoted` / `rejected` shop would
 *   wear a Setnayan approval it does not have on the two renders that survive
 *   the route's 404 gate (admin demo mode · the owning vendor's self-preview).
 *   And if it were re-keyed to `public_visibility`, it would assert a different
 *   fact from the one the gate actually checks — the exact conflation migration
 *   20271013500000 was written to undo.
 *
 *   E2 "Featured in N stories →" — a pointer to a section that already ships.
 *   Two ways it silently rots: the anchor target disappears (dead in-page link),
 *   or the count stops being derived from the arrays the section maps over. The
 *   second is the dangerous one: both loaders swallow their errors to `[]`, so a
 *   FAILED read and a GENUINE zero are the same value at the data layer. Sharing
 *   one expression with the section is what keeps the chip and the tiles from
 *   ever disagreeing — a separate count query would restore the disease.
 *
 * CI cannot render a page, so these are structural, source-scanning assertions
 * in the style of the sibling `one-inquire-button.test.ts`. Each one was mutated
 * on purpose and confirmed red before this file was committed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, 'page.tsx'), 'utf8');

/** Source with comments removed, so assertions test CODE not the prose above. */
const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** The chip's JSX, located by the one attribute only it carries. */
function verifiedChipBlock(): string {
  const idx = code.indexOf('Setnayan reviewed this shop');
  assert.ok(
    idx > 0,
    'the ✓ Verified chip\'s title attribute is gone. It is load-bearing — the page ' +
      'renders three narrower "verified" claims below, and a bare word here reads as ' +
      'covering prices, reviews and availability too.',
  );
  // Walk back to the opening of the conditional that wraps it, and forward past
  // the closing tag, so the block covers gate + markup.
  const start = code.lastIndexOf('{vendor.', idx - 400 > 0 ? idx - 400 : 0);
  assert.ok(start > 0, 'could not locate the chip’s gate — update this test with the markup');
  return code.slice(start, idx + 400);
}

test('the ✓ Verified chip is gated on verification_state === "verified", strictly', () => {
  const block = verifiedChipBlock();
  assert.match(
    block,
    /\{vendor\.verification_state === 'verified' \? \(/,
    'the ✓ Verified chip is no longer gated on a strict equality against the enum value ' +
      "'verified'. A truthiness check or `!== 'unverified'` would light the chip up for " +
      'pending_review, demoted and rejected shops on the admin-demo and vendor-self-preview ' +
      'renders — the only two that survive the route’s 404 gate.',
  );
});

test('the ✓ Verified chip never keys off public_visibility', () => {
  const block = verifiedChipBlock();
  assert.ok(
    !block.includes('public_visibility'),
    'the ✓ Verified chip now references public_visibility. That is a DIFFERENT fact from ' +
      'verification_state (migration 20271013500000 exists because an RLS policy conflated ' +
      'them). The compare page keys its own pill on visibility; do not copy it here.',
  );
});

test('the ✓ Verified chip is not wrapped in the cinematic-hero suppression', () => {
  // The name + tagline fragment is suppressed for top-plan shops with a cover
  // photo. If the chip drifted inside it, exactly the shops paying the most
  // would silently lose the trust signal.
  const chipIdx = code.indexOf('Setnayan reviewed this shop');
  const heroIdx = code.indexOf('{cinematicHero ? null : (');
  assert.ok(heroIdx > 0 && chipIdx > 0, 'could not locate the hero guard or the chip');
  const between = code.slice(heroIdx, chipIdx);
  assert.ok(
    between.includes(')}'),
    'the ✓ Verified chip appears to sit inside the `cinematicHero ? null :` fragment — a ' +
      'top-plan shop with a cover photo would render no Verified chip at all',
  );
});

test('the anchor target and the pointer chip both exist, exactly once each', () => {
  const targets = (code.match(/id="featured-stories"/g) ?? []).length;
  const pointers = (code.match(/href="#featured-stories"/g) ?? []).length;
  assert.equal(
    targets,
    1,
    `expected exactly 1 id="featured-stories" anchor target, found ${targets}. Zero makes the ` +
      'chip a dead in-page link; two makes the browser pick one arbitrarily.',
  );
  assert.equal(
    pointers,
    1,
    `expected exactly 1 href="#featured-stories" pointer, found ${pointers}`,
  );
});

test('the pointer chip and the section it points at share one gate, character for character', () => {
  // Two occurrences: the chip's and the section's. If they ever diverge, the
  // chip becomes a fake door (or the section becomes unreachable from the top).
  const gate =
    'showEditorials &&\n            (featuredEditorials.length > 0 || featuredChapterCredits.length > 0)';
  const chipGate = code.includes(gate);
  const sectionGate = code.includes(
    'showEditorials &&\n        (featuredEditorials.length > 0 || featuredChapterCredits.length > 0)',
  );
  assert.ok(
    chipGate,
    'the "Featured in N stories" chip’s gate no longer matches the section’s. It must stay ' +
      '`showEditorials && (featuredEditorials.length > 0 || featuredChapterCredits.length > 0)` ' +
      '— including showEditorials, which is the vendor’s own switch for hiding that section.',
  );
  assert.ok(
    sectionGate,
    'the "Featured in these stories" section’s gate changed without the chip’s. A chip ' +
      'pointing at a section that will not render is a fake door.',
  );
});

test('the pointer chip counts the rendered arrays — never a separate count query', () => {
  const idx = code.indexOf('href="#featured-stories"');
  assert.ok(idx > 0, 'the pointer chip is gone');
  const block = code.slice(idx, idx + 600);
  // Anchored to the RENDERED number, not merely "the expression appears
  // somewhere in the block" — the singular/plural branch below also mentions it,
  // so a looser check stays green while the displayed count is swapped out.
  assert.ok(
    block.includes(
      'Featured in {featuredEditorials.length + featuredChapterCredits.length}',
    ),
    'the chip’s number is no longer `featuredEditorials.length + featuredChapterCredits.length`. ' +
      'It must be derived from the same arrays the section maps over — both are already sliced ' +
      'to what actually renders, so the number and the tiles cannot disagree. A count query ' +
      'would fail silently to 0 exactly like the loaders do, and could claim stories over a ' +
      'section rendering nothing.',
  );
  assert.ok(
    !/count:\s*'exact'|head:\s*true/.test(block),
    'a count query appeared inside the "Featured in N stories" chip. Forbidden: a failed count ' +
      'and a genuine zero are indistinguishable, and it can disagree with the tiles below.',
  );
});

test('the pointer chip says "1 story", never "1 stories"', () => {
  const idx = code.indexOf('href="#featured-stories"');
  const block = code.slice(idx, idx + 600);
  assert.ok(
    block.includes("=== 1\n                  ? 'story'") || /=== 1[\s\S]{0,40}'story'/.test(block),
    'the singular/plural branch on the "Featured in N stories" chip is gone',
  );
});
