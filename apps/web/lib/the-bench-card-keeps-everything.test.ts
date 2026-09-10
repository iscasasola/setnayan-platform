/**
 * THE BENCH CARD KEEPS EVERYTHING IT HAS.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Owner, 2026-09-09, on a redesign of this surface: *"the imagery of each vendor
 * is important. You lost add manually. Or you are just getting key information
 * and did not check the full bench"* — and then, of the whole stream: *"make
 * sure that we are adding value and not deleting feature on the pages that will
 * be edited (bench)."*
 *
 * A design pass had drawn a bench card from scratch and silently lost TEN
 * things: the photograph, the initials fallback, the ★ Chosen / Asked corner,
 * the city, the rating, the Setnayan and Verified badges, the fit badges, the
 * price, the free-dates line, and both Find and Add manually. Nothing failed.
 * No test, no lint, no review caught it — the owner's eye did.
 *
 * 🔑 THE BENCH IS THE DENSEST SURFACE IN THIS PRODUCT, and every element on a
 * card was added because somebody needed it. Losing one is silent by
 * construction: the card still renders, still looks deliberate, and the couple
 * simply never learns the thing it used to tell them. So the set is pinned
 * here, and a change that drops one has to say so out loud by editing this file.
 *
 * ⚠ THIS IS A FLOOR, NOT A CEILING. Adding an element is free. Removing one
 * costs a line in this test and a sentence in a PR body — which is the whole
 * point.
 *
 * ⚠ AND IT SCANS THE STRIPPED SOURCE. A guard that matches its own explanation
 * guards nothing; this repo has already shipped one that did (a file-level
 * match passing on the comment that described the fix).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const BENCH = 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx';
const ACTIONS = 'app/dashboard/[eventId]/vendors/_components/bench-vendor-actions.tsx';
const src = stripComments(readFileSync(join(WEB, BENCH), 'utf8'));
const actionsSrc = stripComments(readFileSync(join(WEB, ACTIONS), 'utf8'));

/**
 * Every element a bench vendor card renders, with the anchor that proves it is
 * still there. Ported from the shipped card (the `.slcat .vc` block) — if you
 * are here because a line failed, put the element back rather than deleting
 * its row.
 */
const CARD_ELEMENTS: ReadonlyArray<{ element: string; anchor: RegExp; count: number; why: string }> = [
  {
    element: 'the supplier’s photograph',
    anchor: /src=\{v\.photoUrl\}/,
    count: 1,
    why: 'a card with no picture is not a card — the owner said so first',
  },
  {
    element: 'initials when there is no photograph',
    anchor: /<span className="ini">\{initials\(v\.name\)\}<\/span>/,
    count: 2,
    why: 'the fallback is part of the design, not an error state',
  },
  {
    element: '★ Chosen corner',
    anchor: /<span className="pcorner">★ Chosen<\/span>/,
    count: 1,
    why: 'the settled-booking state, and the reason Lock is withheld',
  },
  {
    element: 'Asked corner',
    anchor: /<span className="pcorner">Asked<\/span>/,
    count: 1,
    why: 'an ask is not a booking — it must never borrow the word Chosen',
  },
  {
    element: 'the reason pill',
    anchor: /className=\{`rpill \$\{reason\.tone\}`\}/,
    count: 1,
    why: 'why this supplier is being shown at all',
  },
  { element: 'the name', anchor: /<span className="vn">\{v\.name\}<\/span>/, count: 2,
    why: 'who it is' },
  { element: 'the city', anchor: /<MapPin size=\{11\}/, count: 2,
    why: 'where they work' },
  { element: 'the rating', anchor: /<Star size=\{11\}/, count: 2,
    why: 'what other couples said' },
  {
    element: 'the Setnayan badge',
    anchor: /<span className="bdg setnayan">/,
    count: 1,
    why: 'ours, and it is a trust signal',
  },
  {
    element: 'the Verified badge',
    anchor: /<span className="bdg verified">/,
    count: 2,
    why: 'checked, and it is a trust signal',
  },
  { element: 'fit badges', anchor: /<FitBadges v=\{v\} \/>/, count: 1,
    why: 'reach, budget, date, clash' },
  {
    element: 'the price',
    anchor: /<span className="price">\{formatPhp\(v\.totalCostPhp\)\}<\/span>/,
    count: 1,
    why: 'the number a couple is comparing on',
  },
  {
    element: 'the free-dates line',
    anchor: /<CardDateBlock/,
    count: 1,
    why: 'their open days inside the couple’s window — silent when unknown, never guessed',
  },
  {
    element: 'the standing sentence',
    anchor: /<CardStanding standing=/,
    count: 1,
    why: 'where this supplier stands — the line that lets a couple compare a rail of cards without opening one',
  },
  {
    element: 'the three actions',
    anchor: /<BenchVendorActions/,
    count: 1,
    why: 'Add to build · Inquire / Open conversation · Lock this',
  },
];

/** The two controls beside every carousel. Losing these was the loudest miss. */
const RAIL_CONTROLS: ReadonlyArray<{ element: string; anchor: RegExp; count: number; why: string }> = [
  {
    element: 'Find more / ＋ Add another',
    anchor: /addAnother \? cardAddAnother\(t\.label\) : 'Find more'/,
    count: 2,
    why: 'more of this category, opened in place',
  },
  {
    element: 'Add manually',
    anchor: /<span className="at">Add manually<\/span>/,
    count: 1,
    why: 'how a couple records the supplier their aunt recommended — off Setnayan entirely',
  },
];

test('the scan read the real file (an empty read is a green lie)', () => {
  assert.ok(src.length > 20000, `the bench read as ${src.length} chars — the scan is not reading it`);
  assert.ok(actionsSrc.length > 1000, 'the actions component read empty');
  assert.equal(CARD_ELEMENTS.length, 15, 'the pinned element list changed size — say so in the PR');
});

/**
 * ⚠ COUNTS, NOT PRESENCE — and this was learned the hard way ON THIS FILE.
 * The first cut asserted only that each anchor appeared SOMEWHERE, and three
 * sabotages passed it: this file renders TWO card shapes (the bench card and
 * the row-2 marketplace card) and TWO Find-more sites, so deleting one copy of
 * the initials, the rating or Find more left the other satisfying the test.
 * Measured 2026-09-09 and pinned, so losing EITHER copy fails.
 */
function countOf(anchor: RegExp, haystack: string): number {
  return (haystack.match(new RegExp(anchor.source, 'g')) ?? []).length;
}

test('🔑 every element of the bench card is still rendered, in both card shapes', () => {
  const wrong = CARD_ELEMENTS.filter((e) => countOf(e.anchor, src) !== e.count).map(
    (e) => `${e.element}: expected ${e.count}, found ${countOf(e.anchor, src)} — ${e.why}`,
  );
  assert.deepEqual(
    wrong,
    [],
    'a bench card lost something. Put it back; do not edit the count here to go green.',
  );
});

test('🔑 Find and Add manually still sit beside every carousel', () => {
  const wrong = RAIL_CONTROLS.filter((e) => countOf(e.anchor, src) !== e.count).map(
    (e) => `${e.element}: expected ${e.count}, found ${countOf(e.anchor, src)} — ${e.why}`,
  );
  assert.deepEqual(wrong, [], 'the rail lost a control');
});

test('🔑 a BOOKED supplier can still be reached from the bench', () => {
  // The defect this stream fixed: rule 2 returned every leg as null, so a couple
  // could not open a conversation with the one supplier they had actually
  // booked — the card most likely to have something waiting on them.
  assert.ok(
    !/if \(vendor\.status === 'locked'\) return NO_ACTIONS;/.test(
      stripComments(readFileSync(join(WEB, 'lib/bench-card-actions.ts'), 'utf8')),
    ),
    'a locked card returns NO_ACTIONS again — its conversation is unreachable from the bench',
  );
});

test('the actions component still renders all three legs', () => {
  for (const leg of ['inquiry', 'build', 'lock']) {
    assert.ok(
      new RegExp(leg, 'i').test(actionsSrc),
      `the actions component stopped mentioning the ${leg} leg`,
    );
  }
});
