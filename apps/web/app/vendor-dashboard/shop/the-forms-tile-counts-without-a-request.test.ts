/**
 * the-forms-tile-counts-without-a-request.test.ts — Shop › Makers › Forms Maker says "N saved" (Build 2 leftover, owner
 * 9 Nov "finish it"), and the count costs NO new request: it rides the Shop page's existing own-row select as an embed.
 *
 * It was left off once because a separate count read would have run on every Shop load. These checks hold both halves:
 * the count is in the ONE own-row select (retired forms filtered out), and the tile says an unread count as
 * "Couldn't load" — never "None yet" (a refused read is not an empty library).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const page = stripComments(readFileSync(join(here, 'page.tsx'), 'utf8'));
const makers = stripComments(readFileSync(join(here, '_components', 'shop-makers.tsx'), 'utf8'));

test('the forms count rides the own-row select — no new request', () => {
  const own = page.slice(page.indexOf('const ownRead = (async'), page.indexOf('const soft = new SoftReadLog'));
  assert.match(own, /\.from\('vendor_profiles'\)[\s\S]{0,200}vendor_forms!vendor_forms_vendor_profile_id_fkey\(form_id\)/, 'the forms embed left the own-row select');
  assert.match(own, /\.is\('vendor_forms\.retired_at', null\)/, 'retired forms are counted as saved');
  assert.doesNotMatch(page, /\.from\('vendor_forms'\)/, 'the Shop page reads vendor_forms on its own — a new request on every load');
  assert.match(page, /formsSaved: own && Array\.isArray\(own\.vendor_forms\) \? own\.vendor_forms\.length : null/);
  assert.match(page, /formsSaved=\{data\.formsSaved\}/, 'the count never reaches the tile');
});

test('the tile says the count honestly', () => {
  const fn = makers.slice(makers.indexOf('export function formsSub('));
  assert.match(fn, /saved === null\) return 'Couldn’t load'/, 'an unread count must say so');
  assert.match(fn, /saved === 0 \? 'None yet' : `\$\{formatCount\(saved\)\} saved`/);
  assert.match(makers, /title: 'Forms Maker', sub: formsSub\(formsSaved\)/, 'the Forms tile no longer says the count');
});
