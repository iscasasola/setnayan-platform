/**
 * 📷 GUARD — HOME'S PAPIC CARD HEAD IS ONE DROPDOWN: OFF · ON — EVENT DAY · ON — EVERYONE, NOW.
 *
 * Owner, 2026-10-30: *"actually the switch on event home should be the let everybody shoot now function"* · *"of papic
 * on papic's widget with that toggle switch"* — then, told Home would lose its Papic off switch: *"If we cannot turn it
 * off, then maybe assign partial turn on?"*.
 *
 * ⚡ UPDATED ON PURPOSE 2026-11-22 — LIVE, NO APPLY (owner, specs DECISION_LOG "THE PAPIC DROPDOWN IN MEMORIES IS LIVE — NO
 * APPLY": *"No need to apply. Just go to memories and change the papic drop down there"*). The 30 Oct rule this guard
 * held — `papic_on` through the Event Hub draft, live only after Apply — is SUPERSEDED, and the guard now holds the new
 * one just as hard: one live write, the drafted value cleared, no "after you Apply".
 *
 *   (1) the three positions → the two columns (executed): Off → `papic_on` false (early untouched); On — event day →
 *       `papic_on` true + `papic_guest_capture_early` false; On — everyone, now → both true; no line says "after you
 *       Apply", and an unread fact says "Couldn’t check";
 *   (2) BOTH columns go LIVE in ONE write through the shipped `setPapicGuestCaptureEarly` (no new action, never the
 *       draft), hosts only; that write clears the `papic_on` waiting in the draft and re-renders Memories, the couple's
 *       pages and the Event Hub;
 *   (3) ONE control per fact — one `PickMenu` in the head, no second shoot-now control and no Papic switch on the card;
 *   (4) Event Details › Photos from guests still sets `papic_on` (the same draft column);
 *   (5) SABOTAGE — each check fails on the defect it is written for.
 *
 * Source checks read comment-stripped code (`stripComments`), anchored per component and counted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PAPIC_HEAD_OPTIONS, papicHeadLine, papicHeadPosition, papicHeadWrites } from '@/lib/papic-shoot-now';
import { papicGuestCamerasLines } from '@/lib/papic-guest-cameras-line';
import { HUB_DRAFT_ANSWER_COLUMNS } from '@/lib/hub-draft';
import { placePickList } from './website/editor/_components/pick-menu-place';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? []).length;

// 🔁 UPDATED ON PURPOSE 2026-11-08 (THE ONE BUILD, owner: "Papic + Thank You into Memories"): the card moved whole
// from Home to Memories; the one-dropdown rule is read where the card is built now — NOT WEAKENED.
const HOME = 'app/dashboard/[eventId]/memories/page.tsx';
const COMPONENTS = 'app/dashboard/[eventId]/studio/papic/_components';
const SETTINGS = `${COMPONENTS}/papic-camera-settings.tsx`;
const PICKER = `${COMPONENTS}/papic-head-picker.tsx`;
const ACTION = 'app/dashboard/[eventId]/studio/papic/guest-window-actions.ts';
const CARD = 'app/dashboard/[eventId]/_components/papic-home-card.tsx';
const DETAILS = 'app/dashboard/[eventId]/details/page.tsx';
const ANSWERS = 'app/dashboard/[eventId]/launch/_components/details-answers-parts.tsx';

/** The body of one exported function, up to the next top-level export. */
function fn(src: string, name: string): string {
  const at = src.search(new RegExp(`export (async )?function ${name}\\b`));
  assert.ok(at >= 0, `premise: ${name} exists`);
  const next = src.indexOf('\nexport ', at + 10);
  return src.slice(at, next === -1 ? undefined : next);
}

/** Home's Papic card input — the block the card is built from. */
function homeCard(src = code(HOME)): string {
  const at = src.indexOf('const card: PapicCardInput = {');
  assert.ok(at > 0, 'premise: Memories builds the Papic card');
  return src.slice(at, src.indexOf('papicCard = <PapicCard', at));
}

test('(1) three positions → two columns, and an honest line (executed)', () => {
  assert.deepEqual(
    PAPIC_HEAD_OPTIONS.map((o) => [o.key, o.label]),
    [
      ['off', 'Off'],
      ['eventday', 'On — event day'],
      ['now', 'On — everyone, now'],
    ],
  );
  const onDay = { on: true, early: false };
  const off = { on: false, early: false };
  // Off → papic_on false; the early column is never touched by Off.
  assert.deepEqual(papicHeadWrites('off', onDay), { papic_on: false });
  assert.deepEqual(papicHeadWrites('off', { on: true, early: true }), { papic_on: false });
  // On — event day → papic_on true (only when it was off) + early false (only when it was on).
  assert.deepEqual(papicHeadWrites('eventday', off), { papic_on: true });
  assert.deepEqual(papicHeadWrites('eventday', { on: false, early: true }), { papic_on: true, papic_guest_capture_early: false });
  assert.deepEqual(papicHeadWrites('eventday', { on: true, early: true }), { papic_guest_capture_early: false });
  // On — everyone, now → papic_on true + early true.
  assert.deepEqual(papicHeadWrites('now', off), { papic_on: true, papic_guest_capture_early: true });
  assert.deepEqual(papicHeadWrites('now', onDay), { papic_guest_capture_early: true });
  // Positions from the LIVE facts.
  assert.equal(papicHeadPosition({ live: false, early: true }), 'off');
  assert.equal(papicHeadPosition({ live: true, early: false }), 'eventday');
  assert.equal(papicHeadPosition({ live: true, early: true }), 'now');
  assert.equal(papicHeadPosition({ live: null, early: true }), null);
  assert.equal(papicHeadPosition({ live: true, early: null }), null);
  // The line — live, so it never waits for Apply.
  assert.equal(papicHeadLine({ live: false, early: false }), 'Off');
  assert.equal(papicHeadLine({ live: false, early: true }), 'Off');
  assert.equal(papicHeadLine({ live: true, early: false }), 'On the event day');
  assert.equal(papicHeadLine({ live: true, early: true }), 'Guests can shoot now');
  const dates = { eventDate: '2026-12-18', windowStart: '2026-12-18T00:00:00+08:00', windowEnd: '2026-12-19T11:59:59+08:00' };
  for (const f of [
    { live: false, early: false },
    { live: true, early: false },
    { live: true, early: true },
    { live: true, early: null },
    { live: null, early: true },
  ]) {
    // Short enough for one line beside the 96 px control at 390 px — no lone "day" (owner-approved 2026-10-30).
    assert.ok(papicHeadLine(f).length <= 23, `"${papicHeadLine(f)}" is too long for one line beside the head's control`);
    assert.doesNotMatch(papicHeadLine(f), /Apply/, 'the head still waits for Apply');
    const lines = papicGuestCamerasLines(f, dates, Date.parse('2026-11-22T10:00:00+08:00'));
    for (const line of [lines.now, ...Object.values(lines.byHead)]) assert.doesNotMatch(line, /Apply/, 'the guests’ line still waits for Apply');
  }
  assert.match(papicHeadLine({ live: true, early: null }), /Couldn’t check/);
  assert.match(papicHeadLine({ live: null, early: true }), /Couldn’t check/);
});

function checkDoors(picker: string, action: string): void {
  // ⚡ ONE live write for both columns, through the shipped action, in place — never the Event Hub draft.
  assert.equal(count(picker, /papicSaveInPlace\('setPapicGuestCaptureEarly', fd\)/), 1, 'the pick is not saved through setPapicGuestCaptureEarly, once');
  assert.match(picker, /if \(writes\.papic_on !== undefined\) fd\.set\('papic_on', writes\.papic_on \? '1' : '0'\);/, 'papic_on does not ride the live write');
  assert.match(picker, /if \(writes\.papic_guest_capture_early !== undefined\) fd\.set\('early', writes\.papic_guest_capture_early \? '1' : '0'\);/);
  assert.doesNotMatch(picker, /hubDraftAction|makerSave/, 'papic_on still goes through the Event Hub draft — it waits for Apply again');
  assert.doesNotMatch(picker, /\.from\('events'\)/, 'the picker writes the table itself instead of the checked action');
  // The action: hosts only, both columns in one update, an error and an empty write both refused.
  assert.match(action, /\.eq\('member_type', 'couple'\)[\s\S]{0,200}if \(!membership\) redirect\(back\);[\s\S]{0,400}\.update\(\{\s*\.\.\.\(writeEarly \? \{ papic_guest_capture_early: early \} : \{\}\),\s*\.\.\.\(papicOn !== null \? \{ papic_on: papicOn \} : \{\}\),\s*\}\)/, 'the live write is not behind the couple check, or lost a column');
  assert.match(action, /if \(error\) redirect\(/);
  assert.match(action, /if \(!written\) redirect\(/, 'a write that matched no row reports saved');
  // Off never touches the early column: it is written only when sent beside papic_on.
  assert.match(action, /const writeEarly = papicOn === null \|\| formData\.has\('early'\);/);
  // The drafted papic_on is cleared, so a later Apply cannot undo the pick; and the pages that read it re-render.
  assert.match(action, /if \(papicOn !== null\) \{\s*await forgetDraftedEventColumn\(supabase, eventId, 'papic_on'\);/, 'a later Apply can put the older answer back');
  assert.match(action, /revalidatePath\(`\/dashboard\/\$\{eventId\}`, 'layout'\);\s*revalidateGuestSite\(/, 'Memories / the couple’s pages / the Event Hub are not re-rendered');
  // A refusal reverts to what IS stored and says why under the head.
  assert.match(
    picker,
    /setShown\(stored\.current\);\s*say\.line\(papicHeadLine\(\{ live: stored\.current\.on, early: stored\.current\.early \}\)\);\s*say\.problem\(answer\.error\);/,
    'a refused pick does not revert and say why',
  );
  assert.match(picker, /const writes = papicHeadWrites\(to, stored\.current\);/, 'the picker no longer writes by the rule');
}

function checkOneControl(picker: string, settings: string, card: string): void {
  assert.equal(count(picker, /<PickMenu\b/), 1, 'the head is not ONE dropdown');
  // 📏 Its options never wrap: the list's own least width, through the shared PickMenu's optional prop.
  assert.match(picker, /menuMinWidth=\{PAPIC_HEAD_MENU_MIN_WIDTH\}/, 'the head menu lost its least width — its options wrap again');
  assert.match(picker, /options=\{PAPIC_HEAD_OPTIONS\.map/, 'the dropdown does not offer the three positions');
  assert.match(
    fn(settings, 'PapicHeadControl'),
    // UPDATED ON PURPOSE 2026-11-20 (the approved Memories drawing, "the switch, opened"): + each choice's sub-line, from the gate.
    /return <PapicHeadPicker eventId=\{eventId\} live=\{head\.live\} early=\{head\.early\} hints=\{papicHeadHints\(head\.dates, Date\.now\(\)\)\} \/>;/,
  );
  assert.equal(count(card, /<PapicHeadControl eventId=\{eventId\} papicOn=\{/), 1, 'Home does not mount the head control once');
  assert.equal(count(card, /<PapicHeadLine eventId=\{eventId\}/), 1, "the line under the title is not the head's position");
  assert.equal(count(card + settings, /<PapicSwitch\b|<ShootNowSwitch\b|<GuestCamerasChoice\b/), 0, 'a second Papic / shoot-now control is back on the card');
}

test('(2) ⚡ both columns go LIVE in one write through the shipped action — no draft, no Apply (2026-11-22)', () => {
  checkDoors(code(PICKER), code(ACTION));
});

test('(3) one control per fact — one dropdown in the head, no second shoot-now or Papic control on the card', () => {
  checkOneControl(code(PICKER), code(SETTINGS), homeCard());
  const parts = readdirSync(join(WEB, COMPONENTS))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => [f, code(`${COMPONENTS}/${f}`)] as const);
  const callers = parts.filter(([, src]) => /setPapicGuestCaptureEarly/.test(src)).map(([f]) => f);
  assert.deepEqual(callers, ['papic-head-picker.tsx'], `setPapicGuestCaptureEarly has a second control on the card: ${callers.join(', ')}`);
  const all = parts.map(([, src]) => src).join('\n') + homeCard();
  assert.equal(count(all, /When guests can shoot|Let guests shoot now|Only on my event day/), 0, 'the old "When guests can shoot" row is back');
  // The refusal is said in the card's flow, under the head — never inside the control's absolute slot.
  assert.match(code(CARD), /\{saidProblem \? \(\s*<p role="alert"[^>]*data-papic-head-problem/);
  assert.match(code(CARD), /\{saidLine \?\? headLine \?\? brand\}/);
});

test('(4) Event Details › Photos from guests still sets papic_on through the draft (its path is kept)', () => {
  assert.ok((HUB_DRAFT_ANSWER_COLUMNS as readonly string[]).includes('papic_on'), "papic_on left the draft's answer columns");
  assert.match(code(ANSWERS), /editors\.papic = <AnswerPicker eventId=\{eventId\} column="papic_on"/, 'the Your-info Papic answer is gone');
  assert.match(
    code(DETAILS),
    /row="papic-answer"[\s\S]{0,300}answerKeyOf\('papic_on', shown\.papic_on\)[\s\S]{0,300}waiting\('papic_on'\)/,
    'Event Details › Photos from guests lost its row',
  );
});

test('(4b) the shared PickMenu least width: optional, today\'s rule when absent, on screen at 375 px (executed)', () => {
  const button = { top: 100, bottom: 128, left: 230, width: 96 };
  const phone = { width: 375, height: 812 };
  // Absent — today's rule exactly (the button's width, at least 160 px).
  assert.equal(placePickList({ button, listHeight: 140, viewport: phone }).minWidth, 160);
  // The Papic head's — wide enough, reaching left of the button, and still on screen.
  const p = placePickList({ button, listHeight: 140, viewport: phone, minWidth: 232 });
  assert.equal(p.minWidth, 232);
  assert.ok(p.left < button.left, 'the list does not reach left of its button');
  assert.ok(p.left >= 8 && p.left + p.minWidth <= phone.width - 8, 'the list leaves the screen at 375 px');
  // Never wider than the screen less its margins.
  assert.equal(placePickList({ button, listHeight: 140, viewport: { width: 200, height: 600 }, minWidth: 400 }).minWidth, 184);
  // The shared menu passes it through, and only this instance sets it.
  const menu = code('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx');
  assert.match(menu, /minWidth: menuMinWidth,/);
});

test('(5) SABOTAGE — each check fails on the defect it is written for', () => {
  const picker = code(PICKER);
  const settings = code(SETTINGS);
  const action = code(ACTION);
  // papic_on sent back through the Event Hub draft (it would wait for Apply again)
  assert.throws(() => checkDoors(picker + '\nawait makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh);', action));
  // papic_on dropped from the live write
  const noOn = picker.replace("if (writes.papic_on !== undefined) fd.set('papic_on', writes.papic_on ? '1' : '0');", '');
  assert.notEqual(noOn, picker, 'premise: the sabotage found its anchor');
  assert.throws(() => checkDoors(noOn, action));
  // the drafted value left behind — a later Apply undoes the pick
  const kept = action.replace("await forgetDraftedEventColumn(supabase, eventId, 'papic_on');", '');
  assert.notEqual(kept, action, 'premise: the sabotage found its anchor');
  assert.throws(() => checkDoors(picker, kept));
  // the couple check removed
  const open = action.replace('if (!membership) redirect(back);', '');
  assert.notEqual(open, action, 'premise: the sabotage found its anchor');
  assert.throws(() => checkDoors(picker, open));
  // a refusal that does not revert
  const sticky = picker.replace(/setShown\(stored\.current\);(\s*say\.line\(papicHeadLine)/, '$1');
  assert.notEqual(sticky, picker, 'premise: the sabotage found its anchor');
  assert.throws(() => checkDoors(sticky, action));
  // the old Papic switch back on the card
  assert.throws(() => checkOneControl(picker, settings, homeCard() + '\n<PapicSwitch eventId={eventId} saved />'));
  // a pill row instead of one dropdown
  assert.throws(() => checkOneControl(picker.replace('<PickMenu', '<PillRow'), settings, homeCard()));
});
