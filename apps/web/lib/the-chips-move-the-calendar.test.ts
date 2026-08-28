/**
 * the-chips-move-the-calendar.test.ts
 *
 * Owner, 2026-08-28, looking at his own birthday's date screen: *"picking on the
 * day and the saturday after does not change anything on the calendar. is that
 * correct?"* — and then, on the details screen: *"some of these were answered
 * already like, Celebrant, Turning, what kind of milestone (40)."*
 *
 * ── WHAT WAS ACTUALLY WRONG ────────────────────────────────────────────────
 * The date screen had TWO answers to one question and committed the wrong one.
 * `pickCelebrationDay` wrote `dateValue`; the commit and the calendar both read
 * `dateCandidates` whenever that list had anything in it. So after a single tap
 * on the calendar the chips wrote to a field nothing downstream read: the chip
 * lit, the calendar sat still, **and the day that got saved was the one the chip
 * did not name.** Doing nothing visible was the kinder half of it.
 *
 * 🔑 THE COMMENT ON `activeCelebrationPick` SAID THE CHIPS WERE "A VIEW OF THE
 * DATE FIELD, NEVER A PARALLEL STATE." True of the field, false of the screen —
 * the field itself had become the parallel state. **A second source of truth
 * does not announce itself; it just disagrees.**
 *
 * And it was broken twice over: `DateCalendar` seeds its selection from props
 * ONCE, so even a chip that wrote the right list would have been ignored.
 *
 * This file pins both halves and the seeding of the three re-asked fields.
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
const CALENDAR = 'app/onboarding/_shared/date-calendar.tsx';

// ── 1 · one list, read one way ─────────────────────────────────────────────
test('🔴 the chip writes the list the calendar draws and the commit sends', () => {
  const src = stripComments(read(WIZARD));
  assert.match(
    src,
    /function pickCelebrationDay\(iso: string\) \{[\s\S]{0,600}?setDateCandidates\(next\)/,
    'tapping a chip must write dateCandidates — the field the commit actually reads',
  );
});

test('🪤 the three copies of "which days" are ONE expression', () => {
  // The bug lived in the gap between two copies of this precedence rule. A
  // third copy is how it comes back.
  const src = stripComments(read(WIZARD));
  const copies = src.match(/dateCandidates\.length > 0 \? dateCandidates/g) ?? [];
  assert.equal(
    copies.length,
    1,
    `the candidates-or-the-single-day rule is spelled out ${copies.length} times; `
      + 'it must exist once, as `celebrationDates`',
  );
  assert.match(src, /const celebrationDates = useMemo\(/, 'and that one place must be named');
  assert.match(src, /candidates=\{celebrationDates\}/, 'the calendar must read it');
  assert.match(
    src,
    /dateCandidates: dateMode === 'specific' \? celebrationDates : \[\]/,
    'and the commit must send the same list',
  );
});

test('a chip lights from the list, so both directions cannot disagree', () => {
  const src = stripComments(read(WIZARD));
  assert.match(
    src,
    /chip\(celebrationDates\.includes\(anchorOptions\.onTheDayISO\)\)/,
    'the lit state must be derived from the committed list, never from a parallel field',
  );
});

test('a chip that cannot fit is DISABLED, never silently inert', () => {
  // "Nothing happens when I tap it" is the whole complaint. Shipping a second
  // version of it would be its own joke.
  const src = stripComments(read(WIZARD));
  assert.match(src, /function canPickCelebrationDay\(iso: string\): boolean/, 'the fit must be askable');
  assert.match(src, /disabled=\{!canPickCelebrationDay\(anchorOptions\.onTheDayISO\)\}/, 'and asked');
});

test('a chip answers in the mode where its answer counts', () => {
  // Specific-date mode is the only one that commits candidates; a chip that set
  // a date the flexible window ignores is a dead control in live clothes.
  const src = stripComments(read(WIZARD));
  assert.match(
    src,
    /function pickCelebrationDay\(iso: string\) \{[\s\S]{0,600}?setDateMode\('specific'\)/,
    'tapping a chip must put the screen in the mode that reads its answer',
  );
});

test('"Another day" brings the calendar and picks nothing', () => {
  const src = stripComments(read(WIZARD));
  assert.match(src, /onClick=\{showTheCalendar\}/, 'it must scroll, not select');
  assert.doesNotMatch(
    src,
    /pickCelebrationDay\(anchorOptions\.onTheDayISO, true\)/,
    'it must not select the on-the-day date — the one answer they just declined',
  );
});

// ── 2 · the calendar listens after mount ───────────────────────────────────
test('🔴 the calendar redraws when its answer changes from outside', () => {
  const src = stripComments(read(CALENDAR));
  assert.match(
    src,
    /useEffect\(\(\) => \{[\s\S]{0,400}?setMulti\(candidates\.map\(fromISO\)\)/,
    'a candidates prop that changes after mount must be adopted, or the chip is inert',
  );
  assert.match(src, /lastAdopted/, 'and compared, so a re-render is not a reset');
});

test('🪤 the calendar adopts upward-facing state, it never writes it', () => {
  // A mounting child that lifts would become a second author of its parent's
  // answer — the same disease one level down.
  const src = stripComments(read(CALENDAR));
  const effect = /const lastAdopted[\s\S]*?\}, \[candidates\]\);/.exec(src)?.[0] ?? '';
  assert.ok(effect.length > 0, 'the adopt effect must exist');
  assert.doesNotMatch(effect, /lift\(|onChange\(/, 'the adopt path must never call back up');
});

// ── 3 · the details screen stops re-asking ─────────────────────────────────
test('celebrant, age and milestone are seeded from what the flow already holds', () => {
  const src = stripComments(read(WIZARD));
  assert.match(src, /const derivedSpecialty = useMemo\(/, 'the known facts must be gathered');
  for (const key of ['celebrant_name', 'celebrant_age', 'milestone_type']) {
    assert.match(src, new RegExp(`out\\.${key} =`), `${key} must be answered, not asked`);
  }
  assert.match(src, /birthdayMilestoneFromAge\(knownBirthdayAge, selfSex\)/, 'from the same age');
});

test('🪤 the seeding is NOT routed through the flag-gated prefill seam', () => {
  // `onboardingV2BriefEnabled()` is fail-closed and OFF, so `prefillSpecialty`
  // is always {} in production and this half of the 2026-08-20 fix has never
  // once run. A repair written behind it ships switched off and looks done.
  const src = read(WIZARD);
  const decl = /const derivedSpecialty = useMemo\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/.exec(src)?.[0] ?? '';
  assert.ok(decl.length > 0, 'the derivation must exist');
  assert.doesNotMatch(decl, /prefill/, 'it must not depend on the brief flag');
});

test('a seeded answer never overwrites one already there', () => {
  const src = stripComments(read(WIZARD));
  assert.match(
    src,
    /const holes = keys\.filter\(\(k\) => v\[k\] === undefined \|\| v\[k\] === null \|\| v\[k\] === ''\)/,
    'only an answer-shaped hole may be filled — a draft or a typed value wins',
  );
});

test('the "From your profile" badge comes off the moment the value stops being ours', () => {
  const src = stripComments(read(WIZARD));
  assert.match(
    src,
    /specialtyValues\[k\] === derivedSpecialty\[k\]/,
    'a field wearing that badge over a typed value is a small lie about the screen',
  );
});
