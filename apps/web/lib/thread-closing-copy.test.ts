/**
 * thread-closing-copy.test.ts — a closed conversation never names an act the
 * reader did not perform.
 *
 * EXECUTES the decision module. It does not grep a component for a string:
 * the whole point of the fix is that one module decides and both pages read it,
 * so the assertions must run the real function.
 *
 * The sabotages this is built to catch, all watched red before it was committed:
 *   1. point `withdrawn` back at the decline copy  → "withdrew ≠ declined" fails
 *   2. let an unknown status fall through to `declined` (the old bare `else`)
 *      → "an unrecognised state borrows nobody's words" fails
 *   3. read `inquiry_status` only and ignore `archived_at`
 *      → "a withdrawal is stored as archived_at" fails
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closingCopy,
  resolveClosingKind,
  type ClosingKind,
  type Viewer,
} from '@/lib/thread-closing-copy';

const VENDOR = 'Liwanag Photo';
const both: Viewer[] = ['couple', 'vendor'];

test('a withdrawal is stored as archived_at, not as a status — and outranks it', () => {
  // withdrawInquiry writes ONLY archived_at, so the status is still 'pending'.
  assert.equal(
    resolveClosingKind({ inquiry_status: 'pending', archived_at: '2026-09-22T01:00:00Z' }),
    'withdrawn',
    'a pending thread with archived_at set IS a withdrawal',
  );
  assert.equal(
    resolveClosingKind({ inquiry_status: 'accepted', archived_at: '2026-09-22T01:00:00Z' }),
    'withdrawn',
  );
  // …and an empty string is not a timestamp.
  assert.equal(resolveClosingKind({ inquiry_status: 'pending', archived_at: '' }), 'open');
  assert.equal(resolveClosingKind({ inquiry_status: 'pending', archived_at: null }), 'open');
});

test('the two live states still resolve to themselves', () => {
  assert.equal(resolveClosingKind({ inquiry_status: 'accepted', archived_at: null }), 'open');
  assert.equal(resolveClosingKind({ inquiry_status: 'pending', archived_at: null }), 'open');
  assert.equal(resolveClosingKind({ inquiry_status: 'declined', archived_at: null }), 'declined');
  assert.equal(resolveClosingKind({ inquiry_status: 'displaced', archived_at: null }), 'displaced');
});

test('withdrew ≠ declined — the app must not blame the supplier for the couple’s act', () => {
  for (const viewer of both) {
    const withdrew = closingCopy(
      { inquiry_status: 'pending', archived_at: '2026-09-22T01:00:00Z' },
      viewer,
      { counterpartyLabel: VENDOR },
    );
    const declined = closingCopy({ inquiry_status: 'declined', archived_at: null }, viewer, {
      counterpartyLabel: VENDOR,
    });
    assert.notEqual(withdrew.sentence, declined.sentence, `${viewer}: withdrew borrowed decline copy`);
    assert.equal(withdrew.kind, 'withdrawn');
    assert.match(withdrew.sentence, /withdrew/i, `${viewer}: withdrawal must say so`);
    assert.doesNotMatch(
      withdrew.sentence,
      /declined|isn’t available|not available/i,
      `${viewer}: a withdrawal must not mention declining or availability`,
    );
  }
});

test('booked-another ≠ declined, and never offers alternatives', () => {
  for (const viewer of both) {
    const displaced = closingCopy({ inquiry_status: 'displaced', archived_at: null }, viewer, {
      counterpartyLabel: VENDOR,
    });
    const declined = closingCopy({ inquiry_status: 'declined', archived_at: null }, viewer, {
      counterpartyLabel: VENDOR,
    });
    assert.notEqual(displaced.sentence, declined.sentence, `${viewer}: displaced borrowed decline copy`);
    assert.doesNotMatch(displaced.sentence, /declined|isn’t available/i);
    // The couple chose someone else; offering "similar vendors" reads as a rejection.
    assert.equal(displaced.showSimilarVendors, false, `${viewer}: displaced must not offer alternatives`);
  }
});

test('an unrecognised state borrows nobody’s words — the old bare else is gone', () => {
  const unknowns = ['expired', 'withdrawn_by_admin', 'paused', '', null, undefined, 'DECLINED'];
  for (const viewer of both) {
    const knownSentences = (['declined', 'displaced'] as const).map(
      (s) => closingCopy({ inquiry_status: s, archived_at: null }, viewer, { counterpartyLabel: VENDOR }).sentence,
    );
    const withdrawnSentence = closingCopy(
      { inquiry_status: 'pending', archived_at: '2026-09-22T01:00:00Z' },
      viewer,
      { counterpartyLabel: VENDOR },
    ).sentence;

    for (const u of unknowns) {
      const kind = resolveClosingKind({ inquiry_status: u as string, archived_at: null });
      // '' / null / undefined are not a closed state at all; the rest are unknown.
      if (kind === 'open') continue;
      const copy = closingCopy({ inquiry_status: u as string, archived_at: null }, viewer, {
        counterpartyLabel: VENDOR,
      });
      assert.equal(copy.kind, 'unrecognised', `${viewer}: "${String(u)}" should be unrecognised`);
      for (const s of [...knownSentences, withdrawnSentence]) {
        assert.notEqual(copy.sentence, s, `${viewer}: "${String(u)}" borrowed another state's sentence`);
      }
      assert.equal(copy.showSimilarVendors, false);
      assert.equal(copy.showWithdraw, false);
    }
  }
});

test('the shipped decline wording is unchanged, with and without a reason', () => {
  const withReason = closingCopy({ inquiry_status: 'declined', archived_at: null }, 'couple', {
    counterpartyLabel: VENDOR,
    declineReason: '  We’re already booked that weekend.  ',
  });
  assert.equal(
    withReason.sentence,
    'Liwanag Photo declined this inquiry. Why: “We’re already booked that weekend.” Browse similar vendors to keep your options open.',
  );
  const noReason = closingCopy({ inquiry_status: 'declined', archived_at: null }, 'couple', {
    counterpartyLabel: VENDOR,
    declineReason: '   ',
  });
  assert.equal(
    noReason.sentence,
    'Liwanag Photo isn’t available for your date. Browse similar vendors to keep your options open.',
  );
  assert.equal(
    closingCopy({ inquiry_status: 'declined', archived_at: null }, 'vendor', { counterpartyLabel: 'the couple' })
      .sentence,
    'You declined this inquiry. The couple has been notified and pointed to other vendors.',
  );
});

test('only a real decline offers alternatives or a withdraw control', () => {
  const kinds: Array<[ClosingKind, { inquiry_status: string; archived_at: string | null }]> = [
    ['declined', { inquiry_status: 'declined', archived_at: null }],
    ['displaced', { inquiry_status: 'displaced', archived_at: null }],
    ['withdrawn', { inquiry_status: 'pending', archived_at: '2026-09-22T01:00:00Z' }],
    ['unrecognised', { inquiry_status: 'expired', archived_at: null }],
  ];
  for (const [expected, input] of kinds) {
    const c = closingCopy(input, 'couple', { counterpartyLabel: VENDOR });
    assert.equal(c.kind, expected);
    assert.equal(c.showSimilarVendors, expected === 'declined', `${expected}: alternatives`);
    assert.equal(c.showWithdraw, expected === 'declined', `${expected}: withdraw control`);
  }
});

test('an open thread yields no sentence at all', () => {
  for (const viewer of both) {
    for (const s of ['accepted', 'pending']) {
      const c = closingCopy({ inquiry_status: s, archived_at: null }, viewer, { counterpartyLabel: VENDOR });
      assert.equal(c.kind, 'open');
      assert.equal(c.sentence, '');
    }
  }
});
