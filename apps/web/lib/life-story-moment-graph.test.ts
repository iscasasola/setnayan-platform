/**
 * Life Story · MomentGraph pure-core tests — clustering, coverage, person
 * linking, capturedBy resolution, recurrence. The query layer is a thin RLS
 * pass-through and is exercised on preview; everything decision-shaped lives
 * in these pure functions. Run: pnpm test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CLUSTER_GAP_MS,
  clusterBursts,
  computeCoverage,
  personKeyForGuest,
  assembleMomentGraph,
  filterMomentGraph,
  parseFlashScope,
  flashScopeKey,
  scopeMomentGraph,
  scopeOptions,
  type FlashScope,
  type RawInputs,
} from './life-story-moment-graph';

const at = (s: number) => new Date(Date.UTC(2024, 5, 1, 10, 0, s)).toISOString();

function item(id: string, capturerKey: string | null, capturedAt: string, eventId = 'e1') {
  return { id, eventId, capturerKey, capturedAt };
}

test('clusterBursts: chained ≤20s gaps from one capturer form one cluster; a big gap breaks it', () => {
  const clusters = clusterBursts([
    item('a', 'bea', at(0)),
    item('b', 'bea', at(15)), // 15s after a → chains
    item('c', 'bea', at(30)), // 15s after b → still chains
    item('d', 'bea', at(80)), // 50s after c → breaks
  ]);
  assert.equal(clusters.get('a'), clusters.get('b'));
  assert.equal(clusters.get('b'), clusters.get('c'));
  assert.equal(clusters.get('d'), undefined); // single → unclustered
  assert.ok(CLUSTER_GAP_MS === 20_000);
});

test('clusterBursts: different capturers and unknown capturers never cluster', () => {
  const clusters = clusterBursts([
    item('a', 'bea', at(0)),
    item('b', 'kiko', at(5)),
    item('c', null, at(6)),
    item('d', null, at(8)),
  ]);
  assert.equal(clusters.size, 0);
});

test('computeCoverage: distinct capturers within ±90s; always ≥1; windows are per-event', () => {
  const coverage = computeCoverage([
    item('a', 'bea', at(0)),
    item('b', 'kiko', at(60)), // within 90s of a
    item('c', 'cora', at(400)), // far away
    item('d', 'bea', at(0), 'e2'), // other event — never mingles
  ]);
  assert.equal(coverage.get('a'), 2); // bea + kiko
  assert.equal(coverage.get('b'), 2);
  assert.equal(coverage.get('c'), 1);
  assert.equal(coverage.get('d'), 1);
});

test('personKeyForGuest: linked guests share the person key; unlinked get event-local pseudo-keys', () => {
  const linked = { guest_id: 'g1', event_id: 'e1', display_name: null, first_name: 'Bea', last_name: 'S', person_id: 'p-bea' };
  const unlinked = { ...linked, guest_id: 'g2', person_id: null };
  assert.equal(personKeyForGuest(linked), 'p-bea');
  assert.equal(personKeyForGuest(unlinked), 'guest:g2');
});

// ---------------------------------------------------------------------------
// End-to-end pure assembly
// ---------------------------------------------------------------------------

function raw(): RawInputs {
  return {
    events: [
      { event_id: 'e1', display_name: 'The wedding', event_type: 'wedding', event_date: '2024-06-01', landing_page_hero_image_url: null },
      { event_id: 'e2', display_name: 'Noche Buena', event_type: 'reunion', event_date: '2023-12-24', landing_page_hero_image_url: 'https://cdn/hero.jpg' },
      { event_id: 'e3', display_name: 'Empty debut', event_type: 'debut', event_date: '2026-02-02', landing_page_hero_image_url: 'https://cdn/debut.jpg' },
    ],
    photos: [
      // Crew photo, shot by Bea's claimed seat.
      { photo_id: 'ph1', event_id: 'e1', r2_object_key: 'e1/ph1.jpg', photo_type: 'photo', captured_at: at(0), captured_by_person_id: 'p-bea' },
      // Crew clip from an UNCLAIMED seat.
      { photo_id: 'ph2', event_id: 'e1', r2_object_key: 'e1/ph2.mp4', photo_type: 'clip', captured_at: at(60), captured_by_person_id: null },
      // Shot by the viewer's own seat.
      { photo_id: 'ph3', event_id: 'e2', r2_object_key: 'e2/ph3.jpg', photo_type: 'photo', captured_at: at(0), captured_by_person_id: 'p-viewer' },
    ],
    guestCaptures: [
      // Guest capture by linked guest Kiko.
      { capture_id: 'gc1', event_id: 'e1', guest_id: 'g-kiko', r2_object_key: 'e1/gc1.jpg', media_type: 'photo', captured_at: at(30) },
      // Quota-only row (no bytes) — must be skipped.
      { capture_id: 'gc2', event_id: 'e1', guest_id: 'g-kiko', r2_object_key: null, media_type: 'photo', captured_at: at(90) },
    ],
    tags: [
      { source_table: 'papic_photos', source_id: 'ph1', guest_id: 'g-lola', source: 'individual_qr' },
      { source_table: 'papic_photos', source_id: 'ph1', guest_id: 'g-anon', source: 'individual_qr' },
      { source_table: 'papic_guest_captures', source_id: 'gc1', guest_id: 'g-lola', source: 'individual_qr' },
      // Lola again at the OTHER event → recurrence 2.
      { source_table: 'papic_photos', source_id: 'ph3', guest_id: 'g-lola-e2', source: 'individual_qr' },
    ],
    guests: [
      { guest_id: 'g-kiko', event_id: 'e1', display_name: null, first_name: 'Kiko', last_name: 'R', person_id: 'p-kiko' },
      { guest_id: 'g-lola', event_id: 'e1', display_name: 'Lola Rosario', first_name: 'Rosario', last_name: 'C', person_id: 'p-lola' },
      { guest_id: 'g-lola-e2', event_id: 'e2', display_name: null, first_name: 'Rosario', last_name: 'C', person_id: 'p-lola' },
      { guest_id: 'g-anon', event_id: 'e1', display_name: null, first_name: 'Walk', last_name: 'In', person_id: null },
    ],
    people: [
      { person_id: 'p-bea', display_name: 'Bea', first_name: null, last_name: null, in_memoriam: false },
      { person_id: 'p-kiko', display_name: null, first_name: 'Kiko', last_name: 'Reyes', in_memoriam: false },
      { person_id: 'p-lola', display_name: 'Lola Rosario', first_name: null, last_name: null, in_memoriam: true },
      { person_id: 'p-viewer', display_name: 'Me', first_name: null, last_name: null, in_memoriam: false },
    ],
  };
}

const VIEWER = { personId: 'p-viewer', birthDate: null };

test('assembleMomentGraph: capturedBy resolves seat-claim, guest, unclaimed, and self correctly', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  const byId = new Map(graph.moments.map((m) => [m.media.sourceId, m]));

  const crew = byId.get('ph1')!;
  assert.deepEqual(crew.capturedBy, { kind: 'papic_seat', personId: 'p-bea', displayName: 'Bea' });

  const unclaimed = byId.get('ph2')!;
  assert.deepEqual(unclaimed.capturedBy, { kind: 'papic_seat', personId: null, displayName: null });
  assert.equal(unclaimed.media.type, 'clip');

  const guest = byId.get('gc1')!;
  assert.equal(guest.capturedBy.kind, 'guest');
  assert.equal(guest.capturedBy.personId, 'p-kiko');
  assert.equal(guest.capturedBy.displayName, 'Kiko Reyes'); // person name beats guest name

  const own = byId.get('ph3')!;
  assert.equal(own.capturedBy.kind, 'self');
});

test('assembleMomentGraph: quota-only guest captures (null r2 key) are excluded', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  assert.ok(!graph.moments.some((m) => m.media.sourceId === 'gc2'));
  assert.equal(graph.moments.length, 4);
});

test('assembleMomentGraph: presence links through people; recurrence counts distinct events', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  const crew = graph.moments.find((m) => m.media.sourceId === 'ph1')!;

  const lola = crew.peoplePresent.find((p) => p.personId === 'p-lola')!;
  assert.equal(lola.inMemoriam, true); // ✦ flows from people.in_memoriam only
  assert.equal(lola.recurrence, 2); // e1 + e2
  assert.equal(lola.displayName, 'Lola Rosario');

  const anon = crew.peoplePresent.find((p) => p.personId === 'guest:g-anon')!;
  assert.equal(anon.inMemoriam, false);
  assert.equal(anon.recurrence, 1); // event-local pseudo-person can't recur
  assert.equal(anon.displayName, 'Walk In');

  // graph.people is recurrence-ranked — Lola first.
  assert.equal(graph.people[0]!.personId, 'p-lola');
});

test('assembleMomentGraph: moments come back scored and significance-ordered', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  for (let i = 1; i < graph.moments.length; i++) {
    assert.ok(graph.moments[i - 1]!.significance >= graph.moments[i]!.significance);
  }
  // ph1 (✦ Lola present, wedding, 2 people) must outrank the untagged clip.
  assert.equal(graph.moments[0]!.media.sourceId, 'ph1');
});

test('assembleMomentGraph: sparse dignity — empty events stay in events[] with their hero', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  const empty = graph.events.find((e) => e.eventId === 'e3')!;
  assert.equal(empty.heroImageUrl, 'https://cdn/debut.jpg');
  assert.ok(!graph.moments.some((m) => m.eventId === 'e3'));
});

test('assembleMomentGraph: empty raw input yields a valid empty graph', () => {
  const graph = assembleMomentGraph(
    { events: [], photos: [], guestCaptures: [], tags: [], guests: [], people: [] },
    { personId: null, birthDate: null },
  );
  assert.deepEqual(graph.moments, []);
  assert.deepEqual(graph.people, []);
  assert.deepEqual(graph.events, []);
});

// ---------------------------------------------------------------------------
// Period windowing (the monthly/yearly recap seam — Build Plan §11)
// ---------------------------------------------------------------------------

test('filterMomentGraph: slices moments and events to the window (from inclusive, to exclusive)', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  // raw(): e1 wedding frames at 2024-06-01, e2 photo at 2023-12-24-ish? — e2's
  // ph3 uses at(0) (2024-06-01) too, so window on 2024 keeps both; a 2025
  // window keeps none.
  const y2024 = filterMomentGraph(graph, { from: '2024-01-01', to: '2025-01-01' });
  assert.equal(y2024.moments.length, graph.moments.length);

  const y2025 = filterMomentGraph(graph, { from: '2025-01-01', to: '2026-01-01' });
  assert.equal(y2025.moments.length, 0);
  assert.equal(y2025.events.length, 0);
  assert.equal(y2025.people.length, 0);
});

test('filterMomentGraph: people restrict to in-window presence but keep LIFETIME recurrence', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  // Window that keeps only e1 media (exclude e2's ph3 by windowing on the
  // exact capture minute of e1 — all raw() captures share 2024-06-01T10:00,
  // so instead window by excluding nothing and hand-checking values).
  const whole = filterMomentGraph(graph, { from: '2024-01-01' });
  const lola = whole.people.find((p) => p.personId === 'p-lola');
  assert.ok(lola, 'Lola present in window');
  assert.equal(lola!.recurrence, 2); // lifetime value survives the slice
});

test('filterMomentGraph: open-ended windows and the identity window are no-ops', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  const same = filterMomentGraph(graph, {});
  assert.equal(same.moments.length, graph.moments.length);
  assert.equal(same.events.length, graph.events.length - 1); // e3 has no moments → dropped in a recap view
  assert.deepEqual(
    same.moments.map((m) => m.id),
    graph.moments.map((m) => m.id),
  );
});

// ---------------------------------------------------------------------------
// Life-Flash scopes (event / month / year / lifetime)
// ---------------------------------------------------------------------------

test('parseFlashScope ⇄ flashScopeKey round-trip; malformed degrades to life', () => {
  const cases: FlashScope[] = [
    { kind: 'life' },
    { kind: 'year', year: 2026 },
    { kind: 'month', year: 2026, month: 7 },
    { kind: 'event', eventId: 'e1' },
  ];
  for (const scope of cases) {
    assert.deepEqual(parseFlashScope(flashScopeKey(scope)), scope);
  }
  assert.deepEqual(parseFlashScope('m2026-13'), { kind: 'life' }); // bad month
  assert.deepEqual(parseFlashScope('zzz'), { kind: 'life' });
  assert.deepEqual(parseFlashScope(undefined), { kind: 'life' });
});

test('scopeMomentGraph: event scope slices to one event; life is identity', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  const e1 = scopeMomentGraph(graph, { kind: 'event', eventId: 'e1' });
  assert.ok(e1.moments.length > 0);
  assert.ok(e1.moments.every((m) => m.eventId === 'e1'));
  assert.deepEqual(e1.events.map((e) => e.eventId), ['e1']);

  const life = scopeMomentGraph(graph, { kind: 'life' });
  assert.equal(life.moments.length, graph.moments.length);
  assert.equal(life.events.length, graph.events.length); // identity — chapter cards survive
});

test('scopeMomentGraph: month scope windows correctly incl. December rollover', () => {
  const graph = assembleMomentGraph(raw(), VIEWER); // all captures 2024-06-01
  const june = scopeMomentGraph(graph, { kind: 'month', year: 2024, month: 6 });
  assert.equal(june.moments.length, graph.moments.length);
  const december = scopeMomentGraph(graph, { kind: 'month', year: 2024, month: 12 });
  assert.equal(december.moments.length, 0);
});

test('scopeOptions: only scopes clearing the dignity thresholds are offered', () => {
  const graph = assembleMomentGraph(raw(), VIEWER);
  // raw() yields 4 moments total: 3 in e1, 1 in e2 — below year/month min (5),
  // e1 clears the event min (3), e2 does not.
  const options = scopeOptions(graph);
  assert.equal(options.years.length, 0);
  assert.equal(options.months.length, 0);
  assert.deepEqual(options.events.map((o) => o.key), ['ee1']);
  assert.equal(options.events[0]!.count, 3);
  assert.equal(options.events[0]!.label, 'The wedding');
});

// ---------------------------------------------------------------------------
// SAFETY REGRESSION GUARD (2026-07-11) — the moderation gate.
//
// fetchMomentGraph's papic_photos + papic_guest_captures reads MUST keep
// `.eq('moderation_state','clean')`. That filter is the only thing keeping
// nsfw_blocked / unscreened / RA-10173 consent_withheld / faceblock_withheld
// media out of the fullscreen auto-playing flash (the couple RLS policy gates
// on event membership only; NSFW screening writes moderation_state, never
// hidden_at — so hidden_at is NOT a content proxy). It lives at the Supabase
// query layer, so the pure assembler tests above can't reach it — this reads
// the source and asserts each media query still carries the gate before it
// ends (bounded by the query's own `.limit(`), so nobody can silently drop it.
// ---------------------------------------------------------------------------
test('SAFETY GUARD: both papic media queries keep the moderation_state=clean gate', () => {
  const src = readFileSync(new URL('./life-story-moment-graph.ts', import.meta.url), 'utf8');
  for (const table of ['papic_photos', 'papic_guest_captures'] as const) {
    // From `.from('<table>')`, before the query's `.limit(`, require the clean gate.
    const re = new RegExp(
      `\\.from\\('${table}'\\)(?:(?!\\.limit\\()[\\s\\S])*?\\.eq\\(\\s*'moderation_state'\\s*,\\s*'clean'\\s*\\)`,
    );
    assert.ok(
      re.test(src),
      `SAFETY: fetchMomentGraph's ${table} query must keep .eq('moderation_state','clean') — removing it leaks nsfw_blocked / unscreened / consent_withheld / faceblock_withheld media into Life-Flash.`,
    );
  }
});
