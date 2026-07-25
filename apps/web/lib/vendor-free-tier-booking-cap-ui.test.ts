import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  FREE_TIER_BOOKING_CAP_ERROR_CODE,
  FREE_TIER_BOOKING_CAP_ERROR_TOKEN,
  VENDOR_FULLY_BOOKED_BADGE_LABEL,
  VENDOR_FULLY_BOOKED_COUPLE_MESSAGE,
  countDistinctBookedEvents,
  fullyBookedRefusalPayload,
  isFreeTierBookingCapError,
  lockCtaStateForCap,
  vendorFullyBookedCoupleMessage,
  vendorFullyBookedDepositNotRecordedMessage,
} from './vendor-free-tier-booking-cap-ui';
import * as capUiFlag from './vendor-free-tier-booking-cap-ui-flag';
import { isVendorFullyBookedUiEnabled } from './vendor-free-tier-booking-cap-ui-flag';
import {
  FREE_TIER_ACTIVE_BOOKING_CAP,
  isAtFreeTierBookingCap,
} from './vendor-free-tier-booking-cap';

/**
 * The couple-facing "Fully booked" layer. Four things must never regress:
 *   1. the detector recognises the DB trigger's error on every shape a
 *      supabase-js / PostgREST / RPC round-trip can hand it (so a couple never
 *      reads a raw Postgres sentence),
 *   2. the trigger keeps raising the token the detector matches on, and keeps
 *      counting DISTINCT EVENTS (the pin below reads the migration itself —
 *      reword the RAISE or go back to COUNT(*) and this file goes red),
 *   3. one booking is one EVENT, never one service row, and
 *   4. the flag defaults OFF — flag-OFF is byte-identical to today, and there
 *      is only ONE flag (the second one was a defect factory).
 */

// The literal message the trigger raises. Copied verbatim so a reworded trigger
// that drops the token fails this test loudly. Cross-checked against the actual
// migration text by the "migration pin" block below.
const TRIGGER_MESSAGE =
  'free_tier_booking_cap: free-tier vendor already holds 3 concurrent active bookings (cap 3)';
const TRIGGER_HINT =
  'Free vendors hold 3 concurrent bookings. Finish an event to free a slot, or subscribe (Solo+) for unlimited.';

// ── the detector ────────────────────────────────────────────────────────────

test('detector: the trigger error in `message` is recognised', () => {
  assert.equal(
    isFreeTierBookingCapError({
      code: FREE_TIER_BOOKING_CAP_ERROR_CODE,
      message: TRIGGER_MESSAGE,
      hint: TRIGGER_HINT,
    }),
    true,
  );
});

test('detector: recognised when PostgREST moves the text into `details`', () => {
  assert.equal(
    isFreeTierBookingCapError({
      code: '23514',
      message: 'new row violates check constraint',
      details: TRIGGER_MESSAGE,
    }),
    true,
  );
});

test('detector: recognised even when an RPC re-raise loses the SQLSTATE', () => {
  // The token survives every re-raise; the code does not. Requiring the code
  // would let a raw sentence leak on the slot-acquire RPC path.
  assert.equal(isFreeTierBookingCapError({ message: TRIGGER_MESSAGE }), true);
  assert.equal(
    isFreeTierBookingCapError({ code: 'P0001', message: TRIGGER_MESSAGE }),
    true,
  );
});

test('detector: OTHER check_violations are NOT mistaken for the cap', () => {
  // The verified-gate trigger raises the same SQLSTATE — it must not be
  // translated into "Fully booked".
  assert.equal(
    isFreeTierBookingCapError({
      code: '23514',
      message: 'vendor_not_verified: vendor is not verified',
    }),
    false,
  );
  // The hard-single partial-unique index.
  assert.equal(
    isFreeTierBookingCapError({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      details: 'Key (event_id)=(x) already exists — event_vendors_hard_single_lock_uniq',
    }),
    false,
  );
});

test('detector: null / undefined / empty error objects are safe', () => {
  assert.equal(isFreeTierBookingCapError(null), false);
  assert.equal(isFreeTierBookingCapError(undefined), false);
  assert.equal(isFreeTierBookingCapError({}), false);
  assert.equal(isFreeTierBookingCapError({ code: null, message: null }), false);
});

// ── the migration pin (reads the SQL — NOT a copy of it) ────────────────────
//
// Round one shipped a test that CLAIMED to pin the trigger message but only
// compared two TypeScript constants to each other; rewording the RAISE left
// 15/15 green and every couple would have silently gone back to raw Postgres.
// This block reads the newest migration that (re)defines the function and
// asserts on its actual text.

/** The newest migration that defines `enforce_free_tier_booking_cap`. */
function newestCapTriggerMigration(): { name: string; sql: string } {
  const dir = fileURLToPath(new URL('../../../supabase/migrations', import.meta.url));
  const matches = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(`${dir}/${name}`, 'utf8') }))
    .filter((f) =>
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_free_tier_booking_cap/i.test(
        f.sql,
      ),
    );
  assert.ok(
    matches.length > 0,
    'no migration defines public.enforce_free_tier_booking_cap',
  );
  return matches[matches.length - 1]!;
}

test('migration pin: the live trigger raises the token the detector matches', () => {
  const { name, sql } = newestCapTriggerMigration();
  const raise = /RAISE\s+EXCEPTION\s*\n?\s*'([^']*)'/i.exec(sql);
  assert.ok(raise, `${name}: could not find the RAISE EXCEPTION message`);
  const message = raise![1]!;
  assert.ok(
    message.includes(FREE_TIER_BOOKING_CAP_ERROR_TOKEN),
    `${name}: the RAISE message must carry the "${FREE_TIER_BOOKING_CAP_ERROR_TOKEN}" token or the couple reads raw Postgres — got: ${message}`,
  );
  // The detector must actually fire on the real sentence, format specifiers and
  // all (it matches on substring, so %-placeholders are harmless).
  assert.equal(isFreeTierBookingCapError({ message }), true, name);
  assert.ok(
    /ERRCODE\s*=\s*'check_violation'/i.test(sql),
    `${name}: the trigger must keep raising check_violation (${FREE_TIER_BOOKING_CAP_ERROR_CODE})`,
  );
});

test('migration pin: the trigger counts DISTINCT events, not rows', () => {
  const { name, sql } = newestCapTriggerMigration();
  assert.ok(
    /COUNT\s*\(\s*DISTINCT\s+ev\.event_id\s*\)/i.test(sql),
    `${name}: event_vendors holds ONE ROW PER SERVICE — COUNT(*) lets a single 4-item package booking exhaust a free vendor's whole allowance. Must be COUNT(DISTINCT ev.event_id).`,
  );
  assert.equal(
    /SELECT\s+COUNT\s*\(\s*\*\s*\)\s*\n?\s*INTO\s+v_count/i.test(sql),
    false,
    `${name}: the row-counting SELECT COUNT(*) INTO v_count is back`,
  );
});

test('migration pin: the trigger stays gated on the platform_settings switch', () => {
  const { name, sql } = newestCapTriggerMigration();
  assert.ok(
    /free_tier_booking_cap_enabled/.test(sql),
    `${name}: the cap must stay flag-dark behind platform_settings.free_tier_booking_cap_enabled`,
  );
});

test('migration pin: the RAISE does not leak the internal vendor id', () => {
  const { name, sql } = newestCapTriggerMigration();
  const raise = /RAISE\s+EXCEPTION\s*\n?\s*'([^']*)'/i.exec(sql);
  assert.ok(raise, name);
  assert.equal(
    raise![1]!.includes('marketplace_vendor_id'),
    false,
    `${name}: the wizard rethrows this text verbatim on some paths — it must not carry Setnayan's internal vendor id`,
  );
});

// ── one booking = one EVENT ─────────────────────────────────────────────────

test('distinct: four service rows in ONE event are ONE booking', () => {
  // The exact defect: a 4-item package booking wrote 4 active event_vendors
  // rows and the row-count read them as 4 concurrent bookings.
  assert.equal(countDistinctBookedEvents(['e1', 'e1', 'e1', 'e1']), 1);
  assert.equal(
    isAtFreeTierBookingCap('free', countDistinctBookedEvents(['e1', 'e1', 'e1', 'e1'])),
    false,
    'one 4-service event must NOT exhaust the free vendor’s 3 slots',
  );
});

test('distinct: three separate events DO reach the cap', () => {
  assert.equal(countDistinctBookedEvents(['e1', 'e2', 'e3']), 3);
  assert.equal(
    isAtFreeTierBookingCap('free', countDistinctBookedEvents(['e1', 'e1', 'e2', 'e2', 'e3'])),
    true,
  );
  assert.equal(
    isAtFreeTierBookingCap('free', countDistinctBookedEvents(['e1', 'e1', 'e2', 'e2'])),
    false,
  );
});

test('distinct: blank / non-string ids are ignored, not bucketed', () => {
  assert.equal(countDistinctBookedEvents([]), 0);
  assert.equal(countDistinctBookedEvents([null, undefined, '', '   ']), 0);
  assert.equal(countDistinctBookedEvents(['e1', null, ' e1 ', 'e2']), 2);
});

// ── the copy ────────────────────────────────────────────────────────────────

test('copy: never leaks the vendor’s plan/tier to the couple', () => {
  const all = [
    VENDOR_FULLY_BOOKED_COUPLE_MESSAGE,
    vendorFullyBookedCoupleMessage('Casa Blooms'),
    vendorFullyBookedDepositNotRecordedMessage('Casa Blooms'),
  ];
  for (const line of all) {
    for (const leak of ['free plan', 'free tier', 'subscribe', 'Solo', 'upgrade']) {
      assert.equal(
        line.toLowerCase().includes(leak.toLowerCase()),
        false,
        `couple copy must not mention "${leak}": ${line}`,
      );
    }
  }
});

test('copy: keeps messaging OPEN (inbox/chat are never gated)', () => {
  for (const line of [
    VENDOR_FULLY_BOOKED_COUPLE_MESSAGE,
    vendorFullyBookedCoupleMessage('Casa Blooms'),
  ]) {
    assert.ok(
      line.toLowerCase().includes('message them'),
      `copy must tell the couple they can still message: ${line}`,
    );
  }
});

test('copy: personalises with the vendor name, falls back cleanly', () => {
  assert.ok(vendorFullyBookedCoupleMessage('Casa Blooms').startsWith('Casa Blooms is fully booked'));
  assert.equal(vendorFullyBookedCoupleMessage(''), VENDOR_FULLY_BOOKED_COUPLE_MESSAGE);
  assert.equal(vendorFullyBookedCoupleMessage('   '), VENDOR_FULLY_BOOKED_COUPLE_MESSAGE);
  assert.equal(vendorFullyBookedCoupleMessage(null), VENDOR_FULLY_BOOKED_COUPLE_MESSAGE);
  assert.equal(vendorFullyBookedCoupleMessage(undefined), VENDOR_FULLY_BOOKED_COUPLE_MESSAGE);
});

test('copy: the money path says plainly that NOTHING was recorded', () => {
  // The refusal happens after the couple submitted a downpayment, so the lock
  // never committed and the ledger insert never ran. Silence here is the defect
  // ("money out, no booking, no ledger row") — the sentence must say so.
  for (const name of ['Casa Blooms', '', null, undefined] as const) {
    const line = vendorFullyBookedDepositNotRecordedMessage(name);
    const lower = line.toLowerCase();
    assert.ok(lower.includes('not recorded'), line);
    assert.ok(lower.includes('downpayment'), line);
    assert.ok(lower.includes('nothing is booked'), line);
    // Never promise a refund/hold Setnayan cannot make — it never held the money.
    assert.equal(lower.includes('refund'), false, line);
    assert.equal(lower.includes('we are holding'), false, line);
  }
  assert.ok(
    vendorFullyBookedDepositNotRecordedMessage('Casa Blooms').startsWith('Casa Blooms'),
  );
  assert.ok(
    vendorFullyBookedDepositNotRecordedMessage(null).startsWith('This vendor'),
  );
});

test('refusal payload: a downpayment-carrying refusal ALWAYS warns', () => {
  // No downpayment → the plain capacity refusal, no extra noise.
  assert.deepEqual(
    fullyBookedRefusalPayload({ vendorName: 'Casa Blooms', depositSubmitted: false }),
    { vendorName: 'Casa Blooms' },
  );
  // Downpayment submitted → the couple MUST be told nothing was recorded.
  const withDeposit = fullyBookedRefusalPayload({
    vendorName: 'Casa Blooms',
    depositSubmitted: true,
  });
  assert.equal(withDeposit.vendorName, 'Casa Blooms');
  assert.equal(
    withDeposit.depositNotRecordedMessage,
    vendorFullyBookedDepositNotRecordedMessage('Casa Blooms'),
  );
  assert.ok(
    withDeposit.depositNotRecordedMessage!.toLowerCase().includes('not recorded'),
  );
});

// ── the CTA state ───────────────────────────────────────────────────────────

test('cta: capped → disabled + "Fully booked"; otherwise untouched', () => {
  assert.deepEqual(lockCtaStateForCap(true), {
    disabled: true,
    label: VENDOR_FULLY_BOOKED_BADGE_LABEL,
  });
  assert.deepEqual(lockCtaStateForCap(false), { disabled: false, label: null });
});

test('cta: the label is the badge label (one string, every surface)', () => {
  assert.equal(VENDOR_FULLY_BOOKED_BADGE_LABEL, 'Fully booked');
});

// ── the cap boundary this UI renders (pinned against the pure layer) ────────

test('boundary: the UI only ever fires at the owner-locked cap of 3', () => {
  assert.equal(FREE_TIER_ACTIVE_BOOKING_CAP, 3);
  for (const tier of ['free', 'verified', null, undefined]) {
    for (let n = 0; n <= 5; n += 1) {
      assert.equal(
        lockCtaStateForCap(isAtFreeTierBookingCap(tier, n)).disabled,
        n >= 3,
        `free tier ${String(tier)} with ${n} active bookings`,
      );
    }
  }
  for (const tier of ['solo', 'pro', 'enterprise', 'custom']) {
    for (let n = 0; n <= 5; n += 1) {
      assert.equal(
        lockCtaStateForCap(isAtFreeTierBookingCap(tier, n)).disabled,
        false,
        `paid tier ${tier} is never fully booked (${n} active)`,
      );
    }
  }
});

// ── flag-OFF byte-identity, and ONE flag only ───────────────────────────────

test('flag: default OFF (unset env) — nothing changes for anyone', () => {
  delete process.env.NEXT_PUBLIC_VENDOR_FULLY_BOOKED_UI;
  assert.equal(isVendorFullyBookedUiEnabled(), false);
});

test('flag: only "1" / "true" arm the UI', () => {
  for (const [value, expected] of [
    ['1', true],
    ['true', true],
    ['0', false],
    ['false', false],
    ['', false],
    ['TRUE', false],
    ['yes', false],
  ] as const) {
    process.env.NEXT_PUBLIC_VENDOR_FULLY_BOOKED_UI = value;
    assert.equal(isVendorFullyBookedUiEnabled(), expected, `value=${value}`);
  }
  delete process.env.NEXT_PUBLIC_VENDOR_FULLY_BOOKED_UI;
});

test('flag: there is exactly ONE flag — no env stand-in for the DB switch', () => {
  // The deleted `isVendorFullyBookedPreCheckEnabled` gated the pre-check on
  // NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP, an env var that cannot track
  // platform_settings.free_tier_booking_cap_enabled. Both mismatches were real
  // defects (a paid-then-refused booking one way, lost bookings the other), so
  // re-introducing ANY second flag here must fail loudly.
  assert.deepEqual(Object.keys(capUiFlag).sort(), ['isVendorFullyBookedUiEnabled']);
  assert.equal(
    (capUiFlag as Record<string, unknown>).isVendorFullyBookedPreCheckEnabled,
    undefined,
  );
  // …and no source file may read the retired env var.
  const roots = ['app', 'lib', 'components'].map((d) =>
    fileURLToPath(new URL(`../${d}`, import.meta.url)),
  );
  const offenders: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next') continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(e.name) && !p.endsWith('.test.ts')) {
        // Only actual READS count — prose that names the retired var is fine.
        if (
          readFileSync(p, 'utf8').includes(
            'process.env.NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP',
          )
        ) {
          offenders.push(p);
        }
      }
    }
  };
  for (const r of roots) walk(r);
  assert.deepEqual(
    offenders,
    [],
    `NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP must not gate the cap UI — read platform_settings.free_tier_booking_cap_enabled instead: ${offenders.join(', ')}`,
  );
});
