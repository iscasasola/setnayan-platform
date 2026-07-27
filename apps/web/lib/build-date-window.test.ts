import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyAgainstBuildWindow,
  convergenceBanner,
  DOESNT_FIT_DIVIDER,
  doesntFitReason,
  formatDayKeyLabel,
  freeDaysLine,
  noSharedDateBadge,
  partitionByBuildFit,
  resolveBuildDateWindow,
  resolveProbeWindow,
  type BuildDateWindow,
  type ProbeWindow,
  type TeamCalendarMember,
} from './build-date-window';

const CANDIDATES = ['2027-09-12', '2027-09-26', '2027-10-09'];

function probe(dayKeys: string[] = CANDIDATES, anchored = false): ProbeWindow {
  return {
    anchored,
    dayKeys,
    rangeStart: dayKeys[0] ?? '',
    rangeEnd: dayKeys[dayKeys.length - 1] ?? '',
  };
}

function member(vendorId: string, name: string, freeDays: string[]): TeamCalendarMember {
  return { vendorId, name, freeDays: new Set(freeDays) };
}

// ── formatDayKeyLabel ───────────────────────────────────────────────────────

test('formatDayKeyLabel renders a short month + day, ICU-independently', () => {
  assert.equal(formatDayKeyLabel('2027-09-12'), 'Sep 12');
  assert.equal(formatDayKeyLabel('2027-01-01'), 'Jan 1');
  assert.equal(formatDayKeyLabel('2027-12-31'), 'Dec 31');
});

test('formatDayKeyLabel returns garbage input untouched rather than inventing a date', () => {
  assert.equal(formatDayKeyLabel('not-a-day'), 'not-a-day');
  assert.equal(formatDayKeyLabel('2027-13-01'), '2027-13-01');
});

// ── resolveProbeWindow ──────────────────────────────────────────────────────

test('resolveProbeWindow: a committed day-precision date is ANCHORED — one day, soft tier stands down', () => {
  const w = resolveProbeWindow({ eventDate: '2027-09-12', precision: 'day', candidates: CANDIDATES });
  assert.ok(w);
  assert.equal(w.anchored, true);
  assert.deepEqual(w.dayKeys, ['2027-09-12']);
});

test('resolveProbeWindow: onboarding date candidates become the window, deduped + sorted', () => {
  const w = resolveProbeWindow({
    eventDate: '2027-09',
    precision: 'month',
    candidates: ['2027-10-09', '2027-09-12', '2027-09-12', 'junk'],
  });
  assert.ok(w);
  assert.equal(w.anchored, false);
  assert.deepEqual(w.dayKeys, ['2027-09-12', '2027-10-09']);
  assert.equal(w.rangeStart, '2027-09-12');
  assert.equal(w.rangeEnd, '2027-10-09');
});

test('resolveProbeWindow: month precision with no candidates expands to that month', () => {
  const w = resolveProbeWindow({ eventDate: '2027-02-01', precision: 'month', candidates: [] });
  assert.ok(w);
  assert.equal(w.dayKeys.length, 28);
  assert.equal(w.rangeStart, '2027-02-01');
  assert.equal(w.rangeEnd, '2027-02-28');
});

test('resolveProbeWindow: a pathological candidate SPAN is refused rather than walked day by day', () => {
  assert.equal(
    resolveProbeWindow({
      eventDate: null,
      precision: null,
      candidates: ['2027-01-05', '2029-06-01'],
    }),
    null,
  );
  // Just inside the cap still resolves.
  const ok = resolveProbeWindow({
    eventDate: null,
    precision: null,
    candidates: ['2027-01-05', '2027-06-01'],
  });
  assert.ok(ok);
  assert.deepEqual(ok.dayKeys, ['2027-01-05', '2027-06-01']);
});

test('resolveProbeWindow: year precision is NOT convergeable — null, no banner, no sinking', () => {
  assert.equal(resolveProbeWindow({ eventDate: '2027-01-01', precision: 'year', candidates: null }), null);
  assert.equal(resolveProbeWindow({ eventDate: null, precision: null, candidates: null }), null);
});

// ── resolveBuildDateWindow ──────────────────────────────────────────────────

test('resolveBuildDateWindow: flag OFF returns null — nothing computed, nothing rendered', () => {
  assert.equal(
    resolveBuildDateWindow({ enabled: false, probe: probe(), members: [member('a', 'A', CANDIDATES)] }),
    null,
  );
});

test('resolveBuildDateWindow: no members ⇒ OPEN — an empty build constrains nothing', () => {
  const w = resolveBuildDateWindow({ enabled: true, probe: probe(), members: [] });
  assert.ok(w);
  assert.equal(w.source, 'open');
  assert.deepEqual(w.dayKeys, CANDIDATES);
});

test('resolveBuildDateWindow: each member narrows the window (the convergence the owner asked for)', () => {
  const one = resolveBuildDateWindow({
    enabled: true,
    probe: probe(),
    members: [member('a', 'Alta Vista', ['2027-09-12', '2027-09-26'])],
  });
  assert.deepEqual(one?.dayKeys, ['2027-09-12', '2027-09-26']);

  const two = resolveBuildDateWindow({
    enabled: true,
    probe: probe(),
    members: [
      member('a', 'Alta Vista', ['2027-09-12', '2027-09-26']),
      member('b', 'Baguio Blooms', ['2027-09-26', '2027-10-09']),
    ],
  });
  assert.equal(two?.source, 'build');
  assert.deepEqual(two?.dayKeys, ['2027-09-26']);
});

test('resolveBuildDateWindow: a member free on every day never subtracts (fail-open as arithmetic)', () => {
  const w = resolveBuildDateWindow({
    enabled: true,
    probe: probe(),
    members: [member('a', 'Unknown Calendar', CANDIDATES)],
  });
  assert.deepEqual(w?.dayKeys, CANDIDATES);
});

test('resolveBuildDateWindow: an empty intersection names the guilty PAIR', () => {
  const w = resolveBuildDateWindow({
    enabled: true,
    probe: probe(),
    members: [
      member('a', 'Alta Vista', ['2027-09-12']),
      member('b', 'Baguio Blooms', ['2027-10-09']),
    ],
  });
  assert.equal(w?.dayKeys.length, 0);
  assert.deepEqual(w?.conflictPair, ['Alta Vista', 'Baguio Blooms']);
});

test('resolveBuildDateWindow: a 3-way conflict with no guilty pair reports no pair rather than a wrong one', () => {
  // Every PAIR overlaps; only all three together have no common day.
  const w = resolveBuildDateWindow({
    enabled: true,
    probe: probe(),
    members: [
      member('a', 'A', ['2027-09-12', '2027-09-26']),
      member('b', 'B', ['2027-09-26', '2027-10-09']),
      member('c', 'C', ['2027-10-09', '2027-09-12']),
    ],
  });
  assert.equal(w?.dayKeys.length, 0);
  assert.equal(w?.conflictPair, null);
});

test('resolveBuildDateWindow: an anchored probe reports ANCHORED regardless of members', () => {
  const w = resolveBuildDateWindow({
    enabled: true,
    probe: probe(['2027-09-12'], true),
    members: [member('a', 'A', [])],
  });
  assert.equal(w?.source, 'anchored');
});

// ── classifyAgainstBuildWindow ──────────────────────────────────────────────

const BUILD_WINDOW: BuildDateWindow = {
  source: 'build',
  dayKeys: ['2027-09-26'],
  memberCount: 1,
  windowSize: 3,
  conflictPair: null,
};

const MEMBERS = [member('m1', 'Alta Vista', ['2027-09-26', '2027-10-09'])];

test('classifyAgainstBuildWindow: a vendor free inside the window FITS', () => {
  const v = classifyAgainstBuildWindow({
    window: BUILD_WINDOW,
    vendorFreeDays: new Set(['2027-09-26']),
    vendorId: 'x',
    members: MEMBERS,
    probeDayKeys: CANDIDATES,
  });
  assert.deepEqual(v, { fits: true });
});

test('classifyAgainstBuildWindow: a vendor with no day in the window CLASHES, and names who', () => {
  const v = classifyAgainstBuildWindow({
    window: BUILD_WINDOW,
    vendorFreeDays: new Set(['2027-09-12']),
    vendorId: 'x',
    members: MEMBERS,
    probeDayKeys: CANDIDATES,
  });
  assert.deepEqual(v, { fits: false, clashWith: 'Alta Vista' });
});

test('classifyAgainstBuildWindow: NO calendar signal is never a clash (the fail-open rule)', () => {
  const v = classifyAgainstBuildWindow({
    window: BUILD_WINDOW,
    vendorFreeDays: null,
    vendorId: 'x',
    members: MEMBERS,
    probeDayKeys: CANDIDATES,
  });
  assert.equal(v, null);
});

test('classifyAgainstBuildWindow: anchored / open / null windows issue NO soft verdicts', () => {
  for (const source of ['anchored', 'open'] as const) {
    const v = classifyAgainstBuildWindow({
      window: { ...BUILD_WINDOW, source },
      vendorFreeDays: new Set<string>(),
      vendorId: 'x',
      members: MEMBERS,
      probeDayKeys: CANDIDATES,
    });
    assert.equal(v, null, `source=${source} must issue no verdict`);
  }
  assert.equal(
    classifyAgainstBuildWindow({
      window: null,
      vendorFreeDays: new Set<string>(),
      vendorId: 'x',
      members: MEMBERS,
      probeDayKeys: CANDIDATES,
    }),
    null,
  );
});

test('classifyAgainstBuildWindow: no SINGLE culprit ⇒ the badge blames the build, not a vendor', () => {
  // V overlaps each member individually, yet misses the 3-way intersection.
  const members = [
    member('m1', 'A', ['2027-09-12', '2027-09-26']),
    member('m2', 'B', ['2027-09-26', '2027-10-09']),
  ];
  const w: BuildDateWindow = { ...BUILD_WINDOW, memberCount: 2 }; // dayKeys = [Sep 26]
  const v = classifyAgainstBuildWindow({
    window: w,
    vendorFreeDays: new Set(['2027-09-12', '2027-10-09']),
    vendorId: 'x',
    members,
    probeDayKeys: CANDIDATES,
  });
  assert.deepEqual(v, { fits: false, clashWith: null });
  assert.equal(noSharedDateBadge(null), 'No shared date with your build');
});

test('classifyAgainstBuildWindow: an ALREADY-EMPTY build window blames nobody — the whole bench stays browsable', () => {
  const broken: BuildDateWindow = { ...BUILD_WINDOW, dayKeys: [], conflictPair: ['A', 'B'] };
  const v = classifyAgainstBuildWindow({
    window: broken,
    vendorFreeDays: new Set(['2027-09-12']),
    vendorId: 'x',
    members: MEMBERS,
    probeDayKeys: CANDIDATES,
  });
  assert.equal(v, null);
});

test('classifyAgainstBuildWindow: a build member never clashes with ITSELF', () => {
  // The member IS the card. Its own free days trivially cover the window, so it
  // fits — but assert the self-skip explicitly against a hostile window too.
  const selfOnly = [member('x', 'Self', ['2027-09-12'])];
  const w: BuildDateWindow = { ...BUILD_WINDOW, dayKeys: ['2027-09-12'] };
  const v = classifyAgainstBuildWindow({
    window: w,
    vendorFreeDays: new Set(['2027-09-12']),
    vendorId: 'x',
    members: selfOnly,
    probeDayKeys: CANDIDATES,
  });
  assert.deepEqual(v, { fits: true });
});

test('classifyAgainstBuildWindow: reversible — dropping the clashing member restores the card', () => {
  const clashing = classifyAgainstBuildWindow({
    window: BUILD_WINDOW,
    vendorFreeDays: new Set(['2027-09-12']),
    vendorId: 'x',
    members: MEMBERS,
    probeDayKeys: CANDIDATES,
  });
  assert.equal(clashing?.fits, false);

  // Remove the candidate → the window reopens → the same vendor fits again.
  const reopened = resolveBuildDateWindow({ enabled: true, probe: probe(), members: [] });
  const after = classifyAgainstBuildWindow({
    window: reopened,
    vendorFreeDays: new Set(['2027-09-12']),
    vendorId: 'x',
    members: [],
    probeDayKeys: CANDIDATES,
  });
  assert.equal(after, null, 'an open window issues no verdict → the card is back on the rail');
});

// ── copy ────────────────────────────────────────────────────────────────────

test('convergenceBanner: an OPEN window renders nothing', () => {
  assert.equal(
    convergenceBanner(resolveBuildDateWindow({ enabled: true, probe: probe(), members: [] })),
    null,
  );
  assert.equal(convergenceBanner(null), null);
});

test('convergenceBanner: NARROWING lists the shared dates', () => {
  const b = convergenceBanner({ ...BUILD_WINDOW, dayKeys: ['2027-09-12', '2027-09-26'] });
  assert.equal(b?.tone, 'narrowing');
  assert.ok(b.headline.includes('Sep 12 · Sep 26'));
});

test('convergenceBanner: NARROWING caps the list and says how many more', () => {
  const days = ['09-01', '09-02', '09-03', '09-04', '09-05', '09-06', '09-07', '09-08'].map(
    (d) => `2027-${d}`,
  );
  const b = convergenceBanner({ ...BUILD_WINDOW, dayKeys: days }, { maxDates: 3 });
  assert.ok(b?.headline.includes('+5 more'));
});

test('convergenceBanner: ONE day left says only that day works — and does NOT promise a reservation', () => {
  const b = convergenceBanner(BUILD_WINDOW);
  assert.equal(b?.tone, 'converged');
  assert.equal(b.headline, 'Only Sep 26 works for everyone');
  assert.ok(/nothing is held yet/i.test(b.detail));
});

test('convergenceBanner: EMPTY uses the shipped Compare conflict copy and names the pair', () => {
  const b = convergenceBanner({ ...BUILD_WINDOW, dayKeys: [], conflictPair: ['Alta Vista', 'Baguio Blooms'] });
  assert.equal(b?.tone, 'conflict');
  assert.equal(b.headline, 'No single date works — swap one');
  assert.ok(b.detail.includes('Alta Vista'));
  assert.ok(b.detail.includes('Baguio Blooms'));
});

test('convergenceBanner: ANCHORED reports the locked date and defers to the per-card date badge', () => {
  const b = convergenceBanner(
    { ...BUILD_WINDOW, source: 'anchored' },
    { anchoredLabel: 'Sat, 12 Sep 2027' },
  );
  assert.equal(b?.tone, 'anchored');
  assert.ok(b.headline.includes('Sat, 12 Sep 2027'));
});

test('noSharedDateBadge / doesntFitReason degrade gracefully with no named clash', () => {
  assert.equal(noSharedDateBadge('Alta Vista'), 'No shared date with Alta Vista');
  assert.equal(noSharedDateBadge(null), 'No shared date with your build');
  assert.ok(doesntFitReason('Alta Vista').includes('Alta Vista'));
  assert.ok(doesntFitReason(null).includes('Remove a candidate'));
  assert.equal(DOESNT_FIT_DIVIDER, "Doesn't fit your build");
});

// ── freeDaysLine ────────────────────────────────────────────────────────────

test('freeDaysLine: no signal and no free day both render NOTHING (never a bare "Free:")', () => {
  assert.equal(freeDaysLine({ freeDays: null, windowSize: 3 }), null);
  assert.equal(freeDaysLine({ freeDays: [], windowSize: 3 }), null);
});

test('freeDaysLine: a discrete window names the days, capped', () => {
  assert.equal(
    freeDaysLine({ freeDays: ['2027-09-12', '2027-09-26'], windowSize: 3 }),
    'Free: Sep 12 · Sep 26',
  );
  assert.equal(
    freeDaysLine({ freeDays: ['2027-09-12', '2027-09-26', '2027-10-09'], windowSize: 3, maxNames: 2 }),
    'Free: Sep 12 · Sep 26 +1 more',
  );
});

test('freeDaysLine: a wide window (a whole month) counts instead of listing', () => {
  const days = Array.from({ length: 24 }, (_, i) => `2027-09-${String(i + 1).padStart(2, '0')}`);
  assert.equal(freeDaysLine({ freeDays: days, windowSize: 30 }), 'Free 24 of 30 days');
});

// ── partitionByBuildFit ─────────────────────────────────────────────────────

test('partitionByBuildFit sinks only the clashes, and preserves the incoming sort order', () => {
  const rows = ['a', 'b', 'c', 'd'];
  const verdicts: Record<string, ReturnType<typeof classifyAgainstBuildWindow>> = {
    a: { fits: true },
    b: { fits: false, clashWith: 'X' },
    c: null,
    d: { fits: false, clashWith: null },
  };
  const { fits, clashes } = partitionByBuildFit(rows, (r) => verdicts[r] ?? null);
  assert.deepEqual(fits, ['a', 'c']);
  assert.deepEqual(clashes, ['b', 'd']);
});

test('partitionByBuildFit: an all-null verdict set sinks nothing (flag OFF / no signal)', () => {
  const { fits, clashes } = partitionByBuildFit(['a', 'b'], () => null);
  assert.deepEqual(fits, ['a', 'b']);
  assert.equal(clashes.length, 0);
});
