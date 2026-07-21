/**
 * Setnayan AI activity — live-figure formatter invariants (node:test via tsx).
 *
 * Locks the short strings the ACTIVE studio surface appends to each capability:
 * correct pluralization and the reassuring zero-state fallbacks (so a quiet
 * event reads "you're clear", never "0 deadlines").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  figureRanked,
  figureDeadlines,
  figureNextMove,
  figurePayments,
  type AiActivity,
} from './setnayan-ai-activity';

function activity(over: {
  lockedPct?: number;
  decisionCount?: number;
  vendorsTracked?: number;
  deadlinesTracked?: number;
  paymentsDue30d?: number;
}): AiActivity {
  return {
    cockpit: {
      briefing: {
        lockedPct: over.lockedPct ?? 0,
        decisionCount: over.decisionCount ?? 0,
        nextDeadlineDays: null,
        sentence: 'You’re 0% locked in.',
      },
      decisions: [],
      upcoming: [],
    },
    vendorsTracked: over.vendorsTracked ?? 0,
    deadlinesTracked: over.deadlinesTracked ?? 0,
    paymentsDue30d: over.paymentsDue30d ?? 0,
  };
}

test('figureRanked: percent + singular/plural vendor count', () => {
  assert.equal(
    figureRanked(activity({ lockedPct: 62, vendorsTracked: 4 })),
    '62% locked in · 4 vendors on your board',
  );
  assert.equal(
    figureRanked(activity({ lockedPct: 0, vendorsTracked: 1 })),
    '0% locked in · 1 vendor on your board',
  );
});

test('figureDeadlines: counts when > 0, reassures at 0', () => {
  assert.equal(figureDeadlines(activity({ deadlinesTracked: 3 })), '3 deadlines on watch');
  assert.equal(figureDeadlines(activity({ deadlinesTracked: 1 })), '1 deadline on watch');
  assert.equal(figureDeadlines(activity({ deadlinesTracked: 0 })), 'Nothing overdue — you’re clear');
});

test('figureNextMove: decisions waiting, or calm at 0', () => {
  assert.equal(figureNextMove(activity({ decisionCount: 2 })), '2 decisions waiting on you');
  assert.equal(figureNextMove(activity({ decisionCount: 1 })), '1 decision waiting on you');
  assert.equal(
    figureNextMove(activity({ decisionCount: 0 })),
    'Nothing needs a decision right now',
  );
});

test('figurePayments: due count, or the reassuring zero-state', () => {
  assert.equal(
    figurePayments(activity({ paymentsDue30d: 2 })),
    '2 payments due in the next 30 days',
  );
  assert.equal(
    figurePayments(activity({ paymentsDue30d: 1 })),
    '1 payment due in the next 30 days',
  );
  assert.equal(
    figurePayments(activity({ paymentsDue30d: 0 })),
    'No payments due in the next 30 days',
  );
});
