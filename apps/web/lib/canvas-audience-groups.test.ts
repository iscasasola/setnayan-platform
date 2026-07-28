/**
 * canvas-audience-groups — THE UNION INVARIANT.
 *
 * The audience sheet writes `vendor_coverages.event_types` through the shipped
 * `updateCoverageServes`, which is REPLACE-ALL. Only rendered checkboxes post.
 * Those two facts together mean a vocab key that renders no chip is not merely
 * unavailable — it is DELETED from the vendor's coverage the moment they save
 * the sheet for any other reason, and the loss propagates to Explore via
 * `syncProfileFromCoverages`.
 *
 * So the test that matters is not "are the curated lists right?" — it is
 * "does everything render?". Every case below comes back to that.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LIFE_EVENT_KEYS,
  ORGANISED_EVENT_KEYS,
  audienceGroups,
  type AudienceOption,
} from './canvas-audience-groups';

const CANVAS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../app/vendor-dashboard/services/_components/canvas-maker.tsx',
);

/**
 * LIVE PROD VOCAB, verified against `event_type_vocab WHERE status='active'`
 * on 2026-07-28, in `sort_order`. Sixteen keys. The first cut of the sheet
 * rendered eleven of them.
 */
const PROD_VOCAB: AudienceOption[] = [
  { key: 'wedding', label: 'Wedding' },
  { key: 'debut', label: 'Debut' },
  { key: 'gender_reveal', label: 'Gender Reveal' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'celebration', label: 'Celebration' },
  { key: 'travel', label: 'Travel' },
  { key: 'corporate', label: 'Corporate' },
  { key: 'tournament', label: 'Tournament' },
  { key: 'christening', label: 'Christening' },
  { key: 'anniversary', label: 'Anniversary' },
  { key: 'graduation', label: 'Graduation' },
  { key: 'reunion', label: 'Reunion' },
  { key: 'gala_night', label: 'Gala Night' },
  { key: 'simple_event', label: 'Simple Event' },
  { key: 'date', label: 'Date' },
  { key: 'hangout', label: 'Hangout' },
];

/** Every key the sheet would actually render, across all groups. */
function renderedKeys(options: AudienceOption[]): string[] {
  return audienceGroups(options).flatMap((g) => g.options.map((o) => o.key));
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · THE INVARIANT
// ════════════════════════════════════════════════════════════════════════════

test('THE UNION INVARIANT — every vocab option renders, in exactly one group', () => {
  const rendered = renderedKeys(PROD_VOCAB);
  const input = PROD_VOCAB.map((o) => o.key);

  assert.deepEqual(
    [...rendered].sort(),
    [...input].sort(),
    'a vocab key that renders no chip is DELETED from the coverage on the next save',
  );
  assert.equal(
    new Set(rendered).size,
    rendered.length,
    'a duplicated chip would post its value twice',
  );
});

test('the five keys the first cut dropped now render — in the catch-all group', () => {
  const groups = audienceGroups(PROD_VOCAB);
  const more = groups.find((g) => g.id === 'more');
  assert.ok(more, '"More events" group expected');
  for (const key of ['celebration', 'gala_night', 'simple_event', 'date', 'hangout']) {
    assert.ok(
      more?.options.some((o) => o.key === key),
      `"${key}" must render — it was silently stripped before`,
    );
  }
});

test('an event type an admin adds tomorrow renders with NO code change', () => {
  const withNewKey: AudienceOption[] = [
    ...PROD_VOCAB,
    { key: 'baby_shower', label: 'Baby Shower' },
  ];
  const rendered = renderedKeys(withNewKey);
  assert.ok(rendered.includes('baby_shower'));
  assert.deepEqual([...rendered].sort(), withNewKey.map((o) => o.key).sort());
});

test('a vocab of ONLY uncurated keys still renders every one of them', () => {
  // The worst prior case: a coverage serving only these posted ZERO event types,
  // and parseEventTypes force-wrote ['wedding'] — an audience never chosen.
  const only: AudienceOption[] = [
    { key: 'gala_night', label: 'Gala Night' },
    { key: 'hangout', label: 'Hangout' },
  ];
  assert.deepEqual(renderedKeys(only).sort(), ['gala_night', 'hangout']);
});

// ════════════════════════════════════════════════════════════════════════════
// 2 · The owner's grouping is preserved
// ════════════════════════════════════════════════════════════════════════════

test('the owner’s two curated groups keep their keys and their reading order', () => {
  const groups = audienceGroups(PROD_VOCAB);
  assert.deepEqual(groups.map((g) => g.id), ['life', 'events', 'more']);
  assert.deepEqual(
    groups[0]?.options.map((o) => o.key),
    [...LIFE_EVENT_KEYS],
    'Life events renders in the owner’s order, not sort_order',
  );
  assert.deepEqual(groups[1]?.options.map((o) => o.key), [...ORGANISED_EVENT_KEYS]);
});

test('the catch-all preserves the vocab’s own sort_order (what admin controls)', () => {
  const more = audienceGroups(PROD_VOCAB).find((g) => g.id === 'more');
  assert.deepEqual(more?.options.map((o) => o.key), [
    'celebration', //   sort_order 5
    'gala_night', //    13
    'simple_event', //  14
    'date', //          15
    'hangout', //       16
  ]);
});

test('a curated key missing from the vocab is skipped, never invented', () => {
  const partial: AudienceOption[] = [{ key: 'wedding', label: 'Wedding' }];
  const groups = audienceGroups(partial);
  assert.deepEqual(groups[0]?.options.map((o) => o.key), ['wedding']);
  assert.deepEqual(groups[1]?.options, []);
  assert.deepEqual(groups[2]?.options, []);
});

test('an empty vocab yields three empty groups, never a crash', () => {
  const groups = audienceGroups([]);
  assert.equal(groups.length, 3);
  for (const g of groups) assert.deepEqual(g.options, []);
});

test('duplicate vocab rows collapse to one chip', () => {
  const dupes: AudienceOption[] = [
    { key: 'wedding', label: 'Wedding' },
    { key: 'wedding', label: 'Wedding (dupe)' },
    { key: 'hangout', label: 'Hangout' },
    { key: 'hangout', label: 'Hangout (dupe)' },
  ];
  assert.deepEqual(renderedKeys(dupes).sort(), ['hangout', 'wedding']);
});

// ════════════════════════════════════════════════════════════════════════════
// 3 · The sheet actually uses this — the invariant must reach the screen
// ════════════════════════════════════════════════════════════════════════════

test('the audience sheet renders FROM audienceGroups, not from a local list', () => {
  const canvas = readFileSync(CANVAS, 'utf8');
  assert.match(
    canvas,
    /audienceGroups\(eventTypeOptions\)\.map\(/,
    'the sheet must map the grouping helper — a local .filter() is how the five keys were lost',
  );
  // The hardcoded arrays must NOT come back into the component; they live in
  // the tested module or nowhere.
  assert.doesNotMatch(canvas, /const LIFE_EVENT_KEYS/);
  assert.doesNotMatch(canvas, /const ORGANISED_EVENT_KEYS/);
});
