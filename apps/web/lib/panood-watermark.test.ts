/**
 * Live Studio overlay-decision invariants (Node built-in test runner, run via tsx).
 *
 * This is the paywall AND a wedding-day safety device, so both directions are pinned:
 *
 *   1. FAILS CLOSED — every non-affirmative state draws the overlay. An entitlement lookup that
 *      errors passes paid:false and lands on 'unpaid', which is exactly what the couple already
 *      saw before buying, so a transient failure never changes the screen mid-setup.
 *   2. ONE INSTANT — the overlay clears and the 24h window opens at the same moment: the first
 *      press-live on a paid event. Paying early costs nothing.
 *   3. NEVER INTERRUPT A BROADCAST — if the window lapses while still on air, the overlay stays
 *      OFF. Slamming a logo over a paying couple's ceremony is the worst outcome in the design;
 *      the window bites at the NEXT press-live instead.
 *   4. RE-PRESS CANNOT MOVE THE WINDOW — it is anchored to firstLiveAt, so toggling live off and
 *      on again neither restarts nor extends anything.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideWatermark,
  canStartBroadcast,
  isWindowEndingSoon,
  PANOOD_WINDOW_HOURS,
  WATERMARK_COPY,
  type WatermarkInput,
} from './panood-watermark';

const T0 = new Date('2026-08-15T06:00:00.000Z'); // 6am — hair and makeup, when a PH wedding starts
const hoursAfter = (h: number) => new Date(T0.getTime() + h * 3_600_000);

const input = (over: Partial<WatermarkInput> = {}): WatermarkInput => ({
  paid: true,
  firstLiveAt: T0,
  isLive: true,
  now: T0,
  ...over,
});

/* ── 1. Fails closed ──────────────────────────────────────────────────────── */

test('unpaid always draws the overlay, however live it is', () => {
  const d = decideWatermark(input({ paid: false, isLive: true, now: hoursAfter(1) }));
  assert.equal(d.overlay, true);
  assert.equal(d.reason, 'unpaid');
  assert.equal(d.expiresAt, null);
});

test('an unparseable firstLiveAt degrades to awaiting-go-live, not to a free pass', () => {
  const d = decideWatermark(input({ firstLiveAt: 'not-a-date' }));
  assert.equal(d.overlay, true);
  assert.equal(d.reason, 'awaiting-go-live');
});

/* ── 2. One instant does both things ──────────────────────────────────────── */

test('paid but never pressed live keeps the overlay — buying early costs nothing', () => {
  const d = decideWatermark(input({ firstLiveAt: null, isLive: false, now: hoursAfter(500) }));
  assert.equal(d.overlay, true);
  assert.equal(d.reason, 'awaiting-go-live');
  assert.equal(d.expiresAt, null, 'no clock may start before the first press-live');
});

test('pressing live on a paid event clears the overlay and opens the window', () => {
  const d = decideWatermark(input({ now: T0 }));
  assert.equal(d.overlay, false);
  assert.equal(d.reason, 'window-open');
  assert.equal(d.expiresAt, hoursAfter(PANOOD_WINDOW_HOURS).toISOString());
});

test('the window covers a full PH wedding day — 6am prep to a midnight reception', () => {
  // ~18 hours end to end, comfortably inside 24.
  const atReceptionEnd = decideWatermark(input({ now: hoursAfter(18) }));
  assert.equal(atReceptionEnd.overlay, false);
  assert.equal(atReceptionEnd.reason, 'window-open');
});

/* ── 3. Never interrupt a broadcast ───────────────────────────────────────── */

test('window lapsing mid-broadcast does NOT restore the overlay', () => {
  const d = decideWatermark(input({ isLive: true, now: hoursAfter(30) }));
  assert.equal(d.overlay, false, 'a paying couple must never gain a logo mid-ceremony');
  assert.equal(d.reason, 'expired-broadcasting');
});

test('once off air, an expired window does restore the overlay', () => {
  const d = decideWatermark(input({ isLive: false, now: hoursAfter(30) }));
  assert.equal(d.overlay, true);
  assert.equal(d.reason, 'expired');
});

test('an expired window blocks the NEXT broadcast — that is where it bites', () => {
  assert.equal(canStartBroadcast(input({ isLive: false, now: hoursAfter(30) })), false);
  assert.equal(canStartBroadcast(input({ isLive: true, now: hoursAfter(30) })), false);
});

test('canStartBroadcast allows a first press and a re-press inside the window', () => {
  assert.equal(canStartBroadcast(input({ firstLiveAt: null, isLive: false })), true);
  assert.equal(canStartBroadcast(input({ isLive: false, now: hoursAfter(5) })), true);
});

test('unpaid cannot start a broadcast', () => {
  assert.equal(canStartBroadcast(input({ paid: false, firstLiveAt: null, isLive: false })), false);
});

/* ── 4. Re-press cannot move the window ───────────────────────────────────── */

test('expiry is anchored to the FIRST press — toggling live off and on cannot extend it', () => {
  const first = decideWatermark(input({ now: hoursAfter(1) }));
  // Operator stops, then restarts 10 hours later. firstLiveAt is unchanged by design.
  const afterRestart = decideWatermark(input({ now: hoursAfter(11) }));
  assert.equal(afterRestart.expiresAt, first.expiresAt, 'a re-press must not move the window');
  assert.equal(afterRestart.reason, 'window-open');
});

/* ── Countdown + copy ─────────────────────────────────────────────────────── */

test('minutesRemaining counts down and floors', () => {
  assert.equal(decideWatermark(input({ now: T0 })).minutesRemaining, 24 * 60);
  assert.equal(decideWatermark(input({ now: hoursAfter(23.5) })).minutesRemaining, 30);
});

test('ending-soon fires only inside the last hour of an open window', () => {
  assert.equal(isWindowEndingSoon(decideWatermark(input({ now: hoursAfter(12) }))), false);
  assert.equal(isWindowEndingSoon(decideWatermark(input({ now: hoursAfter(23.5) }))), true);
  // Not "ending soon" once it has already expired — that is a different message.
  assert.equal(isWindowEndingSoon(decideWatermark(input({ now: hoursAfter(30) }))), false);
});

test('every reason has operator-facing copy', () => {
  for (const reason of [
    'unpaid',
    'awaiting-go-live',
    'window-open',
    'expired-broadcasting',
    'expired',
  ] as const) {
    assert.ok(WATERMARK_COPY[reason]?.badge, `missing badge for ${reason}`);
    assert.ok(WATERMARK_COPY[reason]?.detail, `missing detail for ${reason}`);
  }
});

test('a custom window length is honoured', () => {
  const d = decideWatermark(input({ windowHours: 48, now: hoursAfter(30) }));
  assert.equal(d.overlay, false);
  assert.equal(d.reason, 'window-open');
});

/* ── The gate that was never called ───────────────────────────────────────── */

test('the window is enforced on the way UP, and only there', () => {
  // canStartBroadcast had ZERO call sites outside this file, so one purchase bought unlimited
  // clean broadcasts forever. It is now wired into the setLive server action. These pin the
  // exact contract that action depends on.
  const expired = { paid: true, firstLiveAt: T0, isLive: false, now: hoursAfter(30) };

  // Spent window blocks a NEW broadcast...
  assert.equal(canStartBroadcast(expired), false);

  // ...but an in-flight one is never judged by this gate: decideWatermark keeps the overlay OFF
  // while still on air, and the action only consults canStartBroadcast when going live=true.
  assert.equal(
    decideWatermark({ ...expired, isLive: true }).reason,
    'expired-broadcasting',
    'a running broadcast must never be interrupted by an expired window',
  );
});

test('the FREE tier can still press live — it goes to air overlaid', () => {
  // The paywall is the overlay, not the go-live button. Blocking a free press would break the
  // whole "connect, test, then buy" model AND would stop first_live_at ever being stamped.
  assert.equal(
    canStartBroadcast({ paid: false, firstLiveAt: null, isLive: false, now: T0 }),
    false,
    'unpaid has no window to spend',
  );
  assert.equal(
    decideWatermark({ paid: false, firstLiveAt: null, isLive: true, now: T0 }).overlay,
    true,
    'and if it does go live, it goes live overlaid',
  );
});

test('a paid event that has never gone live can always start', () => {
  assert.equal(
    canStartBroadcast({ paid: true, firstLiveAt: null, isLive: false, now: hoursAfter(9000) }),
    true,
    'buying early must never expire before the first press',
  );
});

/* ══════════════════════════════════════════════════════════════════════════════════════════════
   🚫 WAVE 7 · THE OVERLAY IS RETIRED (owner-locked 2026-07-25 · § 4f ①)

   The property under test is blunt and total: with `retired` set, NO combination of inputs draws
   the full-screen mark. That is what "it no longer renders" has to mean — every surface reads this
   one decision, so if the decision can never say `overlay: true`, no surface can draw one.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

test('🚫 retired: the overlay NEVER renders, for any input combination', () => {
  for (const paid of [true, false]) {
    for (const firstLiveAt of [null, T0, hoursAfter(-100), 'not-a-date']) {
      for (const isLive of [true, false]) {
        for (const now of [T0, hoursAfter(1), hoursAfter(25), hoursAfter(9000)]) {
          const d = decideWatermark({ paid, firstLiveAt, isLive, now, retired: true });
          assert.equal(
            d.overlay,
            false,
            `overlay drawn for paid=${paid} firstLiveAt=${String(firstLiveAt)} isLive=${isLive}`,
          );
          assert.equal(d.reason, 'retired');
        }
      }
    }
  }
});

test('🚫 retired reports NO window — the 24h clock moved to lib/live-studio-window.ts', () => {
  // Leaving a plausible-looking countdown here would give a caller a stale number to render.
  const d = decideWatermark(input({ firstLiveAt: T0, now: hoursAfter(1), retired: true }));
  assert.equal(d.expiresAt, null);
  assert.equal(d.minutesRemaining, null);
  assert.equal(isWindowEndingSoon(d), false, 'no window means no "ending soon"');
});

test('🚫 retired: the go-live gate retires WITH the overlay it protected', () => {
  // An armed gate with no paywall behind it is just an invisible refusal to broadcast — and the
  // live /pricing page promises a FREE single-camera livestream.
  assert.equal(
    canStartBroadcast({ paid: false, firstLiveAt: null, isLive: false, now: T0, retired: true }),
    true,
    'a free host must be able to go live',
  );
  assert.equal(
    canStartBroadcast({ paid: true, firstLiveAt: T0, isLive: false, now: hoursAfter(30), retired: true }),
    true,
    'and a spent legacy window no longer blocks the next press',
  );
});

test('🚫 retired copy exists — control-room.tsx indexes WATERMARK_COPY by the resolved reason', () => {
  // A missing key here is a runtime `undefined.badge` on a live surface, not a type error.
  assert.ok(WATERMARK_COPY.retired?.badge);
  assert.ok(WATERMARK_COPY.retired?.detail);
  assert.ok(
    !/overlay/i.test(WATERMARK_COPY.retired.detail),
    'retired copy must not describe an overlay that is no longer drawn',
  );
});

test('flag OFF is byte-identical: omitting `retired` keeps every 2026-07-21 decision', () => {
  // The whole flag-off safety argument in one assertion — `retired` defaults to false, so the
  // legacy Cast room (live, selling PANOOD_SYSTEM, overlay = its only paywall) is untouched.
  const cases: WatermarkInput[] = [
    { paid: false, firstLiveAt: null, isLive: false, now: T0 },
    { paid: true, firstLiveAt: null, isLive: false, now: T0 },
    { paid: true, firstLiveAt: T0, isLive: false, now: hoursAfter(1) },
    { paid: true, firstLiveAt: T0, isLive: true, now: hoursAfter(30) },
    { paid: true, firstLiveAt: T0, isLive: false, now: hoursAfter(30) },
  ];
  const expected = ['unpaid', 'awaiting-go-live', 'window-open', 'expired-broadcasting', 'expired'];
  cases.forEach((c, i) => {
    assert.equal(decideWatermark(c).reason, expected[i]);
    assert.equal(decideWatermark({ ...c, retired: false }).reason, expected[i]);
  });
  assert.equal(decideWatermark(cases[0]!).overlay, true, 'the free tier is still overlaid flag-off');
});
