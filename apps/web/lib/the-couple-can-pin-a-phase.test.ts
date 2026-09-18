/**
 * THE COUPLE CAN PIN THEIR SITE TO ONE PHASE (DAY-33 · PH-6).
 *
 * Owner 2026-07-02: *"a manual toggle to set it automatic or manual launch,
 * whichever website they want. activating one will deactivate the other …
 * save the date, rsvp, event and editorial."*
 *
 * `events.launch_mode` / `events.manual_phase` were added for this by migration
 * 20270426100000 and then sat for eleven weeks with NO reader and NO writer —
 * the PR that built the control (#2562) was closed unmerged, and only its
 * migration landed. The failure that hid it is the one this file exists to
 * stop: a pin that is written and never read looks exactly like a pin that is
 * off. So the guard is on the READ path as much as the write:
 *
 *   1. the resolver's answers, executed;
 *   2. the arrival door, executed — a pin moves the door with the page;
 *   3. every site that picks the site's face composes the pin, and every loader
 *      feeding one SELECTS the two columns (drop either and the pin silently
 *      reads null on every render — the defect class in `_lib/types.ts`'s
 *      "a cast over a column the select never named");
 *   4. the editor has the one control, and the write asks for its row back.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { manualLaunchPhase } from '@/lib/invitation-widgets';
import { arrivalDestinationFor } from '@/lib/invite-destination';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the resolver pins only a manual mode with a real phase', () => {
  assert.equal(manualLaunchPhase('manual', 'rsvp'), 'rsvp');
  assert.equal(manualLaunchPhase('manual', 'save_the_date'), 'save_the_date');
  assert.equal(manualLaunchPhase('manual', 'event'), 'event');
  assert.equal(manualLaunchPhase('manual', 'editorial'), 'editorial');
  // Automatic ignores a leftover pin — the clock decides.
  assert.equal(manualLaunchPhase('auto', 'rsvp'), null);
  assert.equal(manualLaunchPhase('manual', null), null);
  assert.equal(manualLaunchPhase('manual', 'live'), null);
  assert.equal(manualLaunchPhase(undefined, undefined), null);
});

test('a pin moves the arrival door with the page', () => {
  const NOW = Date.parse('2026-09-18T04:00:00Z');
  const farOut = '2027-06-12'; // ~9 months out → the clock says save-the-date
  const base = {
    profile: WEDDING_PROFILE,
    eventDate: farOut,
    eventEndDate: null,
    venueTz: 'Asia/Manila',
    nowMs: NOW,
  };
  // Precondition: without a pin this date really is the save-the-date face,
  // or the next assertion would pass for the wrong reason.
  assert.equal(arrivalDestinationFor(base), 'save_the_date');
  assert.equal(
    arrivalDestinationFor({ ...base, launchMode: 'manual', manualPhase: 'rsvp' }),
    'invitation',
    'the couple pinned the invitation and the door still describes the save-the-date',
  );
  assert.equal(
    arrivalDestinationFor({ ...base, launchMode: 'auto', manualPhase: 'rsvp' }),
    'save_the_date',
    'Automatic must ignore a leftover pin',
  );
});

test('every site that picks the face composes the pin', () => {
  const page = src('app/[slug]/page.tsx');
  assert.match(page, /manualLaunchPhase\(event\.launch_mode, event\.manual_phase\)/);
  // The pin must reach BOTH phases the page derives, the same way the host
  // preview does — or the body pins while the day-of layer follows the clock.
  assert.match(page, /forcedPhase: LifecyclePhase \| null = phaseOverride \?\? pinnedPhase/);
  assert.match(page, /const dayOfPhase: DayOfPhase = forcedPhase/);
  // …and the body's phase takes the pin INSIDE the solemn wrap, so a pinned
  // wake still cannot open on the save-the-date film (the-wake-never-celebrates).
  assert.match(page, /solemnAdjustedPhase\(\s*phaseOverride \?\?\s*pinnedPhase \?\?\s*getLifecyclePhase\(/);

  const editor = src('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(editor, /manualLaunchPhase\(/);
  assert.match(editor, /initialPhase = pinnedPhase \?\? clockPhase/);

  const door = src('lib/invite-destination.ts');
  assert.match(door, /manualLaunchPhase\(input\.launchMode, input\.manualPhase\)/);
});

test('every loader feeding a face selects the two columns', () => {
  const selects: Array<[string, RegExp]> = [
    ['app/[slug]/_lib/loaders.ts', /loadEventShell[\s\S]*?\.select\(\s*'([^']*)'/],
    ['app/[slug]/invite/enter/page.tsx', /\.from\('events'\)\s*\.select\(\s*`([^`]*)`/],
    ['app/dashboard/[eventId]/website/editor/page.tsx', /\.from\('events'\)\s*\.select\(\s*`([^`]*)`/],
  ];
  for (const [rel, re] of selects) {
    const m = src(rel).match(re);
    assert.ok(m, `${rel}: could not find the events select — update this guard, do not delete it`);
    const cols = (m[1] ?? '').split(',').map((c) => c.trim());
    for (const col of ['launch_mode', 'manual_phase']) {
      assert.ok(cols.includes(col), `${rel} no longer selects ${col}; the pin would read null forever`);
    }
  }
});

test('the editor has the control, and the write checks it landed', () => {
  const editor = src('app/dashboard/[eventId]/website/editor/page.tsx');
  const mounts = editor.match(/<LaunchPhasePanel\b/g) ?? [];
  assert.equal(mounts.length, 1, `expected one LaunchPhasePanel mount, found ${mounts.length}`);
  assert.match(editor, /key: 'launch-phase'/);

  const actions = src('app/dashboard/[eventId]/website/editor/actions.ts');
  const i = actions.indexOf('export async function setLaunchPhase');
  assert.ok(i >= 0, 'setLaunchPhase is gone');
  const end = actions.indexOf('\n}\n', i);
  const body = actions.slice(i, end);
  assert.match(body, /launch_mode: 'manual', manual_phase: pinned/);
  assert.match(body, /launch_mode: 'auto', manual_phase: null/);
  assert.match(body, /\.select\('slug'\)/, 'a refused update returns zero rows and no error — ask for the row');
  assert.match(body, /rows\.length > 0/);
});
