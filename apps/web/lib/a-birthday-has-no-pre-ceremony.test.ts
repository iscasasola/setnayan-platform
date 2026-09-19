/**
 * A birthday has no pre-ceremony (AREA-COUPLE, 2026-09-19).
 *
 * Every non-wedding run-of-show seed files "Guest arrival" under the
 * `pre_ceremony` block type, and every surface printed the raw type label — so
 * the live public programme at setnayan.com/movie-night read
 * "PRE-CEREMONY · Guest arrival". This EXECUTES the one label rule, then pins
 * that every surface that shows a block's type to a person goes through it
 * with the event's own type, not the bare map.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scheduleBlockLabelFor, SCHEDULE_BLOCK_LABEL, SCHEDULE_BLOCK_TYPES } from './schedule';
import { stripComments } from './strip-comments';

test('a non-wedding reads "Arrival", never "Pre-ceremony"', () => {
  for (const t of ['birthday', 'debut', 'date', 'christening']) {
    assert.equal(scheduleBlockLabelFor('pre_ceremony', t), 'Arrival', t);
  }
});

test('a wedding, and a legacy null type, are byte-identical to the map', () => {
  for (const type of SCHEDULE_BLOCK_TYPES) {
    assert.equal(scheduleBlockLabelFor(type, 'wedding'), SCHEDULE_BLOCK_LABEL[type]);
    assert.equal(scheduleBlockLabelFor(type, null), SCHEDULE_BLOCK_LABEL[type]);
  }
});

test('every other type is unchanged for a non-wedding', () => {
  for (const type of SCHEDULE_BLOCK_TYPES.filter((t) => t !== 'pre_ceremony')) {
    assert.equal(scheduleBlockLabelFor(type, 'birthday'), SCHEDULE_BLOCK_LABEL[type]);
  }
});

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

// Each person-facing surface that prints a block's TYPE, and how many times.
const SURFACES: Array<[string, number]> = [
  ['app/[slug]/_components/schedule-widget.tsx', 1],
  ['app/dashboard/[eventId]/_components/event-dashboard.tsx', 1],
  ['app/dashboard/[eventId]/schedule/page.tsx', 2],
];

for (const [file, n] of SURFACES) {
  test(`${file}: prints the type through the event-aware rule, never the bare map`, () => {
    const src = read(file);
    const bare = count(src, /SCHEDULE_BLOCK_LABEL\[/g);
    const aware = count(src, /scheduleBlockLabelFor\([^,()]+,\s*eventType\)/g);
    console.log(`${file}: bare=${bare} aware=${aware}`);
    assert.equal(bare, 0);
    assert.equal(aware, n);
  });
}

// The guest widget only knows the type if every mount hands it over.
const MOUNTS = [
  'app/[slug]/_components/site-body.tsx',
  'app/[slug]/_components/public-hideable-widget.tsx',
  'app/[slug]/_components/hideable-widget-render.tsx',
  'app/[slug]/hub/page.tsx',
];
test('every guest-site ScheduleWidget mount passes the event type', () => {
  let total = 0;
  for (const f of MOUNTS) {
    const mounts = read(f).match(/<ScheduleWidget\b[\s\S]*?\/>/g) ?? [];
    const passing = mounts.filter((m) => /eventType=\{event\.event_type\}/.test(m)).length;
    console.log(`${f}: ${passing}/${mounts.length} mounts pass eventType`);
    assert.ok(mounts.length > 0, `${f} no longer mounts ScheduleWidget — update this list`);
    assert.equal(passing, mounts.length, f);
    total += mounts.length;
  }
  assert.equal(total, 4);
});

test('the host schedule threads eventType from the page to both children', () => {
  const src = read('app/dashboard/[eventId]/schedule/page.tsx');
  assert.equal(count(src, /eventType=\{eventRow\?\.event_type \?\? null\}/g), 1);
  assert.equal(count(src, /<AddBlockForm[^>]*eventType=\{eventType\}/g), 1);
  assert.equal(count(src, /<BlockCard[\s\S]*?eventType=\{eventType\}[\s\S]*?\/>/g), 1);
});
