/**
 * guests-see-table.test.ts — "WHAT GUESTS SEE" (DECISION_LOG 2026-10-10), the sheet's table and its handlers.
 *
 * The sheet (`guests-see-sheet.tsx`) draws `GuestsSeeTable` and runs the handlers of `lib/guests-see-table.ts`; the
 * table is built on the server by `lib/guests-see-build.ts`. This file drives those handlers directly:
 *
 *   1. the table is the prototype's: six groups, the rows in its order, five columns — and ONLY a scene on a
 *      lifecycle stage is a box; every other cell is locked or a dash;
 *   2. every box IS `sceneOnStage` (drawn · our pick · the stored choice), for 300 random events;
 *   3. a tick → the draft patch carries exactly that `stage_show` entry; unticking our pick → `false`; ticking it
 *      back → nothing to write; "Back to our picks" → every stored entry cleared;
 *   4. a locked cell and a dash write NOTHING, and answer with their one line;
 *   5. the lines, word for word;
 *   6. a row switched off for the whole event: empty boxes with our marks, and one tick shows it on THAT stage only;
 *   7. Apply's patch, taken through the real draft (sanitizer → merge → preview), draws the table the couple ticked;
 *   8. THE TABLE AND THE GUEST PAGE CANNOT DISAGREE: for stored values, each box says what the real page draws.
 *
 * SABOTAGES RUN (each seen red, then put back and re-checked by hash):
 *   A · a tick made to store the wanted state always (never `null`)          → 3, 7 red;
 *   B · "Back to our picks" made to clear nothing                            → 3 red;
 *   C · a locked cell treated as a box by the handler                        → 4 red;
 *   D · a dash treated as a box by the builder (`notPossible` ignored)       → 1, 4 red;
 *   E · the builder made to read the box from a list of its own (`ourPick`)  → 2, 3, 5, 6, 7, 8 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
/* FIRST: the page renderer's seam (see `lib/stage-pages-fixture.ts`). */
import { LOOK_NOTE, STAGE_WORDS, renderStagePage, stageWidgets, withALook, type RowPatch, type StageCase } from './stage-pages-fixture';
import { STAGE_SHOW_KEY } from './stage-scenes';
import type { InvitationWidgetRow, LifecyclePhase, WidgetType } from './invitation-widgets';
import { sceneOnStage } from './what-guests-see';
import { buildGuestsSeeTable } from './guests-see-build';
import {
  GUESTS_SEE_COLUMNS, GUESTS_SEE_WORDS, guestsSeeApplyLabel, guestsSeeBackToPicks, guestsSeeChanges, guestsSeeOn, guestsSeePatch,
  guestsSeeToggle, type GuestsSeeCell, type GuestsSeeTable, type GuestsSeeWrites,
} from './guests-see-table';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, sanitizeHubDraft } from './hub-draft';

const show = (choices: Partial<Record<LifecyclePhase, boolean>>) => ({ config: { [STAGE_SHOW_KEY]: choices } });
const table = (rows: readonly InvitationWidgetRow[], more: Partial<Parameters<typeof buildGuestsSeeTable>[0]> = {}) =>
  buildGuestsSeeTable({ widgets: rows, hasEntourage: true, giftsOff: false, ...more });
const rowOf = (t: GuestsSeeTable, key: string) => t.groups.flatMap((g) => g.rows).find((r) => r.key === key)!;
const COL = Object.fromEntries(GUESTS_SEE_COLUMNS.map((c, i) => [c.key, i])) as Record<(typeof GUESTS_SEE_COLUMNS)[number]['key'], number>;
const NONE: GuestsSeeWrites = {};

test('1 · the prototype’s table: six groups, its rows, five columns — and only a scene on a lifecycle stage is a box', () => {
  const t = table(stageWidgets());
  assert.deepEqual(GUESTS_SEE_COLUMNS.map((c) => c.label), ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event']);
  assert.deepEqual(
    t.groups.map((g) => [g.title, g.rows.map((r) => r.label)]),
    [
      ['The basics', ['Names and date', 'Place', 'Countdown']],
      ['The story', ['Message', 'Love Story', 'Our photos']],
      ['The details', ['Schedule', 'Map', 'Dress code', 'What to bring', 'E-Gifts']],
      ['People', ['Entourage', 'Reply card']],
      ['On the day', ['Your seat', 'Digital pass', 'Announcements', 'Live', 'Camera', 'Photos of you']],
      ['The opening', ['Reveal']],
      [GUESTS_SEE_WORDS.ownScenes, [STAGE_WORDS.ownSceneTitle]],
    ],
  );
  const count = { box: 0, dash: 0, lockedOn: 0, lockedOff: 0, replyScreens: 0 };
  for (const row of t.groups.flatMap((g) => g.rows)) {
    assert.equal(row.cells.length, 5);
    row.cells.forEach((cell, col) => {
      const lifecycle = GUESTS_SEE_COLUMNS[col]!.stage !== null;
      if (cell.kind === 'box') {
        assert.ok(row.scene !== null && lifecycle, `${row.label} × ${GUESTS_SEE_COLUMNS[col]!.label} is a box that could write nothing`);
        count.box += 1;
      } else if (cell.kind === 'dash') count.dash += 1;
      else if (row.scene !== null) {
        assert.deepEqual([lifecycle, cell.on, cell.why], [false, false, GUESTS_SEE_WORDS.replyScreens], 'a scene is locked only on the reply screens');
        count.replyScreens += 1;
      } else {
        assert.equal(cell.why, GUESTS_SEE_WORDS.locked);
        count[cell.on ? 'lockedOn' : 'lockedOff'] += 1;
      }
    });
  }
  console.log(`  cells: ${JSON.stringify(count)}`);
  // 21 rows × 5 columns = 105 cells, for this invitation (every scene filled, one scene of the couple's own).
  assert.deepEqual(count, { box: 34, dash: 10, lockedOn: 34, lockedOff: 18, replyScreens: 9 });
  // The two scene dashes, in the prototype's words; a fixed row's, in its own.
  assert.deepEqual(rowOf(t, 'countdown').cells[COL.editorial], { kind: 'dash', why: 'The countdown ends on the day.' });
  assert.deepEqual(rowOf(t, 'what_to_bring').cells[COL.editorial], { kind: 'dash', why: 'The day has passed.' });
  assert.deepEqual(rowOf(t, 'live').cells[COL.save_the_date], { kind: 'dash', why: 'Live opens on the day.' });
  // The fixed rows the page's own gates answer for.
  assert.deepEqual(rowOf(t, 'pass').cells.map((c) => c.kind === 'locked' && c.on), [false, false, true, true, false], 'the ticket is drawn on the Invitation and The Day');
  assert.deepEqual(rowOf(t, 'reply').cells.map((c) => c.kind === 'locked' && c.on), [false, true, true, false, false]);
  assert.deepEqual(rowOf(table(stageWidgets(), { hasEntourage: false }), 'entourage').cells.map((c) => c.kind === 'locked' && c.on), [false, false, false, false, false]);
  assert.deepEqual(rowOf(table(stageWidgets(), { giftsOff: true }), 'gifts').cells.map((c) => c.kind === 'locked' && c.on), [false, false, false, false, false]);
});

test('2 · every box IS sceneOnStage — drawn, our pick and the stored choice — for 300 random events', () => {
  let boxes = 0;
  let stored = 0;
  let seed = 1;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let n = 0; n < 300; n += 1) {
    const patch: Partial<Record<WidgetType, RowPatch>> = {};
    for (const type of ['countdown', 'special_message', 'our_love_story', 'our_photos', 'schedule', 'venue_map', 'dress_code', 'what_to_bring', 'custom_1'] as const) {
      const choices: Record<string, boolean> = {};
      for (const s of ['save_the_date', 'rsvp', 'event', 'editorial']) if (rnd() < 0.35) choices[s] = rnd() < 0.5;
      patch[type] = { is_visible: rnd() < 0.75, mode: rnd() < 0.2 ? 'hidden' : 'auto', config: { ...(Object.keys(choices).length ? { [STAGE_SHOW_KEY]: choices } : {}), ...(type === 'our_photos' && rnd() < 0.5 ? { std_lead: 'photos' } : {}) } };
    }
    const rows = stageWidgets(patch);
    const openBrowse = rnd() < 0.4;
    const t = table(rows, { openBrowse });
    for (const row of t.groups.flatMap((g) => g.rows)) {
      if (!row.scene) continue;
      row.cells.forEach((cell, col) => {
        const stage = GUESTS_SEE_COLUMNS[col]!.stage;
        if (stage === null) return;
        const v = sceneOnStage({ widgets: rows, stage, openBrowse }, row.scene!)!;
        if (cell.kind === 'dash') return assert.ok(v.notPossible, `${row.key} × ${stage} is a dash and the page says it is possible`);
        assert.ok(cell.kind === 'box');
        assert.deepEqual([cell.on, cell.ourPick, cell.choice], [v.drawn, v.ourPick, v.choice], `event ${n} · ${row.key} × ${stage}`);
        boxes += 1;
        if (cell.choice !== null) stored += 1;
      });
    }
  }
  assert.ok(boxes > 8000 && stored > 2500, `anti-vacuity: ${boxes} boxes, ${stored} with a stored choice`);
});

test('3 · a tick writes exactly its entry; unticking our pick writes false; ticking it back writes nothing; Back to our picks clears every stored entry', () => {
  const t = table(stageWidgets());
  // An empty box ticked: the Message on The Day.
  const add = guestsSeeToggle(t, NONE, 'special_message', COL.event);
  assert.deepEqual(add.writes, { 'special_message:event': true });
  assert.deepEqual(guestsSeePatch(add.writes), { widgets: { special_message: { stage_show: { event: true } } } });
  // Our pick unticked: the Love Story on the Invitation.
  const off = guestsSeeToggle(t, add.writes, 'our_love_story', COL.rsvp);
  assert.deepEqual(guestsSeePatch(off.writes), { widgets: { special_message: { stage_show: { event: true } }, our_love_story: { stage_show: { rsvp: false } } } });
  assert.equal(guestsSeeChanges(off.writes), 2);
  assert.equal(guestsSeeApplyLabel(2), 'Apply · 2 changes');
  assert.equal(guestsSeeApplyLabel(1), 'Apply · 1 change');
  assert.equal(guestsSeeOn(rowOf(t, 'our_love_story'), COL.rsvp, off.writes), false);
  // Ticked back: nothing left to write for it.
  const back = guestsSeeToggle(t, off.writes, 'our_love_story', COL.rsvp);
  assert.deepEqual(back.writes, { 'special_message:event': true });
  assert.equal(guestsSeePatch(NONE), null);

  // With choices already stored: taking one back writes null, never a second copy of our pick.
  const stored = table(stageWidgets({ our_love_story: show({ rsvp: false, event: false }), special_message: show({ event: true }), schedule: show({ rsvp: false }) }));
  assert.deepEqual(guestsSeeToggle(stored, NONE, 'our_love_story', COL.rsvp).writes, { 'our_love_story:rsvp': null });
  assert.deepEqual(guestsSeeToggle(stored, NONE, 'special_message', COL.event).writes, { 'special_message:event': null });
  // Back to our picks: all four stored entries cleared, and a pending tick elsewhere dropped.
  const pending = guestsSeeToggle(stored, NONE, 'countdown', COL.event).writes;
  const picks = guestsSeeBackToPicks(stored, pending);
  assert.deepEqual(picks.writes, { 'our_love_story:rsvp': null, 'our_love_story:event': null, 'special_message:event': null, 'schedule:rsvp': null });
  assert.equal(picks.line, 'Back to our picks. 5 boxes changed — Apply to keep it.');
  for (const row of stored.groups.flatMap((g) => g.rows)) row.cells.forEach((c, i) => c.kind === 'box' && assert.equal(guestsSeeOn(row, i, picks.writes), c.ourPick, `${row.key} is not back to our pick`));
  // Nothing to take back.
  assert.deepEqual(guestsSeeBackToPicks(t, NONE), { writes: NONE, line: 'These are our picks already.', changed: false });
});

test('4 · a locked cell and a dash write nothing, and answer with their one line', () => {
  const t = table(stageWidgets());
  const pending = guestsSeeToggle(t, NONE, 'special_message', COL.event).writes;
  const cases: Array<[string, number, string]> = [
    ['gifts', COL.rsvp, 'This one cannot be changed here yet.'], // a fixed row, shown
    ['seat', COL.save_the_date, 'This one cannot be changed here yet.'], // a fixed row, not shown
    ['names', COL.rsvp_screens, 'This one cannot be changed here yet.'],
    ['schedule', COL.rsvp_screens, 'Not on the reply screens yet.'], // a scene's RSVP column
    ['countdown', COL.editorial, 'The countdown ends on the day.'], // cannot be there then
    ['camera', COL.editorial, 'The camera closes after the day.'],
  ];
  for (const [row, col, line] of cases) {
    const tap = guestsSeeToggle(t, pending, row, col);
    assert.deepEqual([tap.changed, tap.line], [false, line], `${row} × ${col}`);
    assert.equal(tap.writes, pending, `${row} × ${col} changed what will be written`);
    assert.equal(guestsSeePatch(guestsSeeToggle(t, NONE, row, col).writes), null);
  }
});

test('5 · the lines, word for word', () => {
  const t = table(stageWidgets({}), { content: { what_to_bring: false } });
  const line = (row: string, col: number, writes: GuestsSeeWrites = NONE) => guestsSeeToggle(t, writes, row, col).line;
  assert.equal(GUESTS_SEE_WORDS.quiet, 'Nothing changed yet — our picks do the work.');
  assert.equal(line('our_love_story', COL.rsvp), 'Hidden on Invitation. Still shown on Save the Date, The Day and Post Event.');
  assert.equal(line('special_message', COL.event), 'Added to The Day.');
  assert.equal(line('what_to_bring', COL.save_the_date), 'Added to Save the Date. Nothing written yet — guests will not see it until you write it.');
  const offOnce = guestsSeeToggle(t, NONE, 'our_love_story', COL.rsvp).writes;
  assert.equal(line('our_love_story', COL.rsvp, offOnce), 'Shown on Invitation again.');
  const added = guestsSeeToggle(t, NONE, 'special_message', COL.event).writes;
  assert.equal(line('special_message', COL.event, added), 'Removed from The Day.');
  // The last stage it was shown on.
  let w: GuestsSeeWrites = NONE;
  for (const col of [COL.save_the_date, COL.rsvp]) w = guestsSeeToggle(t, w, 'countdown', col).writes;
  const only = table(stageWidgets({ dress_code: show({ event: false }) }));
  assert.equal(guestsSeeToggle(only, NONE, 'dress_code', COL.rsvp).line, 'Hidden on Invitation. Not shown on any other stage either.');
  assert.equal(rowOf(t, 'what_to_bring').empty, true);
});

test('6 · a row switched off for the whole event: empty boxes, our marks kept, and one tick shows it on THAT stage only', () => {
  const rows = stageWidgets({ special_message: { is_visible: false } });
  const t = table(rows);
  const row = rowOf(t, 'special_message');
  assert.deepEqual(row.cells.map((c) => (c.kind === 'box' ? [c.on, c.ourPick, c.base] : c.kind)), [[false, false, false], 'locked', [false, true, false], [false, false, false], [false, true, false]]);
  const tick = guestsSeeToggle(t, NONE, 'special_message', COL.rsvp);
  assert.deepEqual(tick.writes, { 'special_message:rsvp': true });
  assert.equal(tick.line, 'Shown on Invitation again.');
  // Through the draft: shown on the Invitation, still hidden on Post Event (our pick there) — nothing un-hidden silently.
  const draft = mergeHubDraft(emptyHubDraft(), JSON.parse(JSON.stringify(guestsSeePatch(tick.writes))));
  const after = rowOf(table(overlayHubDraftWidgets(rows, draft)), 'special_message');
  assert.deepEqual(after.cells.map((c) => (c.kind === 'box' ? c.on : null)), [false, null, true, false, false]);
  assert.equal(overlayHubDraftWidgets(rows, draft).find((r) => r.widget_type === 'special_message')!.is_visible, false, 'the event-wide eye was touched');
});

test('7 · Apply’s patch, through the real draft, draws the table the couple ticked — and leaves nothing pending', () => {
  const rows = stageWidgets({ schedule: show({ rsvp: false }) });
  const t = table(rows);
  let w: GuestsSeeWrites = NONE;
  for (const [row, col] of [['special_message', COL.event], ['our_love_story', COL.save_the_date], ['schedule', COL.rsvp], ['dress_code', COL.event], ['custom_1', COL.editorial]] as const) w = guestsSeeToggle(t, w, row, col).writes;
  const wanted = t.groups.flatMap((g) => g.rows).map((r) => r.cells.map((_, i) => guestsSeeOn(r, i, w)));
  const stored = sanitizeHubDraft({ v: 1, events: {}, history: [], ...JSON.parse(JSON.stringify(guestsSeePatch(w))) });
  const next = table(overlayHubDraftWidgets(rows, stored));
  assert.deepEqual(next.groups.flatMap((g) => g.rows).map((r) => r.cells.map((_, i) => guestsSeeOn(r, i, NONE))), wanted);
  assert.equal(overlayHubDraftWidgets(rows, stored).find((r) => r.widget_type === 'schedule')!.config_json && (overlayHubDraftWidgets(rows, stored).find((r) => r.widget_type === 'schedule')!.config_json as Record<string, unknown>)[STAGE_SHOW_KEY], undefined, 'a choice taken back left its key');
});

const ON_THE_PAGE: Array<{ key: string; words: string }> = [
  { key: 'special_message', words: 'We cannot wait to celebrate with you.' },
  { key: 'what_to_bring', words: STAGE_WORDS.reminder },
  { key: 'our_love_story', words: STAGE_WORDS.howWeMet },
  { key: 'countdown', words: 'Until we say' },
  { key: 'custom_1', words: STAGE_WORDS.ownSceneTitle },
  { key: 'our_photos', words: STAGE_WORDS.photo },
  { key: 'dress_code', words: LOOK_NOTE },
  { key: 'schedule', words: 'Cocktails' },
];

test('8 · the table and the guest page cannot disagree: each box says what the REAL page draws, for stored values', async () => {
  const patch: Partial<Record<WidgetType, RowPatch>> = {
    special_message: show({ rsvp: false, event: true }),
    what_to_bring: { is_visible: false, ...show({ event: true, save_the_date: true }) },
    our_love_story: show({ event: false, editorial: false }),
    countdown: show({ event: true, save_the_date: false }),
    custom_1: show({ rsvp: false }),
    our_photos: show({ save_the_date: false, rsvp: true }),
    dress_code: show({ event: false, editorial: true }),
    schedule: show({ event: false, save_the_date: true }),
  };
  const rows = stageWidgets(patch);
  const t = table(rows);
  let asked = 0;
  let on = 0;
  for (const col of GUESTS_SEE_COLUMNS) {
    if (col.stage === null) continue;
    const c: StageCase = { stage: col.stage, reader: 'guest', arrangement: col.stage === 'save_the_date' ? 'film' : 'plain' };
    const page = await renderStagePage(c, rows, withALook(c));
    assert.deepEqual(page.complaints, []);
    for (const { key, words } of ON_THE_PAGE) {
      const cell: GuestsSeeCell = rowOf(t, key).cells[COL[col.key]]!;
      if (cell.kind !== 'box') continue;
      assert.equal(page.html.includes(words), cell.on, `${key} × ${col.label}: the sheet shows ${cell.on ? 'a tick' : 'an empty box'} (choice ${cell.choice}), the page ${page.html.includes(words) ? 'draws it' : 'does not'}`);
      asked += 1;
      if (cell.on) on += 1;
    }
  }
  assert.ok(asked >= 30 && on >= 10 && asked - on >= 10, `anti-vacuity: ${asked} cells asked, ${on} ticked`);
});
