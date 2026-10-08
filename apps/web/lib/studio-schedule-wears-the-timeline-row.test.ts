/**
 * studio-schedule-wears-the-timeline-row.test.ts — STUDIO › SCHEDULE IS START · END · NAME.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 13): *"i though of a good way to create the schedule maker. tap the time start and time end and name of that
 * schedule"* · *"how about a ticker instead so it does not eat too much space"*.
 *
 *   (1) THE ROW — start pill – end pill · name · ⋯, on the app's ONE `TimelineRow`, rolled on its ONE ticker (no
 *       native time picker, no column of its own); rows are in start order whatever order they arrive in.
 *   (2) ONE WRITE PER PICK — what a closed ticker owes: a moved start takes the end with it (length kept); an end
 *       at or before the start is the NEXT DATE; a moment with no end keeps none unless one is chosen; nothing
 *       moved = nothing sent. Sent through the rail's own `updateScheduleBlock` + `onPatch`, once, on close.
 *   (3) AN OVERLAP IS SAID, NEVER BLOCKED — one amber line under the later row; every control still works.
 *   (4) ADD A MOMENT — starts where the last one ended on that day, one hour long, its name open; an unnamed new
 *       row is dropped and nothing is sent; a named one is ONE quiet write under an id the screen made, with no
 *       render of the Maker and no `router.refresh()`; a refused add leaves the timeline and says so. With no
 *       date, or for a coordinator who may stage, the shipped sheet still adds.
 *   (5) THE ACTION — `createScheduleBlock` takes an id only from a quiet Maker write and only a uuid, and
 *       revalidates nothing for that write; from anywhere else it behaves as it always did. No new action.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import type { DayMoment } from '../app/dashboard/[eventId]/schedule/_components/day-types';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SCHED = 'app/dashboard/[eventId]/schedule';
const DAY = '2026-12-12';

const moment = (id: string, label: string, start: string, end: string | null, extra: Partial<DayMoment> = {}): DayMoment => ({
  block_id: id,
  label,
  block_type: 'custom',
  start_at: `${DAY}T${start}:00.000Z`,
  end_at: end ? (end.includes('T') ? end : `${DAY}T${end}:00.000Z`) : null,
  location: null,
  notes: null,
  is_public: true,
  parent_block_id: null,
  run_state: 'upcoming',
  staged: false,
  responsible_party: null,
  responsible_vendor_ids: [],
  audience: null,
  ...extra,
});

async function paintDay(moments: DayMoment[], props: Record<string, unknown> = {}): Promise<{ html: string; writes: string[] }> {
  const { StudioDay } = await import(`../${SCHED}/_components/studio-day`);
  const { DayActionsContext } = await import(`../${SCHED}/_components/day-ui`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const writes: string[] = [];
  const actions = new Proxy({}, { get: (_t, k) => async () => void writes.push(String(k)) });
  const html = renderToStaticMarkup(
    React.createElement(
      DayActionsContext.Provider,
      { value: actions as never },
      React.createElement(StudioDay, { eventId: 'ev-1', dateKey: DAY, moments, canEdit: true, onPatch: () => {}, onAdd: () => {}, onMore: () => {}, notice: null, ...props }),
    ),
  );
  return { html, writes };
}
const rowsOf = (html: string) => html.split(/(?=<li[^>]*data-studio-moment=")/).slice(1);

test('(1) the row is start pill – end pill · name · ⋯ on the ONE timeline row, in start order, with no picker of its own', async () => {
  const { html, writes } = await paintDay([
    moment('c', 'Dinner', '19:00', '22:00'),
    moment('a', 'Ceremony', '15:00', '16:00'),
    moment('b', 'Cocktails', '17:30', '18:30'),
  ]);
  const rows = rowsOf(html);
  assert.deepEqual(rows.map((r) => /data-studio-moment="([^"]+)"/.exec(r)![1]), ['a', 'b', 'c'], 'the rows are not in start order');
  const a = rows[0]!;
  assert.match(a, /^<li[^>]*data-timeline-row="moment"/, 'a moment is not the app’s Timeline row');
  // In order: START pill, the dash, END pill, the name, ⋯.
  const at = (re: RegExp) => a.search(re);
  const order = [/data-ticker-pill="start"/, />–</, /data-ticker-pill="end"/, /data-timeline-name=""/, /data-studio-moment-more="a"/].map(at);
  assert.ok(order.every((n) => n > -1), `a part of the row is missing: ${order}`);
  assert.deepEqual([...order].sort((x, y) => x - y), order, 'the row is not start · end · name · ⋯');
  assert.match(a, /<button[^>]*aria-label="Starts 3:00 PM"[^>]*data-ticker-pill="start"[^>]*>3:00 PM</);
  assert.match(a, /<button[^>]*aria-label="Ends 4:00 PM"[^>]*data-ticker-pill="end"[^>]*>4:00 PM</);
  assert.match(a, /<button[^>]*data-timeline-name=""[^>]*>Ceremony</);
  // A ticker is closed until it is tapped: drawing the day draws no columns, and writes nothing.
  assert.doesNotMatch(html, /data-ticker-column/);
  assert.deepEqual(writes, []);
  // A moment with NO end time does not pretend to have one.
  const open = (await paintDay([moment('x', 'After-party', '22:00', null)])).html;
  assert.match(open, /<button[^>]*aria-label="Set when it ends"[^>]*data-ticker-pill="end"[^>]*>End</);
  assert.doesNotMatch(open, /10:30 PM/, 'a moment with no end shows the rail’s 30-minute stand-in as its end');
  // View only: the times and the name are words — nothing opens, no ⋯.
  const view = (await paintDay([moment('a', 'Ceremony', '15:00', '16:00')], { canEdit: false })).html;
  assert.equal((view.match(/data-ticker-pill="(start|end)"/g) ?? []).length, 2);
  assert.equal((view.match(/<button[^>]*disabled=""[^>]*data-ticker-pill/g) ?? []).length, 2, 'a viewer can open a time');
  assert.doesNotMatch(view, /data-studio-moment-more|data-studio-add-moment|<button[^>]*data-timeline-name/);
  // THE WATCH: this page rolls on the ONE ticker — no native picker, no snapping column of its own.
  const src = read(`${SCHED}/_components/studio-day.tsx`);
  assert.doesNotMatch(src, /type=["'](?:time|date|month|datetime-local)["']/, 'the timeline uses a native picker');
  assert.doesNotMatch(src, /snap-y|scroll-snap|overflow-y-scroll/, 'the timeline rolls a column of its own');
  assert.match(src, /from '@\/app\/_components\/ticker'/);
  assert.match(src, /from '@\/app\/_components\/timeline-row'/);
  // On a phone the ticker rises in the Maker's one sheet — handed in, not rebuilt here.
  assert.match(src, /const sheet = useContext\(PickSheetContext\);/);
  assert.equal((src.match(/sheet=\{sheet\}/g) ?? []).length, 2);
});

test('(2) one write per pick: the start carries the end, an early end is the next date, no end stays none, nothing moved sends nothing', async () => {
  const { rolledTimesWrite } = await import(`../${SCHED}/_components/studio-day`);
  const stored = { startMin: 15 * 60, endMin: 16 * 60, hasEnd: true };
  // Opened and closed, or rolled back to where it was: NOTHING is owed.
  assert.equal(rolledTimesWrite({ dateKey: DAY, stored, rolled: null }), null);
  assert.equal(rolledTimesWrite({ dateKey: DAY, stored, rolled: { span: { startMin: 900, endMin: 960 }, end: false } }), null);
  assert.equal(rolledTimesWrite({ dateKey: DAY, stored, rolled: { span: { startMin: 900, endMin: 960 }, end: true } }), null);
  // The start moved to 5 PM: start AND end go, one hour apart, in one write.
  const moved = rolledTimesWrite({ dateKey: DAY, stored, rolled: { span: { startMin: 17 * 60, endMin: 18 * 60 }, end: false } })!;
  assert.deepEqual(moved.values, { start_at: `${DAY}T17:00`, end_at: `${DAY}T18:00` });
  assert.deepEqual(moved.patch, { start_at: `${DAY}T17:00:00.000Z`, end_at: `${DAY}T18:00:00.000Z` });
  // Only the end moved: only the end is sent.
  const longer = rolledTimesWrite({ dateKey: DAY, stored, rolled: { span: { startMin: 900, endMin: 990 }, end: true } })!;
  assert.deepEqual(longer.values, { end_at: `${DAY}T16:30` });
  // An end past midnight (1 AM after a 10 PM start) is written on the NEXT date — never before its start.
  const { pickEnd } = await import('./timeline');
  const party = { startMin: 22 * 60, endMin: 23 * 60, hasEnd: true };
  const late = rolledTimesWrite({ dateKey: DAY, stored: party, rolled: { span: pickEnd(party, 60), end: true } })!;
  assert.deepEqual(late.values, { end_at: '2026-12-13T01:00' });
  assert.ok(new Date(late.patch.end_at!).getTime() > new Date(`${DAY}T22:00:00.000Z`).getTime());
  // NO end time: moving the start sends the start alone (no end is invented)…
  const open = { startMin: 22 * 60, endMin: 22 * 60 + 30, hasEnd: false };
  const openMoved = rolledTimesWrite({ dateKey: DAY, stored: open, rolled: { span: { startMin: 21 * 60, endMin: 21 * 60 + 30 }, end: false } })!;
  assert.deepEqual(openMoved.values, { start_at: `${DAY}T21:00` });
  assert.ok(!('end_at' in openMoved.patch));
  // …and choosing an end (even the one shown, by Done) writes it.
  const openEnded = rolledTimesWrite({ dateKey: DAY, stored: open, rolled: { span: { startMin: 1320, endMin: 1350 }, end: true } })!;
  assert.deepEqual(openEnded.values, { end_at: `${DAY}T22:30` });
  // WIRED: sent once, when the ticker CLOSES, through the rail's own action and its refusal handling.
  const src = read(`${SCHED}/_components/studio-day.tsx`);
  assert.equal((src.match(/onClosed=\{writeRolled\}/g) ?? []).length, 2, 'a time is not written when its ticker closes');
  assert.match(src, /const owed = rolledTimesWrite\(\{ dateKey, stored, rolled \}\);\s*setRolled\(null\);\s*if \(!owed\) return;\s*onPatch\(m\.block_id, owed\.patch, \(\) => updateScheduleBlock\(/);
  // Rolling only changes what is on screen (`setRolled`) — never a write per column.
  for (const m of src.matchAll(/onChange=\{\(min\) => ([^}]+)\}/g)) assert.match(m[1]!, /^setRolled\(/, `a roll does more than draw: ${m[1]}`);
  assert.equal((src.match(/onChange=\{\(min\) =>/g) ?? []).length, 2);
  assert.match(src, /onChange=\{\(min\) => setRolled\(\{ span: moveStart\(shown, min\)/, 'moving the start does not carry the end');
  assert.match(src, /onChange=\{\(min\) => setRolled\(\{ span: pickEnd\(shown, min\), end: true \}\)\}/);
  assert.deepEqual(src.match(/const \{[^}]*\} = useDayActions\(\);/g), ['const { updateScheduleBlock } = useDayActions();'], 'the timeline writes through something other than updateScheduleBlock');
  assert.doesNotMatch(src, /router\.refresh|useRouter|requestMakerRefresh|from '\.\.\/actions'|'use server'/);
});

test('(3) an overlap is ONE amber line under the later row — and nothing is blocked', async () => {
  const { html } = await paintDay([
    moment('a', 'Ceremony', '15:00', '16:00'),
    moment('b', 'Photos', '15:30', '16:30'),
    moment('c', 'Dinner', '19:00', '22:00'),
  ]);
  const rows = rowsOf(html);
  assert.equal((html.match(/data-timeline-note=""/g) ?? []).length, 1, 'not exactly one overlap line');
  assert.match(rows[1]!, /data-timeline-note=""[^>]*text-warn-700[^>]*>Starts before Ceremony ends \(4:00 PM\)\.</);
  assert.doesNotMatch(rows[0]!, /data-timeline-note/);
  assert.doesNotMatch(rows[2]!, /data-timeline-note/);
  // Never blocked: the overlapping row's times, name and ⋯ all still open.
  assert.doesNotMatch(rows[1]!, /disabled=""/);
  assert.match(rows[1]!, /data-ticker-pill="start"[\s\S]*data-ticker-pill="end"[\s\S]*data-timeline-name=""[\s\S]*data-studio-moment-more="b"/);
  // A moment that runs past midnight overlaps the one that starts under it; one that ends as the next begins does not.
  const late = (await paintDay([moment('a', 'Party', '22:00', '2026-12-13T01:00:00.000Z'), moment('b', 'Send-off', '23:30', '23:45')])).html;
  assert.match(late, /Starts before Party ends \(1:00 AM\)\./);
  const touching = (await paintDay([moment('a', 'Ceremony', '15:00', '16:00'), moment('b', 'Cocktails', '16:00', '17:00')])).html;
  assert.doesNotMatch(touching, /data-timeline-note/);
});

test('(4) Add a moment: where the last one ended, one hour long, the name open; unnamed is dropped; named is one quiet write', async () => {
  const { freshMomentSpan, freshMomentToAdd } = await import(`../${SCHED}/_components/studio-day`);
  const day = [moment('a', 'Ceremony', '15:00', '16:00'), moment('b', 'Dinner', '19:00', '22:00'), moment('r', 'Rehearsal', '18:00', '23:30', { start_at: '2026-12-11T18:00:00.000Z', end_at: '2026-12-11T23:30:00.000Z' })];
  // Where the last one ended ON THAT DAY (the rehearsal the night before does not count), one hour long.
  assert.deepEqual(freshMomentSpan(day, DAY), { startMin: 22 * 60, endMin: 23 * 60 });
  assert.deepEqual(freshMomentSpan([], DAY), { startMin: 14 * 60, endMin: 15 * 60 });
  // Left unnamed — empty, spaces, or ✕ — it is DROPPED: there is nothing to add.
  const span = { startMin: 1320, endMin: 1380 };
  for (const text of ['', '   ', null]) assert.equal(freshMomentToAdd(span, text), null);
  assert.deepEqual(freshMomentToAdd(span, '  Send-off '), { label: 'Send-off', startMin: 1320, endMin: 1380 });
  const src = read(`${SCHED}/_components/studio-day.tsx`);
  // The new row: its name open at once (the row's own field), kept → add, ✕ → nothing.
  assert.match(src, /setFresh\(freshMomentSpan\(moments, dateKey\)\);\s*setEditing\(NEW_ROW\);/);
  assert.match(src, /const toAdd = freshMomentToAdd\(span, text\);\s*if \(toAdd && onCreate\) onCreate\(toAdd\);/);
  assert.match(src, /<NewMomentRow span=\{fresh\} onKeep=\{\(text\) => endFresh\(text\)\} onLeave=\{\(\) => endFresh\(null\)\} \/>/);
  assert.match(src, /function NewMomentRow[\s\S]{0,600}?name=""[\s\S]{0,200}?editing\b/, 'the new row’s name is not open');
  // No date yet, or a coordinator who may stage: the shipped sheet.
  assert.match(src, /if \(!onCreate\) return onAdd\(\);/);
  const rail = read(`${SCHED}/_components/day-rail.tsx`);
  assert.match(rail, /onCreate=\{lastDateKey && !canStage \? createInline : null\}/);
  // ONE write, quiet, under an id made here; the row is on the timeline before it lands and cannot be edited until it has.
  const create = /function createInline\([\s\S]*?\n  \}\n/.exec(rail)?.[0] ?? '';
  assert.ok(create, 'createInline is gone');
  assert.equal((create.match(/createScheduleBlock\(/g) ?? []).length, 1);
  assert.match(create, /const id = crypto\.randomUUID\(\);/);
  assert.match(create, /block_id: id, label: input\.label, block_type: 'custom', start_at: start, end_at: end, is_public: 'on', \[SCHEDULE_QUIET_FIELD\]: '1'/);
  assert.match(create, /setAdded\(\(all\) => \[\s*\.\.\.all,/);
  assert.match(create, /setPending\(\(p\) => new Set\(p\)\.add\(id\)\);/);
  // A refused add is taken OFF the timeline and said — it never stays looking saved.
  assert.match(create, /catch \{\s*setAdded\(\(all\) => all\.filter\(\(m\) => m\.block_id !== id\)\);\s*setNotice\(`“\$\{input\.label\}” was not added\./);
  // No whole-page render: nothing here refreshes the route.
  assert.doesNotMatch(rail, /router\.refresh\(|requestMakerRefresh/);
  assert.match(rail, /pendingIds=\{pending\}/);
  assert.match(src, /canEdit=\{canEdit && landed\}/, 'a moment whose add has not landed can be edited');
  // Painted: a pending moment is shown, and its controls wait.
  const { html } = await paintDay([moment('a', 'Ceremony', '15:00', '16:00'), moment('n', 'Send-off', '22:00', '23:00')], { pendingIds: new Set(['n']), onCreate: () => {} });
  const rows = rowsOf(html);
  assert.match(rows[1]!, />Send-off</);
  assert.doesNotMatch(rows[1]!, /data-studio-moment-more|<button[^>]*data-timeline-name/);
  assert.match(rows[0]!, /data-studio-moment-more="a"/);
});

test('(5) createScheduleBlock takes an id only from a quiet Maker write, only a uuid — and revalidates nothing for it', () => {
  const actions = read(`${SCHED}/actions.ts`);
  const create = /export async function createScheduleBlock\([\s\S]*?\n\}\n/.exec(actions)?.[0] ?? '';
  assert.ok(create, 'createScheduleBlock is gone');
  assert.match(create, /if \(makerQuietWrite\(formData\) && typeof blockIdRaw === 'string' && BLOCK_ID_SHAPE\.test\(blockIdRaw\)\) \{\s*insertRow\.block_id = blockIdRaw;/);
  assert.equal((create.match(/insertRow\.block_id/g) ?? []).length, 1, 'the id is taken somewhere else too');
  // The shape is a uuid's and nothing looser.
  const shape = new RegExp(/const BLOCK_ID_SHAPE = \/(.+)\/;/.exec(actions)![1]!);
  assert.ok(shape.test('3f2b8c1e-7a4d-4e9b-8c1d-2a6f5b7e9c10'));
  for (const bad of ['', 'm-new-1', '3f2b8c1e7a4d4e9b8c1d2a6f5b7e9c10', "3f2b8c1e-7a4d-4e9b-8c1d-2a6f5b7e9c10'; --", '3F2B8C1E-7A4D-4E9B-8C1D-2A6F5B7E9C10 ']) assert.ok(!shape.test(bad), `took ${bad}`);
  // It is an INSERT (an id in use is refused by the key — never an upsert that could overwrite a row).
  assert.match(create, /\.from\('event_schedule_blocks'\)\.insert\(insertRow\)/);
  assert.doesNotMatch(create, /upsert/);
  // Quiet = no revalidate (no whole render of the Maker); every other caller revalidates exactly as before.
  assert.match(create, /revalidateScheduleUnlessMaker\(eventId, formData\);\s*\}\s*$/);
  assert.doesNotMatch(create, /revalidatePath\(/);
  assert.match(actions, /function revalidateScheduleUnlessMaker\(eventId: string, formData: FormData\): void \{\s*if \(makerQuietWrite\(formData\)\) return;\s*revalidatePath\(`\/dashboard\/\$\{eventId\}\/schedule`\);\s*revalidatePath\(`\/dashboard\/\$\{eventId\}`\);/);
  // The Maker's rail does NOT make every create quiet: a part added in ⋯ still comes back with its render.
  const live = read(`${SCHED}/_components/schedule-live.ts`);
  assert.doesNotMatch(live, /createScheduleBlock: quiet/);
});
