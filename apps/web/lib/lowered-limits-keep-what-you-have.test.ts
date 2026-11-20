/**
 * 🪜 THE LOWERED LIMITS APPLY — A SHOP OVER ONE KEEPS WHAT IT HAS AND CANNOT ADD MORE.
 *
 * Owner ruled the change plan §C item 1 on 2026-11-19 ("Yes, all five" — specs DECISION_LOG, "SUPPLIER PLANS §C — FIVE
 * CALLS"): the 19 Nov numbers (people · live cards · branches) apply to every existing shop; nothing it already has is
 * taken away; it simply cannot add another until it is back under the number. Every number here is read from
 * `TIER_CAPS` — never typed — so the test follows the table.
 *
 * Three gates, the three limits the plans now sell:
 *   live cards → `liveCardsVerdict` (turning one more card LIVE; making a card is never refused)
 *   branches   → `includedBranchesLeft` (the database gate holds the same rule: vendor-plan-allowances.db.test.ts GRANDFATHERED)
 *   people     → `canSeat` (an invite past the cap is refused; a role change that does not grow the count is not)
 * And nothing in the 19 Nov migration hides a card, cancels a branch or removes a member.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { liveCardsVerdict } from './live-cards-cap';
import { TIER_CAPS, includedBranchesLeft } from './vendor-tier-caps';
import { canSeat, type SeatMember } from './vendor-free-helper';

const HERE = dirname(fileURLToPath(import.meta.url));

test('LIVE CARDS: a Pro shop already over its live cards keeps them all and cannot turn another on', () => {
  const cap = TIER_CAPS.pro.serviceCardsTotal;
  assert.ok(Number.isFinite(cap) && cap > 0, 'the scenario needs a finite Pro card limit');
  // Over the lowered number (e.g. it had more live under the old table): the next one is refused…
  assert.match(liveCardsVerdict({ cap, liveOthers: cap + 5, isBranchCopy: false }) ?? '', /Hide one, or upgrade/);
  // …exactly at the number too, and one under still goes live.
  assert.notEqual(liveCardsVerdict({ cap, liveOthers: cap, isBranchCopy: false }), null);
  assert.equal(liveCardsVerdict({ cap, liveOthers: cap - 1, isBranchCopy: false }), null);
});

test('BRANCHES: a shop over its lowered branches keeps every one and has none left — never a negative', () => {
  const pro = TIER_CAPS.pro.branchesIncluded;
  assert.equal(includedBranchesLeft('pro', pro + 2), 0, 'an over-limit Pro shop was offered another branch');
  assert.equal(includedBranchesLeft('pro', pro), 0);
  assert.equal(includedBranchesLeft('enterprise', TIER_CAPS.enterprise.branchesIncluded - 1), 1);
});

test('PEOPLE: a team over its lowered seats keeps everyone, may swap roles, and cannot invite another', () => {
  const cap = TIER_CAPS.pro.agentAccounts; // seats beyond the owner
  const founder = 'owner';
  const members: SeatMember[] = [{ user_id: founder, role: 'admin' }];
  // Two more counted members than the plan allows (a lowered limit), none of them the free Helper.
  for (let i = 0; i < cap + 2; i++) members.push({ user_id: `m${i}`, role: 'staff', vendor_team_member_id: `t${i}` });
  assert.equal(canSeat({ members, founderUserId: founder, cap, change: { kind: 'invite', role: 'staff' } }), false, 'an over-limit team invited another counted member');
  // A role change that does not grow the counted team stays allowed — nobody is pushed out.
  assert.equal(canSeat({ members, founderUserId: founder, cap, change: { kind: 'role', memberId: 't0', role: 'admin' } }), true);
});

test('NOTHING IS TAKEN AWAY: the 19 Nov migration hides no card, cancels no branch and removes no member', () => {
  const sql = readFileSync(join(HERE, '../../../supabase/migrations/20271351415438_ultra_addon_and_the_19_nov_plan_numbers.sql'), 'utf8')
    .replace(/--.*$/gm, '');
  assert.doesNotMatch(sql, /UPDATE\s+public\.vendor_services\b/i, 'the migration switches cards off');
  assert.doesNotMatch(sql, /UPDATE\s+public\.vendor_branches\b/i, 'the migration cancels branches');
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.vendor_team_members\b/i, 'the migration removes team members');
});
