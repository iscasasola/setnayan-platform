/**
 * actions.test.ts — both doors on the learned-memory screen are admin-gated,
 * and teaching a phrase can never point outside the admin.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = () => stripComments(readFileSync(join(HERE, 'actions.ts'), 'utf8'));

test('both actions are server-side and admin-gated', () => {
  const s = src();
  assert.match(s, /^'use server';/, 'the file stopped being server-only');
  const deleteFn = s.slice(s.indexOf('export async function deleteSearchPhraseAction'));
  const teachFn = s.slice(s.indexOf('export async function teachSearchPhraseAction'));
  assert.match(deleteFn.slice(0, 200), /await requireAdminAction\(\)/, 'delete stopped gating on admin');
  assert.match(teachFn.slice(0, 200), /await requireAdminAction\(\)/, 'teach stopped gating on admin');
});

test('teaching a phrase re-validates the href before writing it', () => {
  const s = src();
  const teachFn = s.slice(s.indexOf('export async function teachSearchPhraseAction'));
  assert.match(
    teachFn.slice(0, 600),
    /isKnownAdminHref\(href\)/,
    'the teach action stopped checking the href against the route map — a person could now write any URL into memory',
  );
});

test('a corrected phrase is stamped learned_from admin, not ai', () => {
  const s = src();
  const teachFn = s.slice(s.indexOf('export async function teachSearchPhraseAction'));
  assert.match(teachFn, /learned_from:\s*'admin'/, 'teaching a phrase stopped stamping learned_from');
});

test('nothing here touches a table other than its own memory', () => {
  const s = src();
  const writes = [...new Set(s.match(/\.from\('([a-z_]+)'\)/g) ?? [])];
  assert.deepEqual(
    writes,
    [".from('admin_search_phrases')"],
    'the memory screen touches a table other than admin_search_phrases',
  );
});
