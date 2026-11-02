/**
 * journey-is-gone.test.ts — 🧭 JOURNEY IS REMOVED; EVERY DOOR TO IT LANDS ON PLANNING STAGE.
 *
 * Owner 2026-11-01: *"i don't think we need journey anymore? since everything from event created can be a chapter"*
 * (DECISION_LOG "JOURNEY IS REMOVED"; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §6b). And 2026-10-28: all mapping is kept —
 * so an address that still says `?view=journey` must land somewhere real, never on a view that no longer exists.
 *
 * Properties, not phrasings:
 *   1 · the one forwarder sends `journey` to Planning Stage and passes every other view through;
 *   2 · the Schedule page forwards BEFORE any door carries its view on (Suppliers › Booked, the Maker), so those land
 *       there too;
 *   3 · no view offers Journey any more, and nothing links to it;
 *   4 · its view and its aggregator are gone, not hidden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { forwardScheduleView, SCHEDULE_VIEWS } from '@/lib/schedule-view';

const WEB = join(__dirname, '..');
const S = join(WEB, 'app', 'dashboard', '[eventId]', 'schedule');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('1 · ?view=journey forwards to Planning Stage; every other view passes through', () => {
  assert.equal(forwardScheduleView('journey'), 'preparation');
  assert.equal(forwardScheduleView('preparation'), 'preparation');
  assert.equal(forwardScheduleView('event-day'), 'event-day');
  assert.equal(forwardScheduleView(undefined), undefined);
  assert.equal(forwardScheduleView('toString'), 'toString', 'a prototype key is not a retired view');
  assert.ok(!(SCHEDULE_VIEWS as readonly string[]).includes('journey'));
});

test('2 · the Schedule page forwards the view before any door carries it on', () => {
  const page = read(join(S, 'page.tsx'));
  const fwd = page.search(/const viewParam = forwardScheduleView\(askedView\)/);
  assert.ok(fwd > 0, 'the page no longer forwards ?view= through forwardScheduleView');
  const firstDoor = page.search(/redirect\(/);
  assert.ok(firstDoor > fwd, 'a door redirects with the raw ?view= before it is forwarded');
  assert.equal(page.match(/\baskedView\b/g)?.length, 2, 'the raw ?view= is read somewhere other than the forwarder');
});

test('3 · no view offers Journey, and nothing links to it', () => {
  const toggle = read(join(S, '_components', 'schedule-mode-toggle.tsx'));
  assert.doesNotMatch(toggle, /mode:\s*'journey'/, 'the segmented control still offers Journey');
  const frame = read(join(S, '_components', 'schedule-one-line.tsx'));
  assert.doesNotMatch(frame, /'journey'/, 'Booked › Schedule still knows a Journey view');
  const page = read(join(S, 'page.tsx'));
  assert.doesNotMatch(page, /key:\s*'journey'|JourneyView|buildJourneyTimeline/, 'the page still draws Journey');
  // Every link in the app's own code — a `?view=journey` anywhere but the forwarder's own docs is a door to nowhere.
  let out = '';
  try {
    out = execFileSync('git', ['grep', '-l', 'view=journey', '--', 'app', 'lib', 'components'], { cwd: WEB, encoding: 'utf8' });
  } catch {
    out = ''; // git grep exits 1 when nothing matches
  }
  const linking = out
    .split('\n')
    .filter(Boolean)
    .filter((f) => !/\.test\.ts$/.test(f) && f !== 'lib/schedule-view.ts')
    .filter((f) => /view=journey/.test(read(join(WEB, f)))); // in code, not in a comment
  assert.deepEqual(linking, [], `still linking to Journey: ${linking.join(', ')}`);
});

test('4 · the Journey view and its aggregator are deleted, not hidden', () => {
  assert.equal(existsSync(join(S, '_components', 'journey-view.tsx')), false, 'journey-view.tsx is back');
  assert.equal(existsSync(join(WEB, 'lib', 'journey.ts')), false, 'lib/journey.ts is back');
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  assert.doesNotMatch(css, /\.journey-(rise|rail-fill|today|node-pop)\b/, 'the Journey view’s CSS is back');
});
