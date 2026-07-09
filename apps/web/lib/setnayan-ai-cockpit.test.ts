/**
 * Unit suite for the Setnayan-AI Decision Cockpit derivation (item R4).
 * Pure function — every case is fully deterministic given a fixed `now`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCockpitModel,
  formatRelativeDays,
  type CockpitInput,
} from './setnayan-ai-cockpit';
import type { EventVendorRowInput } from './wedding-plan-groups';
import type { ResolvedTask } from './todays-one-thing';

const NOW = new Date('2026-03-01T00:00:00Z');

function baseInput(overrides: Partial<CockpitInput> = {}): CockpitInput {
  return {
    eventId: 'S89E-ABCDEFGHJK',
    daysOut: null,
    lockedVendorCount: 0,
    totalLockableCategories: 20,
    vendors: [],
    sponsors: [],
    topPriorityTask: null,
    paperwork: [],
    ...overrides,
  };
}

const catererConsidering: EventVendorRowInput = {
  vendor_id: 'S89V-1111111111',
  vendor_name: 'Kusina Catering',
  category: 'catering',
  status: 'considering',
};

const catererLocked: EventVendorRowInput = {
  vendor_id: 'S89V-2222222222',
  vendor_name: 'Locked Caterer',
  category: 'catering',
  status: 'contracted',
};

const startTask: ResolvedTask = {
  id: 'reception_venue',
  category: 'Reception venue',
  status: 'next_up',
  title: 'Lock your reception venue',
  whyItMatters: '…',
  ctaLabel: 'Browse reception venues',
  ctaHref: '/explore?folder=venue&from=plan#venue',
  daysContextual: 10,
};

test('empty event → 0% locked, no decisions, calm briefing', () => {
  const m = buildCockpitModel(baseInput(), NOW);
  assert.equal(m.briefing.lockedPct, 0);
  assert.equal(m.decisions.length, 0);
  assert.match(m.briefing.sentence, /nothing needs a decision/i);
});

test('options saved but nothing locked → a pick decision', () => {
  const m = buildCockpitModel(
    baseInput({ vendors: [catererConsidering] }),
    NOW,
  );
  const pick = m.decisions.find((d) => d.id === 'pick:catering');
  assert.ok(pick, 'expected a pick decision for catering');
  assert.equal(pick!.kind, 'pick');
  assert.match(pick!.detail, /1 option saved/);
  assert.equal(pick!.href, '/dashboard/S89E-ABCDEFGHJK/vendors');
});

test('a locked category produces no pick decision', () => {
  const m = buildCockpitModel(baseInput({ vendors: [catererLocked] }), NOW);
  assert.equal(
    m.decisions.some((d) => d.id === 'pick:catering'),
    false,
  );
});

test('top-priority task with no picks → a start decision, deduped against picks', () => {
  const m = buildCockpitModel(
    baseInput({ topPriorityTask: startTask }),
    NOW,
  );
  const start = m.decisions.find((d) => d.id === 'start:reception_venue');
  assert.ok(start);
  assert.equal(start!.kind, 'start');

  // When the top task's group ALSO has an unlocked pick, the start decision is
  // suppressed (the pick decision already covers that group).
  const cateringTask: ResolvedTask = {
    ...startTask,
    id: 'catering',
    category: 'Catering',
    title: 'Lock your caterer',
  };
  const m2 = buildCockpitModel(
    baseInput({
      topPriorityTask: cateringTask,
      vendors: [catererConsidering],
    }),
    NOW,
  );
  assert.equal(
    m2.decisions.some((d) => d.id === 'start:catering'),
    false,
  );
  assert.ok(m2.decisions.some((d) => d.id === 'pick:catering'));
});

test('principal sponsors started but none accepted → a role decision', () => {
  const m = buildCockpitModel(
    baseInput({
      sponsors: [
        { sponsor_tier: 'principal', invitation_status: 'invited' },
        { sponsor_tier: 'principal', invitation_status: 'pending' },
      ],
    }),
    NOW,
  );
  const role = m.decisions.find((d) => d.id === 'role:principal_sponsors');
  assert.ok(role);
  assert.match(role!.detail, /2 invited/);
});

test('accepted principal sponsor → no role decision', () => {
  const m = buildCockpitModel(
    baseInput({
      sponsors: [{ sponsor_tier: 'principal', invitation_status: 'accepted' }],
    }),
    NOW,
  );
  assert.equal(
    m.decisions.some((d) => d.id === 'role:principal_sponsors'),
    false,
  );
});

test('upcoming rail is time-ordered, soonest (incl. overdue) first', () => {
  const m = buildCockpitModel(
    baseInput({
      daysOut: 60,
      topPriorityTask: { ...startTask, status: 'overdue', daysContextual: 5 },
      paperwork: [
        { id: 'p1', label: 'PSA Birth Certificate', dueIso: '2026-03-20' },
      ],
    }),
    NOW,
  );
  // Overdue task (-5) < paperwork (+19) < wedding day (+60).
  assert.deepEqual(
    m.upcoming.map((u) => u.id),
    ['deadline:reception_venue', 'paperwork:p1', 'wedding-day'],
  );
  assert.equal(m.upcoming[0]!.daysOut, -5);
});

test('lockedPct + briefing sentence reflect the counts', () => {
  const m = buildCockpitModel(
    baseInput({
      lockedVendorCount: 5,
      totalLockableCategories: 20,
      daysOut: 30,
      vendors: [catererConsidering],
    }),
    NOW,
  );
  assert.equal(m.briefing.lockedPct, 25);
  assert.match(m.briefing.sentence, /25% locked in/);
  assert.match(m.briefing.sentence, /1 decision needs you/);
  assert.match(m.briefing.sentence, /next deadline in 4 weeks/);
});

test('formatRelativeDays edges', () => {
  assert.equal(formatRelativeDays(null), 'no date yet');
  assert.equal(formatRelativeDays(0), 'today');
  assert.equal(formatRelativeDays(1), 'tomorrow');
  assert.equal(formatRelativeDays(5), 'in 5 days');
  assert.equal(formatRelativeDays(-3), 'overdue by 3 days');
  assert.equal(formatRelativeDays(14), 'in 2 weeks');
  assert.equal(formatRelativeDays(60), 'in 2 months');
});
