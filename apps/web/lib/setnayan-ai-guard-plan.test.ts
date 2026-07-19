/**
 * Setnayan AI guard emission planner (node:test via tsx).
 *
 * Locks the restraint discipline that makes guard notifications safe to ship:
 * guard-category-only, persistent-cooldown dedup, the per-sweep cap, the
 * GRD-01 → email-type channel split, and the day-before scheduled-send math.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Intervention } from './setnayan-ai-triggers';
import {
  planGuardNotifications,
  planPaymentDueReminder,
  GUARD_NOTIFY_MAX_PER_SWEEP,
} from './setnayan-ai-guard-plan';

const paymentDue = (vendor: string, dueDate: string, daysLeft: number): Intervention => ({
  templateId: 'GRD-01',
  category: 'guard',
  slots: { vendor, amount: '20,000', due_date: dueDate, days_left: daysLeft },
  priority: 100 - daysLeft,
  dedupeKey: `GRD-01:${vendor}:${dueDate}`,
});

const overBudget: Intervention = {
  templateId: 'GRD-05',
  category: 'guard',
  slots: { over_amount: '15,000', top_driver_category: 'catering' },
  priority: 80,
  dedupeKey: 'GRD-05:budget',
};

const statutory: Intervention = {
  templateId: 'GRD-02',
  category: 'guard',
  slots: { document: 'Marriage License', deadline: '2026-08-01', days_left: 30 },
  priority: 65,
  dedupeKey: 'GRD-02:Marriage License',
};

const secretaryNudge: Intervention = {
  templateId: 'SEC-04',
  category: 'secretary',
  slots: { vendor: 'A photography vendor', days: 5 },
  priority: 50,
  dedupeKey: 'SEC-04:A photography vendor',
};

const OPTS = { eventId: 'ev-1', cooldown: new Set<string>() };

test('emission gate: only GUARD interventions notify — secretary stays in the digest', () => {
  const plan = planGuardNotifications([secretaryNudge, overBudget], OPTS);
  assert.equal(plan.length, 1);
  assert.equal(plan[0]!.templateId, 'GRD-05');
});

test('channel split: GRD-01 → ai_payment_due (email-allowlisted); other guards → ai_guard_alert', () => {
  const plan = planGuardNotifications(
    [paymentDue('Bloom Florals', '2026-02-01', 3), overBudget, statutory],
    OPTS,
  );
  const byTemplate = new Map(plan.map((n) => [n.templateId, n]));
  assert.equal(byTemplate.get('GRD-01')!.type, 'ai_payment_due');
  assert.equal(byTemplate.get('GRD-05')!.type, 'ai_guard_alert');
  assert.equal(byTemplate.get('GRD-02')!.type, 'ai_guard_alert');
});

test('cooldown: a dedupe key notified within the window never re-fires', () => {
  const plan = planGuardNotifications(
    [paymentDue('Bloom Florals', '2026-02-01', 3), overBudget],
    { eventId: 'ev-1', cooldown: new Set(['GRD-01:Bloom Florals:2026-02-01']) },
  );
  assert.deepEqual(
    plan.map((n) => n.templateId),
    ['GRD-05'],
  );
});

test('per-sweep cap: at most GUARD_NOTIFY_MAX_PER_SWEEP notifications, highest priority first', () => {
  const many = [
    paymentDue('A', '2026-02-01', 1), // priority 99
    paymentDue('B', '2026-02-02', 2), // 98
    paymentDue('C', '2026-02-03', 3), // 97
    statutory, // 65
    overBudget, // 80
  ];
  const plan = planGuardNotifications(many, OPTS);
  assert.equal(plan.length, GUARD_NOTIFY_MAX_PER_SWEEP);
  // Sooner payments outrank; the statutory (65) + over-budget (80) don't make the cut
  // against 99/98/97 — actually over-budget(80) loses to the three payments.
  assert.deepEqual(
    plan.map((n) => n.dedupeKey),
    ['GRD-01:A:2026-02-01', 'GRD-01:B:2026-02-02', 'GRD-01:C:2026-02-03'],
  );
});

test('rendered body + deep link: deterministic template copy, event-scoped URL', () => {
  const plan = planGuardNotifications([paymentDue('Bloom Florals', '2026-02-01', 3)], OPTS);
  assert.equal(plan.length, 1);
  assert.match(plan[0]!.body, /Bloom Florals/);
  assert.match(plan[0]!.body, /₱20,000/);
  assert.match(plan[0]!.body, /3 days away/);
  assert.equal(plan[0]!.relatedUrl, '/dashboard/ev-1/budget');
  assert.equal(plan[0]!.title, 'Payment due soon — Bloom Florals');
});

test('GRD-02 deep-links to the paperwork pipeline', () => {
  const plan = planGuardNotifications([statutory], OPTS);
  assert.equal(plan[0]!.relatedUrl, '/dashboard/ev-1/paperwork');
});

// ---- planPaymentDueReminder (Resend scheduledAt, cron-free) ------------------

test('day-before reminder: scheduled for 09:00 Asia/Manila the day before the due date', () => {
  const now = new Date('2026-01-25T00:00:00.000Z');
  const r = planPaymentDueReminder(paymentDue('Bloom Florals', '2026-02-01', 7), now)!;
  assert.ok(r);
  // 2026-01-31 09:00 +08:00 === 2026-01-31 01:00 UTC.
  assert.equal(r.scheduledAtIso, '2026-01-31T01:00:00.000Z');
  assert.equal(r.dedupeKey, 'GRD-01:Bloom Florals:2026-02-01#d1');
  assert.match(r.subject, /due tomorrow/);
  assert.match(r.bodyText, /already settled/i);
});

test('day-before reminder: skipped when the due date is too close (immediate email covers it)', () => {
  const now = new Date('2026-01-31T06:00:00.000Z'); // past the 09:00+08 slot minus runway
  assert.equal(planPaymentDueReminder(paymentDue('Bloom Florals', '2026-02-01', 0), now), null);
});

test('day-before reminder: only GRD-01 plans one; bad dates never schedule', () => {
  assert.equal(planPaymentDueReminder(overBudget, new Date()), null);
  assert.equal(
    planPaymentDueReminder(paymentDue('X', 'not-a-date', 3), new Date('2026-01-01T00:00:00Z')),
    null,
  );
});
