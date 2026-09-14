/**
 * The window the owner set — and the five readers that must all honour it.
 *
 * Owner 2026-09-14: "coordinators will only have access until event day. but no
 * access after", then "grace period until 7 days after event".
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  delegateAccessHasExpired,
  permissionsWithinWindow,
  DELEGATE_GRACE_DAYS,
} from './delegate-access-window';

const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const base = { isCouple: false, eventDate: '2026-06-10', precision: 'day' as const };

test('the grace period is the seven days the owner set', () => {
  assert.equal(DELEGATE_GRACE_DAYS, 7);
});

test('a delegate keeps access ON the event day and through day seven', () => {
  for (const day of ['2026-06-10', '2026-06-11', '2026-06-15', '2026-06-17']) {
    assert.equal(
      delegateAccessHasExpired({ ...base, now: at(day) }),
      false,
      `${day} is within the window — a coordinator wrapping up must still get in`,
    );
  }
});

test('THE POINT: on day eight the delegate is out', () => {
  assert.equal(delegateAccessHasExpired({ ...base, now: at('2026-06-18') }), true);
  assert.equal(delegateAccessHasExpired({ ...base, now: at('2027-01-01') }), true);
});

test('the COUPLE never expires, however long ago the wedding was', () => {
  // The whole feature must not lock a couple out of their own wedding.
  assert.equal(
    delegateAccessHasExpired({ ...base, isCouple: true, now: at('2030-01-01') }),
    false,
  );
});

test('NO DATE means no expiry — one live event has event_date NULL', () => {
  // A null date is "not decided yet", never "long ago". Treating it as expired
  // would lock a planner out of the event they are helping to schedule.
  for (const d of [null, undefined, '', '   ']) {
    assert.equal(
      delegateAccessHasExpired({ ...base, eventDate: d, now: at('2030-01-01') }),
      false,
      `eventDate=${JSON.stringify(d)} must not expire anyone`,
    );
  }
});

test('an IMPRECISE date expires nobody — one live event is year-precision', () => {
  // Its event_date is a placeholder inside a year, not a day anyone marries on.
  // Counting seven days from it would revoke a planner months early.
  for (const p of ['year', 'month']) {
    assert.equal(
      delegateAccessHasExpired({ ...base, precision: p, now: at('2027-01-01') }),
      false,
      `precision=${p} must not close the window`,
    );
  }
  // …but a day-precise one still does.
  assert.equal(delegateAccessHasExpired({ ...base, precision: 'day', now: at('2027-01-01') }), true);
});

test('a multi-day event counts from its LAST day', () => {
  const multi = { ...base, eventDate: '2026-06-10', eventEndDate: '2026-06-14' };
  // Day 7 after the 14th is the 21st — still in.
  assert.equal(delegateAccessHasExpired({ ...multi, now: at('2026-06-21') }), false);
  assert.equal(delegateAccessHasExpired({ ...multi, now: at('2026-06-22') }), true);
  // Counting from the START date would have expired them on the 18th.
  assert.equal(delegateAccessHasExpired({ ...multi, now: at('2026-06-18') }), false);
});

test('an unparseable date leaves the window OPEN, never closed', () => {
  assert.equal(
    delegateAccessHasExpired({ ...base, eventDate: 'not-a-date', now: at('2030-01-01') }),
    false,
  );
});

test('permissionsWithinWindow returns NULL past the window, not an empty map', () => {
  // null takes the exact path a stranger takes through resolveAreaLevel — an
  // empty map would be a second code path to keep in step.
  const perms = { areas: { guest_list: 'edit' } };
  assert.equal(permissionsWithinWindow(perms, { ...base, now: at('2026-06-12') }), perms);
  assert.equal(permissionsWithinWindow(perms, { ...base, now: at('2026-06-18') }), null);
  assert.equal(permissionsWithinWindow(null, { ...base, now: at('2026-06-12') }), null);
});

test('🔑 EVERY reader of permissions_json applies the window', () => {
  // A window enforced in one of five readers reads as closed while standing
  // open on four surfaces — worse than no window at all. This is the assertion
  // that makes the feature true rather than merely present.
  const READERS = [
    'lib/event-viewer.server.ts',
    'lib/coordinator-broadcasts-server.ts',
    'lib/budget-visibility.ts',
    'lib/run-of-show-advance.ts',
    'app/dashboard/[eventId]/schedule/page.tsx',
  ];
  for (const f of READERS) {
    const src = stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
    assert.ok(
      /permissions_json/.test(src),
      `${f} no longer reads permissions_json — delete it from READERS on purpose`,
    );
    assert.ok(
      /delegate-access-window/.test(src),
      `${f} reads permissions_json but never applies the access window — an ` +
        'expired coordinator still gets in here',
    );
  }
});
