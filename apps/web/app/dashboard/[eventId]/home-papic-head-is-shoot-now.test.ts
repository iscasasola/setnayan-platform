/**
 * 📷 GUARD — HOME'S PAPIC CARD HEAD IS "LET EVERYBODY SHOOT NOW" ONCE PAPIC IS ON.
 *
 * Owner, 2026-10-30: *"actually the switch on event home should be the let everybody shoot now function"* · *"of papic
 * on papic's widget with that toggle switch"*.
 *
 *   (a) Papic ON  → the head switch writes `events.papic_guest_capture_early` through the shipped
 *       `setPapicGuestCaptureEarly` (live, in place — the Papic in-place door), and the line under the title says it;
 *   (b) Papic OFF → the head switch is still `papic_on` (the Papic switch, unchanged);
 *   (c) ONE CONTROL PER FACT — no second "shoot now" control anywhere on the card: the settings' old
 *       "When guests can shoot" row is gone, and `setPapicGuestCaptureEarly` has exactly one caller the card mounts;
 *   (d) SABOTAGE — each check can fail.
 *
 * Source checks read comment-stripped code (`stripComments`), anchored per component and counted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { papicHeadKind, shootNowLine, SHOOT_NOW_LABEL } from '@/lib/papic-shoot-now';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? []).length;

const HOME = 'app/dashboard/[eventId]/page.tsx';
const COMPONENTS = 'app/dashboard/[eventId]/studio/papic/_components';
const SETTINGS = `${COMPONENTS}/papic-camera-settings.tsx`;
const SHOOT_NOW = `${COMPONENTS}/shoot-now-switch.tsx`;
const READS = `${COMPONENTS}/guest-cameras-choice.tsx`;
const ACTION = 'app/dashboard/[eventId]/studio/papic/guest-window-actions.ts';
const CARD = 'app/dashboard/[eventId]/_components/papic-home-card.tsx';

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

test('the rule — which switch the head wears (executed)', () => {
  assert.equal(papicHeadKind(true, 'on'), 'shoot-now');
  assert.equal(papicHeadKind(true, 'unknown'), 'shoot-now', 'a failed entitlement read must not hide the switch');
  assert.equal(papicHeadKind(true, 'off'), 'papic', 'no guest cameras — "shoot now" would govern nothing');
  assert.equal(papicHeadKind(false, 'on'), 'papic', 'Papic off — guests cannot shoot before Papic is on');
  assert.equal(papicHeadKind(null, 'on'), 'papic');
  assert.equal(SHOOT_NOW_LABEL, 'Let everybody shoot now');
  assert.equal(shootNowLine(true), 'Guests can shoot now');
  assert.equal(shootNowLine(false), 'Guests shoot on the event day');
  assert.match(shootNowLine(null), /Couldn’t check/, 'an unread value is never said as "event day"');
});

function checkShootNowWrites(head: string, sw: string, action: string): void {
  // The head picks the shoot-now switch once Papic is on…
  assert.match(head, /if \(head\.kind === 'papic'\) return <PapicSwitch eventId=\{eventId\} saved=\{papicOn\} \/>;\s*return <ShootNowSwitch eventId=\{eventId\} early=\{head\.early\} \/>;/, 'the head no longer chooses by readShootNow');
  // …which saves through the shipped action, in place, as the couple, with the new value.
  assert.equal(count(sw, /papicSaveInPlace\('setPapicGuestCaptureEarly', fd\)/), 1, 'the switch does not save through setPapicGuestCaptureEarly');
  assert.match(sw, /fd\.set\('early', on \? '1' : '0'\)/);
  assert.match(sw, /fd\.set\('return_to', 'home'\)/);
  // A refusal puts the switch AND the line back, and says why.
  assert.match(sw, /setShown\(stored\.current\);\s*say\.line\(shootNowLine\(stored\.current\)\);\s*say\.problem\(answer\.error\);/, 'a failed save does not revert and say why');
  // …said in the card's flow — a sentence in the switch's absolute slot threw the switch over the camera mark.
  assert.doesNotMatch(sw, /\bproblem=\{/, 'the refusal is drawn inside the head switch slot again');
  // The shared switch the head already wore — never a new look.
  assert.match(sw, /<FormRows\b[\s\S]{0,80}<SwitchRow\b[\s\S]{0,60}name=\{SHOOT_NOW_LABEL\}/);
  // And the action writes the one column, after its couple check.
  assert.match(action, /\.eq\('member_type', 'couple'\)[\s\S]{0,400}\.update\(\{ papic_guest_capture_early: early \}\)/);
}

function checkPapicOffKeepsPapicOn(reads: string, settings: string): void {
  assert.match(reads, /if \(papicOn !== true\) return \{ kind: 'papic' \};/, 'Papic off no longer keeps the Papic switch');
  assert.match(fn(settings, 'PapicSwitch'), /<AnswerPicker eventId=\{eventId\} column="papic_on"[^>]*as="switch"/, 'the Papic switch is not papic_on');
}

test('(a) Papic on → the head switch writes papic_guest_capture_early via setPapicGuestCaptureEarly, live', () => {
  const card = homeCard();
  assert.equal(count(card, /<PapicHeadControl eventId=\{eventId\} papicOn=\{/), 1, 'Home does not mount the head control once');
  assert.equal(count(card, /<PapicHeadLine eventId=\{eventId\}/), 1, 'the line under the title is not drawn from the saved value');
  assert.equal(count(card, /<PapicSwitch\b/), 0, 'Home mounts the Papic switch directly again — the head can no longer be shoot-now');
  checkShootNowWrites(fn(code(SETTINGS), 'PapicHeadControl'), code(SHOOT_NOW), code(ACTION));
  // The line follows the press: the card owns it, the switch says it.
  assert.match(code(CARD), /\{saidLine \?\? headLine \?\? brand\}/);
  assert.match(code(SHOOT_NOW), /say\.line\(shootNowLine\(on\)\);/);
  assert.match(code(CARD), /\{saidProblem \? \(\s*<p role="alert"[^>]*data-papic-head-problem/);
});

test('(b) Papic off → the head switch is papic_on (unchanged)', () => {
  checkPapicOffKeepsPapicOn(code(READS), code(SETTINGS));
});

test('(c) one control per fact — no second "shoot now" control on the card', () => {
  // Every file the card mounts from studio/papic/_components, plus Home's card block.
  const parts = readdirSync(join(WEB, COMPONENTS))
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => [f, code(`${COMPONENTS}/${f}`)] as const);
  const callers = parts.filter(([, src]) => /setPapicGuestCaptureEarly/.test(src)).map(([f]) => f);
  assert.deepEqual(callers, ['shoot-now-switch.tsx'], `setPapicGuestCaptureEarly has a second control on the card: ${callers.join(', ')}`);
  const all = parts.map(([, src]) => src).join('\n') + homeCard();
  assert.equal(count(all, /When guests can shoot|Let guests shoot now|Only on my event day/), 0, 'the old "When guests can shoot" row is back');
  assert.equal(count(all, /<ShootNowSwitch\b/), 1, 'the shoot-now switch is mounted twice');
  assert.equal(count(code(SETTINGS), /<GuestCamerasChoice\b/), 0, 'the settings mount the old row again');
});

test('(d) SABOTAGE — each check fails on the defect it is written for', () => {
  const settings = code(SETTINGS);
  const head = fn(settings, 'PapicHeadControl');
  // (a) the head always the Papic switch
  const alwaysPapic = head.replace('return <ShootNowSwitch eventId={eventId} early={head.early} />;', 'return <PapicSwitch eventId={eventId} saved={papicOn} />;');
  assert.throws(() => checkShootNowWrites(alwaysPapic, code(SHOOT_NOW), code(ACTION)));
  // (a) the switch saving into the draft instead of the live action
  const drafted = code(SHOOT_NOW).replace("papicSaveInPlace('setPapicGuestCaptureEarly', fd)", 'hubDraftAction(eventId, fd)');
  assert.throws(() => checkShootNowWrites(head, drafted, code(ACTION)));
  // (a) a failure that does not revert
  const sticky = code(SHOOT_NOW).replace('setShown(stored.current);', '');
  assert.throws(() => checkShootNowWrites(head, sticky, code(ACTION)));
  // (b) Papic off turning into shoot-now
  const noGate = code(READS).replace("if (papicOn !== true) return { kind: 'papic' };", '');
  assert.throws(() => checkPapicOffKeepsPapicOn(noGate, settings));
  // (c) the old row back in the settings
  const twice = settings + '\n<SubmitButton>Let guests shoot now</SubmitButton>';
  assert.equal(count(twice, /When guests can shoot|Let guests shoot now|Only on my event day/), 1);
});
