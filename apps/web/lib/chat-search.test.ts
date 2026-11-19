/**
 * 🔎 SEARCH INSIDE ONE CHAT · 👀 SEEN BY (Unichat part D, 20 Nov 2026; approved drawing `UNICHAT-LIVE-2026-11-19.html`:
 * "the magnifier in the header. ↑ ↓ step through '3 of 7'" · "'Seen · Claire, Liza' sits under your latest message").
 *
 * What would silently undo it:
 *   1. the count lies — "3 of 7" past either end, or a number while the box is empty;
 *   2. the search box is on the page before it is asked for (owner 19 Nov: "search is an icon until tapped"), or it
 *      opens without the keyboard (the focus must happen INSIDE the tap);
 *   3. the search touches the conversation's own nodes (React owns every line) instead of the browser's highlight;
 *   4. "Seen" invents a name — the stored marker has none, so a page-loaded "Seen" stays the plain word.
 *
 * Run: cd apps/web && npx tsx --test lib/chat-search.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { matchesIn, searchCountLine, seenLine, stepHit } from './chat-search';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const STREAM = stripComments(readFileSync(join(HERE, '..', 'app/_components/chat-message-stream.tsx'), 'utf8'));
const SEARCH = stripComments(readFileSync(join(HERE, 'chat-search.ts'), 'utf8'));

test('1 · matches ignore case and never overlap; the count wraps and is silent on an empty box', () => {
  assert.deepEqual(matchesIn('Lights, lights and more LIGHTS', 'lights'), [0, 8, 24]);
  assert.deepEqual(matchesIn('aaaa', 'aa'), [0, 2]);
  assert.deepEqual(matchesIn('anything', '   '), []);
  assert.equal(stepHit(7, 7), 0);
  assert.equal(stepHit(-1, 7), 6);
  assert.equal(stepHit(3, 0), 0);
  assert.equal(searchCountLine('lights', 2, 7), '3 of 7');
  assert.equal(searchCountLine('lights', 7, 7), '1 of 7');
  assert.equal(searchCountLine('zzz', 0, 0), 'No matches');
  assert.equal(searchCountLine('  ', 0, 0), '');
});

test('2 · search is an icon until tapped — and the tap itself raises the keyboard', () => {
  assert.match(STREAM, /aria-label="Search in this chat"[^>]*data-chat-search-open=""/, 'the magnifier is gone');
  // The box exists only while searching…
  assert.match(STREAM, /const searchBar = search \? \(/);
  // …and it is focused inside the press (flushSync puts it on the page before the handler returns).
  assert.match(STREAM, /flushSync\(\(\) => setSearch\(\{ q: '', i: 0 \}\)\);\s*searchInputRef\.current\?\.focus\(\);/);
  for (const name of ['Close search', 'Previous match', 'Next match']) assert.ok(STREAM.includes(`aria-label="${name}"`), `no "${name}"`);
  // Every control of the bar is a full 44-px press.
  assert.match(STREAM, /SEARCH_ICON_BUTTON = 'sn-press grid h-11 w-11 /);
});

test('3 · what is found is tinted by the browser’s highlight — no node of the conversation is written', () => {
  assert.match(SEARCH, /CSS as unknown as \{ highlights\?: HighlightRegistry \}/);
  assert.ok(!/innerHTML|splitText|replaceChild|createElement\(/.test(SEARCH), 'the search edits the conversation’s own nodes');
  const css = readFileSync(join(HERE, '..', 'app/globals.css'), 'utf8');
  assert.match(css, /::highlight\(sn-chat-search\)/);
  assert.match(css, /::highlight\(sn-chat-search-cur\)/);
});

test('4 · "Seen · Claire, Liza" names only those who said so on the chat’s channel; no names → the plain word', () => {
  assert.equal(seenLine('Seen', []), 'Seen');
  assert.equal(seenLine('Seen', ['Claire', 'Liza']), 'Seen · Claire, Liza');
  assert.equal(seenLine('Seen', ['Claire', 'Claire', ' ']), 'Seen · Claire');
  assert.equal(seenLine('Seen', ['A', 'B', 'C', 'D', 'E']), 'Seen · A, B, C +2');
  // The read broadcast says WHO read; the stream keeps each reader's latest and names those at or after your message.
  assert.match(STREAM, /payload: \{ side: viewerRole, at, by: currentUserId \}/);
  assert.match(STREAM, /seenLine\(LAST_LINE_WORDS\.seen, \[\.\.\.seenBy\]\.filter\(\(\[, at\]\) => Date\.parse\(at\) >= Date\.parse\(ownLast\.created_at\)\)/);
});
