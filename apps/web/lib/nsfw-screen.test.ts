/**
 * decideNsfw threshold invariants (Node built-in test runner, run via tsx).
 *
 * Guards the locked block policy of the always-on NSFW screen:
 *   Porn ≥ 0.7  OR  Hentai ≥ 0.75  OR  (Porn + Hentai) ≥ 0.8  → 'nsfw_blocked'
 * and the wedding-critical carve-out: "Sexy" alone NEVER blocks (dancing,
 * gowns, beachwear are normal wedding content).
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideNsfw,
  NSFW_COMBINED_THRESHOLD,
  NSFW_HENTAI_THRESHOLD,
  NSFW_PORN_THRESHOLD,
  stdScreenOutcome,
} from './nsfw-screen';

test('blocks high-confidence porn (0.9)', () => {
  assert.equal(
    decideNsfw({ Porn: 0.9, Neutral: 0.05, Sexy: 0.03, Hentai: 0.01, Drawing: 0.01 }),
    'nsfw_blocked',
  );
});

test('blocks high-confidence hentai (0.8)', () => {
  assert.equal(
    decideNsfw({ Hentai: 0.8, Drawing: 0.15, Neutral: 0.03, Porn: 0.01, Sexy: 0.01 }),
    'nsfw_blocked',
  );
});

test('blocks combined porn 0.45 + hentai 0.4 (sum ≥ 0.8)', () => {
  assert.equal(
    decideNsfw({ Porn: 0.45, Hentai: 0.4, Neutral: 0.1, Sexy: 0.04, Drawing: 0.01 }),
    'nsfw_blocked',
  );
});

test('does NOT block sexy alone, even at 0.99', () => {
  assert.equal(
    decideNsfw({ Sexy: 0.99, Neutral: 0.005, Porn: 0.003, Hentai: 0.001, Drawing: 0.001 }),
    'clean',
  );
});

test('does NOT block neutral content', () => {
  assert.equal(
    decideNsfw({ Neutral: 0.97, Drawing: 0.01, Sexy: 0.01, Porn: 0.005, Hentai: 0.005 }),
    'clean',
  );
});

test('boundary: porn exactly at threshold blocks; just below does not', () => {
  assert.equal(decideNsfw({ Porn: NSFW_PORN_THRESHOLD }), 'nsfw_blocked');
  assert.equal(decideNsfw({ Porn: NSFW_PORN_THRESHOLD - 0.001 }), 'clean');
});

test('boundary: hentai exactly at threshold blocks; just below does not', () => {
  assert.equal(decideNsfw({ Hentai: NSFW_HENTAI_THRESHOLD }), 'nsfw_blocked');
  assert.equal(decideNsfw({ Hentai: NSFW_HENTAI_THRESHOLD - 0.001 }), 'clean');
});

test('boundary: combined sum exactly at threshold blocks; just below does not', () => {
  assert.equal(
    decideNsfw({ Porn: NSFW_COMBINED_THRESHOLD / 2, Hentai: NSFW_COMBINED_THRESHOLD / 2 }),
    'nsfw_blocked',
  );
  assert.equal(
    decideNsfw({
      Porn: NSFW_COMBINED_THRESHOLD / 2,
      Hentai: NSFW_COMBINED_THRESHOLD / 2 - 0.001,
    }),
    'clean',
  );
});

test('missing classes count as zero (empty scores → clean)', () => {
  assert.equal(decideNsfw({}), 'clean');
});

// ── SEC-6 round three: the screen may REJECT, but it may never APPROVE a video ──
//
// This is the whole security claim of the round, stated as a table. The screen
// classifies the POSTER — a client-uploaded JPEG with no proof it came from the
// video — so "dirty video + clean unrelated poster" was, for two rounds, a
// complete bypass that produced a real, bound, sealed `approved`. The outcome
// function below is what `screenStdVideo` actually calls, so these cases pin the
// shipped behaviour, not a description of it.

test('SEC-6 a CLEAN poster parks the row at in_review — it never approves the video', () => {
  const o = stdScreenOutcome({ decision: 'clean', grandfathered: false });
  assert.equal(o.status, 'in_review', 'the automatic screen approved a video it never looked at');
  assert.equal(
    o.videoExaminer,
    null,
    'the screen recorded an examiner for a video whose bytes it never read',
  );
  // It may still vouch for the poster: it downloaded exactly those bytes, and
  // the poster is itself served, so examined and served are one object there.
  assert.equal(o.examinePoster, true);
});

test('SEC-6 a DIRTY poster still rejects — refusal needs no examination of the video', () => {
  const o = stdScreenOutcome({ decision: 'nsfw_blocked', grandfathered: false });
  assert.equal(o.status, 'rejected');
  assert.equal(o.examinePoster, false);
  assert.equal(o.videoExaminer, null);
});

test('SEC-6 the ONLY path to approved is a pre-existing cutover marker, and it is named', () => {
  const o = stdScreenOutcome({ decision: 'clean', grandfathered: true });
  assert.equal(o.status, 'approved');
  // …and it says, in the data, that a still frame is all that was looked at.
  assert.equal(o.videoExaminer, 'legacy-poster-screen');
  assert.equal(o.keepGrandfather, true);
});

test('SEC-6 a rejection ENDS the carry-over — a marker cannot resurrect it', () => {
  const o = stdScreenOutcome({ decision: 'nsfw_blocked', grandfathered: true });
  assert.equal(o.status, 'rejected');
  assert.equal(o.videoExaminer, null);
  assert.equal(o.keepGrandfather, false, 'a dirty poster kept its grandfather marker');
});

test('SEC-6 EXHAUSTIVE: over every input, the screen never names a competent video examiner', () => {
  // The guarantee as a closed statement rather than four examples. If a future
  // edit adds a branch that writes 'human-review' (or any examiner in
  // COMPETENT_EXAMINERS.video), this fails.
  for (const decision of ['clean', 'nsfw_blocked'] as const) {
    for (const grandfathered of [false, true]) {
      const o = stdScreenOutcome({ decision, grandfathered });
      assert.notEqual(
        o.videoExaminer,
        'human-review',
        `the automatic screen claimed a human review (${decision}/${grandfathered})`,
      );
      if (!grandfathered) {
        assert.notEqual(
          o.status,
          'approved',
          `an unmarked row was approved automatically (${decision})`,
        );
      }
    }
  }
});
