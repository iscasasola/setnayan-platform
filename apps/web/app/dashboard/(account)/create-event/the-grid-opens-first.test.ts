/**
 * the-grid-opens-first.test.ts — "+ New event" opens on the type grid, sorted for You (owner 2026-10-22, "Yes to
 * all": Host 3 option B, prototype `journey_fixes_2026-10-22.html`).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * Before the grid, a whole screen asked "Para kanino ito?" — a Tagalog heading and one more tap on the very first
 * thing a host does. For most accounts it offered exactly two rows: "You" and "Someone else", and "someone else"
 * is what the grid's own "show all event types" already does.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. The picker never renders a who-screen in front of the grid: it opens on "You".
 *   2. The who survives as ONE dropdown above the grid — drawn ONLY when a loved one on file makes it a choice.
 *   3. Sorting by the who is unchanged (`gridHiddenTypes`), and "show all" still appears only when something is hidden.
 *
 * Comments stripped before matching (`lib/strip-comments.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  buildSelfSubject,
  buildUnspecifiedSubject,
  dependentSubjects,
  forMenuHint,
  forMenuLabel,
  forMenuSubjects,
  openingSubject,
} from '@/lib/create-subjects';

const PICKER = stripComments(
  readFileSync(
    join(process.cwd(), 'app/dashboard/(account)/create-event/_components/event-type-picker.tsx'),
    'utf8',
  ),
);

const you = buildSelfSubject('Ice', null);
const someone = buildUnspecifiedSubject();
const [lola] = dependentSubjects(
  [{ dependent_id: 'dep-1', name: 'Lola Rosa', dependent_kind: 'person', birth_date: '1946-05-01', sex: 'female' }],
  'viewer',
);

// SABOTAGE: return the first subject (whatever it is) from openingSubject → RED once the roster order changes.
test('the grid opens on "You"', () => {
  assert.equal(openingSubject([someone, lola!, you])?.id, you.id);
  assert.equal(openingSubject([]), null, 'no roster (samahan, QR fast-lane) → the household reading, as before');
  assert.equal(openingSubject(undefined), null);
});

// SABOTAGE: make forMenuSubjects return the roster unconditionally → RED.
// 2026-10-26 (owner: "For you" folds what cannot be yours): "Someone else" is now a real answer on its own — it
// opens a christening, which "For you" folds — so the dropdown draws whenever the roster holds more than "You".
test('the "For" dropdown exists whenever there is more than "You" to choose', () => {
  assert.deepEqual(forMenuSubjects([you, someone])?.map((s) => s.id), [you.id, someone.id]);
  assert.equal(forMenuSubjects([you]), null, '"You" alone is not a choice — draw nothing');
  assert.equal(forMenuSubjects([]), null);
  assert.deepEqual(forMenuSubjects([you, lola!, someone])?.map((s) => s.id), [you.id, lola!.id, someone.id]);
});

test('the rows say the drawn words, and a loved one keeps the shipped plain-English line', () => {
  assert.equal(forMenuLabel(you), 'You', 'the account holder is "You", not their display name');
  assert.equal(forMenuHint(you), 'Your own event');
  assert.equal(forMenuLabel(lola!), 'Lola Rosa');
  assert.equal(forMenuHint(lola!), 'Loved one · person', 'Alaga → "Loved ones" (owner 2026-09-29); no age is shown');
  assert.equal(forMenuLabel(someone), 'Someone else');
  // "Show me everything" stopped being true on 2026-10-26: a wake is only for someone who passed away.
  assert.equal(forMenuHint(someone), 'A living person — every event');
});

// SABOTAGE: put back `const [subject, setSubject] = useState<CreateSubject | null>(null);` → RED.
// SABOTAGE: restore the "Para kanino ito?" heading → RED.
test('the picker has no who-screen in front of the grid', () => {
  assert.doesNotMatch(PICKER, /Para kanino ito/, 'the Tagalog who-screen is back');
  assert.doesNotMatch(PICKER, /askWho/, 'a who-step gate is back in front of the grid');
  assert.match(PICKER, /useState<CreateSubject \| null>\(\(\) =>\s*!samahanCommunityId && !preselect\s*\? \(\(initialSubjectId \? subjects\?\.find\(\(s\) => s\.id === initialSubjectId\) : undefined\) \?\? openingSubject\(subjects\)\)\s*: null,?\s*\)/);
  const grid = PICKER.indexOf('<EventTypePhotoPicker');
  const firstReturn = PICKER.indexOf('  return (', PICKER.indexOf('const heading'));
  assert.ok(grid > firstReturn && firstReturn > 0, 'the first thing the picker returns must be the grid');
});

// SABOTAGE: draw the PickMenu whenever `subject` is set (drop `forMenu &&`) → RED.
test('the who is ONE dropdown above the grid, gated on a real choice', () => {
  assert.match(PICKER, /\{forMenu && subject \? \(/, 'the dropdown must be drawn only when forMenuSubjects returns rows');
  assert.match(PICKER, /const forMenu = !samahanCommunityId && !preselect \? forMenuSubjects\(subjects\) : null;/);
  const menu = PICKER.indexOf('<PickMenu');
  assert.ok(menu > 0 && menu < PICKER.indexOf('<EventTypePhotoPicker'), 'the dropdown sits above the grid');
  assert.match(PICKER, /buttonText=\{`For · \$\{forMenuLabel\(subject\)\}`\}/);
});

test('"show all" still appears only when something is hidden', () => {
  assert.match(PICKER, /\{hiddenCount > 0 && !showAllTypes && mayShowAll \? \(/);
  assert.match(PICKER, /Planning for someone else\?/);
  assert.doesNotMatch(PICKER, /May iba ka pang pinaplano/, 'English labels (owner 2026-10-07)');
});
