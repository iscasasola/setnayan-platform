/**
 * 📷 GUARD — HOME'S PAPIC CARD HEAD IS ONE DROPDOWN: OFF · ON — EVENT DAY · ON — EVERYONE, NOW.
 *
 * Owner, 2026-10-30: *"actually the switch on event home should be the let everybody shoot now function"* · *"of papic
 * on papic's widget with that toggle switch"* — then, told Home would lose its Papic off switch: *"If we cannot turn it
 * off, then maybe assign partial turn on?"*.
 *
 *   (1) the three positions → the two columns (executed): Off → `papic_on` false (early untouched); On — event day →
 *       `papic_on` true + `papic_guest_capture_early` false; On — everyone, now → both true; and the line never looks
 *       applied when it isn't ("… after you Apply"), and an unread fact says "Couldn’t check";
 *   (2) the writes go through the existing doors: `papic_on` through the Event Hub draft (`hubDraftAction` — the old
 *       Papic switch's own path, no new live write), the early column LIVE through `setPapicGuestCaptureEarly`;
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
import { HUB_DRAFT_ANSWER_COLUMNS } from '@/lib/hub-draft';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? []).length;

const HOME = 'app/dashboard/[eventId]/page.tsx';
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
  const at = src.indexOf('const papicCard: PapicCardInput | null =');
  assert.ok(at > 0, 'premise: Home builds the Papic card');
  return src.slice(at, src.indexOf(': null;', at));
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
  const onDay = { draftOn: true, early: false };
  const off = { draftOn: false, early: false };
  // Off → papic_on false; the early column is never touched by Off.
  assert.deepEqual(papicHeadWrites('off', onDay), { papic_on: false });
  assert.deepEqual(papicHeadWrites('off', { draftOn: true, early: true }), { papic_on: false });
  // On — event day → papic_on true (only when it was off) + early false (only when it was on).
  assert.deepEqual(papicHeadWrites('eventday', off), { papic_on: true });
  assert.deepEqual(papicHeadWrites('eventday', { draftOn: false, early: true }), { papic_on: true, papic_guest_capture_early: false });
  assert.deepEqual(papicHeadWrites('eventday', { draftOn: true, early: true }), { papic_guest_capture_early: false });
  // On — everyone, now → papic_on true + early true.
  assert.deepEqual(papicHeadWrites('now', off), { papic_on: true, papic_guest_capture_early: true });
  assert.deepEqual(papicHeadWrites('now', onDay), { papic_guest_capture_early: true });
  // Positions from the facts.
  assert.equal(papicHeadPosition({ live: true, draftOn: false, early: true }), 'off');
  assert.equal(papicHeadPosition({ live: true, draftOn: true, early: false }), 'eventday');
  assert.equal(papicHeadPosition({ live: true, draftOn: true, early: true }), 'now');
  assert.equal(papicHeadPosition({ live: true, draftOn: null, early: true }), null);
  assert.equal(papicHeadPosition({ live: true, draftOn: true, early: null }), null);
  // The line — never applied-looking while papic_on still waits for Apply.
  assert.equal(papicHeadLine({ live: false, draftOn: false, early: false }), 'Off');
  assert.equal(papicHeadLine({ live: true, draftOn: false, early: true }), 'Off after you Apply');
  assert.equal(papicHeadLine({ live: true, draftOn: true, early: false }), 'Guests shoot on the event day');
  assert.equal(papicHeadLine({ live: true, draftOn: true, early: true }), 'Guests can shoot now');
  assert.match(papicHeadLine({ live: false, draftOn: true, early: true }), /after you Apply/);
  assert.match(papicHeadLine({ live: false, draftOn: true, early: false }), /after you Apply/);
  assert.match(papicHeadLine({ live: true, draftOn: true, early: null }), /Couldn’t check/);
  assert.match(papicHeadLine({ live: null, draftOn: true, early: true }), /Couldn’t check/);
});

function checkDoors(picker: string, action: string): void {
  // papic_on — the draft door the Papic switch used, never a new live write.
  assert.match(
    picker,
    /fd\.set\('patch', JSON\.stringify\(\{ events: \{ papic_on: writes\.papic_on \} \}\)\);\s*ok = \(await makerSave\(\(\) => hubDraftAction\(eventId, fd\), requestMakerRefresh\)\)\.ok;/,
    "papic_on no longer goes through the Event Hub draft (the Papic switch's path)",
  );
  assert.doesNotMatch(picker, /\.from\('events'\)/, 'a live write of papic_on was invented');
  // the early column — live, through the shipped action, in place.
  assert.equal(count(picker, /papicSaveInPlace\('setPapicGuestCaptureEarly', fd\)/), 1, 'the early column is not saved through setPapicGuestCaptureEarly');
  assert.match(picker, /fd\.set\('early', writes\.papic_guest_capture_early \? '1' : '0'\)/);
  assert.match(action, /\.eq\('member_type', 'couple'\)[\s\S]{0,400}\.update\(\{ papic_guest_capture_early: early \}\)/);
  // A refusal reverts to what IS stored and says why under the head.
  assert.match(
    picker,
    /setShown\(stored\.current\);\s*say\.line\(papicHeadLine\(\{ live, \.\.\.stored\.current \}\)\);\s*say\.problem\(refused\);/,
    'a refused pick does not revert and say why',
  );
  assert.match(picker, /const writes = papicHeadWrites\(to, stored\.current\);/, 'the picker no longer writes by the rule');
}

function checkOneControl(picker: string, settings: string, card: string): void {
  assert.equal(count(picker, /<PickMenu\b/), 1, 'the head is not ONE dropdown');
  assert.match(picker, /options=\{PAPIC_HEAD_OPTIONS\.map/, 'the dropdown does not offer the three positions');
  assert.match(
    fn(settings, 'PapicHeadControl'),
    /return <PapicHeadPicker eventId=\{eventId\} live=\{head\.live\} draftOn=\{head\.draftOn\} early=\{head\.early\} \/>;/,
  );
  assert.equal(count(card, /<PapicHeadControl eventId=\{eventId\} papicOn=\{/), 1, 'Home does not mount the head control once');
  assert.equal(count(card, /<PapicHeadLine eventId=\{eventId\}/), 1, "the line under the title is not the head's position");
  assert.equal(count(card + settings, /<PapicSwitch\b|<ShootNowSwitch\b|<GuestCamerasChoice\b/), 0, 'a second Papic / shoot-now control is back on the card');
}

test('(2) the writes go through the existing doors — draft for papic_on, live action for the early column', () => {
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

test('(4) Event Details › Photos from guests still sets papic_on through the draft', () => {
  assert.ok((HUB_DRAFT_ANSWER_COLUMNS as readonly string[]).includes('papic_on'), "papic_on left the draft's answer columns");
  assert.match(code(ANSWERS), /editors\.papic = <AnswerPicker eventId=\{eventId\} column="papic_on"/, 'the Your-info Papic answer is gone');
  assert.match(
    code(DETAILS),
    /row="papic-answer"[\s\S]{0,300}answerKeyOf\('papic_on', shown\.papic_on\)[\s\S]{0,300}waiting\('papic_on'\)/,
    'Event Details › Photos from guests lost its row',
  );
});

test('(5) SABOTAGE — each check fails on the defect it is written for', () => {
  const picker = code(PICKER);
  const settings = code(SETTINGS);
  // papic_on written live instead of through the draft
  const live = picker.replace(
    'ok = (await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh)).ok;',
    "ok = !(await supabase.from('events').update({ papic_on: writes.papic_on }).eq('event_id', eventId)).error;",
  );
  assert.notEqual(live, picker, 'premise: the sabotage found its anchor');
  assert.throws(() => checkDoors(live, code(ACTION)));
  // the early column saved into the draft
  assert.throws(() => checkDoors(picker.replace("papicSaveInPlace('setPapicGuestCaptureEarly', fd)", 'hubDraftAction(eventId, fd)'), code(ACTION)));
  // a refusal that does not revert
  const sticky = picker.replace(/setShown\(stored\.current\);(\s*say\.line\(papicHeadLine)/, '$1');
  assert.notEqual(sticky, picker, 'premise: the sabotage found its anchor');
  assert.throws(() => checkDoors(sticky, code(ACTION)));
  // the old Papic switch back on the card
  assert.throws(() => checkOneControl(picker, settings, homeCard() + '\n<PapicSwitch eventId={eventId} saved />'));
  // a pill row instead of one dropdown
  assert.throws(() => checkOneControl(picker.replace('<PickMenu', '<PillRow'), settings, homeCard()));
});
