import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyConceptCoverage,
  staleBaselineEntries,
  formatConceptFindings,
  computePrefixFamilies,
  inboundCounts,
  type CoverageInput,
} from './concept-coverage';

/**
 * Synthetic schemas, not the real replay. The db test proves the guard is green
 * today; these prove it would NOTICE. Every case below is a schema where the
 * guard MUST fire — a guard nobody has watched fail is one you trust on faith.
 */

const SPINE = new Set(['events', 'users', 'vendor_profiles']);

function input(over: Partial<CoverageInput> = {}): CoverageInput {
  return {
    tables: ['events', 'users', 'vendor_profiles', 'guests'],
    fkEdges: [{ from: 'guests', to: 'events' }],
    mapped: new Set(['events', 'users', 'vendor_profiles', 'guests']),
    spine: SPINE,
    baseline: new Map(),
    ...over,
  };
}

/* ── the canonical case: Samahan, reconstructed ── */

test('the real Samahan shape fires — the case this guard exists for', () => {
  // As actually shipped in 20270808218211: three new tables, communities is a
  // hub, and events points at it.
  const tables = [
    ...input().tables,
    'communities',
    'community_members',
    'community_invite_tokens',
  ];
  const fkEdges = [
    ...input().fkEdges,
    { from: 'community_members', to: 'communities' },
    { from: 'community_invite_tokens', to: 'communities' },
    { from: 'events', to: 'communities' },
  ];
  const findings = verifyConceptCoverage(input({ tables, fkEdges }));

  assert.ok(findings.length > 0, 'Samahan must not ship invisible');
  assert.ok(findings.some((f) => f.table === 'communities' && f.reason === 'hub'));

  // NOTE, deliberately asserted so nobody "fixes" it later: the FAMILY sensor
  // does NOT fire here, and that is correct. `communities` is a single word, so
  // it shares no underscore-prefix with `community_members` — the family is 2,
  // under the threshold. Stemming plural→singular to force a match would be
  // fragile guesswork for no gain: the hub sensor already caught this, which is
  // exactly why the guard is a UNION rather than any one clever rule.
  assert.ok(!findings.some((f) => f.reason === 'name-family'));
});

test('once the concept is MAPPED, it greens with no baseline edit', () => {
  const tables = [...input().tables, 'communities', 'community_members', 'community_invite_tokens'];
  const fkEdges = [
    ...input().fkEdges,
    { from: 'community_members', to: 'communities' },
    { from: 'community_invite_tokens', to: 'communities' },
    { from: 'events', to: 'communities' },
  ];
  const mapped = new Set([...input().mapped, 'communities', 'community_members']);
  const findings = verifyConceptCoverage(input({ tables, fkEdges, mapped }));
  assert.deepEqual(findings, []);
});

/* ── each sensor, in isolation ── */

test('hub sensor: two referrers is enough', () => {
  const findings = verifyConceptCoverage(
    input({
      tables: [...input().tables, 'widgets', 'widget_a', 'widget_b'],
      fkEdges: [
        { from: 'widget_a', to: 'widgets' },
        { from: 'widget_b', to: 'widgets' },
      ],
    }),
  );
  assert.ok(findings.some((f) => f.table === 'widgets' && f.reason === 'hub'));
});

test('hub sensor: ONE referrer is not a subsystem — stays quiet', () => {
  // The single most important negative test. A lone leaf table with one FK is
  // ordinary work, and firing on it is how a guard becomes a toll booth.
  const findings = verifyConceptCoverage(
    input({
      tables: [...input().tables, 'event_style_preferences'],
      fkEdges: [...input().fkEdges, { from: 'event_style_preferences', to: 'events' }],
    }),
  );
  assert.deepEqual(findings, []);
});

test('hub sensor: a self-referencing FK is not a relationship between things', () => {
  const findings = verifyConceptCoverage(
    input({
      tables: [...input().tables, 'nodes'],
      fkEdges: [
        { from: 'nodes', to: 'nodes' },
        { from: 'nodes', to: 'nodes' },
      ],
    }),
  );
  assert.deepEqual(findings, []);
});

test('spine sensor: a core table pointing at something new fires on its own', () => {
  // Only ONE referrer, so the hub sensor cannot see it — this is the blind spot
  // the spine sensor exists to cover.
  const findings = verifyConceptCoverage(
    input({
      tables: [...input().tables, 'loyalty_programs'],
      fkEdges: [{ from: 'events', to: 'loyalty_programs' }],
    }),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.reason, 'spine-referenced');
  assert.match(findings[0]!.evidence, /events/);
});

test('family sensor: catches a star-shaped cluster the other two miss', () => {
  // Every table hangs off `events`, nothing references each other, and `events`
  // is the SOURCE not the target — so neither hub nor spine sensor sees it.
  const findings = verifyConceptCoverage(
    input({
      tables: [...input().tables, 'raffle_draws', 'raffle_entries', 'raffle_prizes'],
      fkEdges: [
        { from: 'raffle_draws', to: 'events' },
        { from: 'raffle_entries', to: 'events' },
        { from: 'raffle_prizes', to: 'events' },
      ],
    }),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.reason, 'name-family');
  assert.equal(findings[0]!.family?.length, 3);
});

test('family sensor: two tables are not a family — stays quiet', () => {
  const findings = verifyConceptCoverage(
    input({
      tables: [...input().tables, 'raffle_draws', 'raffle_entries'],
      fkEdges: input().fkEdges,
    }),
  );
  assert.deepEqual(findings, []);
});

test('family sensor: a family with ONE mapped member is an existing concept', () => {
  // `papic_*` growing a fourth table is not a new concept — Papic is mapped.
  const findings = verifyConceptCoverage(
    input({
      tables: [...input().tables, 'papic_pools', 'papic_seats', 'papic_captures'],
      mapped: new Set([...input().mapped, 'papic_pools']),
    }),
  );
  assert.deepEqual(findings, []);
});

/* ── the escape hatch, and its own rot-proofing ── */

test('a baselined table is accounted for', () => {
  const findings = verifyConceptCoverage(
    input({
      tables: [...input().tables, 'widgets', 'widget_a', 'widget_b'],
      fkEdges: [
        { from: 'widget_a', to: 'widgets' },
        { from: 'widget_b', to: 'widgets' },
      ],
      baseline: new Map([['widgets', 'internal ops, not a product entity']]),
    }),
  );
  assert.deepEqual(findings, []);
});

test('a baseline line for a table that no longer exists is STALE', () => {
  const stale = staleBaselineEntries(
    input({ baseline: new Map([['long_gone_table', 'was ops']]) }),
  );
  assert.equal(stale.length, 1);
  assert.match(stale[0]!, /no longer exists/);
});

test('a baseline line for a table that is NOW mapped is STALE', () => {
  // The direction people forget: promoting a concept onto the map must remove
  // its "declined" line, or the record contradicts itself.
  const stale = staleBaselineEntries(
    input({ baseline: new Map([['guests', 'not a product entity']]) }),
  );
  assert.equal(stale.length, 1);
  assert.match(stale[0]!, /now ON the map/);
});

/* ── thresholds are the response to noise, not deletion ── */

test('raising hubMinInbound silences a borderline hub', () => {
  const over = {
    tables: [...input().tables, 'widgets', 'widget_a', 'widget_b'],
    fkEdges: [
      { from: 'widget_a', to: 'widgets' },
      { from: 'widget_b', to: 'widgets' },
    ],
  };
  assert.ok(verifyConceptCoverage(input(over)).length > 0);
  assert.deepEqual(verifyConceptCoverage(input({ ...over, hubMinInbound: 3 })), []);
});

/* ── reporting + helpers ── */

test('the failure message names both remedies and forbids deleting the check', () => {
  const msg = formatConceptFindings([
    { table: 'communities', reason: 'hub', evidence: '3 tables reference it' },
  ]);
  assert.match(msg, /add a node to UGAT_TYPES/);
  assert.match(msg, /ugat-concept\.baseline\.txt/);
  assert.match(msg, /Do NOT delete or weaken this check/);
  assert.match(msg, /raise hubMinInbound/);
});

test('inboundCounts dedupes multiple FKs between the same pair', () => {
  const counts = inboundCounts([
    { from: 'a', to: 'z' },
    { from: 'a', to: 'z' },
    { from: 'b', to: 'z' },
  ]);
  assert.equal(counts.get('z')?.size, 2);
});

test('computePrefixFamilies prefers the longest specific prefix', () => {
  const fams = computePrefixFamilies(
    ['papic_pool_a', 'papic_pool_b', 'papic_pool_c', 'papic_x', 'papic_y'],
    3,
  );
  assert.ok(fams.has('papic_pool'), 'the specific sub-family must win');
  assert.equal(fams.get('papic_pool')?.length, 3);
});
