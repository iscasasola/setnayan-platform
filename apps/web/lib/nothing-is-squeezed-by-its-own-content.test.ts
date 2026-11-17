/**
 * NOTHING IS SQUEEZED BY ITS OWN CONTENT — two live faults, one shape (17 Nov 2026).
 *
 * 1. THE SHOP PAGE'S SERVICE CARDS. From md the services list sits in the column BESIDE the shop's 300/360 px card,
 *    but its column count was set by the WINDOW (`sm:grid-cols-2 lg:grid-cols-3`). At an 800 px window that cut a
 *    424 px column into 206 px cards and the face's words (`ServiceFace`, an 80 px cover + the words) got 90 px —
 *    "Includes: 2 main speakers + subwoofer…" one or two words a line; at 1024 it was 177 px cards and 61 px of words.
 *    Measured live on /testnayanw1lights. The grid now reads its OWN width: auto-fill, each card at least 300 px.
 *
 * 2. THE CHAT BUBBLE. Each message <li> is a column flex aligned end/start, so the row inside it shrank to its
 *    content, and the bubble's `max-w-[75%]` then resolved against that shrunk row — "Hello" drew as "He / llo"
 *    (measured with the live CSS: bubble 44 px, two lines; with the row `w-full`, 59 px, one line).
 *
 * Source-text guard (the repo's pattern): it reads the two class strings and fails if either fault's shape returns.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(resolve(WEB, p), 'utf8'));

test('the shop page service grid sets its columns from its own width, not the window', () => {
  const gallery = src('app/v/[slug]/_components/services-gallery.tsx');
  const ul = gallery.match(/<ul\b[^>]*data-services-one-grid[^>]*>/);
  assert.ok(ul, 'the one services grid (data-services-one-grid) is gone');
  const tag = ul[0];
  assert.doesNotMatch(
    tag,
    /\b(?:sm|md|lg|xl|2xl):grid-cols-/,
    `the services grid picks its column count from a window breakpoint again — beside the shop card that squeezes each card to ~200 px: ${tag}`,
  );
  const min = tag.match(/grid-cols-\[repeat\(auto-(?:fill|fit),minmax\(min\(100%,(\d+)px\),1fr\)\)\]/);
  assert.ok(min, `the services grid no longer auto-fills from its own width: ${tag}`);
  assert.ok(Number(min[1]) >= 280, `a service card may be ${min[1]} px — under 280 px the face's words wrap a word a line`);
});

test("a chat bubble's 75% is of the thread, not of a row shrunk to the bubble", () => {
  const stream = src('app/_components/chat-message-stream.tsx');
  // The message row: the flex that holds the face and the bubble, inside the column-flex <li data-chat-bubble>.
  const rows = stream.match(/className=\{`flex max-w-full [^`]*items-end gap-1\.5 \$\{mine \? 'justify-end' : ''\}`\}/g) ?? [];
  assert.equal(rows.length, 1, `expected the ONE message row, found ${rows.length}`);
  assert.match(
    rows[0],
    // NOT `\bw-full\b` — that matches inside `max-w-full` (a hyphen is a word boundary), which is what this row
    // already had while broken. Sabotage-measured.
    /[\s'`]w-full[\s'`]/,
    `the message row is not full width — the bubble's max-w-[75%] resolves against its own text again ("He / llo"): ${rows[0]}`,
  );
  assert.match(stream, /max-w-\[75%\]/, 'the bubble lost its 75% cap — this guard needs re-reading');
});
