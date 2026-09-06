/**
 * Q9 · SUGGEST, NEVER WRITE.
 *
 * Owner ruling 2026-09-06: a booked supplier makes the reception zone OFFER
 * itself; it does not change the couple's design. These guards hold that line
 * at the two places it can be crossed — the shape of the result, and the
 * vocabulary the match is made in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './strip-comments';
import {
  suggestZonesFromBookings,
  suggestionLine,
  type BookedSupplier,
} from './reception-booked-suggestions';
import { canonicalServicesForPart } from './moodboard-finalization';
import { RECEPTION_PARTS } from './reception-scene';

const BOOKED: BookedSupplier[] = [
  { vendorId: 'v1', vendorName: 'Manila Strings', services: ['live_band'] },
  { vendorId: 'v2', vendorName: 'The Gin Cart', services: ['mobile_bar'] },
  { vendorId: 'v3', vendorName: 'Snapbox', services: ['photo_booth'] },
  { vendorId: 'v4', vendorName: 'Bloomhaus', services: ['florist'] },
  { vendorId: 'v5', vendorName: 'Kuya Mike', services: ['host_emcee'] },
];
const ZONES = ['feast', 'program', 'booths', 'ceiling', 'stage', 'tables'] as const;

test('Q9: a booked band, bar and booth each reach their own zone', () => {
  const byZone = new Map(suggestZonesFromBookings(BOOKED, ZONES).map((s) => [s.zone, s]));
  assert.deepEqual(
    byZone.get('program')?.suppliers.map((v) => v.vendorName).sort(),
    ['Kuya Mike', 'Manila Strings'],
    'a booked live band and emcee did not reach the program zone',
  );
  assert.deepEqual(byZone.get('feast')?.suppliers.map((v) => v.vendorName), ['The Gin Cart']);
  assert.deepEqual(byZone.get('booths')?.suppliers.map((v) => v.vendorName), ['Snapbox']);
});

test('Q9: a zone with no matching supplier is ABSENT, not empty', () => {
  const zones = suggestZonesFromBookings(BOOKED, ZONES).map((s) => s.zone);
  assert.ok(!zones.includes('ceiling'), 'the ceiling was suggested with no ceiling supplier booked');
  assert.deepEqual(suggestZonesFromBookings([], ZONES), []);
  assert.deepEqual(suggestZonesFromBookings(BOOKED, []), []);
});

test('Q9: the same supplier is never listed twice in one zone', () => {
  const dupes: BookedSupplier[] = [
    { vendorId: 'v1', vendorName: 'Manila Strings', services: ['live_band'] },
    { vendorId: 'v1', vendorName: 'Manila Strings', services: ['dj'] },
  ];
  const s = suggestZonesFromBookings(dupes, ['program']);
  assert.equal(s[0]?.suppliers.length, 1, 'a vendor booked under two categories was listed twice');
});

test('Q9: total on junk — no throw, no invented suggestion', () => {
  const junk = [
    { vendorId: '', vendorName: 'nameless', services: ['live_band'] },
    { vendorId: 'v9', vendorName: 'no services', services: [] },
  ] as BookedSupplier[];
  assert.deepEqual(suggestZonesFromBookings(junk, ['program']), []);
  assert.deepEqual(suggestZonesFromBookings(BOOKED, ['not_a_zone' as never]), []);
});

test('Q9 · THE RULING: this module cannot produce a design, by shape', () => {
  // 🔑 The ruling is enforced by the RETURN TYPE, not by discipline. If a later
  // edit teaches this file to write, it has to import the design vocabulary to
  // do it — and that is what this reads. A comment saying "suggest only" would
  // not survive the edit; this does.
  // 🪤 THROUGH `stripComments`, NOT THE RAW FILE. The first version scanned raw
  // source and failed on this module's OWN DOCBLOCK, which names the design
  // vocabulary in order to explain why it must not touch it. A guard that
  // cannot tell code from the comment describing it accuses the explanation —
  // the same shape MB23 hit with its "no-CORS host" scan, and the reason this
  // repo has exactly one stripper.
  const src = stripComments(
    readFileSync(new URL('./reception-booked-suggestions.ts', import.meta.url), 'utf8'),
  );
  assert.doesNotMatch(
    src,
    /ReceptionDesign|sanitizeReceptionDesign|DEFAULT_DESIGN|saveReceptionDesign/,
    'reception-booked-suggestions.ts now references the reception DESIGN vocabulary. The owner ' +
      "ruled 2026-09-06 that a booked supplier SUGGESTS a zone and never writes it: a couple " +
      'must not find selections they did not make, and must be able to delete one and have it ' +
      'stay deleted. If applying is genuinely wanted, it belongs behind an explicit user action ' +
      'in a component — not in the function that computes the offer.',
  );
  // …and the result carries no option id for anything to apply blindly.
  for (const s of suggestZonesFromBookings(BOOKED, ZONES)) {
    assert.deepEqual(
      Object.keys(s).sort(),
      ['suppliers', 'zone'],
      `a suggestion for ${s.zone} carries more than the zone and who was booked`,
    );
  }
});

test('Q9 · THE TRAP: the part-id namespace is `room:<zone>`', () => {
  // 🪤 The first version passed the BARE zone id and produced zero suggestions
  // for every couple — silently, because an empty list is exactly what "booked
  // nobody for this zone" looks like. No type could see it; running it on real
  // bookings did. This pins the namespace so it cannot drift back.
  assert.equal(
    canonicalServicesForPart('program').length,
    0,
    'the bare zone id now resolves to services. If the namespace changed, this module must ' +
      'change with it — and the assertion below is what tells you.',
  );
  assert.ok(
    canonicalServicesForPart('room:program').includes('live_band'),
    '`room:program` no longer resolves to live_band, so a booked band reaches no zone.',
  );
});

test('Q9: every celebration zone can be reached by SOME supplier', () => {
  // A zone whose trades resolve to nothing can never be suggested — which looks
  // identical to "nobody is booked for it". RV1 wired the three celebration
  // zones into MOODBOARD_PART_TRADES; this is what notices if one is unwired.
  for (const zone of ['feast', 'program', 'booths'] as const) {
    const services = canonicalServicesForPart(`room:${zone}`);
    assert.ok(
      services.length > 0,
      `room:${zone} resolves to no canonical service, so no booking can ever light it up.`,
    );
    const one: BookedSupplier[] = [{ vendorId: 'v', vendorName: 'A Supplier', services: [services[0]!] }];
    assert.equal(suggestZonesFromBookings(one, [zone]).length, 1);
  }
});

test('Q9: the line states a BOOKING, never a change to their room', () => {
  const s = suggestZonesFromBookings(BOOKED, ['program'])[0]!;
  const line = suggestionLine(s);
  assert.match(line, /^You've booked /);
  assert.doesNotMatch(
    line,
    /\b(added|applied|updated|set|now shows|we[' ]?ve put)\b/i,
    `the suggestion line reads "${line}", which tells the couple their room has already ` +
      'changed. It has not — the verb they act on belongs in the button.',
  );
  assert.equal(suggestionLine({ zone: 'program', suppliers: [] }), '');
  const many = suggestionLine({
    zone: 'program',
    suppliers: [1, 2, 3, 4].map((i) => ({ vendorId: `v${i}`, vendorName: `Supplier ${i}` })),
  });
  assert.match(many, /and 2 more$/, `four suppliers rendered as "${many}"`);
});

test('Q9: every zone it can suggest is a real reception part', () => {
  const ids = new Set(RECEPTION_PARTS.map((p) => p.id));
  for (const s of suggestZonesFromBookings(BOOKED, ZONES)) {
    assert.ok(ids.has(s.zone), `suggested "${s.zone}", which is not a reception zone`);
  }
});
