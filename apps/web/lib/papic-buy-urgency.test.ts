/**
 * A GUEST MAY BUY THEIR OWN SHOTS — and is told the truth about the wait.
 *
 * Three separate defects are pinned here, each of which shipped green.
 *
 * 1. THE CIRCULAR GATE. Buying dedicated shots required ALREADY HAVING dedicated
 *    shots (`papic_seat_dedicated_points(seat) > 0`, checked twice — surface and
 *    action). Nobody could ever buy their first. A guest whose shared pool ran
 *    dry could only top up the HOST's pool, i.e. pay for shots anyone else could
 *    spend.
 *
 * 2. THE UNSTATED WAIT. Payments are confirmed BY HAND — every row of
 *    `setnayan_pay_methods` is `is_active = false`, so nothing auto-confirms.
 *    The panel said the shots "go live once the Setnayan team confirms it",
 *    which is true and tells a guest nothing about whether that means seconds or
 *    a day.
 *
 * 3. THE SAME-DAY ORDER THAT WAITS ITS TURN. A 24-hour SLA is a promise on an
 *    ordinary order and a broken product on one whose event is TODAY — the party
 *    ends before anyone opens the queue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isSameDayInManila, buyWaitCopy } from './papic-buy-urgency';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Strip comments — the notes explaining a rule must not satisfy the test that
 *  enforces it. (They have, four times on this feature.) */
const noComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

// ── 1 · the circular gate is gone ──────────────────────────────────────────

test('buying your first dedicated shots does not require already having some', () => {
  const action = noComments(read('app/papic/buy/actions.ts'));
  assert.ok(
    !/papic_seat_dedicated_points/.test(action),
    'the buy action must not gate on an existing dedicated balance — that is ' +
      'circular, and it left a dry-pool guest able only to top up the HOST.',
  );

  const page = noComments(read('app/papic/seat/[token]/page.tsx'));
  assert.ok(
    !/papic_seat_dedicated_points/.test(page),
    'the seat page must not hide the offer behind an existing balance either',
  );
});

test('🔒 but "only YOUR camera" still holds — the identity check survives', () => {
  // This is the check that actually protects anything. Removing the circular
  // one must not have taken it with it.
  const action = noComments(read('app/papic/buy/actions.ts'));
  assert.match(
    action,
    /resolveGuestReloadTarget\(/,
    'the seat being reloaded must still be resolved against the buyer credential',
  );
  assert.match(
    action,
    /buyer!\.kind !== 'seat'\)\s*backTo\(returnTo, 'no_camera'\)/,
    'a seatless (cookie-only) guest still cannot buy a dedicated balance — ' +
      'there is no seat for it to attach to',
  );
});

// ── 2 · the wait is stated ─────────────────────────────────────────────────

test('the guest is told the confirmation is by hand and can take a day', () => {
  const { copy } = buyWaitCopy(false);
  assert.match(copy, /24 hours/, 'the ordinary wait must name the 24 hours');
  assert.match(copy, /by hand/i, 'and say a person does it — that is why it is slow');
  assert.match(
    copy,
    /shared pool/i,
    'and say what they can do meanwhile, or the wait reads as "you are stuck"',
  );
});

test('a same-day guest is told they jump the queue, not that they must wait', () => {
  const { copy } = buyWaitCopy(true);
  assert.match(copy, /today/i);
  assert.ok(
    !/24 hours/.test(copy),
    'promising 24 hours to someone whose event is today is promising to miss it',
  );
});

test('the panel renders the wait, and takes it from the shared resolver', () => {
  const panel = noComments(read('app/papic/_components/papic-guest-buy-panel.tsx'));
  assert.match(panel, /buyWaitCopy\(isSameDayInManila\(/);
  const shell = noComments(read('app/papic/_components/papic-buy-shell.tsx'));
  assert.match(shell, /\{wait\.copy\}/, 'the shell must actually print it');
});

test('the "this camera only" copy admits the fallback to the shared pool', () => {
  // papic_reserve_event_points_for_seat returns -1 only WHILE dedicated > 0, so
  // a bought balance is spent first and the camera then rejoins the pool. A
  // guest who is not told that will read "nobody else can spend them" as a
  // promise that their camera is private forever.
  const shell = read('app/papic/_components/papic-buy-shell.tsx');
  assert.match(
    shell,
    /back to the\s*\n?\s*shared pool/,
    'the One rungs must say the camera returns to the shared pool when the ' +
      'bought shots run out',
  );
});

// ── 3 · same-day, in Manila, on both halves ────────────────────────────────

test('🪤 "today" is Manila, not UTC', () => {
  // The trap: a PH evening event is already tomorrow in UTC. 2026-08-02 16:00Z
  // is 2026-08-03 00:00 in Manila — a UTC comparison calls that Aug 2 and files
  // an event happening RIGHT NOW as ordinary.
  const utcEvening = new Date('2026-08-02T16:00:00Z');
  assert.equal(
    isSameDayInManila('2026-08-03', utcEvening),
    true,
    'past 16:00Z it is already tomorrow in Manila — that event is TODAY',
  );
  assert.equal(isSameDayInManila('2026-08-02', utcEvening), false);
});

test('a missing or malformed date is never "today"', () => {
  const now = new Date('2026-08-02T04:00:00Z');
  for (const bad of [null, undefined, '', 'tomorrow', '2026-8-2']) {
    assert.equal(isSameDayInManila(bad, now), false, `${String(bad)} must not pass`);
  }
});

test('a timestamp works as well as a plain date', () => {
  const now = new Date('2026-08-02T04:00:00Z'); // 12:00 Manila, Aug 2
  assert.equal(isSameDayInManila('2026-08-02T10:30:00Z', now), true);
});

test('the admin queue puts today first, above even a clean match', () => {
  const src = noComments(read('app/admin/payments/page.tsx'));
  assert.match(
    src,
    /Number\(b\.sameDay\) - Number\(a\.sameDay\) \|\| Number\(b\.decisive\) - Number\(a\.decisive\)/,
    'same-day must be the FIRST sort key — a clean match on next month can wait',
  );
  assert.match(
    src,
    /isSameDayInManila/,
    'and it must use the same predicate the guest-facing promise uses',
  );
});

test('🪤 the queue read fails OPEN on the ordering, never on the page', () => {
  // Losing the jump costs an ordering an admin can work around. Throwing takes
  // down the payments console — during the event it was meant to rescue.
  const src = read('app/admin/payments/page.tsx');
  const fn = src.slice(src.indexOf('async function fetchSameDayOrderIds'));
  assert.match(fn, /catch\s*\{\s*\n?\s*return out;/, 'must swallow and return empty');
  assert.match(fn, /if \(error \|\| !Array\.isArray\(data\)\) return out;/);
});
