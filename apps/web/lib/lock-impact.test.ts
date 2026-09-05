import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLockImpact, lockImpactCopy, type SavedPlanForImpact } from '@/lib/lock-impact';
import type { PlansRowPick } from '@/lib/plans-panel';

function pick(groupId: string, vendorId: string | undefined = 'v1'): PlansRowPick {
  return { groupId, label: groupId, vendorName: vendorId ?? 'x', costPhp: null, locked: false, vendorId };
}
function plan(buildId: string, title: string, picks: PlansRowPick[]): SavedPlanForImpact {
  return { buildId, title, picks };
}

test('a plan whose ONLY remaining pick is the newly locked category is lost', () => {
  const impact = computeLockImpact({
    groupId: 'reception',
    lockedGroupIds: [],
    savedPlans: [plan('b1', 'Garden Classic', [pick('reception')])],
  });
  assert.deepEqual(impact.plansLost.map((p) => p.title), ['Garden Classic']);
  assert.equal(impact.isEmpty, false);
});

test('a plan with picks in other categories survives, and is reported THINNED', () => {
  const impact = computeLockImpact({
    groupId: 'reception',
    lockedGroupIds: [],
    savedPlans: [plan('b1', 'Big Feast', [pick('reception'), pick('catering')])],
  });
  assert.equal(impact.plansLost.length, 0);
  assert.deepEqual(impact.plansThinned.map((p) => [p.title, p.dropped]), [['Big Feast', 1]]);
});

test('a plan already dead BEFORE this lock is not blamed on this vendor', () => {
  // Its only pick was in a category locked earlier. It is already un-loadable,
  // so this lock costs nothing and the modal must not claim otherwise.
  const impact = computeLockImpact({
    groupId: 'reception',
    lockedGroupIds: ['catering'],
    savedPlans: [plan('b1', 'Old Plan', [pick('catering')])],
  });
  assert.equal(impact.plansLost.length, 0);
  assert.equal(impact.isEmpty, true);
});

test('a lock that costs nothing is EMPTY — the caller renders no modal', () => {
  const impact = computeLockImpact({
    groupId: 'florist',
    lockedGroupIds: [],
    savedPlans: [plan('b1', 'Garden Classic', [pick('reception'), pick('catering')])],
  });
  assert.equal(impact.isEmpty, true);
  assert.equal(lockImpactCopy(impact, 'Bloom Co'), null, 'no copy for a costless lock');
});

test('services lost are the DIFF — a vendor already sunk is not a casualty', () => {
  const impact = computeLockImpact({
    groupId: 'reception',
    lockedGroupIds: [],
    savedPlans: [],
    sunkBefore: [{ vendorName: 'Already Gone', categoryLabel: 'Photo' }],
    sunkAfter: [
      { vendorName: 'Already Gone', categoryLabel: 'Photo' },
      { vendorName: 'Newly Sunk', categoryLabel: 'Photo' },
    ],
  });
  assert.deepEqual(impact.servicesLost.map((s) => s.vendorName), ['Newly Sunk']);
});

test('a caller that cannot supply the after-set reports NO services rather than guessing', () => {
  const impact = computeLockImpact({ groupId: 'reception', lockedGroupIds: [], savedPlans: [] });
  assert.deepEqual(impact.servicesLost, []);
  assert.equal(impact.isEmpty, true);
});

test('copy says "no longer possible", never "deleted" — a plan row survives the lock', () => {
  const impact = computeLockImpact({
    groupId: 'reception',
    lockedGroupIds: [],
    savedPlans: [plan('b1', 'Garden Classic', [pick('reception')])],
  });
  const copy = lockImpactCopy(impact, 'Hacienda Ilog')!;
  assert.ok(copy.headline.includes('Hacienda Ilog'));
  assert.match(copy.lines.join(' '), /no longer possible/i);
  assert.ok(
    !/deleted|cancelled|canceled|removed forever/i.test(copy.lines.join(' ')),
    'a lock makes a plan un-loadable; it does not destroy it',
  );
  assert.ok(copy.confirmLabel.includes('anyway'));
});

test('every casualty named in the copy appears in the impact (no invented names)', () => {
  const impact = computeLockImpact({
    groupId: 'reception',
    lockedGroupIds: [],
    savedPlans: [plan('b1', 'Garden Classic', [pick('reception')]), plan('b2', 'Plan B', [pick('reception')])],
    sunkAfter: [{ vendorName: 'Sunk Studio', categoryLabel: 'Photo' }],
  });
  const text = lockImpactCopy(impact, 'Hacienda Ilog')!.lines.join(' ');
  for (const name of ['Garden Classic', 'Plan B', 'Sunk Studio']) {
    assert.ok(text.includes(name), `${name} must be named in the copy`);
  }
});
