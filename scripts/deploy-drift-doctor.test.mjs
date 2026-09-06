// Unit tests for the deploy drift doctor's pure classifier.
// Run: node --test scripts/deploy-drift-doctor.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDeployDrift, pendingAgeSeconds } from './deploy-drift-doctor.mjs';

test('classifyDeployDrift: up to date — zero commits behind is never drift', () => {
  const r = classifyDeployDrift({ behindCount: 0, oldestPendingAgeSec: null, graceSec: 1200 });
  assert.equal(r.drift, false);
  assert.equal(r.reason, 'up-to-date');
});

test('classifyDeployDrift: within grace — behind but the oldest pending commit is fresh', () => {
  const r = classifyDeployDrift({ behindCount: 3, oldestPendingAgeSec: 60, graceSec: 1200 });
  assert.equal(r.drift, false);
  assert.equal(r.reason, 'within-grace');
});

test('classifyDeployDrift: past grace — the oldest pending commit is older than the window', () => {
  const r = classifyDeployDrift({ behindCount: 7, oldestPendingAgeSec: 3600, graceSec: 1200 });
  assert.equal(r.drift, true);
  assert.equal(r.reason, 'behind');
});

test('classifyDeployDrift: exactly at the grace boundary counts as still fresh (< not <=)', () => {
  const r = classifyDeployDrift({ behindCount: 1, oldestPendingAgeSec: 1200, graceSec: 1200 });
  assert.equal(r.drift, true);
  assert.equal(r.reason, 'behind');
});

test('classifyDeployDrift: behind with unknown age never reports healthy — inconclusive age is still drift', () => {
  const r = classifyDeployDrift({ behindCount: 2, oldestPendingAgeSec: null, graceSec: 1200 });
  assert.equal(r.drift, true);
  assert.equal(r.reason, 'behind-unknown-age');
});

test('classifyDeployDrift: negative behindCount (should not happen, but must not crash or drift)', () => {
  const r = classifyDeployDrift({ behindCount: -1, oldestPendingAgeSec: null, graceSec: 1200 });
  assert.equal(r.drift, false);
  assert.equal(r.reason, 'up-to-date');
});

/*
 * ── pendingAgeSeconds ───────────────────────────────────────────────────────
 * Added 2026-09-06. The tests above cover `classifyDeployDrift`, the pure
 * classifier — and it was correct. The bug was in the UNTESTED half that feeds
 * it: the age was computed as `git log -1 --format=%ct origin/main` minus the
 * pending commit's timestamp, i.e. the span between two commits rather than
 * how long the change had been waiting. A right classifier fed a wrong number
 * is still a wrong monitor, and only the classifier had a test.
 */
test('pendingAgeSeconds: measures from NOW, not from another commit', () => {
  const pendingCommitTs = 1_000_000;
  assert.equal(pendingAgeSeconds({ pendingCommitTs, nowTs: pendingCommitTs + 3600 }), 3600);
});

test('pendingAgeSeconds: the age KEEPS GROWING when no new commit lands', () => {
  /*
    THE REGRESSION THIS PINS. With `now` taken from main's tip, these two calls
    returned the same number — the tip had not moved — so a stale production
    stayed frozen inside the grace window and every hourly cron run reported
    "within grace". Drift beginning after the last merge of the day was
    invisible forever, which is precisely the blind window the schedule was
    added to close.
  */
  const pendingCommitTs = 1_000_000;
  const early = pendingAgeSeconds({ pendingCommitTs, nowTs: pendingCommitTs + 300 });
  const later = pendingAgeSeconds({ pendingCommitTs, nowTs: pendingCommitTs + 86_400 });
  assert.ok(later > early, 'age must grow with wall-clock time even with no new commits');
  assert.equal(later, 86_400);
});

test('pendingAgeSeconds: a fresh commit crosses the grace window as time passes', () => {
  // The end-to-end property: same commit, same grace, opposite verdicts.
  const graceSec = 1200;
  const ts = 1_000_000;
  const fresh = pendingAgeSeconds({ pendingCommitTs: ts, nowTs: ts + 60 });
  const stale = pendingAgeSeconds({ pendingCommitTs: ts, nowTs: ts + 7200 });
  assert.equal(classifyDeployDrift({ behindCount: 1, oldestPendingAgeSec: fresh, graceSec }).drift, false);
  assert.equal(classifyDeployDrift({ behindCount: 1, oldestPendingAgeSec: stale, graceSec }).drift, true);
});

test('pendingAgeSeconds: clock skew never reads as a future commit', () => {
  // A committer's clock ahead of the runner's would otherwise yield a negative
  // age — which is < graceSec, so it would land inside the grace and report
  // healthy. Clamped at 0: unknown-but-not-negative, still "fresh", never "in
  // the future".
  const ts = 1_000_000;
  assert.equal(pendingAgeSeconds({ pendingCommitTs: ts + 500, nowTs: ts }), 0);
});

test('pendingAgeSeconds: non-numeric input is null, which classify treats as drift', () => {
  assert.equal(pendingAgeSeconds({ pendingCommitTs: NaN, nowTs: 1 }), null);
  assert.equal(
    classifyDeployDrift({ behindCount: 1, oldestPendingAgeSec: null, graceSec: 1200 }).drift,
    true,
    'an age we could not compute must never be reported as healthy',
  );
});
