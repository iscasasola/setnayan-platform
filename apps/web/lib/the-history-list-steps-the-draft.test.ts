/**
 * ↺ THE HISTORY LIST STEPS THE DRAFT — Build 6 Lane F, ruling 5 (owner 2026-11-09 "↺ BECOMES A HISTORY LIST",
 * 2026-11-10 "ALL YES": stepped-past rows stay greyed until the next edit). `lib/hub-draft-history.ts`.
 *
 * The draft semantics, proved on the draft itself — no database, no browser:
 *   1 · a tap on an earlier row returns the page to it; the rows passed stay GREYED (ahead)
 *   2 · a tap on a greyed row goes forward again (redo)
 *   3 · the next edit drops the greyed rows; editing continues from the point tapped
 *   4 · every Apply leaves a "Published <time>" row — the last row, "What guests see now"
 *   5 · two hosts: a tap returns only across YOUR steps; behind the other host's newer edit only yours are taken back
 *   6 · an old draft (no times, no greyed rows, no Published) still loads and lists its rows, with no time
 *   7 · the list never forgets "What guests see now" when the oldest edits drop
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HUB_DRAFT_FOLDED_SAID,
  HUB_DRAFT_HISTORY_LIMIT,
  emptyHubDraft,
  hubDraftForWrite,
  mergeHubDraft,
  sanitizeHubDraft,
  type HubDraft,
  type HubDraftPatch,
} from './hub-draft';
import {
  HUB_DRAFT_GUESTS_SEE_NOW,
  hubDraftHistoryRows,
  hubDraftTapOf,
  hubDraftTimeline,
  hubDraftTimelineIndexOf,
  jumpHubDraft,
} from './hub-draft-history';
import { undoOwnHubDraftStep } from './hub-draft-authors';
import { draftLeftAfterApply } from './hub-draft-rebase';
import { hubDraftStamp } from './hub-draft-stamp';
import { labLive } from '../app/dev/maker-lab/lab-draft';

const live = labLive(false);
const ME = '11111111-1111-4111-8111-111111111111';
const CLAIRE = '22222222-2222-4222-8222-222222222222';

/** A hide of one scene on one stage — a step the Apply sheet names ("Countdown · Hidden on Post Event"). */
const hide = (type: string, stage = 'editorial'): HubDraftPatch => ({ widgets: { [type]: { stage_show: { [stage]: false } } } }) as HubDraftPatch;
/** The draft as the row hands it back (a JSON round trip through the one reader). */
const stored = (d: HubDraft): HubDraft => sanitizeHubDraft(JSON.parse(JSON.stringify(hubDraftForWrite(d))));
const t = (min: number) => `2026-11-12T07:${String(min).padStart(2, '0')}:00.000Z`;

/** Three edits by `by`, at 7:41, 7:50, 7:52. */
function threeEdits(by?: string): HubDraft {
  let d = emptyHubDraft();
  d = stored(mergeHubDraft(d, hide('countdown'), by, t(41)));
  d = stored(mergeHubDraft(d, hide('dress_code'), by, t(50)));
  d = stored(mergeHubDraft(d, hide('our_photos'), by, t(52)));
  return d;
}
const where = (d: HubDraft, me?: string) => hubDraftHistoryRows(d, live, me).map((r) => r.where);
const shows = (d: HubDraft, type: string) => (d.widgets as Record<string, { stage_show?: Record<string, unknown> }>)[type]?.stage_show?.editorial === false;

test('each edit is a row, newest first, with its plain label and its time; the last row is what guests see now', () => {
  const rows = hubDraftHistoryRows(threeEdits(), live);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.at), [t(52), t(50), t(41), null]);
  assert.match(rows[0]!.what, /·/, `a step is named in the Apply sheet's words: "${rows[0]!.what}"`);
  assert.notEqual(rows[0]!.what, rows[1]!.what, 'two different edits read the same');
  assert.equal(rows[3]!.base, true);
  assert.equal(rows[3]!.what, HUB_DRAFT_GUESTS_SEE_NOW);
  assert.deepEqual(rows.map((r) => r.where), ['here', 'behind', 'behind', 'behind']);
  assert.equal(rows[0]!.tap, 'none', 'the row the page is at cannot be tapped');
});

test('1 · a tap on an earlier row returns the page to it; the rows passed stay greyed', () => {
  const d = threeEdits();
  const back = stored(jumpHubDraft(d, 1));
  assert.equal(shows(back, 'countdown'), true);
  assert.equal(shows(back, 'dress_code'), false, 'the later edits are still on the page');
  assert.equal(shows(back, 'our_photos'), false);
  assert.equal(back.ahead?.length, 2, 'the rows stepped past were dropped, not greyed');
  assert.deepEqual(where(back), ['ahead', 'ahead', 'here', 'behind']);
  assert.deepEqual(hubDraftHistoryRows(back, live).slice(0, 2).map((r) => r.at), [t(52), t(50)], 'a greyed row lost its time');
  // The greyed rows survive a write and a read (they are the redo, kept in the draft itself).
  assert.equal(stored(back).ahead?.length, 2);
});

test('2 · a tap on a greyed row goes forward again (redo) — one row, or all the way', () => {
  const d = threeEdits();
  const back = stored(jumpHubDraft(d, 1));
  const one = stored(jumpHubDraft(back, 2));
  assert.equal(shows(one, 'dress_code'), true);
  assert.equal(shows(one, 'our_photos'), false);
  assert.deepEqual(where(one), ['ahead', 'here', 'behind', 'behind']);
  const all = stored(jumpHubDraft(back, 3));
  assert.equal(all.ahead, undefined, 'forward to the newest leaves nothing greyed');
  assert.equal(hubDraftStamp(all), hubDraftStamp(d), 'redo did not give back the same page');
  assert.deepEqual(hubDraftHistoryRows(all, live).map((r) => r.what), hubDraftHistoryRows(d, live).map((r) => r.what));
});

test('3 · the next edit drops the greyed rows, and editing continues from the point tapped', () => {
  const back = stored(jumpHubDraft(threeEdits(), 1));
  const edited = stored(mergeHubDraft(back, hide('schedule'), undefined, t(55)));
  assert.equal(edited.ahead, undefined, 'the greyed rows outlived the next edit');
  assert.equal(shows(edited, 'countdown') && shows(edited, 'schedule'), true);
  assert.equal(shows(edited, 'dress_code'), false, 'a dropped edit came back');
  assert.deepEqual(hubDraftHistoryRows(edited, live).map((r) => r.at), [t(55), t(41), null]);
});

test('4 · every Apply leaves a "Published <time>" row — the last row, what guests see now', () => {
  const d = threeEdits();
  const published = draftLeftAfterApply(d, { v: 1, events: {}, widgets: {}, history: [] }, d, t(53));
  const rows = hubDraftHistoryRows(stored(published), live);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0]!.what, rows[0]!.pub, rows[0]!.base, rows[0]!.at, rows[0]!.where], ['Published', true, true, t(53), 'here']);
  // The next edit sits on top of it; the Published row stays the last.
  const next = stored(mergeHubDraft(stored(published), hide('countdown'), undefined, t(58)));
  const after = hubDraftHistoryRows(next, live);
  assert.deepEqual(after.map((r) => [r.pub, r.at]), [[false, t(58)], [true, t(53)]]);
  // A tap on it returns the page to what guests see — and the edit stays greyed.
  const toGuests = stored(jumpHubDraft(next, 0));
  assert.equal(shows(toGuests, 'countdown'), false);
  assert.equal(toGuests.ahead?.length, 1);
  // A second Apply is a new "Published" row.
  const again = draftLeftAfterApply(next, { v: 1, events: {}, widgets: {}, history: [] }, next, t(59));
  assert.deepEqual(hubDraftHistoryRows(stored(again), live).map((r) => [r.what, r.at]), [['Published', t(59)]]);
});

test('5 · two hosts — a tap returns only across YOUR edits; behind the other host’s newer edit only yours go', () => {
  let d = emptyHubDraft();
  d = stored(mergeHubDraft(d, hide('countdown'), ME, t(41)));
  d = stored(mergeHubDraft(d, hide('dress_code'), CLAIRE, t(45)));
  d = stored(mergeHubDraft(d, hide('our_photos'), ME, t(50)));
  // Every row is listed; Claire's is marked hers.
  const mine = hubDraftHistoryRows(d, live, ME);
  assert.deepEqual(mine.map((r) => r.theirs), [false, true, false, false]);
  // One row back (across my own newest edit): an exact step, greyed redo.
  assert.equal(hubDraftTapOf(d, 2, ME), 'go');
  const oneBack = stored(jumpHubDraft(d, 2, ME));
  assert.equal(oneBack.ahead?.length, 1);
  assert.equal(shows(oneBack, 'dress_code'), true, "Claire's edit was taken back");
  // Behind Claire's edit: only mine are taken back — hers stays — and nothing is left greyed.
  assert.equal(hubDraftTapOf(d, 0, ME), 'mine');
  const toStart = stored(jumpHubDraft(d, 0, ME));
  assert.equal(shows(toStart, 'dress_code'), true, "my tap took back Claire's edit (ruling B)");
  assert.equal(shows(toStart, 'countdown') || shows(toStart, 'our_photos'), false, 'my own edits were not taken back');
  assert.equal(toStart.ahead, undefined);
  // Claire: behind MY newer edit she may take back only hers; a row with only my edits after it cannot be tapped.
  assert.equal(hubDraftTapOf(d, 2, CLAIRE), 'none', 'Claire could take back only my edit');
  assert.equal(hubDraftTapOf(d, 0, CLAIRE), 'mine');
  const hers = stored(jumpHubDraft(d, 0, CLAIRE));
  assert.equal(shows(hers, 'dress_code'), false, "Claire's tap did not take back her edit");
  assert.equal(shows(hers, 'countdown') && shows(hers, 'our_photos'), true, "Claire's tap took back mine");
  assert.equal(jumpHubDraft(d, 2, CLAIRE), d, 'a tap that may do nothing changed the draft');
  const rowsForClaire = hubDraftHistoryRows(d, live, CLAIRE);
  assert.deepEqual(rowsForClaire.map((r) => [r.theirs, r.tap]), [[true, 'none'], [false, 'none'], [true, 'mine'], [false, 'mine']]);
  // ↺'s own single step (the drawn undo) follows the same rule: my newest is mine → greyed redo.
  assert.equal(stored(undoOwnHubDraftStep(d, ME)).ahead?.length, 1);
});

test('a tap names its STATE: the list drawn before another screen saved still reaches the row it showed', () => {
  const d = threeEdits();
  const rows = hubDraftHistoryRows(d, live);
  const tapped = rows[2]!; // the 7:41 edit
  // Another screen adds an edit before the tap lands — positions are unchanged, but the newest moved.
  const moved = stored(mergeHubDraft(d, hide('schedule'), undefined, t(53)));
  assert.equal(hubDraftTimelineIndexOf(moved, tapped.stamp, tapped.i), tapped.i);
  // A state no longer in the history is not guessed at.
  assert.equal(hubDraftTimelineIndexOf(moved, 'nope', 1), -1);
});

test('6 · an old draft — no times, no greyed rows, no Published — loads and lists its rows without a time', () => {
  const now = threeEdits();
  const strip = (s: object) => Object.fromEntries(Object.entries(s).filter(([k]) => !['at', 'said', 'pub', 'by'].includes(k)));
  const old = { ...strip(now), v: 1, history: now.history.map(strip) };
  const d = sanitizeHubDraft(JSON.parse(JSON.stringify(old)));
  const rows = hubDraftHistoryRows(d, live);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.at), [null, null, null, null]);
  assert.deepEqual(rows.map((r) => r.what), hubDraftHistoryRows(now, live).map((r) => r.what), 'an old draft lost its labels');
  // …and still steps.
  assert.equal(shows(stored(jumpHubDraft(d, 1)), 'dress_code'), false);
  // No draft at all: one row, what guests see now.
  assert.deepEqual(hubDraftHistoryRows(null, null).map((r) => r.what), [HUB_DRAFT_GUESTS_SEE_NOW]);
});

test('7 · past the ten-state limit the oldest edits fold into "Earlier edits" — "What guests see now" stays the last row', () => {
  let d = emptyHubDraft();
  const types = ['countdown', 'dress_code', 'our_photos', 'schedule', 'what_to_bring', 'venue_map', 'event_details', 'special_message', 'our_love_story', 'countdown', 'dress_code', 'our_photos'];
  types.forEach((type, i) => {
    d = stored(mergeHubDraft(d, hide(type, i < 9 ? 'editorial' : 'rsvp'), undefined, t(10 + i)));
  });
  const { states } = hubDraftTimeline(d);
  assert.equal(d.history.length, HUB_DRAFT_HISTORY_LIMIT);
  const rows = hubDraftHistoryRows(d, live);
  assert.equal(rows.at(-1)!.what, HUB_DRAFT_GUESTS_SEE_NOW);
  assert.equal(rows.at(-2)!.what, HUB_DRAFT_FOLDED_SAID);
  assert.equal(states.length, HUB_DRAFT_HISTORY_LIMIT + 1);
  // A tap on the last row is still what guests see: nothing drafted.
  const toGuests = stored(jumpHubDraft(d, 0));
  assert.deepEqual([toGuests.events, toGuests.widgets], [{}, {}]);
});

test('time, words and greyed rows are never part of the state: the same page has the same stamp', () => {
  const d = threeEdits();
  const back = jumpHubDraft(d, 1);
  const again = jumpHubDraft(stored(back), 3);
  assert.equal(hubDraftStamp(again), hubDraftStamp(d));
  const sameEditLater = mergeHubDraft(emptyHubDraft(), hide('countdown'), undefined, t(59));
  assert.equal(hubDraftStamp(sameEditLater), hubDraftStamp(mergeHubDraft(emptyHubDraft(), hide('countdown'), undefined, t(1))));
});
