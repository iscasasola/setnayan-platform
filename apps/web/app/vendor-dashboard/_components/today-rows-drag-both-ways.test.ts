/**
 * 🔒 TODAY ROWS DRAG BOTH WAYS (Today v3 part 2 — owner 19 Nov 2026: *"so it is drag left to do tomorrow / drag right
 * open it / tap to open a quick way to resond"* · *"yes. except urgent"* · *"you cannot delete a task until its
 * complete"*; drawing `Today, tap opens a card` v3.5, V3 · 2 · 2b; DECISION_LOG 2026-11-19 "TODAY v3 RULED AS A WHOLE").
 *
 *   1 · THE SHIPPED GESTURE, NOT A SECOND ONE: the row's drag is `swipeBegin` · `swipeMove` · `SWIPE_REVEAL_PX` from
 *       `swipe-to-delete.tsx`, and it snaps back on the shipped Release (`--sn-m-swipe-snap` on Settle);
 *   2 · RIGHT OPENS, LEFT IS TOMORROW, RED IS REFUSED — out loud: the three outcomes go to the page, to the put-off
 *       action and to the "Urgent · can't go to tomorrow" toast; only a CLOSED row drags;
 *   3 · THE RECORD IS THE CALLER'S, AND ONE ROUTE: one exported server action, the caller's own session (RLS), a failed
 *       write is SAID and keeps the row;
 *   4 · AN UNREAD RECORD NEVER HIDES WORK: the read fails to `null`, and `null` holds nothing off;
 *   5 · WHAT WAS PUT OFF IS SHOWN, not dropped: "Tomorrow N", each row "Back on Today tomorrow".
 * 🛡 SABOTAGE (each seen RED, then restored — 2026-11-19): the drag enabled on an open card (red: 2) · the admin client
 *   used in the action (red: 3) · `?? []` for `?? null` on the read's failure (red: 4) · the Tomorrow block removed (red: 5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const ROW = read('today-v2-client.tsx');
const DRAG = read('../../_components/two-way-drag.tsx');
const V2 = read('today-v2.tsx');
const ACTION = read('../../_actions/today-put-off-actions.ts');
const READS = read('../../../lib/supplier-today-v2.server.ts');
const ASSEMBLE = read('today-v2-assemble.tsx');

test('1 · the shipped gesture, in both directions', () => {
  assert.match(DRAG, /import \{ SWIPE_REVEAL_PX, swipeBegin, swipeMove, type SwipeDrag \} from '@\/app\/_components\/swipe-to-delete';/, 'the drag grew a second gesture instead of the shipped one');
  assert.match(ROW, /import \{ TwoWayPanes, useTodayDrag \} from '@\/app\/_components\/two-way-drag';/, 'Today’s row grew its own drag');
  assert.match(ROW, /transition: dragging \? 'none' : 'transform var\(--sn-m-swipe-snap\) var\(--sn-m-settle\)'/, 'the snap-back is not the shipped Release');
  assert.match(DRAG, /setTx\(dragOffset\(t\.clientX - next\.x, red, SWIPE_REVEAL_PX\)\)/);
});

test('2 · right opens, left is tomorrow, red is refused out loud — and only a closed row drags', () => {
  assert.match(DRAG, /if \(outcome === 'open'\) onOpen\(\);\s*else if \(outcome === 'tomorrow'\) onTomorrow\(\);\s*else if \(outcome === 'refused'\) onRefuse\(\);/);
  assert.match(ROW, /onOpen: \(\) => \(href \? router\.push\(href\) : undefined\)/, 'a drag right does not open the task’s page');
  assert.match(ROW, /onTomorrow: \(\) => g\?\.putOff\(rowKey\)/);
  assert.match(ROW, /refuse: \(\) => say\(PUT_OFF_WORDS\.refused, 'note'\)/, 'a refused drag is silent');
  assert.match(ROW, /enabled: Boolean\(g && href && !open\)/, 'an open card drags — it holds a reply box');
});

test('3 · one route, the caller’s own session, a failure is said', () => {
  assert.equal((ACTION.match(/^export async function /gm) ?? []).length, 1, 'more than one exported action — the route budget');
  assert.match(ACTION, /const supabase = await createClient\(\);/);
  assert.doesNotMatch(ACTION, /createAdminClient|service_role/, 'the put-off is written past RLS');
  assert.match(ACTION, /return \{ ok: false, message: PUT_OFF_WORDS\.failed \};/);
  assert.match(ROW, /if \(!r\.ok\) \{\s*moving\.current = null;\s*return say\(r\.message, 'bad'\);/, 'a failed put-off is not said');
});

test('4 · an unread record never hides work', () => {
  assert.match(READS, /readPutOffs\(supabase, vendorProfileId, todayIso\)\.catch\(\(\) => null\)/);
  assert.match(READS, /if \(r\.error\) \{[\s\S]{0,160}return null;/, 'a refused read became an empty list');
  assert.match(ASSEMBLE, /putOff: activePutOffs\(r\?\.putOffs \?\? null, i\.todayIso\)/);
});

test('5 · what was put off is shown, under Tomorrow', () => {
  assert.match(V2, /split\.tomorrow\.length \+ tomorrowMore\.length > 0 \? \(\s*<div data-today-tomorrow="">/);
  assert.match(ASSEMBLE, /tomorrowMore=\{later\}/, 'a held-off bill, permit or event is dropped, not listed under Tomorrow');
  assert.match(V2, /line=\{PUT_OFF_WORDS\.back\}/);
});
