import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  UGAT_TYPES,
  UGAT_TYPE_BY_ID,
  UGAT_FINDINGS,
  UGAT_JOINTS,
  UGAT_FINDING_STALE_AFTER_DAYS,
  platformEdges,
  findingsForType,
  findingForEdge,
  openUgatFindings,
  findingAgeDays,
  isFindingStale,
  jointsForEdge,
} from './graph';
import { scoreUgatMatch } from './data-pure';

/* ── the nine platform type nodes are complete + consistent ── */

test('there are exactly nine type nodes, one per entity type', () => {
  assert.equal(UGAT_TYPES.length, 9);
  const types = new Set(UGAT_TYPES.map((t) => t.type));
  assert.equal(types.size, 9);
  // every node id is unique
  const ids = new Set(UGAT_TYPES.map((t) => t.id));
  assert.equal(ids.size, 9);
});

test('every type-node edge points at a real type node', () => {
  for (const node of UGAT_TYPES) {
    for (const eg of node.edges) {
      assert.ok(
        UGAT_TYPE_BY_ID[eg.to],
        `${node.id} edge "${eg.verb}" → unknown node ${eg.to}`,
      );
    }
  }
});

/* ── platform edges: de-duped on the unordered pair ── */

test('platformEdges de-dupes reciprocal edges (one line per pair)', () => {
  const edges = platformEdges();
  const seen = new Set<string>();
  for (const e of edges) {
    const k = [e.from, e.to].sort().join('|');
    assert.ok(!seen.has(k), `duplicate edge for pair ${k}`);
    seen.add(k);
  }
  // Users↔Events appears once, not twice (both nodes declare the relationship).
  const userEventEdges = edges.filter(
    (e) =>
      (e.from === 'TYPE-USERS' && e.to === 'TYPE-EVENTS') ||
      (e.from === 'TYPE-EVENTS' && e.to === 'TYPE-USERS'),
  );
  assert.equal(userEventEdges.length, 1);
});

test('platformEdges only references present nodes', () => {
  const present = new Set(UGAT_TYPES.map((t) => t.id));
  for (const e of platformEdges()) {
    assert.ok(present.has(e.from));
    assert.ok(present.has(e.to));
  }
});

/* ── health findings registry ── */

test('every finding has a valid severity, fix state and 5-step trace', () => {
  // Deliberately NOT a hardcoded count. The old assertion pinned 9 and had to be
  // edited every time the registry moved, which made "the count changed" look
  // like a test failure rather than what it is — the audit doing its job.
  assert.ok(UGAT_FINDINGS.length >= 9, 'registry should not lose findings');
  for (const f of UGAT_FINDINGS) {
    assert.ok(f.sev === 'red' || f.sev === 'amber');
    assert.ok(f.fix === 'queued' || f.fix === 'needsowner' || f.fix === 'done');
    // A trace must be a full walk, but no longer EXACTLY five. The re-audit
    // added a sixth row to several findings recording that the original cited a
    // column which never existed — pinning 5 would force deleting exactly the
    // evidence that makes the correction auditable. FindingCard numbers rows
    // dynamically, so the length was never load-bearing for rendering.
    assert.ok(
      f.trace.length >= 5 && f.trace.length <= 7,
      `${f.id} trace should be a 5-7 step walk, got ${f.trace.length}`,
    );
    // every finding binds a real entity type
    assert.ok(
      UGAT_TYPES.some((t) => t.type === f.bindType),
      `${f.id} binds unknown type ${f.bindType}`,
    );
  }
});

test('finding ids are unique', () => {
  const ids = UGAT_FINDINGS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate finding id');
});

/* ── the anti-staleness contract (added 2026-07-30) ──
   Six of nine findings silently went stale inside 25 days, and three cited
   columns that never existed. These assertions make an undated or unevidenced
   finding a BUILD failure rather than a slow rot. */

test('every finding carries an ISO verifiedAt that is not in the future', () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const f of UGAT_FINDINGS) {
    assert.match(f.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${f.id} verifiedAt must be ISO yyyy-mm-dd`);
    assert.ok(f.verifiedAt <= today, `${f.id} verifiedAt is in the future`);
  }
});

test('every finding carries non-empty evidence and a valid status', () => {
  for (const f of UGAT_FINDINGS) {
    assert.ok(
      f.verifiedEvidence && f.verifiedEvidence.trim().length > 20,
      `${f.id} needs real evidence (a ref + file:line or migration), not a stub`,
    );
    assert.ok(
      f.status === 'open' || f.status === 'mitigated' || f.status === 'fixed',
      `${f.id} has invalid status`,
    );
  }
});

test('openUgatFindings excludes exactly the fixed rows', () => {
  const open = openUgatFindings();
  assert.ok(open.every((f) => f.status !== 'fixed'));
  assert.equal(open.length, UGAT_FINDINGS.filter((f) => f.status !== 'fixed').length);
  // fixed findings are KEPT in the registry as history, never deleted
  assert.ok(
    UGAT_FINDINGS.some((f) => f.status === 'fixed'),
    'fixed findings must remain as history',
  );
});

test('a fixed finding is never stale, and staleness turns over at the boundary', () => {
  const open = openUgatFindings()[0];
  assert.ok(open, 'expected at least one open finding');
  const base = Date.parse(`${open.verifiedAt}T00:00:00Z`);
  const day = 86_400_000;
  assert.equal(findingAgeDays(open, base), 0);
  assert.equal(isFindingStale(open, base + UGAT_FINDING_STALE_AFTER_DAYS * day), false);
  assert.equal(isFindingStale(open, base + (UGAT_FINDING_STALE_AFTER_DAYS + 1) * day), true);
  const fixed = UGAT_FINDINGS.find((f) => f.status === 'fixed')!;
  const fixedBase = Date.parse(`${fixed.verifiedAt}T00:00:00Z`);
  assert.equal(isFindingStale(fixed, fixedBase + 9999 * day), false);
});

test('the map overlay never surfaces a fixed finding on an edge', () => {
  // findingForEdge feeds the canvas. A closed finding painting a red edge is
  // the exact regression this refresh existed to end.
  for (const f of UGAT_FINDINGS) {
    if (f.status === 'fixed' && f.bindEdge) {
      assert.notEqual(
        findingForEdge(f.bindEdge[0], f.bindEdge[1])?.id,
        f.id,
        `${f.id} is fixed but still marks its edge`,
      );
    }
  }
});

test('findingsForType rolls findings onto their bound type node', () => {
  // F2 (verification fee) binds vendor; F9 binds service.
  assert.ok(findingsForType('vendor').some((f) => f.id === 'F2'));
  assert.ok(findingsForType('service').some((f) => f.id === 'F9'));
  // orders own F1 + F8 + F10 (the new public-receipt exposure)
  const orderIds = findingsForType('order').map((f) => f.id).sort();
  assert.deepEqual(orderIds, ['F1', 'F10', 'F8']);
});

test('findingForEdge matches a bound edge in either direction', () => {
  const f = findingForEdge('TYPE-SERVICES', 'TYPE-TAXONOMY');
  assert.equal(f?.id, 'F9');
  // order-independent
  assert.equal(findingForEdge('TYPE-TAXONOMY', 'TYPE-SERVICES')?.id, 'F9');
  // an unbound pair returns nothing
  assert.equal(findingForEdge('TYPE-USERS', 'TYPE-BILLING'), undefined);
});

/* ── joints index ── */

test('joints resolve for a type-node edge, order-independent', () => {
  const j = jointsForEdge('TYPE-USERS', 'TYPE-EVENTS');
  assert.ok(j.some((x) => x.joint === 'event_members'));
  assert.deepEqual(
    jointsForEdge('TYPE-EVENTS', 'TYPE-USERS').map((x) => x.id),
    jointsForEdge('TYPE-USERS', 'TYPE-EVENTS').map((x) => x.id),
  );
});

test('every joint pair references real type nodes', () => {
  for (const j of UGAT_JOINTS) {
    assert.ok(UGAT_TYPE_BY_ID[j.pair[0]], `${j.id} bad pair[0] ${j.pair[0]}`);
    assert.ok(UGAT_TYPE_BY_ID[j.pair[1]], `${j.id} bad pair[1] ${j.pair[1]}`);
    if (j.healthId) {
      assert.ok(
        UGAT_FINDINGS.some((f) => f.id === j.healthId),
        `${j.id} references missing finding ${j.healthId}`,
      );
    }
  }
});

/* ── search ranking (pure) ── */

test('scoreUgatMatch ranks exact > prefix > contained > token', () => {
  assert.ok(scoreUgatMatch('Lumina Studios', 'lumina studios') > scoreUgatMatch('Lumina Studios', 'lumina'));
  assert.ok(scoreUgatMatch('Lumina Studios', 'lumina') > scoreUgatMatch('Lumina Studios', 'studios'));
  assert.ok(scoreUgatMatch('Lumina Studios', 'studios') > 0);
  // no query or empty haystack → 0
  assert.equal(scoreUgatMatch('Lumina', ''), 0);
  assert.equal(scoreUgatMatch('', 'lumina'), 0);
  // no overlap → 0
  assert.equal(scoreUgatMatch('Lumina', 'zzzz'), 0);
});

test('scoreUgatMatch is case-insensitive and trims', () => {
  assert.equal(scoreUgatMatch('  Bloomfield  ', 'BLOOMFIELD'), 100);
});
