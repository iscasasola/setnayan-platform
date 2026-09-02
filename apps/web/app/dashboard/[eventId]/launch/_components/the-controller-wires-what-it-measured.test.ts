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

/*
  ── VIEW AS — the wiring claim, which the other two files cannot see ────────
  The resolver refuses a `guest` row and the stage paints no switcher for an
  empty list. Both stay true while the PAGE hands `hubPreviewRoles` something
  other than this viewer's own `member_type` — a literal 'couple', a `Boolean`,
  or an `offered` list built by hand — and neither file would notice, because
  neither reads the page. That substitution IS the defect that shipped once.
*/
test('the offer list is built from THIS viewer\'s member_type, through the one gate', () => {
  const src = page();
  assert.match(src, /hubPreviewRoles\(\{/, 'the page must ask the gate, not assemble a list');
  assert.match(
    src,
    /memberType:\s*\(membership as[\s\S]{0,120}?\)\?\.member_type/,
    'the gate must be fed the viewer\'s OWN row, never a literal',
  );
  assert.doesNotMatch(
    src,
    /hubPreviewRoles\(\{[\s\S]{0,160}?memberType:\s*'(couple|coordinator)'/,
    'a typed-in member_type would hand every viewer the host reads',
  );
  assert.doesNotMatch(
    src,
    /const offeredRoles\s*=\s*(HUB_ROLES|HUB_GENERIC_ROLES|\[)/,
    'the offer list may never be assembled beside the gate instead of by it',
  );
});

test('the armed role is resolved against the offer list, never taken from the URL', () => {
  const src = page();
  assert.match(
    src,
    /resolveArmedHubRole\(\{\s*param:\s*search\.viewas,\s*offered:\s*offeredRoles\s*\}\)/,
    'the param is checked against what this viewer was offered — it is not the authority',
  );
  assert.doesNotMatch(
    src,
    /armedRole\s*=\s*search\.viewas/,
    'reading the role straight off the address bar is the whole bug, wearing a param',
  );
});

test('the named-guest read reaches the gate as a FLAG, and the page reads no guest by name', () => {
  const src = page();
  assert.match(
    src,
    /namedGuestEnabled:\s*hubNamedGuestPreviewEnabled\(\)/,
    'the privacy surface must be gated by the flag, not by a literal',
  );
  assert.doesNotMatch(
    src,
    /namedGuestEnabled:\s*true/,
    'a hardcoded true ships the one read the owner has not ruled on',
  );
  // Flag ON or OFF, this page performs no per-guest name read. The absence is
  // provable rather than promised — there is no such select to audit.
  assert.doesNotMatch(src, /first_name|display_name/, 'no guest is read by name here');
});

test('the stage is HANDED the resolved reads — it resolves no role of its own', () => {
  const src = page();
  assert.match(src, /roles=\{roleViews\}/);
  assert.match(src, /armedRole=\{armedRole\}/);
  assert.match(
    src,
    /resolveHubRoleView\(\{\s*role,\s*standing,\s*slug:\s*eventSlug,\s*guests:\s*guestFacts\s*\}\)/,
    'the role reads are built from the SAME standing and guest facts the stage shows',
  );
});
