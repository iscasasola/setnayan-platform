/**
 * close-out-orders-and-dates-hold-final-check.test.ts — final check, area 2, fix batch 4 (25 Nov 2026).
 *
 * Nine findings: the irreversible "Close out the day" (offered too early, a failed save reported as success, the wrong
 * livestream door, no confirm), Cancel order's silent refusal, Maya's waiting dead end, the
 * souvenir total, the long-weekend claim and the find-date doors. Behaviour for the two pure helpers; comment-stripped
 * source for the wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { closeOutOpen } from '@/lib/close-out-open';
import { spanTouchesWeekend } from '@/lib/long-weekend';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string): string => stripComments(readFileSync(join(web, rel), 'utf8'));

test('A2-P8: close-out opens only once The Day has opened at the venue (an undated event stays open)', () => {
  const opens = Date.UTC(2027, 1, 22, 22, 0);
  assert.equal(closeOutOpen({ nowMs: opens - 89 * 86_400_000, opensMs: opens }), false, '89 days before');
  assert.equal(closeOutOpen({ nowMs: opens - 1, opensMs: opens }), false, 'a minute before');
  assert.equal(closeOutOpen({ nowMs: opens, opensMs: opens }), true, 'the day has opened');
  assert.equal(closeOutOpen({ nowMs: opens, opensMs: Number.NaN }), true, 'no date: nothing to wait for');
});

test('A2-P8 / G17 / G18 / G19: the close-out page and action', () => {
  const page = src('app/dashboard/[eventId]/clearance/page.tsx');
  assert.match(page, /const open = closeOutOpen\(eventClockOf\(event\)\)/);
  assert.ok(page.indexOf('{open ? (') < page.indexOf('<ConfirmForm'), 'the button is drawn only when open');
  assert.match(page, /<ConfirmForm[\s\S]*action=\{closeOutTheDay\.bind\(null, eventId\)\}/, 'one confirm first (G19)');
  assert.doesNotMatch(page, /<form action=\{closeOutTheDay/);
  assert.match(page, /href: liveStudioControllerHref\(eventId\)/, 'Stop the livestream opens the live controller (G18)');
  const action = src('app/dashboard/[eventId]/clearance/actions.ts');
  assert.match(action, /if \(!closeOutOpen\(eventClockOf\(clockRow\)\)\)/, 'the action refuses before the day too');
  const failed = action.indexOf("logQueryError('closeOutTheDay (events update)'");
  const back = action.indexOf("clearance?error=save_failed`", failed);
  const success = action.lastIndexOf('redirect(`/dashboard/${eventId}`)');
  assert.ok(failed >= 0 && back > failed && back < success, 'a failed save stays on the page and says so (G17)');
});

test('A2-F4: a refused "Cancel order" says why', () => {
  const s = src('app/dashboard/[eventId]/orders/[orderId]/page.tsx');
  assert.match(s, /cancel\?: string;/);
  assert.match(s, /search\.cancel === 'refused' \?/);
  assert.doesNotMatch(s, /\{decodeURIComponent\(search\.error\)\}/, 'the address bar is not printed as is');
});

test('A2-F5: Maya’s "Checking your payment" always has a way back, and a press once it stops asking', () => {
  const desk = src('app/pay/[reference]/_components/maya-checking.tsx');
  assert.match(desk, /label="Check again"/);
  const page = src('app/pay/[reference]/page.tsx');
  const checking = page.indexOf('<MayaChecking />');
  const back = page.indexOf('payable.back?.href ?? payable.home', checking);
  assert.ok(checking >= 0 && back > checking && back - checking < 400, 'the way back sits beside the waiting card');
});

test('A2-E1: the souvenir total is the attending headcount from the one reader', () => {
  const page = src('app/dashboard/[eventId]/guests/souvenirs/page.tsx');
  assert.match(page, /headcountForBasis\(computeGuestStats\(/);
  assert.match(page, /expected=\{expected\}/);
  const desk = src('app/dashboard/[eventId]/guests/souvenirs/_components/souvenir-desk.tsx');
  assert.doesNotMatch(desk, /const total = guests\.length/);
  assert.match(desk, /const total = expected;/);
});

test('A2-H13: "long weekend" only when the span really touches a Saturday or Sunday', () => {
  // 2027-06-14 is a Monday. A Wednesday two days after it does not touch a weekend; a Saturday two days before does.
  assert.equal(spanTouchesWeekend(new Date(2027, 5, 16), new Date(2027, 5, 14)), false, 'Wed ↔ Mon');
  assert.equal(spanTouchesWeekend(new Date(2027, 5, 12), new Date(2027, 5, 14)), true, 'Sat ↔ Mon');
  assert.equal(spanTouchesWeekend(new Date(2027, 5, 11), new Date(2027, 5, 14)), true, 'Fri ↔ Mon bridges one');
  const page = src('app/dashboard/[eventId]/date-selection/page.tsx');
  assert.doesNotMatch(page, /Math\.abs\(delta\) <= 2/);
  assert.match(page, /spanTouchesWeekend\(base, probe\)/);
});

test('A2-H16: Find your date offers the date settings only to the couple, in plain words', () => {
  const view = src('app/dashboard/[eventId]/find-date/_components/find-your-date.tsx');
  assert.doesNotMatch(view, /Set your wedding date/);
  assert.match(view, /\{canSetDate \? \(/);
  assert.match(view, /\{!canSetDate \? null : matrix\.exactDate \?/);
  assert.match(src('app/dashboard/[eventId]/find-date/page.tsx'), /canSetDate: Boolean\(coupleRes\.data\)/);
});
