/**
 * ⚡ THE ONLINE/OFFLINE SWITCH FLIPS THE MOMENT IT IS PRESSED — and flips back when the server refuses.
 *
 * Owner, 15 Nov 2026, verbatim: *"pressing online offline takes too long to update"*. The switch under every service
 * card and bundle card drew only the server's `isActive`, so it moved only after the whole save — the gates, the
 * update, the revalidates and the page's re-render. Now:
 *
 *   1. it draws `shown` (where it is going while the save is on its way, else the server's state) and says so in one
 *      line under the row ("Going online…") — a press shows pressed and what is loading;
 *   2. a refusal (missing items going online, an open booking going offline) or a failed send flips it STRAIGHT BACK,
 *      and the refusal still prints under the row — it never keeps a state the server did not save;
 *   3. a bundle card does the same with its own `live`.
 *
 * Every server gate is unchanged: the service switch still saves through `svServices.toggleVendorServiceActive`, the
 * bundle through `bundleCardRow`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROW = code('app/vendor-dashboard/services/_components/service-card-menu-row.tsx');
const STAY = code('app/_components/stay-form.tsx');
const BUNDLE = code('app/vendor-dashboard/shop/_components/shop-bundle-card.tsx');

test('1 · the switch draws where it is going, not only the server’s isActive', () => {
  assert.match(ROW, /const \[pendingTo, setPendingTo\] = useState<boolean \| null>\(null\);/);
  assert.match(ROW, /const shown = pendingTo \?\? isActive;/, 'the switch has no optimistic state');
  const sw = ROW.slice(ROW.indexOf('role="switch"'), ROW.indexOf('</button>', ROW.indexOf('role="switch"')));
  assert.match(sw, /aria-checked=\{shown\}/, 'the switch’s checked state reads the server alone');
  assert.match(sw, /<SwitchTrack on=\{shown\}/, 'the drawn track reads the server alone');
  assert.doesNotMatch(sw, /on=\{isActive\}|aria-checked=\{isActive\}/, 'part of the switch still waits for the server');
  assert.match(sw, /onClick=\{\s*action && pendingTo === null\s*\? \(\) => \{\s*setLanded\(false\);\s*setPendingTo\(!isActive\);\s*\}\s*: undefined\s*\}/, 'the press does not flip it at once');
  // A press shows what is loading: one line under the row while it saves.
  assert.match(ROW, /\{!held && saving \? \(\s*<p role="status"[^>]*data-card-online-saving-line=""[^>]*>\s*\{shown \? 'Going online…' : 'Going offline…'\}/);
});

test('2 · a refusal flips it back; a landed save keeps the new state until the page’s isActive catches up', () => {
  const form = ROW.slice(ROW.indexOf('<StayForm'), ROW.indexOf('</StayForm>'));
  assert.match(form, /door="svServices\.toggleVendorServiceActive"/, 'the switch left the shipped door (and its gates)');
  assert.match(form, /onRefused=\{\(\) => \{ setPendingTo\(null\); setLanded\(false\); \}\}/, 'a refused save keeps the flipped switch');
  // A landed save only stops the saving line. It must NOT hand `shown` back to `isActive`: the state update after the
  // save's await is outside the transition, so it could commit before the new props and flash the OLD state.
  const onSaved = form.match(/onSaved=\{\(\) => [^}]*\}/)?.[0] ?? '';
  assert.match(onSaved, /^onSaved=\{\(\) => setLanded\(true\)\}$/, 'a landed save does more than mark it landed');
  assert.doesNotMatch(onSaved, /setPendingTo/, 'a landed save resets the switch to the (stale) isActive — it flashes the old state');
  assert.match(ROW, /const saving = \(pendingTo !== null && !landed\) \|\| toggling;/, 'the saving line outlives the save');
  // Only the page's own isActive arriving ends the pending state.
  assert.match(ROW, /if \(pendingTo !== null && isActive === pendingTo\) \{\s*setPendingTo\(null\);\s*setLanded\(false\);\s*\}/);
  // StayForm calls onRefused on every refusal, including a send that failed.
  assert.match(STAY, /if \(!r\.ok\) \{\s*setError\(r\.error\);\s*onRefused\?\.\(\);/, 'StayForm does not report a refusal');
  assert.match(STAY, /await save\(door, fd\)\.catch\(\(\) => \(\{ ok: false as const, error: COULD_NOT_SAVE \}\)\)/, 'a failed send is not a refusal');
});

test('3 · the bundle card flips its own switch at once and back on a refusal', () => {
  const fn = BUNDLE.slice(BUNDLE.indexOf('function toggle()'), BUNDLE.indexOf('function onSwipeDelete'));
  const flip = fn.indexOf('setLive(next);');
  const call = fn.indexOf('bundleCardRow(');
  assert.ok(flip > 0 && call > flip, 'the bundle switch waits for the call before it moves');
  assert.match(fn, /if \(why\) \{\s*setRefusal\(why\);\s*setLive\(!next\);\s*\}/, 'a refused bundle keeps the flipped switch');
  assert.match(fn, /\.catch\(\(\) => null\)/, 'a failed call leaves the switch flipped');
  assert.match(fn, /if \(pending\) return;/, 'a second press races the first');
  assert.match(BUNDLE, /toggling=\{pending\}/, 'the row is not told the bundle is saving');
});
