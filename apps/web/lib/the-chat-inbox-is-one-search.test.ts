/**
 * THE CHATS INBOX SEARCH IS THE APP'S ONE SEARCH, IN THE THUMB ROW, BEHIND ONE FUNCTION (owner 2026-10-28, verbatim:
 * *"search will always be the same"* · *"search searches for the name and the message"* · *"thumb bar"*).
 *
 * C1 matches the other side's NAME over the loaded rows; message text is slice C5, which lands inside
 * `searchInboxRows` and changes nothing here. See `lib/chat-inbox-search.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { searchInboxRows } from './chat-inbox-search';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const INBOX = 'app/dashboard/[eventId]/messages/_components/chat-inbox.tsx';
const PAGE = 'app/dashboard/[eventId]/messages/page.tsx';

const ROWS = [
  { threadId: '1', name: 'Lumière Photo', preview: 'You: casa tasting?' },
  { threadId: '2', name: 'Casa Catering', preview: 'Here it is' },
  { threadId: '3', name: 'DJ Rico', preview: 'Thank you!' },
];

test('it matches the NAME — any case, any accent, every word — and never the preview line', () => {
  assert.deepEqual(searchInboxRows(ROWS, '').map((r) => r.threadId), ['1', '2', '3']);
  assert.deepEqual(searchInboxRows(ROWS, 'lumiere').map((r) => r.threadId), ['1'], 'an accent hid a name');
  assert.deepEqual(searchInboxRows(ROWS, 'CASA cat').map((r) => r.threadId), ['2']);
  // "casa" is in row 1's preview, too: a preview match would look like message search while missing every older message.
  assert.deepEqual(searchInboxRows(ROWS, 'casa').map((r) => r.threadId), ['2'], 'the search matched a preview line');
});

test('the field is the shipped ThumbRow field, in the thumb dock, and calls the one function — once', () => {
  const s = read(INBOX);
  assert.equal((s.match(/<ThumbRow\b/g) ?? []).length, 1, 'the inbox draws its own row instead of the one ThumbRow');
  assert.equal((s.match(/<ThumbDock\b/g) ?? []).length, 1, 'the row is not on the thumb dock');
  assert.equal((s.match(/\bsearchInboxRows\(/g) ?? []).length, 1, 'the inbox filters by something other than the one search');
  assert.doesNotMatch(s, /<input\b/, 'a second, hand-rolled search field');
  // ✎ is the row's one action wherever the page offers a new message (the couple's); the supplier's Chats passes none
  // (2026-11-06 — a supplier answers chats, it does not start them), so its row is the field alone.
  assert.match(s, /action=\{\s*newMessage\s*\?\s*\{ icon: SquarePen, label: 'New message'[^}]*\}\s*:\s*null\s*\}/, '✎ is not the row\'s one action');
  const page = read(PAGE);
  assert.doesNotMatch(page, /role="search"|name="q"|matchesSearch\(/, 'the old ?q= server search is back beside the field');
});
