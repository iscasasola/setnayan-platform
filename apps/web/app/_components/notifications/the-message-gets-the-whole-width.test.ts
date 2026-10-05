/**
 * the-message-gets-the-whole-width.test.ts — A NOTICE'S MESSAGE IS NEVER
 * SQUEEZED BESIDE ITS TOPIC (owner, live iPhone review 2026-10-04).
 *
 * The topic pill ("ABOUT REMOVING A CELEBRATION") was a `shrink-0` flex
 * sibling of the message, so on a 375 px phone it took most of the row and the
 * message wrapped one word per line. The topic now sits on its own line, the
 * message below it at full width, and the time and buttons under that.
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

test('the topic and the message are not side by side in one flex row', () => {
  assert.ok(ITEM.length > 0, 'NotificationItem is gone');
  const li = ITEM.slice(ITEM.indexOf('<li'), ITEM.indexOf('>', ITEM.indexOf('className={`', ITEM.indexOf('<li'))));
  assert.doesNotMatch(li, /\bflex\b/, 'the notice is a flex row again — the topic will squeeze the message');
  const topic = ITEM.indexOf('data-notice-topic');
  const message = ITEM.indexOf('data-notice-message');
  assert.ok(topic > -1 && message > topic, 'the topic no longer sits ABOVE the message');
  // The message block is the item's own child, not wrapped together with the topic.
  const between = ITEM.slice(topic, message);
  assert.match(between, /<\/span>\s*<div className="mt-2 min-w-0"/, 'something now sits between the topic line and the message');
  assert.doesNotMatch(ITEM.slice(ITEM.indexOf('<span'), topic), /shrink-0/, 'the topic is shrink-0 again');
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
