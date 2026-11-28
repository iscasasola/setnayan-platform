/**
 * 🔒 The Attire Maker's plans (owner 2026-11-28): one answer for who may do what.
 * Run from apps/web: npx tsx --test lib/gown-plan.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOWN_PLAN_DAYS,
  GOWN_PLAN_SKUS,
  GOWN_TRIAL_DAYS,
  gownPlanAfterPayment,
  gownPlanAllows,
  gownPlanLine,
  gownPlanRefusal,
  gownPlanState,
  gownPlanTierOfSku,
  type GownPlanFacts,
  type GownPlanUse,
} from './gown-plan';

const DAY = 86_400_000;
const NOW = Date.parse('2026-12-01T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();
const facts = (o: Partial<GownPlanFacts> = {}): GownPlanFacts => ({ eligible: true, trialStartedAt: null, plan: null, ...o });
const USES: GownPlanUse[] = ['read', 'make', 'full'];
const allows = (f: GownPlanFacts) => USES.filter((u) => gownPlanAllows(gownPlanState(f, NOW), u));

test('1 · only a shop with a custom gown design card; an unread fact refuses everything', () => {
  assert.deepEqual(gownPlanState(facts({ eligible: false, plan: { tier: 'full', until: iso(NOW + DAY) } }), NOW), { s: 'not_eligible' }, 'a paid plan opened it for a shop with no gown card');
  assert.deepEqual(allows(facts({ eligible: false })), []);
  assert.deepEqual(gownPlanState(facts({ eligible: null }), NOW), { s: 'unread' });
  assert.deepEqual(allows(facts({ eligible: null })), []);
});

test('2 · the 30-day trial: everything, from the first open, and then it pauses (her work stays readable)', () => {
  assert.equal(GOWN_TRIAL_DAYS, 30);
  assert.deepEqual(gownPlanState(facts(), NOW), { s: 'fresh' });
  assert.deepEqual(allows(facts()), ['read', 'make'], 'before the first open, nothing full-only runs');
  const day1 = facts({ trialStartedAt: iso(NOW) });
  assert.deepEqual(gownPlanState(day1, NOW), { s: 'trial', endsAt: iso(NOW + 30 * DAY), daysLeft: 30 });
  assert.deepEqual(allows(day1), ['read', 'make', 'full'], 'the trial has a cap');
  const lastMinute = facts({ trialStartedAt: iso(NOW - 30 * DAY + 60_000) });
  assert.equal(gownPlanState(lastMinute, NOW).s, 'trial');
  const over = facts({ trialStartedAt: iso(NOW - 30 * DAY) });
  assert.deepEqual(gownPlanState(over, NOW), { s: 'paused', was: 'trial' });
  assert.deepEqual(allows(over), ['read'], 'a paused maker makes something, or hides her work');
});

test('3 · Use and save makes and keeps; Full adds the pattern, pages and quotation; a lapsed plan pauses', () => {
  const use = facts({ trialStartedAt: iso(NOW - 90 * DAY), plan: { tier: 'use', until: iso(NOW + 5 * DAY) } });
  assert.deepEqual(gownPlanState(use, NOW), { s: 'paid', tier: 'use', until: iso(NOW + 5 * DAY), daysLeft: 5 });
  assert.deepEqual(allows(use), ['read', 'make']);
  const full = facts({ plan: { tier: 'full', until: iso(NOW + DAY) } });
  assert.deepEqual(allows(full), ['read', 'make', 'full']);
  const lapsed = facts({ trialStartedAt: iso(NOW - 90 * DAY), plan: { tier: 'full', until: iso(NOW - 1) } });
  assert.deepEqual(gownPlanState(lapsed, NOW), { s: 'paused', was: 'full' });
  assert.deepEqual(allows(lapsed), ['read']);
  // A plan bought before she ever opened it is paid, not a trial (the trial is never stacked on top).
  assert.equal(gownPlanState(facts({ plan: { tier: 'use', until: iso(NOW + DAY) } }), NOW).s, 'paid');
});

test('4 · a paid month adds 30 days from today, or from where the plan ends; the tier is the one bought', () => {
  assert.equal(GOWN_PLAN_DAYS, 30);
  assert.deepEqual(gownPlanAfterPayment(null, 'use', NOW), { tier: 'use', until: iso(NOW + 30 * DAY) });
  assert.deepEqual(gownPlanAfterPayment({ tier: 'use', until: iso(NOW + 10 * DAY) }, 'use', NOW), { tier: 'use', until: iso(NOW + 40 * DAY) }, 'a renewal lost the days left');
  assert.deepEqual(gownPlanAfterPayment({ tier: 'use', until: iso(NOW - 10 * DAY) }, 'full', NOW), { tier: 'full', until: iso(NOW + 30 * DAY) }, 'a lapsed plan charged for days already gone');
  assert.equal(gownPlanTierOfSku(GOWN_PLAN_SKUS.use), 'use');
  assert.equal(gownPlanTierOfSku(GOWN_PLAN_SKUS.full), 'full');
  assert.equal(gownPlanTierOfSku('vendor_tool_attire_tool'), null, 'the retired one-time row still opens a plan');
});

test('5 · the words: where she stands and why a press is refused, never a price', () => {
  const lines = [
    gownPlanLine(gownPlanState(facts({ trialStartedAt: iso(NOW - 29 * DAY) }), NOW)),
    gownPlanLine(gownPlanState(facts({ plan: { tier: 'use', until: iso(NOW + 12 * DAY) } }), NOW)),
    gownPlanLine(gownPlanState(facts(), NOW)),
    gownPlanLine({ s: 'paused', was: 'trial' }),
  ];
  assert.deepEqual(lines, ['Free trial · 1 day left', 'Use and save · renews by hand in 12 days', 'Free for 30 days from your first design.', 'Paused · your work is kept']);
  assert.match(gownPlanRefusal({ s: 'paused', was: 'trial' }, 'make'), /Your work is kept/);
  assert.match(gownPlanRefusal({ s: 'paid', tier: 'use', until: iso(NOW + DAY), daysLeft: 1 }, 'full'), /Full plan/);
  const src = readFileSync(join(__dirname, 'gown-plan.ts'), 'utf8');
  assert.doesNotMatch(src, /₱|\b\d{3,}\/mo|\b1,?990\b|\b3,?490\b|\b499\b/, 'a price was typed into the plan rules, or a comment');
});
