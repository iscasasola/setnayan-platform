/**
 * THE PLAN SHEET READS, NEVER TYPES (Build 5 · Lane B). Held:
 *   · every limit on the sheet is TIER_CAPS (the shop is never promised a number the table does not hold);
 *   · Door 1 offers the LOWEST plan above the shop's own that takes the number pressed, and saves at the current limit;
 *   · Door 2's "today" is the plan-change RPC's own arithmetic — unused value only on an upgrade, money on the account
 *     off any charge, never below ₱0 — and NO number when the unused value could not be read;
 *   · the file types no peso.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIER_CAPS } from '@/lib/vendor-tier-caps';
import { stripComments } from '@/lib/strip-comments';
import {
  PLAN_LIMITS,
  changeKind,
  limitAsk,
  limitOf,
  lowestPlanAllowing,
  payToday,
  planChanges,
  planRowLine,
  sheetPlans,
} from '@/lib/plan-sheet';

const HERE = dirname(fileURLToPath(import.meta.url));

test('every limit is read from TIER_CAPS', () => {
  for (const t of ['free', 'verified', 'solo', 'pro', 'enterprise'] as const) {
    const c = TIER_CAPS[t];
    assert.equal(limitOf(t, 'bookingsPerDate', true), c.bookingsPerDatePerService);
    assert.equal(limitOf(t, 'cardsPerCategory', true), c.servicesPerLeaf);
    assert.equal(limitOf(t, 'mainCategories', true), c.parentCategories);
    assert.equal(limitOf(t, 'teamSeats', true), c.agentAccounts);
    assert.equal(limitOf(t, 'branches', true), c.branchesIncluded);
    assert.equal(limitOf(t, 'reach', true), c.serviceRadiusKm);
  }
  assert.equal(PLAN_LIMITS.length, 6);
});

test('Door 1 offers the lowest plan above the shop that takes the number', () => {
  const soloBookings = TIER_CAPS.solo.bookingsPerDatePerService;
  const want = soloBookings + 1;
  const plan = lowestPlanAllowing('solo', 'bookingsPerDate', want, true);
  assert.ok(plan);
  assert.ok(TIER_CAPS[plan].bookingsPerDatePerService >= want);
  // Nothing between Solo and that plan takes it.
  const ladder = ['solo', 'pro', 'enterprise'] as const;
  for (const t of ladder.slice(1, ladder.indexOf(plan as 'pro' | 'enterprise'))) {
    assert.ok(TIER_CAPS[t].bookingsPerDatePerService < want, `${t} already takes ${want}`);
  }
  const ask = limitAsk('solo', 'bookingsPerDate', want, true);
  assert.ok(ask);
  assert.equal(ask.plan, plan);
  assert.equal(ask.savedAt, soloBookings, 'the setting saves at the current limit until paid');
  assert.match(ask.headline, new RegExp(`take up to ${TIER_CAPS[plan].bookingsPerDatePerService} bookings a day on a card`));
  assert.equal(ask.keep, `Keep ${soloBookings}`);
  assert.ok(ask.alsoUnlocks.length > 0, 'the other differences are listed');
});

test('Door 1 says nothing within the limit, and says so when no plan takes it', () => {
  assert.equal(limitAsk('pro', 'bookingsPerDate', TIER_CAPS.pro.bookingsPerDatePerService, true), null);
  const top = limitAsk('enterprise', 'mainCategories', TIER_CAPS.enterprise.parentCategories + 1, true);
  assert.ok(top);
  assert.equal(top.plan, null);
  assert.match(top.headline, /^No plan takes more than/);
});

test('an unverified shop past its reach is sent to get verified', () => {
  const ask = limitAsk('free', 'reach', 1, true);
  assert.ok(ask);
  assert.equal(ask.plan, 'verified');
  assert.match(ask.headline, /^Get verified/);
});

test('Door 2 lists the shop first, never offers being unverified to a verified shop', () => {
  assert.deepEqual(sheetPlans('solo'), ['solo', 'verified', 'pro', 'enterprise']);
  assert.deepEqual(sheetPlans('free'), ['free', 'verified', 'solo', 'pro', 'enterprise']);
  assert.ok(!sheetPlans('verified').includes('free'));
  const ch = planChanges('solo', 'pro', true);
  assert.equal(ch.direction, 'up');
  const seats = ch.limits.find((l) => l.key === 'teamSeats')!;
  assert.equal(seats.now, String(TIER_CAPS.solo.agentAccounts));
  assert.equal(seats.after, String(TIER_CAPS.pro.agentAccounts));
  assert.equal(planChanges('pro', 'solo', true).direction, 'down');
  assert.match(planRowLine('pro', 'solo', true, '8 Dec 2026'), /^Lower plan · starts after 8 Dec 2026$/);
});

test('the kind is by plan, never by price — as vendor_plan_change_kind', () => {
  const now = Date.parse('2026-11-10T00:00:00Z');
  const live = '2026-12-08T00:00:00Z';
  assert.equal(changeKind('solo', live, 'pro', now), 'upgrade');
  assert.equal(changeKind('pro', live, 'solo', now), 'downgrade');
  assert.equal(changeKind('pro', live, 'pro', now), 'renewal');
  assert.equal(changeKind('pro', '2026-10-01T00:00:00Z', 'solo', now), 'new');
  assert.equal(changeKind('free', null, 'solo', now), 'new');
});

test('today is the RPC arithmetic — and no number when the unused value is unread', () => {
  const base = { currentRaw: 'solo', endsOn: '8 Dec 2026' };
  assert.equal(payToday({ ...base, kind: 'upgrade', price: 100, unusedPhp: 30, creditPhp: 10 }).amount, 60);
  assert.equal(payToday({ ...base, kind: 'upgrade', price: 100, unusedPhp: 300, creditPhp: 0 }).amount, 0, 'never below zero');
  // Unused value is credited ONLY on an upgrade; money on the account comes off any charge.
  assert.equal(payToday({ ...base, kind: 'downgrade', price: 100, unusedPhp: 30, creditPhp: 10 }).amount, 90);
  assert.equal(payToday({ ...base, kind: 'renewal', price: 100, unusedPhp: 30, creditPhp: 0 }).amount, 100);
  assert.equal(payToday({ ...base, kind: 'new', price: 100, unusedPhp: null, creditPhp: 0 }).amount, 100);
  const unread = payToday({ ...base, kind: 'upgrade', price: 100, unusedPhp: null, creditPhp: 0 });
  assert.equal(unread.amount, null);
  assert.match(unread.line, /exact amount shows on your order/);
  assert.match(payToday({ ...base, kind: 'downgrade', price: 100, unusedPhp: 0, creditPhp: 0 }).line, /^Starts when Supplier Plus ends on 8 Dec 2026/);
});

test('no peso and no jargon is typed in the sheet', () => {
  for (const f of [join(HERE, 'plan-sheet.ts'), join(HERE, '../app/vendor-dashboard/subscription/_components/plan-sheet.tsx'), join(HERE, '../app/_components/lock/limit-sheet.tsx')]) {
    // Words a shop reads — import paths are not copy.
    const src = stripComments(readFileSync(f, 'utf8')).replace(/^import .*$/gm, '');
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a peso amount`);
    assert.doesNotMatch(src, /'[^']*\b(proration|prorated|tier|billing cycle)\b[^']*'/i, `${f} speaks jargon`);
  }
});
