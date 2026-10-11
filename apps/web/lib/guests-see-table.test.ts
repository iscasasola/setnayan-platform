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
 *   9. ONLY BOXES THAT WORK ARE BOXES: every box of the table is flipped — through the draft, as Apply sends it — and
 *      the REAL page of its stage, read on a day that stage is really read on, must show a guest something different
 *      (its words or its pictures). 33 boxes, 11 of them empty ones ticked; none may change nothing.
 *      ⚠ WHAT THIS CANNOT SEE: the page is the server's HTML. A scene that hides itself in the BROWSER is invisible to
 *      it — that is the Countdown on The Day (it retires once the clock is read: `CountdownWidget`, `isPast`), found
 *      by reading the code, and made a dash by its own rule (`SCENES_RETIRED_ON_THE_DAY`). No other scene of the
 *      table reads the clock in the browser to decide whether to draw.
 *
 * SABOTAGES RUN (each seen red, then put back and re-checked by hash):
 *   A · a tick made to store the wanted state always (never `null`)          → 3, 7 red;
 *   B · "Back to our picks" made to clear nothing                            → 3 red;
 *   C · a locked cell treated as a box by the handler                        → 4 red;
 *   D · a dash treated as a box by the builder (`notPossible` ignored)       → 1, 4 red;
 *   E · the builder made to read the box from a list of its own (`ourPick`)  → 2, 3, 5, 6, 7, 8 red;
 *   F · the page's plan made deaf to the stage's choice                      → 8, 9 red (every list box is then dead).
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
  guestsSeeHandSet, guestsSeeHasEmptyRow, guestsSeeOpeningLine, guestsSeeToggle, guestsSeeWithRemoved, type GuestsSeeCell, type GuestsSeeTable, type GuestsSeeWrites,
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
      // (The prototype's head is "On the day"; the owner's rule d25 names that stage "The Day" on every label.)
      ['The Day', ['Your seat', 'Digital pass', 'Announcements', 'Live', 'Camera', 'Photos of you']],
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
        /* 🔁 RE-AIMED 2026-10-11 (pass 2): a box is no longer "a scene" — it is a row that has somewhere to WRITE
           (`row.write`: a scene's own row, or `part:<key>` on the hero row), on a lifecycle stage. The claim is the
           same: no box that could write nothing. `fixed-rows-are-real-boxes` flips each fixed row's on the real page. */
        assert.ok(row.write !== null && lifecycle, `${row.label} × ${GUESTS_SEE_COLUMNS[col]!.label} is a box that could write nothing`);
        count.box += 1;
      } else if (cell.kind === 'dash') count.dash += 1;
      else if (row.scene !== null) {
        assert.deepEqual([lifecycle, cell.on, cell.why], [false, false, GUESTS_SEE_WORDS.replyScreens], 'a scene is locked only on the reply screens');
        count.replyScreens += 1;
      } else {
        // A row that is not a scene: "not changed here yet", the prototype's "always shown" line, or — in the RSVP
        // column of a part that IS a box elsewhere — the reply screens' line.
        assert.ok(
          [GUESTS_SEE_WORDS.locked, GUESTS_SEE_WORDS.alwaysNames, GUESTS_SEE_WORDS.alwaysPlace, GUESTS_SEE_WORDS.alwaysReply, GUESTS_SEE_WORDS.replyScreens].includes(cell.why as never),
          `${row.label}: ${cell.why}`,
        );
        count[cell.on ? 'lockedOn' : 'lockedOff'] += 1;
      }
    });
  }
  console.log(`  cells: ${JSON.stringify(count)}`);
  // 21 rows × 5 columns = 105 cells, for this invitation (every scene filled, one scene of the couple's own).
  // (Pass 2: 18 of the fixed rows' cells are boxes now — the film-led Save the Date keeps E-Gifts a dash — so
  // 33 + 18 boxes; "Live" on the Save the Date and the Camera after the day changed kind with them.)
  assert.deepEqual(count, { box: 51, dash: 11, lockedOn: 19, lockedOff: 15, replyScreens: 9 });
  // The two scene dashes, in the prototype's words; a fixed row's, in its own.
  assert.deepEqual(rowOf(t, 'countdown').cells[COL.editorial], { kind: 'dash', why: 'The countdown ends on the day.' });
  // …and ON the day too: the Countdown has retired by then (`SCENES_RETIRED_ON_THE_DAY`) — a box there would be a tick that draws nothing.
  assert.deepEqual(rowOf(t, 'countdown').cells[COL.event], { kind: 'dash', why: 'The countdown ends on the day.' });
  assert.deepEqual(rowOf(t, 'what_to_bring').cells[COL.editorial], { kind: 'dash', why: 'The day has passed.' });
  // (Pass 2: Live follows the broadcast, not the calendar — on the Save the Date it is a box, no longer "Live opens on the day.")
  assert.equal(rowOf(t, 'live').cells[COL.save_the_date]!.kind, 'box');
  assert.deepEqual(rowOf(t, 'photosofyou').cells[COL.save_the_date], { kind: 'dash', why: 'Photos of you come from the day.' });
  // The fixed rows the page's own gates answer for.
  assert.deepEqual(rowOf(t, 'pass').cells.map((c) => c.kind === 'locked' && c.on), [false, false, true, true, false], 'the ticket is drawn on the Invitation and The Day');
  assert.deepEqual(rowOf(t, 'reply').cells.map((c) => c.kind === 'locked' && c.on), [false, true, true, false, false]);
  /* 🔁 RE-AIMED (pass 2): the Entourage and E-Gifts are boxes now. With nobody in a role the row says so under its
     name (its boxes still say where it stands); "Accept gifts? — No" leaves every gift box empty. */
  assert.equal(rowOf(table(stageWidgets(), { hasEntourage: false }), 'entourage').note, GUESTS_SEE_WORDS.nobodyYet);
  assert.deepEqual(rowOf(table(stageWidgets({ our_photos: { config: { std_lead: 'photos' } } }), { giftsOff: true }), 'gifts').cells.map((c) => (c.kind === 'box' ? c.on : null)), [false, null, false, false, false]);
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
  const pending = guestsSeeToggle(stored, NONE, 'special_message', COL.save_the_date).writes;
  assert.equal(guestsSeeChanges(pending), 1, 'anti-vacuity: a tick is waiting');
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
    /* 🔁 RE-AIMED (pass 2): E-Gifts and Your seat are boxes now, so the rows that are still shown-as-is stand here. */
    ['pass', COL.rsvp, 'This one cannot be changed here yet.'], // a fixed row, shown
    ['announce', COL.save_the_date, 'This one cannot be changed here yet.'], // a fixed row
    ['names', COL.rsvp_screens, 'Names and date are always shown.'],
    ['gifts', COL.rsvp_screens, 'Not on the reply screens yet.'], // a part's RSVP column
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
  // The key: the prototype's words for four of the five; the locked entry says what its tap says.
  assert.deepEqual(
    [GUESTS_SEE_WORDS.legendOn, GUESTS_SEE_WORDS.legendOff, GUESTS_SEE_WORDS.legendPick, GUESTS_SEE_WORDS.legendLocked, GUESTS_SEE_WORDS.legendDash],
    ['Guests see it', 'Hidden', 'Our pick', 'Cannot be changed here yet', 'Not possible yet'],
  );
  assert.ok(GUESTS_SEE_WORDS.locked.toLowerCase().includes(GUESTS_SEE_WORDS.legendLocked.toLowerCase().replace(/^cannot/, 'cannot')), 'the key and the tap line say two different things');
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
  assert.ok(asked >= 28 && on >= 10 && asked - on >= 10, `anti-vacuity: ${asked} cells asked, ${on} ticked`);
});

/** What a guest can SEE of a page: its words and its pictures — not its markup. */
function visible(html: string): string {
  const pictures = [...html.matchAll(/<(?:img|video|source)[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]).join(' ');
  const words = html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return `${words} ¦ ${pictures}`;
}

/** The day each stage is really read on (the fixture's clock is pinned to 10 October 2026). */
const STAGE_DATE: Record<LifecyclePhase, string> = {
  save_the_date: '2027-06-12', // far off
  rsvp: '2026-12-12', // 63 days to go
  event: '2026-10-10', // today
  editorial: '2026-10-01', // behind us
};

test('9 · ONLY BOXES THAT WORK ARE BOXES: flipping every box changes what a guest sees on the real page of its stage', async () => {
  const rows = stageWidgets();
  const t = table(rows);
  const dead: string[] = [];
  let boxes = 0;
  let empty = 0;
  for (const col of GUESTS_SEE_COLUMNS) {
    if (col.stage === null) continue;
    const stage = col.stage;
    const c: StageCase = { stage, reader: 'guest', arrangement: stage === 'save_the_date' ? 'film' : 'plain' };
    const look = withALook(c);
    const more = { ...look, event: { ...look.event!, event_date: STAGE_DATE[stage] } };
    const before = visible((await renderStagePage(c, rows, more)).html);
    for (const row of t.groups.flatMap((g) => g.rows)) {
      const cell = row.cells[COL[col.key]]!;
      if (cell.kind !== 'box' || !row.scene) continue;
      boxes += 1;
      if (!cell.on) empty += 1;
      // The entry a tap would store, taken through the draft exactly as Apply sends it.
      const patch = guestsSeePatch(guestsSeeToggle(t, NONE, row.key, COL[col.key]).writes);
      assert.ok(patch, `${row.label} × ${col.label}: a box whose tap writes nothing`);
      const draft = mergeHubDraft(emptyHubDraft(), JSON.parse(JSON.stringify(patch)));
      const page = await renderStagePage(c, overlayHubDraftWidgets(rows, draft), more);
      assert.deepEqual(page.complaints, []);
      if (visible(page.html) === before) dead.push(`${row.label} × ${col.label} (${cell.on ? 'untick' : 'tick'})`);
    }
  }
  console.log(`  ${boxes} boxes flipped on the real page (${empty} of them empty boxes ticked) · ${dead.length} changed nothing${dead.length ? `: ${dead.join(' · ')}` : ''}`);
  assert.equal(boxes, 33);
  assert.ok(empty >= 10, `anti-vacuity: ${empty} empty boxes`);
  assert.deepEqual(dead, [], 'a box that changes nothing a guest sees must be a dash');
});



/**
 * 10 · THE TABLE LEARNS OF A PART THE CANVAS JUST TOOK OFF (the merged copy's walk, 2026-10-11, M06). A Remove on the
 * page is drawn at the tap and owes no render (the eye holds a hide), so the table the work area holds is the last
 * render's — "Countdown × Invitation is STILL TICKED". The work area hands the sheet what it took off and what the eye
 * stored for it (`guests-see-sheet.tsx` `guestsSeeWorkArea` → `guestsSeeWithRemoved`).
 */
test('10 · a part the canvas just took off: exactly its box is empty, holds what the eye stored, and a tap on it writes what it would after a render', async () => {
  const rows = stageWidgets({});
  const t = table(rows);
  const all = (x: GuestsSeeTable) => x.groups.flatMap((g) => g.rows).flatMap((r) => r.cells.map((c, i) => `${r.key}:${i}:${c.kind === 'box' ? `${c.on}/${c.choice}` : c.kind}`));
  assert.equal((rowOf(t, 'countdown').cells[COL.rsvp] as Extract<GuestsSeeCell, { kind: 'box' }>).on, true, 'anti-vacuity: the Countdown is on the Invitation');
  // Our pick, removed on the Invitation: the eye stored `false`.
  const after = guestsSeeWithRemoved(t, [{ type: 'countdown', stage: 'rsvp', stored: false }]);
  const cell = rowOf(after, 'countdown').cells[COL.rsvp] as Extract<GuestsSeeCell, { kind: 'box' }>;
  assert.deepEqual([cell.on, cell.choice], [false, false], 'M06: the box of the part just removed is still ticked');
  const moved = all(after).filter((c, i) => c !== all(t)[i]);
  assert.equal(moved.length, 1, `the Remove changed ${moved.length} boxes: ${moved.join(' ')}`);
  // It is what the next render brings — the same table the real draft draws.
  const stored = sanitizeHubDraft({ v: 1, events: {}, history: [], widgets: { countdown: { stage_show: { rsvp: false } } } });
  assert.deepEqual(all(after), all(table(overlayHubDraftWidgets(rows, stored))), 'the table laid over is not the table the next render draws');
  // A tap on it brings it back: the choice is taken back (`null`), exactly as after a render.
  assert.deepEqual(guestsSeeToggle(after, NONE, 'countdown', COL.rsvp).writes, { 'countdown:rsvp': null });
  // A part the couple had ADDED to a stage, removed there: the eye took the choice back (`null`) — the box is empty all the same.
  const added = table(stageWidgets({ schedule: show({ save_the_date: true }) }));
  const un = rowOf(guestsSeeWithRemoved(added, [{ type: 'schedule', stage: 'save_the_date', stored: null }]), 'schedule').cells[COL.save_the_date] as Extract<GuestsSeeCell, { kind: 'box' }>;
  assert.deepEqual([un.on, un.choice], [false, null]);
  // Nothing removed → the very same table; an unknown scene or stage moves nothing.
  assert.equal(guestsSeeWithRemoved(t, []), t);
  assert.deepEqual(all(guestsSeeWithRemoved(t, [{ type: 'nothing', stage: 'rsvp', stored: false }, { type: 'countdown', stage: 'lunch', stored: false }])), all(t));
  // …and the sheet reads the work area's table THROUGH it, with the value the eye sent.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const sheet = readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/launch/_components/guests-see-sheet.tsx'), 'utf8');
  assert.match(sheet, /return \{ eventId: raw\.eventId, table: guestsSeeWithRemovedFrom\(table, raw\), door \};/);
  assert.match(sheet, /stored: stageEyeValue\(/);
  assert.match(sheet, /return guestsSeeWithRemoved\(table, removed\);/);
});


/**
 * 11 · THE KEY AND THE OPENING LINE SAY WHAT IS TRUE (the re-walk of 2026-10-11, R03). The pale tick of a row with
 * nothing written had no entry in the key; and a table opened again with a box set by hand read "Nothing changed
 * yet — our picks do the work." under a visibly unticked Message.
 */
test('11 · the opening line: our picks say so; boxes set by hand are counted — and the key explains the pale tick, in the row’s own words', async () => {
  const ours = table(stageWidgets({}));
  assert.equal(guestsSeeHandSet(ours), 0);
  assert.equal(guestsSeeOpeningLine(ours), GUESTS_SEE_WORDS.quiet);
  assert.equal(guestsSeeOpeningLine(null), GUESTS_SEE_WORDS.quiet);
  // One box unticked and applied (M04's table): it is NOT "our picks do the work".
  const one = table(stageWidgets({ special_message: show({ rsvp: false }) }));
  assert.equal(guestsSeeOpeningLine(one), '1 box changed from our picks.');
  const three = table(stageWidgets({ special_message: show({ rsvp: false, save_the_date: true }), schedule: show({ editorial: true }) }));
  assert.equal(guestsSeeOpeningLine(three), '3 boxes changed from our picks.');
  // The count is the one "Back to our picks" announces — one measure, two lines.
  assert.equal(guestsSeeBackToPicks(three, NONE).line, 'Back to our picks. 3 boxes changed — Apply to keep it.');
  assert.equal(guestsSeeHandSet(three), 3);
  // Every word of the new line is the sheet's own.
  for (const word of ['box', 'boxes', 'changed', 'our picks']) assert.ok(Object.values(GUESTS_SEE_WORDS).some((w) => w.includes(word)) || guestsSeeBackToPicks(three, NONE).line.includes(word), `"${word}" is a new word in this sheet`);

  // The pale tick's entry is the first words of the row's own line.
  assert.equal(GUESTS_SEE_WORDS.legendEmpty, 'Nothing written yet');
  assert.ok(GUESTS_SEE_WORDS.emptyNote.startsWith(`${GUESTS_SEE_WORDS.legendEmpty} — `), 'the key and the row say two things');
  assert.equal(guestsSeeHasEmptyRow(ours), false);
  assert.equal(guestsSeeHasEmptyRow(table(stageWidgets({}), { content: { what_to_bring: false } })), true);
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const sheet = readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/launch/_components/guests-see-sheet.tsx'), 'utf8');
  assert.match(sheet, /useState<string>\(\(\) => guestsSeeOpeningLine\(area\?\.table\)\)/);
  assert.match(sheet, /guestsSeeHasEmptyRow\(table\) \? \(\[\[\{ kind: 'box', on: true[^\]]*\}, true, W\.legendEmpty, true\]\]/);
  assert.match(sheet, /<Mark cell=\{cell\} on=\{on\} dim=\{dim === true\} \/>/);
});

/**
 * 12 · A PALE TICK ONLY WHERE THE MAKER HAS A PLACE TO WRITE IT (the re-walk of 2026-10-11, M08). Three pale-ticked
 * boxes had nothing on their stage's canvas — each a place a scene is met OFF the stage's list, which draws nothing
 * while nothing is written. (Open browsing on, the default for a new event.)
 */
test('12 · nothing written: a pale tick where the stage LISTS the scene (its prompt is drawn); off the list, an empty box where a tick can add it — else a dash', () => {
  const rows = stageWidgets({});
  const empty = { our_photos: false, our_love_story: false, what_to_bring: false, dress_code: false } as const;
  const t = table(rows, { content: empty, openBrowse: true });
  const at = (key: string, col: number) => rowOf(t, key).cells[col]!;
  const line = GUESTS_SEE_WORDS.emptyNote;
  // The gallery on a Save the Date its film leads: the film carries it — no scene can stand there (`stdShows`).
  assert.deepEqual(at('our_photos', COL.save_the_date), { kind: 'dash', why: line });
  // The reminders and the dress code on The Day: the Day's Welcome draws them, never the Maker's canvas (`DAY_WELCOME_SCENES`).
  assert.deepEqual(at('what_to_bring', COL.event), { kind: 'dash', why: line });
  assert.deepEqual(at('dress_code', COL.event), { kind: 'dash', why: line });
  // The love story on The Day: its prose stand-in has nothing to tell — an EMPTY box; a tick adds the SCENE there.
  const story = at('our_love_story', COL.event) as Extract<GuestsSeeCell, { kind: 'box' }>;
  assert.deepEqual([story.kind, story.on, story.base, story.ourPick, story.choice], ['box', false, false, false, null]);
  const tick = guestsSeeToggle(t, NONE, 'our_love_story', COL.event);
  assert.deepEqual(tick.writes, { 'our_love_story:event': true });
  assert.equal(tick.line, `Added to The Day.${GUESTS_SEE_WORDS.emptyTail}`);
  const ticked = table(overlayHubDraftWidgets(rows, sanitizeHubDraft({ v: 1, events: {}, history: [], ...JSON.parse(JSON.stringify(guestsSeePatch(tick.writes))) })), { content: empty, openBrowse: true });
  assert.equal((rowOf(ticked, 'our_love_story').cells[COL.event] as Extract<GuestsSeeCell, { kind: 'box' }>).on, true, 'the tick is forgotten');
  // Where the stage LISTS it, the pale tick stays (the Maker draws "Add …" there).
  for (const [key, col] of [['our_love_story', COL.rsvp], ['our_love_story', COL.save_the_date], ['what_to_bring', COL.rsvp], ['our_photos', COL.editorial]] as const) {
    const c = at(key, col) as Extract<GuestsSeeCell, { kind: 'box' }>;
    assert.deepEqual([c.kind, c.on, c.ourPick], ['box', true, true], `${key}: the pale tick on a stage that lists it is gone`);
  }
  // EVERY pale tick is a scene the MAKER lists on that stage — so its prompt is on the canvas. (The whole table.)
  let pale = 0;
  for (const row of t.groups.flatMap((g) => g.rows).filter((r) => r.empty)) {
    row.cells.forEach((c, i) => {
      const stage = GUESTS_SEE_COLUMNS[i]!.stage;
      if (c.kind !== 'box' || !c.on || !stage) return;
      pale += 1;
      assert.equal(sceneOnStage({ widgets: rows, stage, reader: 'guest', openBrowse: true, content: {} }, row.scene!)!.inList, true, `${row.key} × ${stage}: a pale tick with no place on the canvas`);
    });
  }
  assert.ok(pale >= 6, `anti-vacuity: only ${pale} pale ticks`);
  // WRITTEN, each of the three is a ticked box again — a box that works (test 9 flips it on the real page).
  const written = table(rows, { openBrowse: true });
  for (const [key, col] of [['our_photos', COL.save_the_date], ['what_to_bring', COL.event], ['our_love_story', COL.event]] as const) {
    const c = rowOf(written, key).cells[col] as Extract<GuestsSeeCell, { kind: 'box' }>;
    assert.deepEqual([c.kind, c.on], ['box', true], `${key}: written, it is no longer a ticked box`);
  }
});
