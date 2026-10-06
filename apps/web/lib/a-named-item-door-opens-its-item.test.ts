/**
 * a-named-item-door-opens-its-item.test.ts — 🗓 A DOOR THAT NAMES ONE ITEM OPENS
 * THAT ITEM, NEVER THE GUIDED FLOW'S STAGE LIST (owner, live on desktop
 * 2026-10-06: *"why do i jump here when i tried to tap on the schedule"*).
 *
 * The bug: on an unfinished event the launch page tells Event Details to open
 * on the guided flow ("Which stage do you want ready?") for a plain landing.
 * Details is unmounted while the canvas shows, so a schedule moment tapped on the
 * canvas set the Maker's item to `schedule` and MOUNTED Details fresh — on the
 * stage list the server had chosen. The item was right (`data-details-item=
 * "schedule"`), the screen was the picker. The same shape held for every door
 * that names one item: the couple's mark (→ Logo), Page ▾ › Love Story, the draft
 * bar's Look jump, a `?open=` Look row.
 *
 * The fix is one mechanism, the one Look already had (`lookVisit`): the Maker's
 * `openDetailsItem` sets the item AND counts the visit; Details answers each
 * visit ONCE (`takeItemVisit`) by leaving the flow's screens. `setDetailsItem`
 * stays a REPORT (Details tells the Maker where it is) — never a door.
 *
 * Measured in /dev/maker-lab at 1440 and 375 (the PR body lists them): before,
 * the tapped moment landed on the picker on both; after, on Schedule in All
 * items. Each guard below was broken by hand and seen RED before it was trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · an item visit is answered ONCE — a later mount of Details (the Details door) still opens the flow', async () => {
  const { lookVisitTaker } = await import(`../${L}/maker-bar`);
  const take = lookVisitTaker();
  assert.equal(take(0), false, 'no door named an item, yet Details left the flow');
  assert.equal(take(1), true, 'a tapped schedule moment was not answered — Details stays on the stage list');
  assert.equal(take(1), false, 'a remount of Details (the Event Details door) replayed the old item visit');
  assert.equal(take(2), true, 'the next named door was not answered');
});

test('2 · the Maker’s item door sets the item AND counts the visit; every item-naming door in the shell uses it', () => {
  const shell = read(`${L}/maker-shell.tsx`);
  const door = /const openDetailsItem = useCallback\(\s*\(\s*(\w+)[^)]*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[\s*\]\s*\)/.exec(shell);
  assert.ok(door, 'the Maker has no item door (`openDetailsItem`) — re-read this guard');
  assert.match(door[2]!, new RegExp(`setDetailsItem\\(\\s*${door[1]}\\s*\\)`), 'the item door does not set the item');
  assert.match(door[2]!, /setItemVisit\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\s*\+\s*1\s*\)/, 'the item door does not count its visit — Details cannot tell it from a plain landing');
  assert.match(shell, /const takeItemVisit = useMemo\(\(\) => lookVisitTaker\(\), \[\]\);/, 'the visit is not answered once');
  // A page that moved into Details (Logo · Hero · Reveal — the couple's mark) is a named door.
  assert.match(shell, /if \(moved\.item\) openDetailsItem\(moved\.item\);/, 'a moved page (the couple’s mark → Logo) opens Details on the stage list');
  // No item is named in the shell except through the door (the Look/Details/Prints doors pass `makerPressDoor`, the flow's own doors).
  const literal = shell.match(/\bsetDetailsItem\(\s*'[a-z-]+'\s*\)/g) ?? [];
  assert.deepEqual(literal, [], `a door names an item with the bare report setter: ${literal.join(', ')}`);
  for (const k of ['openDetailsItem', 'itemVisit', 'takeItemVisit']) {
    assert.match(shell, new RegExp(`^\\s+${k},?$`, 'm'), `the Maker does not hand \`${k}\` to its pages`);
  }
});

test('3 · Details answers an item visit by LEAVING the flow’s screens for the item', () => {
  const ws = read(`${L}/details-workspace.tsx`);
  const effect = /useEffect\(\(\) => \{\s*if \(!itemVisit \|\| !takeItemVisit\?\.\(itemVisit\)\) return;([\s\S]*?)\}, \[itemVisit, takeItemVisit\]\);/.exec(ws);
  assert.ok(effect, 'Details does not answer an item visit — a tapped schedule moment lands on "Which stage do you want ready?"');
  assert.match(effect[1]!, /setMode\('all'\);/, 'an item visit stays in the guided flow');
  assert.match(effect[1]!, /setPane\(null\);/, 'an item visit stays on the stage list');
  assert.match(ws, /const itemVisit = maker\?\.itemVisit \?\? 0;/);
  assert.match(ws, /const takeItemVisit = maker\?\.takeItemVisit;/);
});

test('4 · the tapped schedule moment opens Details through the item door', () => {
  const src = read(`${E}/editor-shell.tsx`);
  const at = src.indexOf("data.key === 'w:schedule'");
  assert.ok(at > 0, 'the schedule moment tap is gone — re-read this guard');
  const branch = src.slice(at, src.indexOf('return;', at));
  const ref = /(\w+)\.current\('schedule'\)/.exec(branch);
  assert.ok(ref, 'the schedule moment no longer names its item — re-read this guard');
  assert.match(
    src,
    new RegExp(`${ref[1]}\\.current = maker\\?\\.openDetailsItem \\?\\? maker\\?\\.setDetailsItem;`),
    'the schedule moment names its item with the bare report setter — Details mounts on the stage list',
  );
});

test('5 · outside the Maker shell and Details, nothing opens an item with the bare report setter', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
        walk(p);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        const rel = relative(WEB, p);
        if (rel.endsWith('maker-shell.tsx') || rel.endsWith('details-workspace.tsx') || rel.endsWith('maker-context.tsx')) continue;
        const src = stripComments(readFileSync(p, 'utf8'));
        for (const m of src.matchAll(/[\w?.]*setDetailsItem\b/g)) {
          const before = src.slice(Math.max(0, m.index! - 40), m.index!);
          if (!/openDetailsItem\s*\?\?\s*$/.test(before)) offenders.push(`${rel}: …${src.slice(m.index!, m.index! + 40).split('\n')[0]}`);
        }
      }
    }
  };
  walk(join(WEB, 'app'));
  assert.deepEqual(offenders, [], `a door into Details names its item without counting the visit:\n${offenders.join('\n')}`);
});

/* ══ 6 · THE OPEN ITEM SURVIVES A SAVE, A REFRESH AND A RELOAD ══════════════
   (owner 2026-10-06, second report: Seat plan › Auto arrange landed on the stage
   list.) Details writes its place into the address (`?tool=details&item=…`). It
   used to pass `window.history.state`, which carries Next's `__NA` marker — and
   Next's patched `replaceState` IGNORES any call carrying it ("Avoid a loop when
   Next.js internals trigger pushState/replaceState"). So the router kept the
   landing address: a server action (Auto arrange) re-rendered the page AT THE
   LANDING, the address bar snapped back to it, and the next reload or remount
   opened "Which stage do you want ready?". Measured in /dev/maker-lab with a
   lab-only action standing in for Auto arrange (it revalidates another path,
   as `autoArrange` revalidates /seating): before, the address went
   `?tool=details&item=schedule` → `?guide=1` and a reload showed the picker;
   after, it stayed and the reload landed on Schedule. */

test('6a · Next ignores a history write that carries its own marker — the reason the router never heard Details', () => {
  // The rule as Next 15's app-router patch states it, against the installed copy.
  const nextPkg = require.resolve('next/package.json', { paths: [WEB] });
  const appRouter = readFileSync(join(nextPkg, '..', 'dist/client/components/app-router.js'), 'utf8');
  assert.match(
    appRouter,
    /window\.history\.replaceState = function replaceState\(data, _unused, url\) \{[\s\S]{0,200}?data\.__NA\)[\s\S]{0,120}?return originalReplaceState\(data, _unused, url\);/,
    'Next no longer skips a replaceState carrying __NA — re-measure whether Details still needs `null` (this guard explains the fix; it must not outlive the reason)',
  );
});

test('6b · Details writes its place so Next’s router hears it — never with Next’s own history state', () => {
  const ws = read(`${L}/details-workspace.tsx`);
  const writes = [...ws.matchAll(/window\.history\.replaceState\(([^,]+),/g)].map((m) => m[1]!.trim());
  assert.ok(writes.length > 0, 'Details no longer keeps its place in the address — re-read this guard');
  for (const first of writes) {
    assert.doesNotMatch(first, /history\.state/, 'Details writes the address with Next’s own state — the router keeps the landing, and a save lands on the stage list');
  }
});
