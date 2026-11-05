/**
 * THE PEOPLE PAGE LISTS ONLY MY HOUSEHOLD — owner, 2026-09-25, on his own People page:
 * *"i do not have a registered spouse"* — it showed another user's business,
 * "Indigo Caterers", tagged "Shared by your spouse". RLS admits an ADMIN to every
 * dependent on the platform, and the list rendered whatever came back, calling
 * every row that was not the viewer's own "Shared by your spouse".
 *
 * The page must decide membership itself: my rows · rows I handed over · rows my
 * ACTUAL spouse (current_spouse_user_ids) marked shared. Nothing else.
 *
 * 2026-09-29 — THE SAME ROW CAME BACK THROUGH A SECOND READER. The People
 * roster counted `dependents` without the rule, so the picker read "Loved ones
 * 1" above "No loved ones yet." The rule moved to ONE function
 * (`lib/my-loved-ones.ts`); this file now pins that EVERY reader uses it —
 * executed rules live in `my-loved-ones.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SECTION = stripComments(
  readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '(account)', 'people', '_components', 'dependents-section.tsx'),
    'utf8',
  ),
);
const ROSTER = stripComments(readFileSync(join(__dirname, 'people-roster.ts'), 'utf8'));

test('the Loved ones list is filtered by the ONE rule before it renders', () => {
  assert.match(
    SECTION,
    /const dependents = myLovedOnes\(rows, myUserId, spouseSet\);/,
    'the rendered list is the FILTERED rows, never the raw RLS result',
  );
  assert.match(SECTION, /const spouseSet = spouseIdSet\(spouseIds\);/, 'the spouse set is not the one current_spouse_user_ids returned');
});

test('🔴 the roster COUNTS and LISTS by the same rule — the count can never claim a row the view cannot show', () => {
  assert.match(ROSTER, /alagaCount = error \? null : myLovedOnes\(rows, userId, spouses\)\.length;/);
  assert.match(ROSTER, /for \(const d of lovedOnesInMyCare\(rows, userId, spouses\)\)/, 'roster alaga rows skip the rule');
  assert.match(ROSTER, /rpc\('current_spouse_user_ids'\)/, 'the roster guesses the spouse instead of reading it');
});

test('the raw result is never mapped straight into a list or a count', () => {
  assert.doesNotMatch(SECTION, /const dependents = \(data \?\? \[\]\)/, 'rendering the RLS result directly shows an admin everyone');
  assert.doesNotMatch(SECTION, /const dependents = rows\.filter\(/, 'a second, hand-written copy of the rule');
  const alaga = ROSTER.slice(ROSTER.indexOf("from('dependents')"), ROSTER.indexOf('const connections ='));
  assert.ok(alaga.length > 200, 're-anchor: the roster alaga read moved');
  assert.doesNotMatch(alaga, /for \(const d of \(data \?\? \[\]\)/, 'the roster lists the raw RLS result again');
  assert.doesNotMatch(alaga, /alagaCount = error \? null : rows\.length/, 'the roster counts the raw RLS result again');
});

/*
 * 2026-10-27 — A THIRD AND A FOURTH READER. Create Event's "Who is it for?" listed the owner's own SetnaProd AND three
 * other users' businesses (owner: *"Why do i have flowerstoreph and indigocaterers"* · *"It only has setnaprod"* ·
 * *"It should not"*); the Events board counted every platform dependent with a bare `count: 'exact'`. Both now go
 * through the rule. And so a fifth reader cannot be written without it: every app/ page or component that reads
 * `dependents` as a LIST (no single-row `.eq('dependent_id'|'owner_user_id', …)` scope) must call the rule.
 */
const read = (...p: string[]) => stripComments(readFileSync(join(__dirname, '..', ...p), 'utf8'));
const CREATE = read('app', 'dashboard', '(account)', 'create-event', 'page.tsx');
const BOARD = read('app', 'dashboard', '(launcher)', 'page.tsx');

test('🔴 Create Event offers only MY loved ones — never an admin-visible stranger', () => {
  assert.match(CREATE, /lovedOnesInMyCare\(\s*\(deps \?\? \[\]\)/, 'the picker lists the raw RLS result');
  assert.match(CREATE, /rpc\('current_spouse_user_ids'\)/, 'the picker guesses the spouse');
  assert.doesNotMatch(CREATE, /const rows = \(deps \?\? \[\]\) as DependentSubjectRow\[\];/, 'the raw rows came back');
});

test('🔴 the Events board counts MY loved ones — never a bare platform-wide count', () => {
  const at = BOARD.indexOf("from('dependents')");
  assert.ok(at > 0, 're-anchor: the board no longer reads dependents');
  const block = BOARD.slice(at, at + 900);
  assert.doesNotMatch(block, /count: 'exact'/, 'a bare count counts every dependent an admin can see');
  assert.match(block, /myLovedOnes\(/, 'the count skips the rule');
});

test('every app/ LIST read of dependents goes through the one rule', async () => {
  const { execFileSync } = await import('node:child_process');
  const root = join(__dirname, '..');
  const files = execFileSync('git', ['grep', '-l', "from('dependents')", '--', 'app'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.endsWith('.test.ts') && !/actions?\.ts$/.test(f));
  assert.ok(files.length >= 4, `re-anchor: only ${files.length} readers found`);
  const offenders = files.filter((f) => {
    const code = stripComments(readFileSync(join(root, f), 'utf8'));
    const scoped = /\.eq\('(dependent_id|owner_user_id|claim_token)'/.test(code);
    const ruled = /\b(myLovedOnes|lovedOnesInMyCare|belongsOnMyPeoplePage)\(/.test(code);
    return !scoped && !ruled;
  });
  assert.deepEqual(offenders, [], 'a dependents list read with neither a single-row scope nor the my-loved-ones rule');
});
