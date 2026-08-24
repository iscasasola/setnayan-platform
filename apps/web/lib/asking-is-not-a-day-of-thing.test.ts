/**
 * A COORDINATOR CAN ASK BEFORE THE WEDDING, NOT ONLY ON IT.
 *
 * The owner's rule for the guest list is "only the owner of the event and
 * coordinator (by request)". The request machinery all shipped — the ask, the
 * host's line-by-line answer, the grant — but the only screen that mounted the
 * ask was the LIVE FLOOR CONSOLE, and that page redirects unless the booking
 * is dated today.
 *
 * 🔑 A HANDLE THAT EXISTS FOR ONE DAY IS THE GATE-WITH-NO-HANDLE FAMILY IN A
 * DIFFERENT COSTUME. A planner working a wedding for six months could not ask
 * for the guest list until the morning of it — the one day nobody wants to be
 * waiting on an answer.
 *
 * These assertions read the SOURCE because the thing being proved is where a
 * component is mounted, which no runtime test on a pure function can see.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LIVE_CONSOLE = 'app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx';
const CLIENT_CARD = 'app/vendor-dashboard/clients/[eventId]/page.tsx';
const ASK = 'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/ask-access.tsx';

/** Source with comments stripped — a rule that matches a comment explaining
 *  the rule is a rule that cannot fail. */
function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  let out = '';
  let i = 0;
  let inBlock = false;
  let inLine = false;
  while (i < raw.length) {
    const two = raw.slice(i, i + 2);
    if (!inBlock && !inLine && two === '/*') { inBlock = true; i += 2; continue; }
    if (inBlock && two === '*/') { inBlock = false; i += 2; continue; }
    if (!inBlock && !inLine && two === '//') { inLine = true; i += 2; continue; }
    if (inLine && raw[i] === '\n') { inLine = false; out += '\n'; i += 1; continue; }
    if (!inBlock && !inLine) out += raw[i];
    i += 1;
  }
  return out;
}

test('THE PREMISE: the live console really is day-gated', () => {
  // If this ever stops being true the mount below is redundant rather than
  // load-bearing, and whoever changed it should be told by a red test.
  const src = code(LIVE_CONSOLE);
  assert.ok(
    src.includes("booking.bookedDate !== today"),
    'the live console no longer refuses a booking that is not today — re-read why the ask was moved',
  );
  assert.ok(src.includes("redirect('/vendor-dashboard/on-the-day')"));
});

test('the ask is mounted on a screen that is NOT day-gated', () => {
  const src = code(CLIENT_CARD);
  assert.ok(src.includes('<AskAccess'), 'the client card must mount the ask');
  assert.ok(
    !src.includes('bookedDate !== today'),
    'the client card must not have inherited the day gate',
  );
  // It is offered to booked suppliers only — the server action re-checks this,
  // so the display rule must agree with it rather than contradict it.
  assert.ok(src.includes('isBooked && (askableAreas.length > 0'));
});

test('the ask component says nothing that only makes sense on the day', () => {
  // It is mounted twice now. Copy naming "the day", or promising tools appear
  // "here", is wrong on one of the two screens.
  const src = code(ASK);
  for (const phrase of ['appear here', 'on the day']) {
    assert.ok(!src.includes(phrase), `"${phrase}" reads wrong on the client card`);
  }
});

test('the four askable areas are one list, not two', () => {
  // Both mounts must offer the same set, or a coordinator sees different
  // options depending on which screen they opened.
  const { FLOOR_REQUESTABLE_AREAS } = require('./floor-command') as {
    FLOOR_REQUESTABLE_AREAS: readonly string[];
  };
  assert.ok(FLOOR_REQUESTABLE_AREAS.includes('guest_list'), 'the owner ruled on this one by name');
  assert.equal(FLOOR_REQUESTABLE_AREAS.length, 4);
  // Derived, not typed out: BOTH mounts filter the same exported constant, so
  // a coordinator cannot be offered a different set depending on which screen
  // they opened. (The dead loop that used to sit here read a path that does
  // not exist and threw — a search that cannot match is not a negative result,
  // and this one was not even a search.)
  const FLOOR_CONSOLE_MOUNT =
    'app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/floor-command.tsx';
  let filtering = 0;
  for (const path of [FLOOR_CONSOLE_MOUNT, CLIENT_CARD]) {
    if (code(path).includes('FLOOR_REQUESTABLE_AREAS.filter')) filtering += 1;
  }
  assert.equal(filtering, 2, 'both mounts must derive the offer from the shared list');
});
