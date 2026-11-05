/**
 * a-moment-holds-its-tasks.test.ts — 📖 STEP 3b: a moment and its parallel tasks (owner 2026-11-01, corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN §3 "Moments work the same way" · §3c "Blow by blow, tested against the real run of show").
 *
 * Held here, as properties:
 *   1 · A TASK SAVES WITH ITS WHO AND PLACE: every kind of who the sheet's Who ▾ offers (a supplier, its crew, a role, a
 *       group, a person, a name in words), as the sheet POSTS it (`taskFields`), is read back by the server's parser
 *       (`taskInputFromForm` → `taskRowFrom`) into a row naming exactly that who, with the place typed — and a blank
 *       place stays none (the moment's room). And the post reaches the writer: the real door posts `moment_op`, and the
 *       Schedule's update door hands it to `runMomentOp` BEFORE it builds a block patch.
 *   2 · A CLASH IS FLAGGED: the same person or crew in two places at once — in one moment or across two — is found and
 *       said in words naming both places; a supplier split into crews, or two people in one room, is not. The sheet
 *       draws it on the task and the chapter's page marks the moment's row. Never refused: the task write never reads it.
 *   3 · THE DELETE WARNING COUNTS: Delete moment asks THIS MOMENT'S Papic count (each capture knows the moment of its
 *       chapter on at the shutter — `papic_chapter_captures.moment_block_id`, migration 20271302139013) and the warning
 *       names what it deletes and what stays in another chapter; a count it could not read is said, never drawn as 0 or
 *       "none". Nothing is removed before Continue. (The removal itself: tests/db/papic-knows-the-moment.db.test.ts.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  clashesForMoment,
  momentDeleteWords,
  taskFields,
  taskInputFromForm,
  taskPlace,
  taskRowFrom,
  whoFieldsOf,
  type ClashMoment,
  type TaskNames,
  type TaskRow,
} from '@/lib/schedule-chapters';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const SHEET = 'app/dashboard/[eventId]/schedule/_components/moment-sheets.tsx';
const HOST = 'app/dashboard/[eventId]/schedule/_components/chapters-host.tsx';
const ACTIONS = 'app/dashboard/[eventId]/schedule/actions.ts';
const SERVER = 'lib/schedule-chapters.server.ts';

/** The body of `function <name>(…) {…}` in `src`, brace-matched. */
function body(src: string, name: string): string {
  const at = src.search(new RegExp(`function\\s+${name}\\s*[(<]`));
  assert.ok(at >= 0, `${name} not found — this guard is pointed at nothing`);
  let i = src.indexOf('(', at);
  for (let d = 0; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')' && --d === 0) break;
  }
  const open = src.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(open, j + 1);
  }
  throw new Error(`${name} never closes`);
}

function posted(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** The sheet's post for this Who ▾ key → the row the server writes. */
function roundTrip(key: string, place: string | null, crew?: string): Record<string, unknown> {
  const who = whoFieldsOf(key);
  assert.ok(who, `Who ▾ key ${key} is not understood`);
  const f = taskFields(crew === undefined ? who : { ...who, crew }, 'Hair and make-up, one chair each', '2026-12-18T07:30:00.000Z', place, 1, null);
  const input = taskInputFromForm(posted(f));
  assert.ok(input.ok, `the server could not read the sheet's post for ${key}: ${!input.ok ? input.error : ''}`);
  const row = taskRowFrom('moment-1', input.input);
  assert.ok(row.ok, 'the task row was refused');
  return row.row;
}

test('1 · a task saves with its who and place', () => {
  const supplier = roundTrip('s:v-hmua', '2F holding room');
  assert.equal(supplier.vendor_id, 'v-hmua');
  assert.equal(supplier.crew, null);
  assert.equal(supplier.place, '2F holding room', 'the place typed on the task is not what is written');
  assert.equal(supplier.what, 'Hair and make-up, one chair each');
  assert.equal(supplier.call_at, '2026-12-18T07:30:00.000Z');

  const crew = roundTrip('c:v-hmua:Team B', 'Lobby');
  assert.deepEqual([crew.vendor_id, crew.crew, crew.place], ['v-hmua', 'Team B', 'Lobby'], 'a crew is not saved as its supplier + crew');
  const typedCrew = roundTrip('s:v-coord', null, 'Coord A');
  assert.deepEqual([typedCrew.vendor_id, typedCrew.crew], ['v-coord', 'Coord A'], 'a crew typed on a supplier task is lost');

  const each: [string, string, string][] = [
    ['p:guest-1', 'guest_id', 'guest-1'],
    ['g:group-1', 'group_id', 'group-1'],
    ['r:bridesmaid', 'role', 'bridesmaid'],
    ['o:Seda banquet captain', 'who_label', 'Seda banquet captain'],
  ];
  for (const [key, col, value] of each) {
    const row = roundTrip(key, null);
    assert.equal(row[col], value, `${key} is not saved as its ${col}`);
    const whos = ['vendor_id', 'guest_id', 'group_id', 'role', 'who_label'].filter((c) => row[c] !== null);
    assert.deepEqual(whos, [col], `${key} saved more than one who`);
    assert.equal(row.place, null, 'a blank place must stay none (the moment’s room), never ""');
  }

  // A blank place reads as the moment's room on the page.
  assert.equal(
    taskPlace({ place: null }, { block_id: 'm', start_at: '', end_at: null, location: null, spot: 'Bridal suite' }, { location: 'Hotel Aurora', spot: null }),
    'Hotel Aurora, Bridal suite',
  );

  // The post reaches the writer: the sheet's task write posts THIS encoding, the real door posts `moment_op`, and the
  // update door routes it to `runMomentOp` before it builds a block patch (which would otherwise refuse or ignore it).
  const sheet = code(SHEET);
  assert.match(body(sheet, 'TaskEditor'), /taskFields\(/, 'the task row no longer posts through taskFields');
  assert.match(body(sheet, 'realMomentDoors'), /moment_op:\s*op/, 'the real task door does not post moment_op');
  const update = body(code(ACTIONS), 'updateScheduleBlock');
  const branch = update.search(/formData\.get\('moment_op'\)/);
  const patch = update.search(/const patch: Patch/);
  assert.ok(branch >= 0 && update.slice(branch, patch).includes('runMomentOp('), 'updateScheduleBlock no longer hands moment_op to runMomentOp');
  assert.ok(branch < patch, 'the moment_op branch must run before the block patch is built');
  const run = body(code(SERVER), 'runMomentOp');
  for (const door of ['addMomentTask(', 'updateMomentTask(', 'deleteMomentTask(']) assert.ok(run.includes(door), `runMomentOp no longer reaches ${door}`);
});

const NAMES: TaskNames = {
  suppliers: new Map([
    ['v-hmua', 'Glow HMUA'],
    ['v-coord', 'The Planning Desk'],
  ]),
  guests: new Map([['g-ana', 'Ana Cruz']]),
  groups: new Map(),
  roles: new Map([['bride', 'Bride']]),
};
const at = (hhmm: string) => `2026-12-18T${hhmm}:00.000Z`;
const CHAPTER = { block_id: 'c1', location: 'Hotel Aurora', spot: null };
const M1: ClashMoment = { block_id: 'm1', parent_block_id: 'c1', label: 'Hair and make-up', start_at: at('08:00'), end_at: at('08:30'), location: null, spot: 'Bridal suite' };
const M2: ClashMoment = { block_id: 'm2', parent_block_id: 'c1', label: 'Florist arrives', start_at: at('08:15'), end_at: at('08:45'), location: null, spot: 'Lobby' };
const task = (id: string, block: string, who: Partial<TaskRow>, place: string | null): TaskRow => ({
  task_id: id,
  block_id: block,
  vendor_id: null,
  crew: null,
  guest_id: null,
  group_id: null,
  role: null,
  who_label: null,
  what: 'Something',
  call_at: null,
  place,
  sort_order: 0,
  ...who,
});

test('2 · a clash is flagged', () => {
  // The run of show: three at once, two places — the bride and the planner in the suite, Team B in the holding room.
  const three = [
    task('t1', 'm1', { role: 'bride' }, null),
    task('t2', 'm1', { vendor_id: 'v-hmua', crew: 'Team B' }, '2F holding room'),
    task('t3', 'm1', { vendor_id: 'v-coord', crew: 'Coord A' }, null),
  ];
  assert.equal(clashesForMoment('m1', three, [M1, M2], [CHAPTER], NAMES).size, 0, 'three people in two places is normal, not a clash');

  // Glow HMUA's OTHER crew in another room at once is a split team, not a clash.
  const split = [...three, task('t4', 'm1', { vendor_id: 'v-hmua', crew: 'Team A' }, 'Groom’s room')];
  assert.equal(clashesForMoment('m1', split, [M1, M2], [CHAPTER], NAMES).size, 0, 'a supplier split into crews was flagged');

  // Coord A also asked to be in the lobby, by ANOTHER moment at the same time → flagged, naming both places.
  const twice = [...three, task('t5', 'm2', { vendor_id: 'v-coord', crew: 'Coord A' }, null)];
  const flags = clashesForMoment('m1', twice, [M1, M2], [CHAPTER], NAMES);
  assert.equal(flags.size, 1, 'the same crew in two places at once was not flagged');
  const words = flags.get('t3') ?? '';
  assert.match(words, /The Planning Desk · Coord A/, 'the flag does not say who');
  assert.match(words, /Bridal suite/, 'the flag does not name this place');
  assert.match(words, /Lobby/, 'the flag does not name the other place');
  assert.equal(clashesForMoment('m2', twice, [M1, M2], [CHAPTER], NAMES).has('t5'), true, 'the other moment is not flagged too');

  // Drawn: the sheet flags the task row, the chapter's page marks the moment's row — and the write never reads it.
  const sheet = code(SHEET);
  assert.match(body(sheet, 'MomentSheet'), /clashesForMoment\(/, 'the moment sheet no longer checks for clashes');
  assert.match(body(sheet, 'TaskEditor'), /clash\s*\?/, 'a task row no longer shows its clash');
  assert.match(code(HOST), /clashesForMoment\(/, 'the chapter page no longer marks a clashing moment');
  const write = body(sheet, 'TaskEditor').slice(body(sheet, 'TaskEditor').indexOf('const write'));
  assert.doesNotMatch(write.slice(0, write.indexOf('const q =')), /clash/, 'a clash must be flagged, never refused — the task write reads it');
});

test('3 · the delete warning counts', () => {
  // 📷 Since 20271302139013 a capture knows its moment: the warning names what the delete takes, and what stays.
  const counted = momentDeleteWords({ label: 'Guests arrive', tasks: 3, papic: { ok: true, value: { removed: 12, stays: 0 } } });
  assert.match(counted, /deletes the 12 Papic photos and videos\b/, 'the warning does not name the count');
  assert.match(counted, /3 tasks/, 'the warning does not say its tasks go too');
  assert.match(counted, /cannot be undone/);
  assert.match(momentDeleteWords({ label: 'Mass', tasks: 0, papic: { ok: true, value: { removed: 1, stays: 2 } } }), /deletes the 1 Papic photo or video\b[\s\S]*2 Papic photos and videos also in another chapter stay there/);
  assert.match(momentDeleteWords({ label: 'Mass', tasks: 0, papic: { ok: true, value: { removed: 0, stays: 0 } } }), /No Papic photos/);
  const unread = momentDeleteWords({ label: 'Mass', tasks: 0, papic: { ok: false } });
  assert.match(unread, /couldn’t be counted/, 'a failed count is not said');
  assert.doesNotMatch(unread, /\b0\b|No Papic/, 'a failed count is drawn as none');
  assert.doesNotMatch(momentDeleteWords({ label: 'Mass', tasks: 0, papic: null }), /\b0\b|No Papic/, 'a count still on its way reads as none');

  // Drawn: Delete moment only ASKS — it fetches THIS MOMENT's count (in its chapter) and words it; the removal is behind Continue.
  const sheet = body(code(SHEET), 'MomentSheet');
  const ask = sheet.slice(sheet.indexOf('const askDelete'), sheet.indexOf('return (', sheet.indexOf('const askDelete')));
  assert.match(ask, /papicCount\(m\.block_id,\s*c\.block_id\)/, 'the warning no longer counts this moment’s Papic items');
  assert.doesNotMatch(ask, /doors\.remove/, 'Delete moment deletes before Continue');
  assert.match(sheet, /momentDeleteWords\(\{[^}]*papic\s*\}/, 'the warning no longer words the count it read');
  const cont = sheet.indexOf("label=\"Continue\"");
  assert.ok(cont >= 0 && sheet.indexOf('doors.remove(', cont) > cont, 'the removal is not behind Continue');
  // The count is the chapter's Papic links tagged with this moment.
  const count = body(code(SERVER), 'countMomentPapic');
  assert.match(count, /from\('papic_chapter_captures'\)[\s\S]*\.eq\('moment_block_id',\s*momentId\)/, 'the count no longer reads the moment’s Papic links');
  assert.match(body(code(SERVER), 'runMomentOp'), /countMomentPapic\(/, 'the papic_count op no longer counts');
});
