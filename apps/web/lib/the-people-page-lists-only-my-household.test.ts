/**
 * THE PEOPLE PAGE LISTS ONLY MY HOUSEHOLD — owner, 2026-09-25, on his own People page:
 * *"i do not have a registered spouse"* — it showed another user's business,
 * "Indigo Caterers", tagged "Shared by your spouse". RLS admits an ADMIN to every
 * dependent on the platform, and the list rendered whatever came back, calling
 * every row that was not the viewer's own "Shared by your spouse".
 *
 * The page must decide membership itself: my rows · rows I handed over · rows my
 * ACTUAL spouse (current_spouse_user_ids) marked shared. Nothing else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(
  readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '(account)', 'people', '_components', 'dependents-section.tsx'),
    'utf8',
  ),
);

test('the list is filtered to mine · handed-over · spouse-shared before it renders', () => {
  assert.match(SRC, /const dependents = rows\.filter\(/, 'the rendered list is the FILTERED rows, never the raw RLS result');
  const at = SRC.indexOf('const dependents = rows.filter(');
  const body = SRC.slice(at, at + 400);
  assert.match(body, /d\.owner_user_id === myUserId/, 'my own rows');
  assert.match(body, /d\.handed_over_by_user_id === myUserId/, 'rows I handed over');
  assert.match(body, /d\.shared_with_spouse && spouseSet\.has\(d\.owner_user_id\)/, 'only my ACTUAL spouse’s shared rows');
});

test('the raw result is never mapped straight into the list', () => {
  assert.doesNotMatch(SRC, /const dependents = \(data \?\? \[\]\)/, 'rendering the RLS result directly shows an admin everyone');
});
