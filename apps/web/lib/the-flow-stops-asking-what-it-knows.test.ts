/**
 * the-flow-stops-asking-what-it-knows.test.ts
 *
 * Three defects the owner found in ONE walk from the Year page into a birthday
 * (2026-08-20). All three are the same shape: the flow asking a question whose
 * answer it is already holding.
 *
 *   1. "i tried the birthday. it asked if its mine."
 *   2. "it should be when do you want to celebrate it?"
 *   3. "it also knows my birthday to be 40th. why do i get asked for this?"
 *
 * Each fix has a trap next to it, and the traps are what this file pins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const stripComments = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const WIZARD = 'app/onboarding/[type]/_components/generic-onboarding.tsx';
const CARRY = 'lib/onboarding/moment-handoff.ts';
// 🔁 THE ROW MOVED, THE HAND-OVER DID NOT (2026-08-21). /dashboard/year is a
// redirect; its moment rows are the board's "Worth planning" shelf. This
// assertion is the RECEIVING end of the same wire that
// `year-page-answers-created-or-not.test.ts` guards at the sending end — both
// went red when the retirement left the affordance behind, which is exactly
// what a two-ended guard is for.
const YEAR = 'app/dashboard/(launcher)/_components/year-moments-list.tsx';

// ── 1 · the celebrant ──────────────────────────────────────────────────────
test('when we know the celebrant, no empty box is rendered under the answer', () => {
  const src = stripComments(read(WIZARD));
  assert.match(src, /const knowsCelebrant = /, 'the known-celebrant case must be named');
  assert.match(
    src,
    /\{knowsCelebrant \? \(/,
    'the celebrant screen must BRANCH on it, not merely re-word a heading over a field',
  );
  // The reversible way back — hiding is a default, never a wall.
  assert.match(src, /setHonoreeRevealed\(true\)/, 'the folded field must have a way open');
});

test('the refusal reopens the field it tells you to type in', () => {
  // `blockedBy` renders "put their name above". With the field folded away that
  // sentence would point at nothing — the exact dead end that screen exists to
  // replace.
  const src = stripComments(read(WIZARD));
  const decl = /const knowsCelebrant = ([^;]+);/.exec(src)?.[1] ?? '';
  assert.match(decl, /!blockedBy/, 'a blocked celebrant must always see the field');
  assert.match(decl, /!honoreeRevealed/, 'tapping Change must open it');
  assert.match(decl, /!honoree\b/, 'a typed name means it is no longer theirs');
});

// ── 2 · the day ────────────────────────────────────────────────────────────
test('a day we already know turns "When is it?" into "When are you celebrating?"', () => {
  const src = stripComments(read(WIZARD));
  assert.match(src, /const knownDayISO = anchorDate \|\| momentDayISO;/,
    'the celebration options must key on EITHER source of a known day');
  assert.match(src, /celebrationOptionsFor\(knownDayISO, today\)/,
    'the shipped chips + title must be driven by the known day');
});

test('🪤 the carried day is never poured into the anchor', () => {
  // `anchorOrigin` is a plain useState defaulting to the literal 'wedding' and
  // is never derived from the event type, so an anchor set from a birthday
  // carry renders "Our wedding falls on …" — naming a wedding that does not
  // exist. The two columns also mean different things.
  const src = stripComments(read(WIZARD));
  assert.doesNotMatch(src, /setAnchorDate\(\s*moment\./, 'the carry must not become an anchor');
  assert.doesNotMatch(
    src,
    /setAnchorDate\(\s*momentDayISO/,
    'the carried day must not become an anchor',
  );
  // And the sentence must have its own branch for the carried case.
  assert.match(src, /if \(!anchorDate && momentDayISO\)/,
    'a carried day must describe itself by the event type, not by anchorOrigin');
});

// ── 3 · the age ────────────────────────────────────────────────────────────
test('the age the Year row printed is carried, not re-asked', () => {
  const year = read(YEAR);
  assert.match(year, /age=\{m\.age \?\? null\}/, 'the Year row must hand over the age it shows');
  const carry = stripComments(read(CARRY));
  assert.match(carry, /age: number \| null;/, 'the carry must have somewhere to put it');
  assert.match(carry, /isPlausibleAge/, 'an untrusted age must be dropped, never clamped');
});

test('the age-bracket screen is SKIPPED in transit, never removed', () => {
  const src = stripComments(read(WIZARD));
  // Removal shifts every later index, and screens[step] is read with a non-null
  // assertion whose next line calls a string method — out of range is a THROW.
  assert.doesNotMatch(
    src,
    /screens[\s\S]{0,200}?filter\([^)]*tq_who/,
    'tq_who must never be filtered out of the sequence',
  );
  assert.match(src, /skippedScreens\.has\(screens\[next\]!\)/, 'it must be skipped during navigation');
  // Direction-aware, and never off either end.
  assert.match(src, /next \+= dir;/, 'the skip must continue in the direction of travel');
  assert.match(src, /next > 0 && next < screens\.length - 1/, 'the skip must not run off an end');
});

test('a bracket the person chose themselves always wins over one we derived', () => {
  const src = stripComments(read(WIZARD));
  assert.match(
    src,
    /setDetails\(\(d\) => \(d\.who \? d : \{ \.\.\.d, who: derivedWho \}\)\)/,
    'the derived answer must only fill an ANSWER-SHAPED HOLE, never overwrite one',
  );
  assert.match(src, /eventType === 'birthday'/, 'the age answers a BIRTHDAY question only');
});

// ── every door, not just the Year row ──────────────────────────────────────
test('🚨 the party-type question is answered from the profile too, not only the Year hop', () => {
  // Owner, 2026-08-20: "since we already know it is for his birthday, then it is
  // not a question of what type of party." Creating the same birthday from the
  // Create button carries nothing, so a carry-only fix would still have asked.
  const page = stripComments(read('app/onboarding/[type]/page.tsx'));
  assert.match(page, /const selfBirthdayAge =/, 'the page must work out the reader’s own age');
  assert.match(page, /nextBirthday\(self\.birthdate, manilaToday\(\)\)/, 'from their own profile');
  assert.match(page, /selfBirthdayAge=\{selfBirthdayAge\}/, 'and hand it to the wizard');

  const src = stripComments(read(WIZARD));
  assert.match(
    src,
    /carriedAge \?\? selfBirthdayAge/,
    'the tapped row wins, and the profile answers every other door',
  );
});

test('🪤 the age is NOT routed through the flag-gated prefill seam', () => {
  // `onboardingV2BriefEnabled()` is fail-closed and OFF, so a fix built behind
  // it ships switched off. The flag holds back a WIDER brief, not this fact.
  const page = read('app/onboarding/[type]/page.tsx');
  const decl = /const selfBirthdayAge =[\s\S]*?;\n/.exec(page)?.[0] ?? '';
  assert.ok(decl.length > 0, 'the age derivation must exist');
  assert.doesNotMatch(decl, /onboardingV2BriefEnabled|prefill/, 'it must not depend on the brief flag');
});

test('a blank celebrant means "mine", and typing a name puts the question back', () => {
  const src = stripComments(read(WIZARD));
  const decl = /const knownBirthdayAge =[\s\S]*?;\n/.exec(src)?.[0] ?? '';
  assert.match(decl, /!honoree\.trim\(\)/, 'a typed celebrant must stop us answering for them');
  assert.match(decl, /eventType === 'birthday'/, 'only a birthday has this question');
});

test('a stored answer that differs from ours keeps its screen', () => {
  // Skipping a screen that holds somebody's own earlier answer is a wall, not a
  // default — they would have no way back to it.
  const src = stripComments(read(WIZARD));
  assert.match(
    src,
    /stored === undefined \|\| stored === derivedWho/,
    'only skip when what is stored is what we would have derived',
  );
});
