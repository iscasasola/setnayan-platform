/**
 * THE 19 NOV PLAN RULINGS (PR #8019 §C) — owner, verbatim: *"Yes, all five"*.
 *
 *   1. The lowered limits apply: a shop OVER a limit keeps what it has and cannot add more.
 *   2. Pro's year is ₱39,900, set by the standing 10× rule (no typed figure — the migration derives it).
 *   3. The single extra seat and branch rows stay ACTIVE (renewals) but are never offered for sale.
 *   4. A current Pro subscriber moves to the new price at their NEXT renewal: the price is read from the catalogue when
 *      the order is made and stored on that purchase, so it never changes mid-period.
 *   5. The Films layer opens to every plan.
 *
 * Each block below fails if its ruling stops being true. The pure rules are RUN; where a rule lives in a server action
 * or in SQL, the source is read (comments stripped) because that module cannot be imported by a test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { liveCardsVerdict } from '@/lib/live-cards-cap';
import { canSeat, type SeatMember } from '@/lib/vendor-free-helper';
import { ultraAddOnsFromRows } from '@/lib/vendor-ultra-addons';
import { canBuyExtraBranches, canBuyExtraSeats, canRenewExtraBranches, VENDOR_TIERS } from '@/lib/vendor-tier-caps';
import { micrositeCan } from '@/lib/vendor-microsite';
import { addonLines } from '@/app/for-suppliers/_components/plan-table-data';

const WEB = join(__dirname, '..', '..', '..');
const REPO = join(WEB, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── 1 · over a lowered limit: keep, never add ─────────────────────────────────────────────────────────────────────
test('1 · cards — a shop over its live total cannot turn another card on, and a card already live is never asked', () => {
  assert.notEqual(liveCardsVerdict({ cap: 10, liveOthers: 27, isBranchCopy: false }), null, 'a 28th live card on a 10-card plan');
  assert.notEqual(liveCardsVerdict({ cap: 10, liveOthers: 10, isBranchCopy: false }), null);
  assert.equal(liveCardsVerdict({ cap: 10, liveOthers: 9, isBranchCopy: false }), null);
  // Nothing hides the cards a shop already has: the save asks only a card that is NOT already live.
  const save = code('app/vendor-dashboard/services/actions.ts');
  assert.match(save, /if \(!alreadyLive\) \{\s*const overLive = await liveCardsCapRefusal\(/);
});

test('1 · people — a team over its seats keeps everyone and may shuffle roles, but cannot grow', () => {
  const founder = 'founder';
  const members: SeatMember[] = [
    { user_id: founder, role: 'admin', vendor_team_member_id: 'm0' },
    ...[1, 2, 3, 4, 5].map((i) => ({ user_id: `u${i}`, role: 'agent', vendor_team_member_id: `m${i}` })),
  ];
  // Pro used to hold more people; on a plan of 1 seat this team is 4 over.
  assert.equal(canSeat({ members, founderUserId: founder, cap: 1, change: { kind: 'invite', role: 'agent' } }), false);
  assert.equal(
    canSeat({ members, founderUserId: founder, cap: 1, change: { kind: 'role', memberId: 'm2', role: 'manager' } }),
    true,
    'a role change that does not add a counted seat is allowed while over',
  );
  // Nothing in the team actions removes a member because the plan went down.
  const team = code('app/vendor-dashboard/team/actions.ts');
  assert.doesNotMatch(team, /over(Cap|Seats)[\s\S]{0,120}\.delete\(\)/);
});

test('1 · branches — the database refuses only a branch that BECOMES live past the allowance; live ones are left', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const last = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => readFileSync(join(dir, f), 'utf8').includes('FUNCTION public.enforce_included_branch_allowance()'))
    .pop();
  assert.ok(last, 'no migration defines enforce_included_branch_allowance');
  const body = readFileSync(join(dir, last!), 'utf8');
  assert.match(body, /IF NOT \(NEW\.included_in_plan AND NEW\.cancelled_at IS NULL\) THEN\s*RETURN NEW;/);
  assert.match(body, /IF TG_OP = 'UPDATE' AND OLD\.included_in_plan AND OLD\.cancelled_at IS NULL THEN\s*RETURN NEW;/);
});

// ── 3 · the single seat and branch: renewals only, never sold ─────────────────────────────────────────────────────
test('3 · no plan may buy a single extra seat or branch; a branch already bought may renew', () => {
  for (const t of VENDOR_TIERS) {
    assert.equal(canBuyExtraSeats(t), false, `${t} can buy a single seat`);
    assert.equal(canBuyExtraBranches(t), false, `${t} can buy a single branch`);
  }
  assert.equal(canRenewExtraBranches('enterprise'), true, 'a branch already bought can no longer renew');
});

test('3 · active and priced, the seat and branch rows are still not offered — the Plan page and the public tables', () => {
  const rows = [
    { sku_code: 'vendor_ultra_addon', title: 'Ultra Add-on', price_php: 2490, is_active: true },
    { sku_code: 'vendor_extra_seat', title: 'Extra seat', price_php: 990, is_active: true },
    { sku_code: 'vendor_additional_branch', title: 'Extra branch', price_php: 990, is_active: true },
  ];
  const offered = ultraAddOnsFromRows(rows).map((r) => r.kind);
  assert.deepEqual(offered, ['ultra']);
  const bySku = Object.fromEntries(rows.map((r) => [r.sku_code, `₱${r.price_php}`]));
  assert.deepEqual(addonLines(bySku).map((a) => a.kind), ['ultra'], '/for-suppliers, /for-coordinators and llms.txt list it');
  // The two shipped buy buttons ask the same rule before drawing.
  assert.match(code('app/vendor-dashboard/team/_components/team-screen.tsx'), /canBuySeats = canBuyExtraSeats\(/);
  assert.match(code('app/vendor-dashboard/shop/_components/branch-panel.tsx'), /canBuyMore = canBuyExtraBranches\(/);
});

// ── 4 · the new price at the next renewal, never mid-period ────────────────────────────────────────────────────────
test('4 · a plan purchase reads the catalogue price when it is made and stores it on that purchase', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const last = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /FUNCTION public\.create_vendor_subscription\(/.test(readFileSync(join(dir, f), 'utf8')))
    .pop();
  assert.ok(last, 'no migration defines create_vendor_subscription');
  const body = readFileSync(join(dir, last!), 'utf8');
  assert.match(body, /SELECT price_php, offering_type INTO v_price, v_offering[\s\S]{0,200}FROM public\.vendor_billing_catalog/);
  assert.match(body, /list_price_php/, 'the purchase no longer keeps the price it was sold at');
  // The renewal is a new purchase — nothing re-prices a running plan when the catalogue moves.
  const sub = code('app/vendor-dashboard/subscription/actions.ts');
  assert.match(sub, /supabase\.rpc\('create_vendor_subscription'/);
});

// ── 5 · the Films layer is on every plan ──────────────────────────────────────────────────────────────────────────
test('5 · every plan may save films to its shop page', () => {
  for (const t of [null, 'free', 'verified', 'solo', 'pro', 'enterprise']) {
    assert.equal(micrositeCan(t).isEnterprise, true, `${t ?? 'no plan'} cannot add films`);
  }
  // The films save asks that same answer — so opening it to every plan opens the save too.
  assert.match(code('app/vendor-dashboard/actions.ts'), /vendorPaywallApplies\(micrositeCan\(rowTyped\?\.tier_state\)\.isEnterprise\)/);
});
