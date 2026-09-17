/**
 * the-countdown-ends-at-the-venue.test.ts — DAY-32a.
 *
 * `events.event_date` is a DATE column, so it reaches the guest page as
 * `"2027-02-14"`. The widget did `new Date(targetIso)`, and ECMAScript parses a
 * DATE-ONLY string as **UTC** — putting the target at 08:00 in Manila instead of
 * midnight.
 *
 * 🔑 THE ROW HAD THE SIGN BACKWARDS. It was filed as "the countdown ends 8 hours
 * EARLY". It ends eight hours **LATE**: it over-counts, then hangs on into the
 * morning of the wedding instead of retiring at the start of the day. The two
 * have opposite fixes — anchor the date to the venue, never shift it — which is
 * why the sign is asserted below and not just the magnitude.
 *
 * 🔑 AND THE WIDGET WAS NEVER WRONG. `target - Date.now()` is instant arithmetic
 * and was always correct; the entire defect was the value handed to it. Anyone
 * opening `countdown.tsx` to find the bug finds clean code and marks the row
 * false. **Measure where a value ENTERS, not where it is used.**
 *
 * ⚠ THESE ASSERTIONS ARE ABSOLUTE INSTANTS, NOT LOCAL RENDERINGS, so the file
 * cannot pass or fail because of the zone the runner happens to be in — which is
 * the same class of mistake it exists to catch.
 *
 * 🛡 Sabotage-checked, each mutation still parsing and still typechecking, with
 * the measured numbers printed before any verdict is read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { countdownTargetMs } from '@/lib/countdown-target';

const HERE = dirname(fileURLToPath(import.meta.url));
const widget = stripComments(
  readFileSync(join(HERE, '..', 'app', '[slug]', '_components', 'countdown.tsx'), 'utf8'),
);

const MANILA = 'Asia/Manila';
const WEDDING = '2027-02-14';
/** Manila midnight on the wedding day, as a true instant. */
const LOCAL_MIDNIGHT = Date.parse('2027-02-13T16:00:00.000Z');
/** What the UTC parse produced — 08:00 Manila. */
const THE_OLD_WRONG_TARGET = Date.parse('2027-02-14T00:00:00.000Z');

test('a DATE-only wedding zeroes at the venue’s own midnight', () => {
  const got = countdownTargetMs(WEDDING, MANILA);
  console.log(`  target: ${new Date(got!).toISOString()}  (local midnight: ${new Date(LOCAL_MIDNIGHT).toISOString()})`);
  assert.equal(got, LOCAL_MIDNIGHT);

  const lateBy = (THE_OLD_WRONG_TARGET - LOCAL_MIDNIGHT) / 3_600_000;
  console.log(`  the UTC parse was LATE by ${lateBy} hours`);
  assert.equal(lateBy, 8, 'the reference numbers in this file have drifted');
  assert.notEqual(got, THE_OLD_WRONG_TARGET, 'the date is being parsed as UTC again');
  // The direction, stated: the honest target is EARLIER than the UTC one.
  assert.ok(got! < THE_OLD_WRONG_TARGET, 'the fix shifted the clock the wrong way');
});

test('what a guest is shown, at Manila midnight the day before', () => {
  const now = Date.parse('2027-02-12T16:00:00.000Z'); // 13 Feb 00:00 Manila
  const ms = countdownTargetMs(WEDDING, MANILA)! - now;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  console.log(`  shown: ${days}d ${hours}h  (the UTC parse showed 1d 8h)`);
  assert.deepEqual({ days, hours }, { days: 1, hours: 0 });
});

test('a zone west of UTC is anchored too — the rule is the venue, not an offset', () => {
  /*
   * Asia/Manila is UTC+8, so a bug that ADDED eight hours would look identical to
   * a correct answer under a +8-only test. A negative-offset venue is the fixture
   * that tells "anchor to the venue" apart from "add eight hours".
   */
  const ny = countdownTargetMs(WEDDING, 'America/New_York');
  console.log(`  New York target: ${new Date(ny!).toISOString()}`);
  assert.equal(ny, Date.parse('2027-02-14T05:00:00.000Z')); // EST = UTC−5
  assert.ok(ny! > THE_OLD_WRONG_TARGET, 'a western venue must zero LATER than UTC midnight');
});

test('a value that already carries a time is an instant already, and is left alone', () => {
  const exact = '2027-02-14T14:30:00+08:00';
  assert.equal(countdownTargetMs(exact, MANILA), Date.parse(exact));
  // A trailing Z is explicit UTC and must survive as itself.
  assert.equal(countdownTargetMs('2027-02-14T00:00:00Z', MANILA), THE_OLD_WRONG_TARGET);
});

test('an unusable date draws NO clock rather than a confident wrong one', () => {
  for (const bad of [null, undefined, '', '   ', 'soon', '2027-13-45x']) {
    assert.equal(countdownTargetMs(bad as string | null, MANILA), null, `"${String(bad)}" produced a target`);
  }
  console.log('  unusable inputs → null (the widget renders nothing)');
  assert.match(
    widget,
    /if \(target === null\) return null;/,
    'the widget no longer refuses to draw a clock it cannot anchor',
  );
});

test('the widget asks the resolver — it does not parse the date itself', () => {
  const direct = widget.match(/new Date\(targetIso\)/g)?.length ?? 0;
  console.log(`  direct \`new Date(targetIso)\` in the widget: ${direct}`);
  assert.equal(direct, 0, 'the widget is parsing the date itself again — that IS the defect');
  assert.match(widget, /countdownTargetMs\(targetIso, timeZone\)/);
});
