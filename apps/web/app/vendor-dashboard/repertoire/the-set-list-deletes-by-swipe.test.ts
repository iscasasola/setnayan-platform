/**
 * the-set-list-deletes-by-swipe.test.ts — 👈 a song on "Your set list" deletes by its SWIPE, not a visible trash
 * (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), with Undo, and the
 * write is still the one `vendor_songs` delete (`removeRepertoireSong`, now answered instead of redirected).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const list = read('_components/set-list.tsx');
const page = read('page.tsx');
const actions = read('actions.ts');

test('each song row is the one SwipeToDelete, named for its song — no visible trash on the page', () => {
  assert.match(list, /<SwipeToDelete[\s\S]{0,200}?label=\{`Remove \$\{song\.title\}`\}/);
  assert.match(page, /<SetList\s+songs=\{repertoire\}/);
  assert.doesNotMatch(page, /aria-label=\{`Remove \$\{song\.title\}`\}/);
  assert.doesNotMatch(page, /action=\{removeRepertoireSong\}/, 'the page no longer posts the trash form');
});

test('the swipe deletes with Undo through the same vendor_songs delete', () => {
  assert.match(list, /deleteWithUndo\(\{[\s\S]{0,600}?commit: \(\) => removeRepertoireSong\(song\.song_id\)/);
  assert.match(list, /<UndoToastHost \/>/);
  const drop = actions.slice(actions.indexOf('export async function removeRepertoireSong'));
  assert.match(drop, /\.from\('vendor_songs'\)\s*\.delete\(\)\s*\.eq\('vendor_profile_id', profile\.vendor_profile_id\)/);
  assert.doesNotMatch(drop.slice(0, drop.indexOf('\n}\n')), /back\(|redirect\(/, 'a write landing after the Undo window never redirects');
});
