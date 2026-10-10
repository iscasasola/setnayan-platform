/**
 * the-day-hub-follows-the-stage.test.ts — `/[slug]/hub` NEVER NAMES A STAGE THE EVENT'S OWN PAGE IS NOT AT.
 *
 * Measured on the live sample event, 61 days before its day (2026-10-11):
 * `/maria-and-jose/hub` said "THE DAY" over a lit "Live" tab, while
 * `/maria-and-jose` — one address up — said "INVITATION". The hub decided from
 * the calendar window alone and hard-coded its own stage word.
 *
 * 🔑 THE PROPERTY: there is ONE answer to "what stage is this event at" — the
 * one `app/[slug]/page.tsx` composes (a host's `?phase=` preview, the couple's
 * pin, the venue's clock) — and the hub page asks it the same way; while that
 * stage is before the day the hub draws NOTHING of its own and sends the
 * visitor to the page that speaks for the stage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { getLifecyclePhase, type LifecyclePhase } from '@/lib/invitation-widgets';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import { dayHubOpens } from './day-hub';
import { STAGE_BAR } from './stage-bar';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));
const HUB = read('hub/page.tsx');
const PAGE = read('page.tsx');

test('the day’s hub opens on The Day and after it — never while the stage is still before the day', () => {
  const opens = PUBLIC_STAGE_ORDER.map((stage) => `${PUBLIC_STAGE_LABELS[stage]}:${dayHubOpens(stage)}`);
  assert.deepEqual(opens, ['Save the Date:false', 'Invitation:false', 'The Day:true', 'Post Event:true']);
  // Every stage a "Live" tab would be untrue on is a stage the hub does not draw.
  for (const stage of PUBLIC_STAGE_ORDER) {
    const barHasLive = STAGE_BAR[stage].slots.includes('live');
    if (barHasLive) assert.ok(dayHubOpens(stage), `${stage}: the page's own bar has a Live tab and the hub is shut`);
    if (!dayHubOpens(stage)) assert.ok(!barHasLive, `${stage}: the hub is shut on a stage whose own bar carries Live`);
  }
});

test('by the clock: the measured case (61 days out) is a stage the hub does not draw, and the day itself is one it does', () => {
  const day = '2026-12-12';
  const tz = 'Asia/Manila';
  const at = (iso: string) => getLifecyclePhase(day, tz, null, Date.parse(iso));
  const cases: Array<[string, string, boolean]> = [
    ['2026-07-01T04:00:00+08:00', 'months out', false],
    ['2026-10-11T02:30:00+08:00', '61 days out — the walk', false],
    ['2026-12-10T12:00:00+08:00', 'two days before', false],
    ['2026-12-12T15:00:00+08:00', 'the ceremony', true],
    ['2026-12-20T12:00:00+08:00', 'the week after', true],
  ];
  for (const [iso, what, open] of cases) {
    assert.equal(dayHubOpens(at(iso)), open, `${what} (${iso}) → stage ${at(iso)}`);
  }
  assert.equal(PUBLIC_STAGE_LABELS[at('2026-10-11T02:30:00+08:00')], 'Invitation', 'the event’s own page said INVITATION that night');
});

test('the hub page asks the stage exactly as the event’s page does — preview, then the pin, then the venue’s clock', () => {
  // The pin and the clock, composed literally (the rule `manualLaunchPhase`'s docblock sets for every site).
  const compose = /solemnAdjustedPhase\(\s*phaseOverride \?\?\s*pinnedPhase \?\?\s*getLifecyclePhase\(/;
  assert.match(PAGE, compose, 'the event page no longer composes the stage this way — re-read both before touching this guard');
  assert.match(HUB, compose, 'the hub page resolves the stage some other way than the event’s own page');
  assert.match(HUB, /pinnedPhase: LifecyclePhase \| null = manualLaunchPhase\(event\.launch_mode, event\.manual_phase\)/);
  assert.match(HUB, /getLifecyclePhase\(event\.event_date, venueTz, event\.event_end_date \?\? null\)/, 'the venue’s clock or the last day is no longer handed in');
  // …with the columns the pin and a several-day event are read from.
  const select = /\.from\('events'\)\s*\.select\(\s*(?:\/\/[^\n]*\n\s*)*`([^`]*)`/.exec(readFileSync(join(HERE, '..', 'hub/page.tsx'), 'utf8'));
  assert.ok(select, 'could not find the hub’s events select — update this guard, do not delete it');
  for (const col of ['launch_mode', 'manual_phase', 'event_end_date', 'event_date']) {
    assert.ok(select![1]!.split(',').map((c) => c.trim()).includes(col), `the hub no longer selects ${col}; the stage would be read from nothing`);
  }
  // The day-of phase follows a forced stage the same way on both pages.
  const forced = /const dayOfPhase: DayOfPhase = forcedPhase\s*\? forcedPhase === 'event'\s*\? 'live'\s*: forcedPhase === 'editorial'\s*\? 'post'\s*: 'pre'/;
  assert.match(PAGE, forced);
  assert.match(HUB, forced);
});

test('before the day the hub draws nothing: it leaves for the event’s page before a single panel is built', () => {
  const leave = HUB.search(/if \(!dayHubOpens\(lifecyclePhase\)\) \{\s*redirect\(/);
  assert.ok(leave > 0, 'the hub no longer leaves while the stage is before the day');
  for (const later of ['const dayOfPhase: DayOfPhase', 'const phaseLabel', 'const header = (', '<HubShell']) {
    const at = HUB.indexOf(later);
    assert.ok(at > leave, `${later} is built before the hub decides whether it is open`);
  }
  // No stage word of the hub's own: outside the day's window the header reads the one table.
  assert.match(HUB, /STAGE_BAR\[lifecyclePhase\]\.label/);
  assert.doesNotMatch(HUB, /:\s*'The day';/, 'the hub hard-codes a stage word again');
});
