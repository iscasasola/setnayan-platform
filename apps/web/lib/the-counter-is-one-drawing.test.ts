/**
 * the-counter-is-one-drawing.test.ts — THE SEAT COUNTER IS THE COUNTER (kind 17), AND ITS LAST STEP IS THE STATUS LINE (kind 12).
 *
 * Owner "approved" 2026-10-13 (DECISION_LOG "THE MAKER'S PRINTS SIX + THE SEAT COUNTER"; corpus `MAKER_PRINTS_SEAT_COUNTER_2026-10-13_fable.md` § 7,
 * prototype `maker_prints_seat_counter_2026-10-13.html`): in the Seat plan's table sheet, after Table name and Shape, ONE Form row "Seats at this table" ·
 * "6 seated · of 10 chairs" with `− 7 +`. − greys when every chair left is taken; + greys when every chair is out; the number ticks; "Chair 8 removed." ·
 * Undo is the status line; it saves at once (live, never via Apply) and Undo takes back exactly ONE step.
 *
 *   1 · the rules (`lib/seat-counter.ts`) — the shipped stepper's, kept: − the HIGHEST empty chair, + the LOWEST removed one, each refused when it can't;
 *   2 · the Counter's drawing — the one pill, accent signs, grey + a name that says why when it cannot be pressed, the number in figures of one width;
 *   3 · the sheet: the row sits third, under Shape, with its small line; the step is the status line with Undo;
 *   4 · the editor: both docks draw the Counter, −/+ read the rules, Undo is the opposite of the LAST step (either way), the chair is drawn at the press
 *       (optimistic) and still saved by the ONE `setTableSeat`; the hand-made stepper is gone;
 *   5 · the status line's three tones are told apart by mark and role, never colour alone.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): − removing the LOWEST empty chair · + never greying · the Counter's sign in a hand colour ·
 * the counter row dropped from the sheet · Undo always restoring (a "+" step undone by another "+") · the optimistic chair op removed · the bad tone as `status`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { seatCounter, seatStepWords } from './seat-counter';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const S = 'app/dashboard/[eventId]/seating/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const html = async (el: React.ReactElement) => (await import('react-dom/server')).renderToStaticMarkup(el);
const occ = (cap: number, seated: number[]) => Array.from({ length: cap }, (_, i) => seated.includes(i));

test('1 · the rules: − the highest EMPTY chair (refused when every chair left is taken), + the lowest removed one (grey when none is out)', () => {
  /* The prototype's own table: 10 chairs, 6 seated (0–5), chairs 9 and 10 removed → 8. */
  const a = seatCounter({ capacity: 10, removed: new Set([8, 9]), occupied: occ(10, [0, 1, 2, 3, 4, 5]) });
  assert.deepEqual([a.value, a.seated, a.less, a.more], [8, 6, 7, 8]);
  assert.equal(a.line, '6 seated · of 10 chairs');
  assert.equal(a.lessLabel, 'One chair less');
  assert.equal(a.moreLabel, 'One chair more');
  /* A guest in the highest chair is skipped — − never takes a chair someone sits in. */
  assert.equal(seatCounter({ capacity: 10, removed: new Set(), occupied: occ(10, [9, 8]) }).less, 7);
  /* Every chair left is taken → − is grey and says why. */
  const full = seatCounter({ capacity: 10, removed: new Set([6, 7, 8, 9]), occupied: occ(10, [0, 1, 2, 3, 4, 5]) });
  assert.equal(full.value, 6);
  assert.equal(full.less, null);
  assert.equal(full.lessLabel, 'Every chair left is taken');
  assert.equal(full.more, 6, '+ brings back the LOWEST removed chair');
  /* All 10 out → + is grey and says why. */
  const all = seatCounter({ capacity: 10, removed: new Set(), occupied: occ(10, []) });
  assert.equal(all.value, 10);
  assert.equal(all.more, null);
  assert.equal(all.moreLabel, 'All 10 chairs are out');
  assert.equal(all.less, 9);
  /* A seated guest in a removed chair (old data) is not counted twice; a bad capacity draws nothing, never throws. */
  assert.equal(seatCounter({ capacity: 4, removed: new Set([3]), occupied: occ(4, [3]) }).seated, 0);
  assert.equal(seatCounter({ capacity: -2, removed: new Set(), occupied: [] }).value, 0);
  assert.equal(seatStepWords(7, true), 'Chair 8 removed.');
  assert.equal(seatStepWords(7, false), 'Chair 8 is back.');
});

test('2 · the Counter: one pill, accent signs, a grey sign is disabled AND named for why, the number in figures of one width', async () => {
  const { Counter } = await import('../app/_components/counter');
  const noop = () => {};
  const m = await html(React.createElement(Counter, { label: 'Seats at this table', value: 6, onLess: noop, onMore: noop, lessDisabled: true, lessLabel: 'Every chair left is taken', moreLabel: 'One chair more' }));
  assert.match(m, /role="group" aria-label="Seats at this table"/);
  assert.match(m, /class="inline-flex h-11 flex-none items-center rounded-full border border-ink\/15 bg-white/, 'the pill is not the one 44 px white pill');
  const less = m.match(/<button[^>]*data-counter-less=""[^>]*>/)?.[0] ?? '';
  const more = m.match(/<button[^>]*data-counter-more=""[^>]*>/)?.[0] ?? '';
  assert.match(less, /aria-label="Every chair left is taken"/);
  assert.match(less, /disabled=""/);
  assert.doesNotMatch(more, /disabled=""/);
  for (const b of [less, more]) {
    assert.match(b, /sn-press/, 'a sign has no press');
    assert.match(b, /h-11 min-h-11 w-11/, 'a sign is not a 44 px target');
    assert.match(b, /text-sn-accent/, 'a sign is not in the accent');
    assert.match(b, /disabled:text-ink\/20/, 'a grey sign is not grey');
  }
  assert.match(m, /<b[^>]*data-counter-value="6"[^>]*tabular-nums[^>]*>6<\/b>/);
  const src = read('app/_components/counter.tsx');
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|\bstyle=\{|bg-(?:terracotta|mulberry)|text-(?:terracotta|mulberry)/, 'the Counter writes a colour of its own');
  assert.match(src, /prefers-reduced-motion: reduce/, 'the tick moves under reduce motion');
});

test('3 · the sheet: "Seats at this table" is the third row (after Table name and Shape) with its line; the last step is the status line with Undo', async () => {
  const { PhoneTableDock } = await import(`../${S}/seat-plan-phone`);
  const { Counter } = await import('../app/_components/counter');
  const noop = () => {};
  const base = {
    tableId: 'T10', tableLabel: 'Table 10', typeValue: 'round', typeWord: 'Round', typeOptions: [{ key: 'round', label: 'Round' }],
    onRename: noop, onPickType: noop, canEdit: true, onRotate: noop, onEditChairs: noop, linked: false, onUnlink: noop, linkPressed: false, onLink: noop,
    seatPeople: null, onDone: noop, onDelete: noop, seatsLine: '6 seated · of 10 chairs',
    seats: React.createElement(Counter, { label: 'Seats at this table', value: 7, onLess: noop, onMore: noop }),
  };
  let undone = 0;
  const m = await html(React.createElement(PhoneTableDock as never, { ...base, seatNote: { words: 'Chair 8 removed.', onUndo: () => (undone += 1) } } as never));
  const at = (re: RegExp) => m.search(re);
  assert.ok(at(/Table name/) >= 0 && at(/Table name/) < at(/>Shape</) && at(/>Shape</) < at(/Seats at this table/), 'the seats row is not the third row');
  assert.match(m, /data-form-row="seat-table-seats"[\s\S]*?Seats at this table[\s\S]*?6 seated · of 10 chairs[\s\S]*?data-counter=""/, 'the row is not name · line · the Counter');
  assert.match(m, /role="status" data-status-line="seat-step" data-status-tone="info"[\s\S]*?Chair 8 removed\.[\s\S]*?data-status-action=""[^>]*>Undo<\/button>/, 'the step is not the status line with Undo');
  assert.ok(at(/data-status-line="seat-step"/) > at(/data-counter=""/) && at(/data-status-line="seat-step"/) < at(/>Rotate</), 'the status line is not under the rows, above the verbs');
  const none = await html(React.createElement(PhoneTableDock as never, { ...base, seatNote: null } as never));
  assert.doesNotMatch(none, /data-status-line/, 'a status line with nothing to say');
  assert.doesNotMatch(none, /removed · Undo/, 'the old strip is back');
});

test('4 · the editor: both docks draw the Counter; −/+ read the rules; Undo is the opposite of the LAST step; the chair is drawn at the press and saved by the one action', () => {
  const ed = read(`${S}/seating-editor.tsx`);
  const stepper = ed.slice(ed.indexOf('const dockSeatsStepper = (t: EventTableRow) => {'), ed.indexOf('const dockRotateCluster'));
  assert.match(stepper, /<Counter\b[\s\S]*?value=\{c\.value\}[\s\S]*?onLess=\{\(\) => decSeat\(t\)\}[\s\S]*?onMore=\{\(\) => incSeat\(t\)\}[\s\S]*?lessDisabled=\{c\.less === null \|\| !canEdit\}[\s\S]*?moreDisabled=\{c\.more === null \|\| !canEdit\}/);
  assert.doesNotMatch(ed, /aria-label="Remove a chair"|aria-label="Restore a chair"|\{formatCount\(effCap\)\}\/\{formatCount\(t\.capacity\)\}/, 'the hand-made seat stepper is still drawn');
  assert.match(ed, /const decSeat = \(t: EventTableRow\) => \{[\s\S]{0,200}const seat = counterFor\(t\)\.less;[\s\S]{0,200}toggleSeat\(t\.table_id, seat, true\);\s*setSeatNotice\(\{ tableId: t\.table_id, seat, removed: true \}\);/);
  assert.match(ed, /const incSeat = \(t: EventTableRow\) => \{[\s\S]{0,200}const seat = counterFor\(t\)\.more;[\s\S]{0,200}toggleSeat\(t\.table_id, seat, false\);\s*setSeatNotice\(\{ tableId: t\.table_id, seat, removed: false \}\);/);
  assert.match(ed, /const undoSeatRemoval = \(\) => \{\s*if \(!seatNotice\) return;\s*toggleSeat\(seatNotice\.tableId, seatNotice\.seat, !seatNotice\.removed\);\s*setSeatNotice\(null\);/, 'Undo is not the opposite of the last step');
  const toggle = ed.slice(ed.indexOf('const toggleSeat = (tableId: string, seatNumber: number, removed: boolean) => {'), ed.indexOf('// --- collision avoidance'));
  assert.match(toggle, /startTransition\(async \(\) => \{\s*applyTableOpt\(\{ type: 'chair', id: tableId, seat: seatNumber, removed \}\);\s*await runGated\(\(\) => setTableSeat\(fd\)\);/, 'the chair is not drawn at the press, or not saved by setTableSeat');
  assert.match(ed, /op\.removed\) next\.add\(op\.seat\);\s*else next\.delete\(op\.seat\);/, 'the optimistic chair op does not add/remove the chair');
  /* The phone sheet gets the Counter, its line and the step; the desktop dock the same Counter. */
  assert.match(ed, /seats=\{dockSeatsStepper\(st\)\}\s*seatsLine=\{counterFor\(st\)\.line\}\s*seatNote=\{seatNote\}/);
  assert.match(ed, /\{seatPeopleBtn\(false\)\}\s*\{dockSeatsStepper\(st\)\}\s*\{undoStrip\}/);
  /* Live, never drafted: no Event Hub draft write in the counter's path. */
  assert.doesNotMatch(stepper + toggle, /hubDraftAction|makerSave|DraftPatch/);
});

test('5 · the status line: three tones, each with its own mark and role — never colour alone; one action in words', async () => {
  const { StatusLine } = await import('../app/_components/status-line');
  const say = async (tone: 'info' | 'warn' | 'bad') => html(React.createElement(StatusLine as never, { tone, action: { label: 'Undo', onClick: () => {} } } as never, 'Words.'));
  const info = await say('info');
  const warn = await say('warn');
  const bad = await say('bad');
  assert.match(info, /role="status"[^>]*data-status-tone="info"/);
  assert.match(warn, /role="status"[^>]*data-status-tone="warn"/);
  assert.match(bad, /role="alert"[^>]*data-status-tone="bad"/, 'a wrong thing is not said as an alert');
  const mark = (m: string) => m.match(/<svg[^>]*class="lucide lucide-([a-z-]+)/)?.[1];
  assert.equal(new Set([mark(info), mark(warn), mark(bad)]).size, 3, 'two tones share a mark');
  for (const m of [info, warn, bad]) assert.match(m, /<button type="button" data-status-action=""[^>]*class="sn-press inline-flex min-h-11[^"]*underline[^"]*">Undo<\/button>/);
  const src = read('app/_components/status-line.tsx');
  assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|\bstyle=\{|bg-(?:terracotta|mulberry|amber|red)|text-(?:terracotta|mulberry|amber|red)-/, 'the status line writes a colour of its own');
});
