/**
 * groups-are-on-the-list.test.ts — People renders a Groups section in its main list.
 *
 * Owner, 2026-10-25: "finding groups is so hard". Groups lived only behind the ≡ button → "Groups"; nothing on the
 * page said they existed. prototypes/groups_on_people_2026-10-25 adds ONE folded section to the list: "Groups · N",
 * after Loved ones and before the connection tree, drawn like Loved ones — "New group" at its head, then one row per
 * group, each opening the group page. The ≡ "Groups" view stays.
 *
 * Held, comments stripped first:
 *   1. the page hands the roster a `groups` section, between `alaga` and `tree`, rendering the real reader;
 *   2. the roster draws it with the Groups icon (a fold, like Loved ones);
 *   3. the section opens with "New group" (the page that creates one) BEFORE its rows, and each row opens
 *      `/dashboard/samahan/<id>`;
 *   4. the ≡ Groups view is still there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const ROSTER = stripComments(readFileSync(join(HERE, '_components', 'people-roster-view.tsx'), 'utf8'));
const SECTION = stripComments(readFileSync(join(HERE, '_components', 'samahan-people-section.tsx'), 'utf8'));

test('People hands its list a Groups section — after Loved ones, before the tree', () => {
  const extra = PAGE.slice(PAGE.indexOf('extra={['), PAGE.indexOf(']}', PAGE.indexOf('extra={[')));
  const alaga = extra.indexOf("key: 'alaga'");
  const groups = extra.indexOf("key: 'groups'");
  const tree = extra.indexOf("key: 'tree'");
  console.log(`# extra sections at alaga@${alaga} · groups@${groups} · tree@${tree}`);
  assert.ok(groups >= 0, 'the Groups section is not on the People list');
  assert.ok(alaga < groups && groups < tree, 'Groups must sit after Loved ones and before the tree');
  assert.match(extra.slice(groups, tree), /label: 'Groups'/);
  assert.match(extra.slice(groups, tree), /<GroupsFoldSection\b/, 'the section does not render the real reader');
});

test('the roster draws it as a fold with the Groups icon', () => {
  assert.match(ROSTER, /key: 'alaga' \| 'groups' \| 'tree'/);
  assert.match(ROSTER, /e\.key === 'groups' \? UsersRound/);
});

test('"New group" heads the section; each row opens the group page', () => {
  const list = SECTION.slice(SECTION.indexOf('export function GroupsFoldList('));
  const door = list.indexOf('href="/dashboard/samahan/new"');
  const row = list.indexOf('href={`/dashboard/samahan/${g.communityId}`}');
  assert.ok(door >= 0 && list.includes('New group'), 'the section lost its "New group" door');
  assert.ok(row >= 0, 'a group row no longer opens the group page');
  assert.ok(door < row, '"New group" must head the section, not trail its rows');
});

test('the ≡ Groups view stays', () => {
  assert.match(PAGE, /\{view === 'samahan' \? \(/, 'the ≡ Groups view is gone');
});
