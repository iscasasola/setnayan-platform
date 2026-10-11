import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyHubDraft, type HubDraft } from '@/lib/hub-draft';
import { stageOrderPatch } from '@/lib/maker-reorder';
import {
  LAB_APPLY_MESSAGE,
  LAB_BAR_COOKIE,
  LAB_ROWS_COOKIE,
  labBarFromCookie,
  labDraftCookies,
  labDraftFrom,
  labDraftStep,
  labDraftedRows,
  labRows,
} from './lab-draft';
import { labStageTiles } from './lab-navigator';

/**
 * 🧪 THE LAB'S DRAFT IS THE REAL DRAFT (the walk of 2026-10-11, P01 · P02 · P05).
 *
 * The tester's steps, on the lab's own door, with no browser: three changes and ↺ three times; Later then Earlier;
 * Remove then ＋; a change made and unmade. Each asserts what a signed-in couple's draft does, because the lab runs the
 * same reducers (`lab-draft.ts`) — a lab that counts calls instead fails every one of these.
 */

const save = (d: HubDraft, patch: unknown, bar = true) => labDraftStep(d, { intent: 'save', patch: JSON.stringify(patch), ...(bar ? { bar: '1' } : {}) }, false);
const count = (d: HubDraft) => labBarFromCookie(labDraftCookies(d, false)[LAB_BAR_COOKIE] ?? undefined);
const SERIF = { fixedStyles: { hero_eyebrow: 'serif' } };
const TITLE = { widgets: { hero: { canvas: { elements: { eyebrow: { word: 'With joy, we invite you' } } } } } };
const FADE = { widgets: { countdown: { canvas: { inFx: { fade: true } } } } };

test('P01 — three changes, then ↺ three times: each is undone, newest first, and the ✓ count goes 3 → 2 → 1 → 0', () => {
  let d = emptyHubDraft();
  for (const patch of [SERIF, TITLE, FADE]) d = save(d, patch).draft;
  assert.equal(count(d).changeCount, 3);
  assert.equal(count(d).canUndo, true);

  const cookiesAt = [labDraftCookies(d, false)];
  const seen: number[] = [];
  for (let i = 0; i < 3; i++) {
    const step = labDraftStep(d, { intent: 'undo' }, false);
    assert.equal(step.result.ok, true);
    d = step.draft;
    seen.push(count(d).changeCount);
    cookiesAt.push(labDraftCookies(d, false));
  }
  assert.deepEqual(seen, [2, 1, 0], 'the count did not step back one change at a time');
  /* The page follows: ↺ 1 takes the Fade off the Countdown, ↺ 2 the typed Title, ↺ 3 the Serif. */
  assert.match(decodeURIComponent(cookiesAt[0]!.lab_widgets ?? ''), /countdown/);
  assert.doesNotMatch(decodeURIComponent(cookiesAt[1]!.lab_widgets ?? ''), /countdown/);
  assert.match(decodeURIComponent(cookiesAt[1]!.lab_widgets ?? ''), /With joy, we invite you/);
  assert.equal(cookiesAt[2]!.lab_widgets, null, 'the typed Title is still handed to the page after its undo');
  assert.match(decodeURIComponent(cookiesAt[2]!.lab_styles ?? ''), /serif/);
  assert.equal(cookiesAt[3]!.lab_styles, null);
  assert.equal(count(d).canUndo, false, '↺ is still offered with nothing left to undo');
  assert.equal(cookiesAt[3]![LAB_BAR_COOKIE], null);
});

test('P05 — the count is the changes that differ from what guests see, never the taps', () => {
  let d = save(emptyHubDraft(), FADE).draft;
  assert.equal(count(d).changeCount, 1);
  /* Un-picking Fade puts the scene back as guests have it: no change is waiting. */
  d = save(d, { widgets: { countdown: { canvas: {} } } }).draft;
  assert.equal(count(d).changeCount, 0, 'a change made and unmade still counts');
  assert.equal(count(d).canUndo, true, 'the two steps can still be undone');
});

test('P05 — a save answers with the bar only when it asks for it, as the real save does', () => {
  const asked = save(emptyHubDraft(), SERIF, true).result;
  const plain = save(emptyHubDraft(), SERIF, false).result;
  assert.ok(asked.ok && asked.bar && asked.bar.free.changeCount === 1 && asked.bar.free.changes?.length === 1);
  assert.ok(plain.ok && plain.bar === undefined);
});

/** The Invitation's scenes as the Maker lists them and its canvas draws them (`lab-navigator.ts`), by type. */
const invitation = (d: HubDraft) =>
  labStageTiles(labDraftedRows(labDraftCookies(d, false)[LAB_ROWS_COOKIE] ?? undefined), 'rsvp')
    .filter((k) => k.startsWith('w:') && k !== 'w:what_to_bring')
    .map((k) => k.slice(2));
/** The Maker's own move: the stage's WHOLE order in one save (`lib/maker-reorder.ts`). */
const move = (d: HubDraft, order: string[]) => save(d, stageOrderPatch(order.map((t) => `w-${t}`), (id) => id.slice(2), 'rsvp'), false).draft;

test('P02 — Later moves the Message one place down on the page, Earlier moves it back', () => {
  const start = invitation(emptyHubDraft());
  assert.deepEqual(start, ['countdown', 'special_message', 'our_love_story', 'schedule', 'venue_map', 'dress_code']);
  const later = move(emptyHubDraft(), ['countdown', 'our_love_story', 'special_message', 'schedule', 'venue_map', 'dress_code']);
  assert.deepEqual(invitation(later), ['countdown', 'our_love_story', 'special_message', 'schedule', 'venue_map', 'dress_code']);
  assert.equal(count(later).changeCount > 0, true);
  const back = move(later, start);
  assert.deepEqual(invitation(back), start);
  /* ↺ after the two moves: the page is where Later left it. */
  assert.deepEqual(invitation(labDraftStep(back, { intent: 'undo' }, false).draft), invitation(later));
});

test('P02 — Remove takes the Message off the page; ＋ (the eye again) brings it back in place', () => {
  const removed = save(emptyHubDraft(), { widgets: { special_message: { is_visible: false } } }).draft;
  assert.equal(invitation(removed).includes('special_message'), false, 'a removed scene is still drawn');
  assert.equal(count(removed).changeCount, 1);
  const back = save(removed, { widgets: { special_message: { is_visible: true } } }).draft;
  assert.deepEqual(invitation(back), invitation(emptyHubDraft()));
  assert.equal(count(back).changeCount, 0);
});

test('leaving and coming back keeps the draft — its count, its history and what the page draws', () => {
  let d = emptyHubDraft();
  for (const patch of [SERIF, TITLE]) d = save(d, patch).draft;
  const kept = labDraftFrom(JSON.stringify(d));
  assert.deepEqual(labDraftCookies(kept, false), labDraftCookies(d, false));
  assert.equal(count(kept).changeCount, 2);
  assert.equal(labDraftStep(kept, { intent: 'undo' }, false).draft.history.length, 1);
  /* Nothing stored, or something unreadable, is no draft — never a throw. */
  assert.deepEqual(labDraftFrom(null), emptyHubDraft());
  assert.deepEqual(labDraftFrom('{not json'), emptyHubDraft());
});

test('Restore throws the draft away; Reset goes into it and can be undone; Apply says the sample cannot go live', () => {
  const d = save(emptyHubDraft(), FADE).draft;
  const restored = labDraftStep(d, { intent: 'restore' }, false);
  assert.deepEqual(restored.draft, emptyHubDraft());
  assert.ok(Object.values(labDraftCookies(restored.draft, false)).every((v) => v === null), 'a cookie outlived Restore');

  const reset = labDraftStep(d, { intent: 'reset', stage: 'rsvp' }, false);
  assert.equal(reset.result.ok, true);
  assert.deepEqual(labDraftStep(reset.draft, { intent: 'undo' }, false).draft.widgets, d.widgets);
  assert.equal(labDraftStep(d, { intent: 'reset', stage: 'nowhere' }, false).result.ok, false);

  const apply = labDraftStep(d, { intent: 'apply' }, false);
  assert.deepEqual(apply.result, { ok: false, intent: 'apply', error: LAB_APPLY_MESSAGE });
  assert.equal(apply.draft, d, 'a refused step changed the draft');
  assert.doesNotMatch(LAB_APPLY_MESSAGE, /celebration|website|\bsite\b/i);
});

test('the Scrub chain is its own draft: its start is what guests "see", so opening it counts nothing', () => {
  const none = labDraftCookies(emptyHubDraft(), true);
  assert.equal(none[LAB_BAR_COOKIE], null);
  const d = labDraftStep(emptyHubDraft(), { intent: 'save', patch: JSON.stringify({ widgets: { countdown: { canvas: { out: 'none' } } } }) }, true).draft;
  const c = labDraftCookies(d, true);
  assert.ok(c.lab_widgets_scrub, 'the chain saved to the ordinary jar');
  assert.equal(c.lab_widgets, undefined);
});

/* ── wiring: the lab's shell and pages really go through this file ─────────────────────────────────────────────── */

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'app', 'dev', 'maker-lab', ...p), 'utf8');

test('the lab keeps no draft arithmetic of its own — one door, and the bar is handed it', () => {
  const shell = read('maker-lab-shell.tsx');
  assert.doesNotMatch(shell, /labChanges|labPro\b|labSummary/, 'the call counter is back');
  assert.match(shell, /labDraftStep\(/);
  assert.match(shell, /labDraftCookies\(/);
  /* ↺ · ✓ · Restore · Reset go to the lab's door too — never to the real server action with a made-up event. */
  assert.match(shell, /<HubDraftToolbar[^>]*draftAction=\{labDraft\}/);
  const page = read('page.tsx');
  assert.match(page, /labDraftedRows\(/, 'the Maker is handed the sample rows without the draft over them');
  assert.match(page, /labBarFromCookie\(/, 'the lab render reports no draft');
  const guest = read('guest', 'page.tsx');
  assert.match(guest, /const labRowsNow = labDraftedRows\(/, 'the canvas ignores the draft’s order');
  assert.match(guest, /const stageTiles = labStageTiles\(labRowsNow, stageNow, labStory\);/, 'the canvas draws a list of its own');
  assert.match(guest, /<LabStagePages\s+stage=\{stageNow\}\s+tiles=\{stageTiles\}/);
  assert.equal(labRows().length, 16);
});
