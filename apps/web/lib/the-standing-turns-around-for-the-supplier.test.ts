/**
 * the-standing-turns-around-for-the-supplier.test.ts
 *
 * "Where you stand" was written in the couple's second person. On the
 * supplier's own thread page it would have read backwards — telling a supplier
 * "waiting on you" about a quote they are in fact waiting on — so for three
 * weeks the supplier got no standing line at all.
 *
 * 2026-09-10 turned the subject around INSIDE the one derivation (a `viewer`
 * fact), rather than writing a second sentence. These assertions pin both
 * halves of that: the supplier is never told the couple's wait is theirs, and
 * the couple's sentence did not move by a single character.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupplierStanding,
  standingSentence,
  type StandingSpeaker,
  type SupplierStandingFacts,
} from '@/lib/supplier-standing';
import type { ThreadStage } from '@/lib/vendor-thread-stage';

const NOW = Date.parse('2026-09-10T04:00:00.000Z');
const YESTERDAY = NOW - 86_400_000 - 3_600_000;
const TWELVE_DAYS = NOW - 12 * 86_400_000 - 3_600_000;

const STAGES: ThreadStage[] = ['inquiry', 'quoted', 'booked', 'completed', 'cancelled'];
const SPEAKERS: Array<StandingSpeaker | null> = ['couple', 'vendor', null];
const WHENS = [NOW - 60_000, YESTERDAY, TWELVE_DAYS];

function facts(over: Partial<SupplierStandingFacts>): SupplierStandingFacts {
  return {
    stage: 'quoted',
    hasThread: true,
    quotedAmountPhp: 187_500,
    lastSpeaker: 'vendor',
    lastSaidAtMs: YESTERDAY,
    nowMs: NOW,
    ...over,
  };
}

const sentence = (f: SupplierStandingFacts) => {
  const s = buildSupplierStanding(f);
  return s ? standingSentence(s) : null;
};

test('🔑 the supplier is never told "waiting on you" — every rung, speaker and age', () => {
  let checked = 0;
  for (const stage of STAGES) {
    for (const lastSpeaker of SPEAKERS) {
      for (const lastSaidAtMs of WHENS) {
        const s = buildSupplierStanding(facts({ stage, lastSpeaker, lastSaidAtMs, viewer: 'vendor' }));
        if (!s) continue;
        checked++;
        const text = standingSentence(s);
        assert.doesNotMatch(text, /waiting on you/i, `${stage}/${lastSpeaker}: "${text}"`);
        // And nothing in the supplier's line is painted as a need: a supplier's
        // decisions arrive as Decisions entries, counted there.
        assert.ok(!s.segments.some((g) => g.kind === 'need'), `${stage}/${lastSpeaker} grew a need`);
        assert.equal(s.needsYou, false);
      }
    }
  }
  assert.ok(checked > 10, `only ${checked} sentences were built — the sweep is not sweeping`);
});

test('the couple\'s sentence did not move — omitting the viewer equals "couple", everywhere', () => {
  for (const stage of STAGES) {
    for (const lastSpeaker of SPEAKERS) {
      for (const lastSaidAtMs of WHENS) {
        const base = facts({ stage, lastSpeaker, lastSaidAtMs });
        assert.deepEqual(
          buildSupplierStanding(base),
          buildSupplierStanding({ ...base, viewer: 'couple' }),
          `${stage}/${lastSpeaker}: the default reader changed`,
        );
      }
    }
  }
});

test('a quote out with the couple: the couple owes it, the supplier waits — the same fact, both ways', () => {
  const f = facts({ stage: 'quoted', lastSpeaker: 'vendor', lastSaidAtMs: YESTERDAY });
  assert.equal(sentence({ ...f, viewer: 'couple' }), 'Quoted ₱187,500 · waiting on you');
  assert.equal(sentence({ ...f, viewer: 'vendor' }), 'Quoted ₱187,500 · waiting on them');
});

test('a couple who wrote last is news for the supplier, not an alarm', () => {
  const s = buildSupplierStanding(facts({ stage: 'booked', lastSpeaker: 'couple', viewer: 'vendor' }));
  assert.ok(s);
  assert.equal(standingSentence(s), 'Booked · They replied yesterday');
  assert.equal(s.replied, true);
  assert.equal(s.segments.at(-1)?.kind, 'said');
});

test('the supplier who wrote last and heard nothing reads the same quiet line the couple would', () => {
  // "No reply · 12 days" is about whoever is not you, so it is true from either side.
  assert.equal(
    sentence(facts({ stage: 'booked', lastSpeaker: 'vendor', lastSaidAtMs: TWELVE_DAYS, viewer: 'vendor' })),
    'Booked · No reply · 12 days',
  );
  assert.equal(
    sentence(facts({ stage: 'booked', lastSpeaker: 'couple', lastSaidAtMs: TWELVE_DAYS, viewer: 'couple' })),
    'Booked · No reply · 12 days',
  );
});

test('a finished or ended conversation says nothing about replies, to either reader', () => {
  for (const stage of ['completed', 'cancelled'] as const) {
    for (const viewer of ['couple', 'vendor'] as const) {
      const text = sentence(facts({ stage, lastSpeaker: 'couple', lastSaidAtMs: TWELVE_DAYS, viewer }));
      assert.doesNotMatch(text ?? '', /repl|waiting/i, `${viewer}/${stage}: "${text}"`);
    }
  }
});
