/**
 * 🔒 AN EMPTY PORTFOLIO LOOKS FINISHED (Build 3 Lane E item 1, owner 9 Nov: *"Portfolio does not look good empty"*).
 * Every section draws, empty or not, as ONE card shape (`PortfolioCard`): one honest line and at most one door — no
 * grey text wall, no "0 · 0 · 0". A refused read says so, never "none yet". (Read from source: the groups import server
 * actions, which a unit render cannot load.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/collections/_components/portfolio-groups.tsx'), 'utf8'));

test('every section is the one card shape', () => {
  for (const id of ['songs', 'all', 'stories']) {
    assert.match(SRC, new RegExp(`<PortfolioCard\\s+id="${id}"`), `${id} is not drawn as a card`);
  }
  assert.match(SRC, /<PortfolioCard id=\{id\}/, 'the album groups (events · services · inspiration) are not cards');
  assert.match(SRC, /data-portfolio-group="video"\s+data-portfolio-card=""/, 'Video links is not a card');
  assert.doesNotMatch(SRC, /border-b border-ink\/10 pb-1\.5 pt-4/, 'a bare grey header row (the old text wall) is back');
});

test('each empty card says one line and offers its one door', () => {
  for (const door of ['Open Clients', 'Add a cover to a card', 'Add a song']) {
    assert.match(SRC, new RegExp(`label: '${door}'`), `the empty door "${door}" is gone`);
  }
  assert.match(SRC, /INSPIRATION_LIBRARY_ROW\.label, href: INSPIRATION_LIBRARY_HREF/, 'the inspiration card lost its door');
  assert.match(SRC, /"Nothing yet · the ＋ below adds photos"/, 'All photos no longer points at the one add');
  assert.match(SRC, /function EmptyLine\(/);
  assert.equal((SRC.match(/<ActionButton\b/g) ?? []).length, 1, 'an empty card draws more than one door');
});

test('a refused read says so — events · services · inspiration · stories · songs', () => {
  assert.match(SRC, /data-portfolio-group-unread=\{id\}/);
  assert.match(SRC, /data-portfolio-group-unread="stories"/);
  assert.match(SRC, /data-portfolio-group-unread="songs"/);
});

test('Moodboard library (on the library row — one door) and Song bank are in Portfolio, for their own shops only', () => {
  assert.match(SRC, /Moodboard library · \$\{formatCount\(moodboard\.looks\)\}/, 'the library row no longer counts the sets');
  const page = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/collections/page.tsx'), 'utf8'));
  assert.match(page, /isMusicToolCategory\(services\)/, 'the Song bank section is shown to non-music shops');
  assert.match(page, /d\.input\.moodboard && d\.input\.moodboard\.allowed/, 'the Moodboard library section ignores its access rule');
});
