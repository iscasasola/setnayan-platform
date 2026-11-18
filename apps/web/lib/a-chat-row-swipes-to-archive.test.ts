/**
 * 👆 A CHAT ROW: TAP OPENS, SWIPE LEFT ARCHIVES (CHAT-17, W1 walk 16 Nov 2026; owner 4 Nov "rows: tap opens, swipe left
 * removes", DECISION_LOG 2026-11-03 "SWIPE LEFT TO DELETE ON EVERY LIST ROW").
 *
 * Measured live: neither the supplier's nor the couple's Chats had a swipe — only an always-visible archive icon. Both
 * lists draw `ChatInbox`, so the one swipe goes there, submitting the row's own shipped archive form.
 *
 * SABOTAGE (seen red, then restored): the `<SwipeToDelete` wrapper removed (red); the archive form drawn beside the row
 * again, not hidden (red).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const inbox = () =>
  stripComments(readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'messages', '_components', 'chat-inbox.tsx'), 'utf8'));

test('the inbox row is the ONE swipe, and its remove is the row’s own archive form', () => {
  const s = inbox();
  assert.match(s, /import \{ SwipeToDelete \} from '@\/app\/_components\/swipe-to-delete';/);
  assert.equal((s.match(/<SwipeToDelete\b/g) ?? []).length, 1, 'a chat row is not the one swipe');
  assert.match(s, /word=\{r\.archived \? 'Unarchive' : 'Archive'\}/);
  assert.match(s, /querySelector<HTMLFormElement>\(`\[data-row-archive="\$\{r\.threadId\}"\] form`\)\?\.requestSubmit\(\)/, 'the swipe does not archive');
  assert.match(s, /<div hidden data-row-archive=\{r\.threadId\}>\s*\{r\.archive\}\s*<\/div>/, 'the archive icon is drawn beside the row again');
});
