/**
 * the-controller-wires-what-it-measured.test.ts — the last link in the chain.
 *
 * `lib/event-hub-control.test.ts` proves the resolvers are honest.
 * `hub-stage-renders.test.ts` proves an honest resolver reaches the pixels.
 * Both can be perfect while the PAGE hands them a lie — `measured: true` typed
 * in place of `guestRead.measured`, `shared: true` in place of the gate — and
 * neither of those files would notice, because neither reads the page.
 *
 * That is not hypothetical: the whole class of defect this stream exists for is
 * a measurement that is taken correctly and then dropped one layer above.
 *
 * 🔑 SOURCE, BECAUSE THIS IS A WIRING CLAIM. What is asserted here is which
 * VALUE flows into which field — not behaviour, which the two files above
 * already own. Comments are stripped first, so prose about a construct is never
 * mistaken for it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const page = () => stripComments(readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8'));

test('the guest facts carry the READ\'s own verdict, not a typed-in true', () => {
  const src = page();
  assert.match(
    src,
    /shared:\s*mayReadGuestList/,
    'a hardcoded `shared: true` tells a delegate the couple invited nobody',
  );
  assert.match(
    src,
    /measured:\s*guestRead\.measured/,
    'a hardcoded `measured: true` restores "0 of 0 in" for a couple with 180 names',
  );
  assert.doesNotMatch(src, /shared:\s*true/, 'no literal may stand in for the gate');
  assert.doesNotMatch(src, /measured:\s*true/, 'nor for the read');
});

test('the EVENT read is measured too — its refusal is the silent one', () => {
  const src = page();
  // A refused `events` read yields a null date, and BOTH phase resolvers answer
  // a null date honestly — 'save_the_date' and 'plan'. So the page would paint a
  // wedding that happened last month as "Stage 1 of 4" with nothing to warn it.
  assert.match(src, /measured:\s*!eventRes\.error/, 'the event read must report its own refusal');
});

test('the day-of upsell collapses to NOTHING, and the ruling is not re-derived here', () => {
  const src = page();
  assert.match(src, /hubOffersAllowed\(/, 'the ruling has one home');
  assert.doesNotMatch(
    src,
    /offersAllowed\s*=\s*(?:true|standing\.phase\s*!==)/,
    'the page must not compute its own version of "may we sell today"',
  );
  // The Add branch is reachable ONLY through the ruling.
  const addBranch = /offersAllowed \? \(/;
  assert.match(src, addBranch, 'the Add link sits behind the ruling');
  assert.match(src, /: null/, 'and its else-branch is nothing at all');
});

test('the three ownership predicates are still the canonical ones', () => {
  const src = page();
  // Papic was gated on a retired SKU for a year and its card could never light
  // up. Twenty-two upgrade slots is twenty-two chances to repeat that.
  assert.match(src, /eventPapicActive\(supabase, eventId\)/);
  assert.match(src, /eventSkuActive\(supabase, eventId, 'LIVE_WALL'\)/);
  assert.match(src, /resolveAddOnState\(supabase, eventId, 'live-studio-roam', 'couple'\)/);
  assert.doesNotMatch(src, /eventPapicSeatsActive\(/, 'the retired five-seat pass gate');
});

test('membership asks the ONE definition of host', () => {
  const src = page();
  assert.match(src, /isHostMemberType\(/);
  assert.doesNotMatch(
    src,
    /\['couple',\s*'coordinator'\]/,
    'a second, re-typed definition of "host" is how a guest row counted as one',
  );
});
