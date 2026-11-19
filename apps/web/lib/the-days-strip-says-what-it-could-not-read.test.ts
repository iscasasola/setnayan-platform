/**
 * 🔎 THE DAYS STRIP SAYS WHAT IT COULD NOT READ (review HOLD on #7976, 19 Nov 2026).
 *
 * The strip's days come from two reads the client page already makes: the appointments (meetings) and the payment
 * plan. A refused read left its list empty, and the strip then drew "Nothing with <client> this day" — the same words
 * as a day that truly has nothing. A failure that renders like emptiness.
 *
 *   1. the rule: an unread list is named, and an empty day never says "Nothing" while a list is unread;
 *   2. the page KEEPS the appointments error and hands both read results to the strip;
 *   3. the strip draws the unread line and the unread empty day from the rule — not its own words.
 *
 * SABOTAGE (19 Nov): dropping `error: apptError` from the page → test 2 RED; making `emptyDayLine` ignore `unread` →
 * test 1 RED; putting "Nothing with {eventName} this day." back in the strip → test 3 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { clientScheduleDays, emptyDayLine, scheduleDaysUnread, unreadDaysLine } from './schedule-days';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));
const CLIENT = 'app/vendor-dashboard/clients/[eventId]';

test('1 · a refused read is named — and an empty day never says "Nothing" while a list is unread', () => {
  assert.deepEqual(scheduleDaysUnread({ meetingsRead: true, paymentsRead: true }), []);
  assert.deepEqual(scheduleDaysUnread({ meetingsRead: false, paymentsRead: true }), ['meetings']);
  assert.deepEqual(scheduleDaysUnread({ meetingsRead: true, paymentsRead: false }), ['payments']);
  assert.deepEqual(scheduleDaysUnread({ meetingsRead: false, paymentsRead: false }), ['meetings', 'payments']);

  assert.equal(unreadDaysLine([]), null, 'everything read: no line');
  assert.match(unreadDaysLine(['meetings'])!, /^Meetings couldn’t load/);
  assert.match(unreadDaysLine(['payments'])!, /^Payment days couldn’t load/);
  assert.match(unreadDaysLine(['meetings', 'payments'])!, /^Meetings and payment days couldn’t load/);

  // THE FAILING PATH: the appointments read was refused, so the meetings list is empty and the day has no rows.
  const items = clientScheduleDays({ eventDate: '2026-11-08', chapters: [], meetings: [], payments: [] });
  assert.equal(items.filter((i) => i.day === '2026-11-05').length, 0, 'the refused read leaves the day empty');
  const refused = emptyDayLine('Reyes & Santos', scheduleDaysUnread({ meetingsRead: false, paymentsRead: true }));
  assert.equal(refused.unread, true);
  assert.doesNotMatch(refused.line, /Nothing/, 'a refused read was drawn as an empty day');
  assert.match(refused.line, /Couldn’t load this day’s meetings/);
  // And the honest empty day still says so.
  assert.deepEqual(emptyDayLine('Reyes & Santos', []), { line: 'Nothing with Reyes & Santos this day.', unread: false });
});

test('2 · the client page keeps the appointments error and hands both read results to the strip', () => {
  const page = read(`${CLIENT}/page.tsx`);
  assert.match(page, /\{ data: apptRows, error: apptError \}/, 'the appointments read drops its error again');
  assert.match(page, /if \(apptError\) \{\s*appointmentsReadFailed = true;/);
  const strip = page.slice(page.indexOf('<ScheduleDays'), page.indexOf('</ScheduleDays>'));
  assert.match(strip, /unread=\{scheduleDaysUnread\(\{ meetingsRead: !appointmentsReadFailed, paymentsRead: planReadComplete \}\)\}/, 'the strip is not told what could not be read');
});

test('3 · the strip draws the unread line and the unread empty day from the rule', () => {
  const strip = read(`${CLIENT}/_components/schedule-days.tsx`);
  assert.match(strip, /const unreadLine = unreadDaysLine\(unread\);/);
  assert.match(strip, /const emptyDay = emptyDayLine\(eventName, unread\);/);
  assert.match(strip, /\{unreadLine \? \(\s*<p role="status"[^>]*data-schedule-days-unread=/, 'the strip does not say a list is unread');
  assert.match(strip, /emptyDay\.unread \? \(\s*<p role="status"[^>]*data-schedule-day-empty="unread">/, 'the empty day does not say "couldn’t load"');
  assert.doesNotMatch(strip, /Nothing with \{eventName\}/, 'the strip writes its own "Nothing…" again — it cannot know the read failed');
});
