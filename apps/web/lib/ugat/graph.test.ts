import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  UGAT_TYPES,
  UGAT_TYPE_BY_ID,
  UGAT_FINDINGS,
  UGAT_JOINTS,
  platformEdges,
  findingsForType,
  findingForEdge,
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

test('all nine findings have a valid severity, fix state and 5-step trace', () => {
  assert.equal(UGAT_FINDINGS.length, 9);
  for (const f of UGAT_FINDINGS) {
    assert.ok(f.sev === 'red' || f.sev === 'amber');
    assert.ok(f.fix === 'queued' || f.fix === 'needsowner');
    assert.equal(f.trace.length, 5, `${f.id} trace should have 5 steps`);
    // every finding binds a real entity type
    assert.ok(
      UGAT_TYPES.some((t) => t.type === f.bindType),
      `${f.id} binds unknown type ${f.bindType}`,
    );
  }
});

test('findingsForType rolls findings onto their bound type node', () => {
  // F2 (verification fee) binds vendor; F9 binds service.
  assert.ok(findingsForType('vendor').some((f) => f.id === 'F2'));
  assert.ok(findingsForType('service').some((f) => f.id === 'F9'));
  // orders own F1 + F8
  const orderIds = findingsForType('order').map((f) => f.id).sort();
  assert.deepEqual(orderIds, ['F1', 'F8']);
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
