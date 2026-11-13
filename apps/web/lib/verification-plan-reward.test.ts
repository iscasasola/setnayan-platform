/**
 * verification-plan-reward.test.ts — 🏅 the Ultra weeks a verification gives (owner, 12 Nov 2026): *"Regular verified
 * will add one set 4-week ultra for vendors, and founders verified will give them 3 sets of the 4-week ultra"*.
 * The pure rule here; the once-per-shop check and both call sites are pinned below by source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ULTRA_SETS, ULTRA_TIER, PLAN_REWARD_SET_DAYS, VERIFICATION_REWARD_CARRIES_PLAN_GIFTS, planIsVerificationReward, ultraRewardWrite } from './verification-plan-reward';
import { stripComments } from './strip-comments';

const NOW = new Date('2026-11-13T05:00:00.000Z');
const days = (iso: string) => Math.round((Date.parse(iso) - NOW.getTime()) / 86_400_000);

test('the owner’s numbers: founders 3 sets, regular 1 set, a set is four weeks, Ultra is `enterprise`', () => {
  assert.deepEqual(ULTRA_SETS, { founders: 3, regular: 1 });
  assert.equal(PLAN_REWARD_SET_DAYS, 28);
  assert.equal(ULTRA_TIER, 'enterprise');
});

test('a Free or Verified shop starts Ultra today, as a comp that ends by itself', () => {
  const f = ultraRewardWrite({ tier_state: 'free' }, 'founders', NOW)!;
  assert.deepEqual([f.tier_state, f.tier_source, days(f.tier_expires_at)], ['enterprise', 'admin_comp', 84]);
  const r = ultraRewardWrite({ tier_state: 'verified', tier_source: null }, 'regular', NOW)!;
  assert.equal(days(r.tier_expires_at), 28);
  assert.equal(days(ultraRewardWrite(null, 'regular', NOW)!.tier_expires_at), 28);
});

test('a comped Ultra still running is extended from its own end day — the weeks stack', () => {
  const end = new Date(NOW.getTime() + 10 * 86_400_000).toISOString();
  const w = ultraRewardWrite({ tier_state: 'enterprise', tier_source: 'admin_comp', tier_expires_at: end }, 'founders', NOW)!;
  assert.equal(days(w.tier_expires_at), 94);
  // An Ultra already over starts again today.
  const over = new Date(NOW.getTime() - 86_400_000).toISOString();
  assert.equal(days(ultraRewardWrite({ tier_state: 'enterprise', tier_source: 'admin_comp', tier_expires_at: over }, 'regular', NOW)!.tier_expires_at), 28);
  // A comped Supplier Plus or Pro becomes Ultra today.
  assert.equal(ultraRewardWrite({ tier_state: 'pro', tier_source: 'admin_comp', tier_expires_at: end }, 'regular', NOW)!.tier_state, 'enterprise');
});

test('a plan the shop pays for itself is never overwritten, and an open-ended comped Ultra needs nothing', () => {
  assert.equal(ultraRewardWrite({ tier_state: 'pro', tier_source: 'self_serve', tier_expires_at: null }, 'founders', NOW), null);
  assert.equal(ultraRewardWrite({ tier_state: 'enterprise', tier_source: 'admin_comp', tier_expires_at: null }, 'founders', NOW), null);
});

test('once per shop: the server checks for an earlier reward first, and both doors call it after the badge is written', () => {
  const server = stripComments(readFileSync('lib/verification-plan-reward.server.ts', 'utf8'));
  const check = server.indexOf(".eq('action', PLAN_REWARD_AUDIT_ACTION)");
  const write = server.indexOf(".from('vendor_profiles')\n    .update({ tier_state: write.tier_state");
  assert.ok(check > 0 && write > check, 'the earlier-reward check must come before the plan write');
  const founders = stripComments(readFileSync('app/admin/vendors/verification-bypass-actions.ts', 'utf8'));
  assert.match(founders, /grantVerificationPlanReward\(admin, \{ vendorProfileId: vendorId, door: 'founders'/);
  assert.ok(founders.indexOf("door: 'founders'") > founders.indexOf("from('vendor_verification_bypasses').upsert"), 'the reward runs after the vouch is written');
  // The decision engine moved to its own module (2026-11-14) — admin and automatic grants share it.
  const regular = stripComments(readFileSync('lib/verification-decision.server.ts', 'utf8'));
  assert.match(regular, /input\.decision === 'approved' && toState === 'verified' && fromState !== 'verified'\) \{\s*await grantVerificationPlanReward\(admin, \{[\s\S]{0,120}door: 'regular'/);
});

test('the reward is Ultra’s tools, never its 4-weekly gifts — and the plan-gift table says so (owner 12 Nov 2026)', () => {
  assert.equal(VERIFICATION_REWARD_CARRIES_PLAN_GIFTS, false);
  const gifts = readFileSync('lib/badge-rewards.ts', 'utf8');
  const at = gifts.indexOf('export const PLAN_PERIOD_GIFTS');
  assert.ok(at > 0, 'PLAN_PERIOD_GIFTS moved');
  assert.match(gifts.slice(Math.max(0, at - 900), at), /NEVER FOR A PLAN GIVEN AS A VERIFICATION REWARD[\s\S]*readVerificationRewardPlanUntil/, 'the plan-gift table no longer says a verification reward is excluded');
  // The reward's own Ultra is recognised; a plan an admin moved by hand afterwards is not.
  const w = ultraRewardWrite({ tier_state: 'free' }, 'founders', NOW)!;
  assert.equal(planIsVerificationReward(w, w.tier_expires_at), true);
  assert.equal(planIsVerificationReward({ ...w, tier_expires_at: new Date(NOW.getTime() + 400 * 86_400_000).toISOString() }, w.tier_expires_at), false);
  assert.equal(planIsVerificationReward(w, null), false);
});
