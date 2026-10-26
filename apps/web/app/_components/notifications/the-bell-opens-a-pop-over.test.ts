/**
 * the-bell-opens-a-pop-over.test.ts — THE BELL OPENS A POP-OVER, AND A NOTICE IS ONE PRESS.
 *
 * Owner, 2026-10-25, over the notifications page, the bell with "9+" and the account pop-over: *"shouldn't it be a
 * pop up to see the notifications and an option to view all?"* · on the full page: *"view all notifications
 * simpler"* · approving `Setnayan/prototypes/notifications_popover_2026-10-25/index.html`: *"Build it"*.
 *
 * What this holds, each against the component that draws it (comments stripped first — the docblocks QUOTE the old
 * shapes to explain why they went, and a raw scan would read that prose as the defect):
 *   1 · the bell is a BUTTON that opens a dialog — not a link that leaves the page;
 *   2 · the pop-over closes on the dark: it sits over `OverlayBackdrop` whose press closes it (the 25 Oct tap-out
 *       rule), with `useModalA11y` (Esc · focus · the page held still);
 *   3 · "View all" is in the pop-over, and goes to the bell's own `href` (couple · supplier · console);
 *   4 · a row is ONE press: one form, whose one submit button is the whole row, returning to the notice's own page;
 *   5 · no per-row "Open" or "Mark read" button, and no coloured type pill — Mark read ALONE is the swipe / the ⋯;
 *   6 · a refused read is never drawn as "You're all caught up".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const BELL = stripComments(readFileSync(join(HERE, '..', 'unread-bell-badge.tsx'), 'utf8'));
const LIST = stripComments(readFileSync(join(HERE, 'notifications-list.tsx'), 'utf8'));
const ITEM = LIST.slice(LIST.indexOf('function NotificationItem('), LIST.indexOf('function RowButton('));
const ROW_BUTTON = LIST.slice(LIST.indexOf('function RowButton('), LIST.indexOf('export function NotificationsHead('));

/** The JSX the bell RETURNS (after its last `return (`), so a helper's markup cannot satisfy a check. */
const BELL_RETURN = BELL.slice(BELL.lastIndexOf('  return ('));
const PANEL = BELL.slice(BELL.indexOf('function renderPanel()'), BELL.lastIndexOf('  return ('));

test('1 · the bell is a button that opens a dialog, not a link', () => {
  assert.ok(BELL_RETURN.length > 0 && PANEL.length > 0, 'anchors moved: the bell\'s return or renderPanel() is gone');
  const trigger = BELL_RETURN.slice(0, BELL_RETURN.indexOf('<Bell '));
  assert.match(trigger, /<button\b[\s\S]*?aria-haspopup="dialog"/, 'the bell is not a <button aria-haspopup="dialog">');
  assert.match(trigger, /onClick=\{\(\) => setOpen\(/, 'pressing the bell no longer opens anything');
  assert.doesNotMatch(trigger, /<Link\b|<a\b/, 'the bell is a link again — it leaves the page instead of opening the pop-over');
  assert.match(PANEL, /role="dialog"[\s\S]*?aria-modal="true"/, 'the pop-over is not a modal dialog');
});

test('2 · the pop-over closes on the dark (OverlayBackdrop) and is a managed modal', () => {
  assert.match(
    BELL_RETURN,
    /createPortal\([\s\S]*?<OverlayBackdrop onClose=\{close\}[\s\S]*?\{renderPanel\(\)\}/,
    'the pop-over is not over the one backdrop whose press closes it — a tap outside would do nothing',
  );
  assert.match(BELL, /function close\(\) \{\s*setOpen\(false\);?\s*\}/, 'close() no longer closes the pop-over');
  assert.match(BELL, /useModalA11y\(\{ open, onClose: close, containerRef: panelRef \}\)/, 'the pop-over lost useModalA11y');
  assert.match(PANEL, /ref=\{panelRef\}/, 'useModalA11y is not attached to the dialog');
});

test('3 · "View all" is in the pop-over and goes to the bell\'s own page', () => {
  assert.match(PANEL, /<Link\s+href=\{href\}[\s\S]*?View all/, '"View all" is gone from the pop-over, or no longer goes to href');
  // Kept in the empty state too: the drawing's empty sheet still has it (older notices live on the page).
  const empty = PANEL.indexOf("You\\u2019re all caught up");
  assert.ok(empty > -1, 'the empty words moved');
  assert.ok(PANEL.lastIndexOf('View all') > empty, '"View all" no longer follows the list and its empty state');
});

test('4 · a row is one press: one form, whose one submit button is the whole row', () => {
  assert.ok(ITEM.length > 0 && ROW_BUTTON.length > 0, 'anchors moved: NotificationItem or RowButton is gone');
  assert.match(
    ITEM,
    /<form\s+action=\{markNotificationRead\}[\s\S]*?name="return_to" value=\{n\.related_url \?\? returnTo\}[\s\S]*?<RowButton/,
    'the row is not a markNotificationRead form returning to the notice\'s own page (related_url ?? this page)',
  );
  assert.match(ROW_BUTTON, /<button\s+type="submit"[\s\S]*?w-full/, 'the row is not one full-width submit button');
  // Everything the row shows sits inside that one button.
  const rowAt = ITEM.indexOf('<RowButton');
  const rowEnd = ITEM.indexOf('</RowButton>');
  const row = ITEM.slice(rowAt, rowEnd);
  for (const part of ['data-notice-icon', '{n.title}', 'relativeTimeShort(', 'data-notice-dot']) {
    assert.ok(row.includes(part), `${part} is no longer inside the one press`);
  }
  assert.doesNotMatch(row, /<button\b|<a\b|<Link\b/, 'a second control sits inside the row');
});

test('5 · no per-row "Open" or "Mark read" button, no type pill — mark-read alone is the swipe and the ⋯', () => {
  assert.doesNotMatch(ITEM, />\s*Open\s*</, 'a per-row "Open" button is back');
  assert.doesNotMatch(LIST, /NOTIFICATION_TYPE_TONE/, 'the coloured type pill is back');
  assert.doesNotMatch(ITEM, /SubmitButton/, 'a per-row SubmitButton is back');
  // "Mark read" appears exactly twice: behind the swipe, and as the ⋯ menu's one item.
  const marks = ITEM.match(/>\s*Mark read\s*</g) ?? [];
  assert.equal(marks.length, 2, `"Mark read" is drawn ${marks.length} times — only the swipe and the ⋯ menu may say it`);
  assert.match(ITEM, /data-notice-swipe-mark[\s\S]*?Mark read/, 'the phone swipe no longer reveals Mark read');
  assert.match(ITEM, /role="menu"[\s\S]*?role="menuitem"[\s\S]*?Mark read/, 'the desktop ⋯ menu lost its one item');
  assert.match(ITEM, /lg:group-hover:inline-flex/, 'the ⋯ is no longer a desktop hover control');
});

test('6 · a refused read is not drawn as "all caught up"', () => {
  assert.match(PANEL, /rows === null \? \(/, 'the pop-over no longer tells a failed read apart from an empty one');
  const failed = PANEL.slice(PANEL.indexOf('rows === null ? ('), PANEL.indexOf('<NotificationsList'));
  assert.doesNotMatch(failed, /caught up/, 'a failed read says "all caught up"');
});
