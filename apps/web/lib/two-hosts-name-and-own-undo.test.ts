/**
 * 👥 TWO HOSTS — ROUND 3, THE OWNER'S TWO RULINGS (2026-10-18, "do your recommendation"):
 *   A. the note NAMES the person ("Claire changed this a moment ago — showing the newest.");
 *   B. ↺ takes back only YOUR OWN steps; with none of yours left it is greyed.
 * The pure half (`lib/hub-draft-authors.ts`, `hub-draft.ts`'s `by`) run for real, and the wiring pinned on source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { emptyHubDraft, hubDraftCanUndoOwn, mergeHubDraft, sanitizeHubDraft, sanitizeHubDraftPatch, summarizeHubDraft, type HubDraft } from './hub-draft';
import { hubDraftStepAuthorOf, pickHostFirstName, twoScreensNoteFor, undoOwnHubDraftStep } from './hub-draft-authors';
import { hubDraftStamp } from './hub-draft-stamp';
import { TWO_SCREENS_NOTE } from './merge-from-base';

const INDA = '11111111-1111-4111-8111-111111111111';
const CLAIRE = '22222222-2222-4222-8222-222222222222';
const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Indalecio sets the welcome, Claire sets what to bring, Indalecio sets the welcome again. */
function threeSteps(): HubDraft {
  let d = mergeHubDraft(emptyHubDraft(), { events: { special_message: 'Welcome' } }, INDA);
  d = mergeHubDraft(d, { events: { what_to_bring: 'An umbrella' } }, CLAIRE);
  return mergeHubDraft(d, { events: { special_message: 'Welcome, all' } }, INDA);
}

test('the record: each state remembers who made it — kept through the store, never taken from a posted patch', () => {
  const d = threeSteps();
  assert.equal(d.by, INDA);
  assert.deepEqual(d.history.map((h) => h.by), [undefined, INDA, CLAIRE]);
  const read = sanitizeHubDraft(JSON.parse(JSON.stringify(d)));
  assert.equal(read.by, INDA, 'the stored author is lost on read');
  assert.deepEqual(read.history.map((h) => h.by), [undefined, INDA, CLAIRE]);
  assert.equal(sanitizeHubDraftPatch({ events: {}, by: CLAIRE }).by, undefined, 'a client can claim a step is somebody else’s');
  assert.equal(mergeHubDraft(d, { events: { special_message: 'x' } }).by, undefined, 'a step with no author inherited the last one');
  assert.equal(sanitizeHubDraft({ events: {}, widgets: {}, history: [], by: 'not-an-id' }).by, undefined);
});

test('the stamp is of the STATE — who left it does not change it', () => {
  const a = mergeHubDraft(emptyHubDraft(), { events: { special_message: 'Hi' } }, INDA);
  const b = mergeHubDraft(emptyHubDraft(), { events: { special_message: 'Hi' } }, CLAIRE);
  assert.equal(hubDraftStamp(a), hubDraftStamp(b));
});

test('B · ↺ takes back MY newest step and keeps Claire’s later one (before: it took hers)', () => {
  let d = mergeHubDraft(emptyHubDraft(), { events: { special_message: 'Welcome' } }, INDA);
  d = mergeHubDraft(d, { events: { what_to_bring: 'An umbrella' } }, CLAIRE);
  const back = undoOwnHubDraftStep(d, INDA);
  assert.equal(back.events.what_to_bring, 'An umbrella', 'Indalecio’s ↺ took back Claire’s step');
  assert.equal(back.events.special_message, undefined, 'Indalecio’s own step was not taken back');
  assert.equal(back.by, CLAIRE, 'the state left behind lost its author');
  // …and Claire's ↺ still finds hers.
  const hers = undoOwnHubDraftStep(back, CLAIRE);
  assert.deepEqual([hers.events.special_message, hers.events.what_to_bring], [undefined, undefined]);
});

test('B · ↺ never wipes what the other host changed AFTER my step on the same value', () => {
  let d = mergeHubDraft(emptyHubDraft(), { events: { special_message: 'Welcome' } }, INDA);
  d = mergeHubDraft(d, { events: { special_message: 'Welcome, friends' } }, CLAIRE);
  const back = undoOwnHubDraftStep(d, INDA);
  assert.equal(back.events.special_message, 'Welcome, friends', 'my ↺ put my old value back over Claire’s newer one');
});

test('B · the newest own step, several deep: only it goes; every later step keeps its author and its change', () => {
  const back = undoOwnHubDraftStep(threeSteps(), INDA);
  assert.deepEqual([back.events.special_message, back.events.what_to_bring], ['Welcome', 'An umbrella']);
  const again = undoOwnHubDraftStep(back, INDA);
  assert.deepEqual([again.events.special_message, again.events.what_to_bring], [undefined, 'An umbrella']);
  assert.equal(again.by, CLAIRE);
});

test('B · none of mine → ↺ greyed, and a press changes nothing; a step nobody is recorded for stays undoable', () => {
  const hers = mergeHubDraft(emptyHubDraft(), { events: { what_to_bring: 'Shades' } }, CLAIRE);
  assert.equal(hubDraftCanUndoOwn(hers, INDA), false);
  assert.equal(hubDraftCanUndoOwn(hers, CLAIRE), true);
  assert.deepEqual(undoOwnHubDraftStep(hers, INDA), hers);
  const live = { events: {}, widgets: {} } as unknown as Parameters<typeof summarizeHubDraft>[1];
  assert.equal(summarizeHubDraft(hers, live, false, INDA).canUndo, false, 'the bar offers ↺ on a draft of only Claire’s steps');
  const older = mergeHubDraft(emptyHubDraft(), { events: { what_to_bring: 'Shades' } });
  assert.equal(hubDraftCanUndoOwn(older, INDA), true, 'a draft from before the record strands its ↺');
  assert.equal(hubDraftCanUndoOwn(hers, undefined), true, 'the lab (no account) lost ↺');
});

test('A · whose change a save met: the newest step that touched what the screen must now show', () => {
  const d = threeSteps();
  assert.deepEqual(hubDraftStepAuthorOf(d, { events: { what_to_bring: 'An umbrella' } }), { found: true, by: CLAIRE });
  assert.deepEqual(hubDraftStepAuthorOf(d, { events: { special_message: 'Welcome, all' } }), { found: true, by: INDA });
  assert.deepEqual(hubDraftStepAuthorOf(d, { events: { venue_name: 'x' } as never }), { found: false });
});

test('A · the words: a name · your own other screen · nobody the draft knows', () => {
  assert.equal(twoScreensNoteFor({ self: false, name: 'Claire' }), 'Claire changed this a moment ago — showing the newest.');
  assert.equal(twoScreensNoteFor({ self: true }), TWO_SCREENS_NOTE);
  assert.equal(twoScreensNoteFor({ self: false, name: null }), 'Someone changed this a moment ago — showing the newest.');
  assert.equal(pickHostFirstName({ guestFirst: ' Claire ', userFirst: 'Clarissa' }), 'Claire', 'the event’s own name for her loses to her profile');
  assert.equal(pickHostFirstName({ userDisplay: 'Claire Santos' }), 'Claire');
  assert.equal(pickHostFirstName({ userDisplay: 'claire@mail.test' }), null, 'an email address was shown as a name');
});

test('wiring: the one action records the author on every step, undoes only the host’s own, and names the other', () => {
  const a = src('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(a, /const me = await requireHostMembershipOrThrow\(eventId, FORBIDDEN\)/);
  assert.match(a, /undoOwnHubDraftStep\(cur, me\)/, '↺ is not the own-step undo');
  assert.doesNotMatch(a, /undoHubDraft\(/, 'the action still steps back whoever made the step');
  assert.match(a, /mergeHubDraft\(c, rebased\.patch, by\)/, 'a save does not record who made it');
  assert.match(a, /mergeHubDraft\(cur, hubResetPatch\(scope\), by\)/, 'a reset does not record who made it');
  assert.match(a, /hubDraftStepAuthorOf\(c, rebased\.merged\)/);
  assert.match(a, /hostFirstName\(eventId, met\.by\)/, 'the note does not name the person');
  assert.match(a, /hubDraftBarAfterSave\(supabase, eventId, next, me\)/, 'the bar after a save greys ↺ for the wrong person');
  const store = src('lib/hub-draft-store.ts');
  assert.match(store, /const built = await build\(row\.draft, by\)/, 'the one door does not hand the author to its builders');
  assert.match(store, /mergeHubDraft\(current, rebased\.patch, by\)/, 'the existing writers’ draft saves do not record who made them');
  // 🍎 `proShell` = the store shell minus Apple In-App Purchase (rd/in-app-purchase, 2026-10-18).
  assert.match(store, /summarizeHubDraft\(draft, live, ownsPro && !proShell, me\)/, 'the render’s bar does not know whose steps are whose');
});
