/**
 * The Plan screen's words are DERIVED, never typed (simpler supplier dashboard step 6).
 *
 *   · "What <plan> gives you" follows TIER_CAPS — move a cap and the line moves (checklist 16.2: the prototype's
 *     typed numbers were wrong).
 *   · The booking-fee line follows the LIVE schedule handed in (checklist X2: 5 % to ₱100k, 1 % after, ₱50 floor —
 *     never a flat rate) and the standing's own ordinal for "N of 5 used".
 *   · An unread standing never reads as free.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BOOKING_FEE, type BookingFeeSchedule } from './booking-fee';
import { TIER_CAPS } from './vendor-tier-caps';
import { bookingFeeRow, planGivesLines, planPickLine } from './vendor-plan-rows';

const line = (tier: string, key: string, paywallOn = true) =>
  planGivesLines(tier, paywallOn).find((l) => l.key === key)?.line;

test('what a plan gives is read from TIER_CAPS', () => {
  assert.match(line('pro', 'services')!, new RegExp(`^${TIER_CAPS.pro.serviceCardsTotal} in total`));
  assert.match(line('pro', 'helpers')!, new RegExp(`^${TIER_CAPS.pro.agentAccounts} team seats \\+ 1 free Helper`));
  assert.equal(line('enterprise', 'services'), '68 in total · 12 kinds of work'); // Ultra, owner 2026-11-19
  // 🔓 No reach line on any plan since 2026-11-19 (owner: "unlock the range. not plan dependend anymore").
  for (const t of ['free', 'verified', 'solo', 'pro', 'enterprise']) assert.equal(line(t, 'reach'), undefined, t);
  // Own web address from Plus up ("website applies to solo as well"); below it, the plan is named from the table.
  assert.equal(line('solo', 'web'), 'Yes');
  // The same shop page on every plan since 2026-11-19 (owner: "shop page also is 1 for all already").
  assert.equal(line('verified', 'web'), 'Yes');
  assert.equal(line('free', 'web'), 'Yes');
  // Branches (owner 2026-11-04, "branches 0,0,3,10"; only Ultra buys more).
  assert.equal(line('solo', 'branches'), 'Not on this plan');
  assert.equal(line('pro', 'branches'), `${TIER_CAPS.pro.branchesIncluded} included`);
  assert.equal(line('enterprise', 'branches'), `${TIER_CAPS.enterprise.branchesIncluded} included · more can be added`);
});

test('with the paywall OFF, a plan with no seats gets the entry plan’s, and says insights are open', () => {
  assert.match(line('free', 'helpers', true)!, /^0 team seats \+ 1 free Helper/);
  assert.match(line('free', 'helpers', false)!, /^1 team seat \+ 1 free Helper/);
  assert.equal(line('free', 'insights', false), 'All of it — open to every plan today');
  assert.equal(line('free', 'waitlist', true), 'You choose, up to 10 a date'); // no plan limit, 2026-11-18
});

test('a changed table changes the line (no typed copy survives an edit)', () => {
  const was = TIER_CAPS.solo.whitelistPerDate;
  try {
    (TIER_CAPS.solo as { whitelistPerDate: number }).whitelistPerDate = 7;
    assert.equal(line('solo', 'holding'), '7 a date');
  } finally {
    (TIER_CAPS.solo as { whitelistPerDate: number }).whitelistPerDate = was;
  }
});

const LIVE: BookingFeeSchedule = { ...BOOKING_FEE, rate: 0.04, tailRate: 0.02, tier1LimitPhp: 80_000, minPhp: 75 };

test('the fee line reads the LIVE schedule handed in, never the code default', () => {
  const row = bookingFeeRow({ kind: 'billable', ordinal: 9, ordinalIsFrozen: false, schedule: LIVE }, 0)!;
  assert.match(row.line, /^4% of the first ₱80,000, then 2%, minimum ₱75/);
  assert.doesNotMatch(row.line, /5%/);
});

test('20 Nov: no free first booking is promised; a place frozen free reads Waived; tickets and every-Nth are named', () => {
  const frozen = bookingFeeRow({ kind: 'free', ordinal: 1, ordinalIsFrozen: true, schedule: BOOKING_FEE }, 0)!;
  assert.deepEqual(frozen.badge, { tone: 'ok', word: 'Waived' });
  assert.doesNotMatch(frozen.line, /first booking/i);
  const billed = bookingFeeRow({ kind: 'billable', ordinal: 1, ordinalIsFrozen: false, schedule: BOOKING_FEE }, 0)!;
  assert.equal(billed.badge, null);
  assert.equal(billed.line, '5% of the first ₱100,000, then 3%, minimum ₱50, never more than ₱100,000');
  const flat = bookingFeeRow({ kind: 'billable', ordinal: 1, ordinalIsFrozen: false, schedule: BOOKING_FEE, unverified: true }, 0)!;
  assert.equal(flat.line, '5% of the whole booking, minimum ₱50, never more than ₱100,000');
  const ticket = bookingFeeRow({ kind: 'billable', ordinal: 3, ordinalIsFrozen: false, schedule: BOOKING_FEE, badgeReward: 'next' }, 0)!;
  assert.match(ticket.line, /ticket pays your next one by itself/);
  assert.doesNotMatch(ticket.line, /redeem/i);
  const nth = bookingFeeRow({ kind: 'billable', ordinal: 9, ordinalIsFrozen: true, schedule: BOOKING_FEE, platformFree: 100_000 }, 0)!;
  assert.match(nth.line, /Setnayan's 100,000th booking fee — free/);
});

test('waived (launch offer / promotion) reads Waived; a bill waiting outranks it', () => {
  const launch = { kind: 'launch_offer' as const, schedule: BOOKING_FEE, cap: 2000, papicCredits: 50, isFrozen: false, number: null };
  assert.equal(bookingFeeRow(launch, 0)!.badge?.word, 'Waived');
  assert.deepEqual(bookingFeeRow(launch, 2)!.badge, { tone: 'no', word: '2 to pay' });
});

test('an unread standing never says free; the fee off says nothing', () => {
  const row = bookingFeeRow({ kind: 'unreadable' }, 0)!;
  assert.doesNotMatch(row.line, /free|waived|₱0/i);
  assert.equal(bookingFeeRow({ kind: 'silent' }, 0), null);
});

test('picking a plan says what happens, by the live ladder', () => {
  assert.match(planPickLine('solo', 'pro', '31 October 2026'), /^Starts the day your payment is confirmed/);
  assert.equal(planPickLine('pro', 'solo', '31 October 2026'), 'Starts when Pro ends · 31 October 2026');
  assert.equal(planPickLine('pro', 'free', '31 October 2026'), 'Nothing renews by itself · Pro ends 31 October 2026, then Free');
  assert.equal(planPickLine('free', 'free', null), 'You are on Free — nothing to pay');
});

test('owner 21/22 Nov: Specialized tools come with Pro and Ultra only — Plus reads the free set, never "All included"', () => {
  assert.doesNotMatch(line('solo', 'tools') ?? '', /^All included$/);
  assert.equal(line('solo', 'tools'), 'The free set · all of them from Pro');
  assert.equal(line('verified', 'tools'), 'The free set · all of them from Pro');
  assert.equal(line('pro', 'tools'), 'All included');
  assert.equal(line('enterprise', 'tools'), 'All included');
});
