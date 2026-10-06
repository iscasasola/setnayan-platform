/**
 * 🙋 PLAN IT MYSELF IS ONE SWITCH, ON THE ONE STORE (owner 2026-10-02, tracker
 * d4: "one free 'Plan it myself' switch in Your info for every host — turns
 * the automatic help off; not only for Setnayan AI buyers").
 *
 * Pins, each where it would silently break:
 *   1. it is an item of Your info › Your event, for every event type (no
 *      purchase, no type gate);
 *   2. its switch posts `setPlanningMode` — the SAME action the Setnayan AI
 *      page posts — with the mode OPPOSITE to what is on now;
 *   3. "on" means `planning_mode === 'manual'`, the value `isSetnayanAiActive`
 *      reads as "the automatic help is off";
 *   4. the launch page reads `planning_mode` and hands it in;
 *   5. the suppliers page no longer ignores it (it was neutralized while no
 *      control existed to flip it back).
 *
 * SABOTAGE (run 2026-10-02): changing the hidden mode to `value="manual"`
 * unconditionally turns test 2 red ("the switch cannot turn the help back on").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DETAILS_ITEM_GROUPS, detailsItemApplies } from '@/lib/maker-details-items';
import { isSetnayanAiActive, PLANNING_MODE_MANUAL } from '@/lib/setnayan-ai';
import { stripComments } from '@/lib/strip-comments';
import { planMyselfOn, planMyselfSub } from '@/lib/plan-myself';

const HERE = import.meta.dirname;
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

test('1 · it LEFT the Maker for the event’s Settings (owner 2026-10-06) — the same switch, on the Event Details page', () => {
  /* 🗂 "EVENT DETAILS IS REBUILT": Plan it myself → the event's Settings on the
     dashboard. Still an item (an old address opens it), never a list row. */
  const event = DETAILS_ITEM_GROUPS.find((g) => g.group === 'event')!;
  assert.ok(!(event.keys as readonly string[]).includes('plan-myself'), 'Plan it myself is back in the Your event form');
  const elsewhere = DETAILS_ITEM_GROUPS.find((g) => g.group === 'elsewhere')!;
  assert.ok(elsewhere.hidden && elsewhere.keys.includes('plan-myself'));
  const page = read('../../details/page.tsx');
  assert.match(page, /<PlanMyselfSwitch eventId=\{eventId\} on=\{planMyselfOn\(typeof e\.planning_mode === 'string' \? e\.planning_mode : null\)\} \/>/, 'the event’s Settings do not draw the switch');
  assert.match(page, /'setnayan_ai_active, planning_mode,/, 'the page does not read planning_mode — the switch would be drawn from a guess');
  // No type gate: an empty applies-rule means every celebration gets it.
  const ctx = { profile: { enabledSurfaces: [], terminology: {}, roleSetKey: 'x' } } as never;
  assert.equal(detailsItemApplies('plan-myself', ctx), true);
});

test('2 · the switch posts setPlanningMode, flipping to the OTHER mode', () => {
  const src = read('plan-myself.tsx');
  assert.match(src, /import \{ setPlanningMode \} from '@\/app\/dashboard\/\[eventId\]\/actions'/, 'a second writer');
  assert.match(src, /<form action=\{setPlanningMode\}/);
  assert.match(src, /name="event_id" value=\{eventId\}/);
  assert.match(
    src,
    /name="mode" value=\{on \? 'guided' : 'manual'\}/,
    'the switch cannot turn the help back on (or off)',
  );
  assert.match(src, /role="switch"/);
  assert.match(src, /aria-checked=\{on\}/);
  // A failed read offers no switch (it would flip the wrong way).
  assert.match(src, /if \(on === null\)/);
});

test('3 · on = manual = the automatic help is off', () => {
  assert.equal(planMyselfOn(PLANNING_MODE_MANUAL), true);
  assert.equal(planMyselfOn('guided'), false);
  assert.equal(planMyselfOn(null), false);
  assert.equal(isSetnayanAiActive({ planning_mode: PLANNING_MODE_MANUAL }, false), false);
  assert.equal(isSetnayanAiActive({ planning_mode: 'guided' }, false), true);
  assert.equal(planMyselfSub(true), 'On · no automatic help');
  assert.equal(planMyselfSub(null), 'Could not load');
});

test('4 · the launch page reads planning_mode and hands it to Your info', () => {
  const page = read('../page.tsx');
  assert.match(page, /\.select\('[^']*\bplanning_mode\b[^']*'\)/, 'planning_mode is not read');
  assert.match(page, /planMyself=\{\{ on: eventRes\.error \? null : planMyselfOn\(eventRow\?\.planning_mode\) \}\}/);
  const details = read('maker-details.tsx');
  assert.match(details, /editors\['plan-myself'\] = <PlanMyselfSwitch eventId=\{eventId\} on=\{props\.planMyself\.on\} \/>/);
  assert.match(details, /\.\.\.\(props\.planMyself \? \(\['plan-myself'\] as const\) : \[\]\)/);
});

test('5 · the suppliers page honours the switch (no longer neutralizes planning_mode)', () => {
  const vendors = read('../../vendors/page.tsx');
  assert.ok(!/planning_mode:\s*null/.test(vendors), 'the suppliers page ignores Plan it myself again');
});
