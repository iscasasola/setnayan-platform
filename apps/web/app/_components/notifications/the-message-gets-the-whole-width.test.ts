/**
 * the-message-gets-the-whole-width.test.ts — A NOTICE'S MESSAGE IS NEVER
 * SQUEEZED BESIDE ITS TOPIC (owner, live iPhone review 2026-10-04).
 *
 * The topic pill ("ABOUT REMOVING A CELEBRATION") was a `shrink-0` flex
 * sibling of the message, so on a 375 px phone it took most of the row and the
 * message wrapped one word per line. Since 2026-10-25 (the bell's pop-over) the
 * pill is gone altogether — the type is the row icon's accessible name — and the
 * message takes everything the 38px icon and the narrow time column leave.
 *
 * Also held here, from the same screenshot: the notice says "event", never
 * "celebration" (owner: "use event everywhere" — this notice's words only),
 * and "papic" typed by a person is shown as "Papic".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { NOTIFICATION_TYPE_LABEL } from '@/lib/notifications';
import { notificationEmailReason } from '@/lib/notification-email-reason';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'notifications-list.tsx'), 'utf8'));
const ITEM = SRC.slice(SRC.indexOf('function NotificationItem('));

test('nothing wide sits beside the message — only the 38px icon and the narrow time column', () => {
  assert.ok(ITEM.length > 0, 'NotificationItem is gone');
  /*
    2026-10-25 (the bell's pop-over, owner "Build it"): the topic PILL left the pixels — the type is now the icon's
    accessible name. The row is icon · message · time, and the 2026-10-04 rule still holds: the message takes every
    pixel the two fixed ends leave it. A topic word drawn beside it again would squeeze it back to one word a line.
  */
  assert.doesNotMatch(ITEM, /data-notice-topic/, 'a topic pill is drawn again — the type lives in the icon\'s aria-label');
  const icon = ITEM.indexOf('data-notice-icon');
  const message = ITEM.indexOf('data-notice-message');
  assert.ok(icon > -1 && message > icon, 'the row is no longer icon, then message');
  const iconTag = ITEM.slice(ITEM.lastIndexOf('<span', icon), icon);
  assert.match(iconTag, /h-\[38px\] w-\[38px\] flex-none/, 'the icon is no longer a fixed 38px circle');
  const msgTag = ITEM.slice(ITEM.lastIndexOf('<span', message), message);
  assert.match(msgTag, /min-w-0 flex-1/, 'the message no longer takes the rest of the row');
  // The title and the message stack: the message is its own block line under the title.
  const messageBlock = ITEM.slice(message, ITEM.indexOf('relativeTimeShort', message));
  assert.match(messageBlock, /\{n\.title\}[\s\S]*?className=\{`mt-0\.5 block truncate/, 'the message no longer sits on its own line under the title');
});

test('the team\'s typed words are shown with our names spelled our way — never a name', () => {
  assert.match(ITEM, /TEAM_TYPED_BODY\.has\(n\.type\) \? brandWords\(n\.body\)/, 'the admin\'s note is printed raw — "papic" stays lower-case');
  assert.match(SRC, /TEAM_TYPED_BODY[^=]*= new Set\(\['event_deletion_answered'\]\)/, 'the removal answer is not respelled');
  assert.doesNotMatch(ITEM, /brandWords\(n\.title\)/, 'a title — which carries event and guest NAMES — is respelled');
});

test('the removal answer says "event", never "celebration"', () => {
  assert.doesNotMatch(NOTIFICATION_TYPE_LABEL.event_deletion_answered, /celebration/i);
  assert.doesNotMatch(notificationEmailReason('event_deletion_answered'), /celebration/i);
});
