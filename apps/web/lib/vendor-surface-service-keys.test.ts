/**
 * SEC-4b · vendor-surface keys must not be sellable from couple checkout.
 *
 * Recovered from commit 9743f1f4f (the #3738 repair that never merged) and
 * re-pointed at current `main`. Two things changed on the way in, both
 * deliberate — see the module header:
 *
 *   • The throwing variant (`assertVendorSurfaceKeyNotSoldToCouple` +
 *     `VendorSurfaceKeyRefused`) is NOT landed. It had zero call sites in the
 *     original commit — 7 mentions, all inside its own module, its own test and
 *     a migration comment — and checkout returns `{ ok: false, reason }` rather
 *     than throwing, so it had no shape to fit into. Landing an unwired guard
 *     that passes its own tests while enforcing nothing is the failure mode this
 *     repo caught twice on 2026-07-30.
 *   • The last test is a WIRING GUARD. Every assertion above it exercises a pure
 *     predicate, so deleting the call in checkout would leave them all green —
 *     exactly what #3905 was about.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  VENDOR_SURFACE_SERVICE_KEY_PREFIXES,
  isVendorSurfaceServiceKey,
} from './vendor-surface-service-keys';

import { BOOKING_FEE_LOCK_SERVICE_PREFIX } from './booking-fee-lock';
import { BRANCH_SERVICE_KEY_PREFIX } from './vendor-branches';
import { SEAT_SERVICE_KEY_PREFIX } from './vendor-seats';
import { CUSTOM_PLAN_SERVICE_KEY_PREFIX } from './vendor-custom-catalog';

const CHECKOUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'app',
  'dashboard',
  '[eventId]',
  'checkout',
  'actions.ts',
);

/* ── the list itself ───────────────────────────────────────────────────────── */

test('all four vendor-surface families are covered', () => {
  for (const prefix of [
    BOOKING_FEE_LOCK_SERVICE_PREFIX,
    BRANCH_SERVICE_KEY_PREFIX,
    SEAT_SERVICE_KEY_PREFIX,
    CUSTOM_PLAN_SERVICE_KEY_PREFIX,
  ]) {
    assert.ok(
      VENDOR_SURFACE_SERVICE_KEY_PREFIXES.includes(prefix),
      `${prefix} dropped out of the guard list`,
    );
  }
  assert.equal(VENDOR_SURFACE_SERVICE_KEY_PREFIXES.length, 4);
});

test('the list is frozen — a caller cannot widen the gate at runtime', () => {
  assert.throws(() => {
    (VENDOR_SURFACE_SERVICE_KEY_PREFIXES as string[]).push('anything__');
  });
});

test('the prefixes are imported, not re-typed', () => {
  // Re-typing is how a rename silently drops a family out of the guard. Reading
  // the source is the only way to assert the import actually happened.
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'vendor-surface-service-keys.ts'),
    'utf8',
  );
  for (const mod of [
    './booking-fee-lock',
    './vendor-branches',
    './vendor-seats',
    './vendor-custom-catalog',
  ]) {
    assert.match(src, new RegExp(`from '${mod.replace('.', '\\.')}'`), `${mod} not imported`);
  }
});

/* ── the predicate ─────────────────────────────────────────────────────────── */

test('every vendor-surface key is recognised', () => {
  for (const key of [
    `${BOOKING_FEE_LOCK_SERVICE_PREFIX}0f4c1e6a-1111-2222-3333-444455556666`,
    `${BRANCH_SERVICE_KEY_PREFIX}0f4c1e6a-1111-2222-3333-444455556666`,
    `${SEAT_SERVICE_KEY_PREFIX}0f4c1e6a-1111-2222-3333-444455556666`,
    `${CUSTOM_PLAN_SERVICE_KEY_PREFIX}0f4c1e6a-1111-2222-3333-444455556666`,
  ]) {
    assert.equal(isVendorSurfaceServiceKey(key), true, `${key} slipped through`);
  }
});

test('real couple-side SKUs are NOT caught — the gate must not block sales', () => {
  for (const key of [
    'PAPIC_GUEST',
    'PAPIC_POOL',
    'SETNAYAN_AI_SUB',
    'LIVE_STUDIO',
    'PANOOD_SYSTEM',
    'save-the-date:some-slug',
    '',
  ]) {
    assert.equal(isVendorSurfaceServiceKey(key), false, `${key} was wrongly refused`);
  }
});

test('a bare prefix with no suffix still counts as vendor-surface', () => {
  // It names no valid target, so it can only ever be a probe — refuse it at the
  // door rather than letting it reach a hook that parses the suffix to null.
  assert.equal(isVendorSurfaceServiceKey(BRANCH_SERVICE_KEY_PREFIX), true);
});

test('matching is prefix-anchored, not substring', () => {
  // A key that merely CONTAINS the prefix must not be caught, or a future
  // couple-side SKU could be blocked by accident.
  assert.equal(isVendorSurfaceServiceKey(`x_${BRANCH_SERVICE_KEY_PREFIX}abc`), false);
});

/* ── the wiring — without this, every test above can pass while nothing is
 *    enforced (the #3905 lesson) ─────────────────────────────────────────── */

test('couple checkout actually CALLS the guard, before the sellability gate', () => {
  const src = readFileSync(CHECKOUT, 'utf8');

  assert.match(
    src,
    /from '@\/lib\/vendor-surface-service-keys'/,
    'checkout no longer imports the guard',
  );
  const call = src.indexOf('isVendorSurfaceServiceKey(serviceKey)');
  assert.ok(call > 0, 'checkout no longer calls the guard — the module is inert');

  // It must REFUSE on the true branch, not merely evaluate the predicate.
  const after = src.slice(call, call + 400);
  assert.match(after, /ok:\s*false/, 'the guard is called but does not refuse');

  // Order matters: this is not a pricing question, and running it after the
  // pricing gate would make the refusal depend on catalog state.
  const sellability = src.indexOf('await resolveServiceSellability(serviceKey)');
  assert.ok(sellability > 0, 'the sellability gate moved — re-check the ordering');
  assert.ok(
    call < sellability,
    'the vendor-surface guard must run BEFORE resolveServiceSellability',
  );
});
