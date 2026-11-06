/**
 * ✕ A REMOVED CHALLENGE KEEPS ITS PHOTOS — the source half (the database half is
 * `tests/db/a-removed-challenge-keeps-its-photos.db.test.ts`).
 *
 * Owner 2026-10-26 (DECISION_LOG "PAPIC CHALLENGES: A LIVE SWITCH AND AN ✕"): *"challenges will have a toggle to make
 * that challenge live and happening on the app. but it also needs a (X) to remove that challenge. if the challenge is
 * removed and someone did the challenge, the photo and challenge is saved but anything after, you do not have the
 * challenge"*.
 *
 *   · the ✕ action never DELETEs a row (completions cascade on delete) — it sets is_active = false + removed_at;
 *   · the switch never re-lights a removed row;
 *   · the host's list and the picker's taken-set skip removed rows; Memories keeps a removed one only on its photos;
 *   · each in-card row draws its name, its switch and its ✕ (44 px).
 * Each assertion has a sabotage beside it, so a pattern that stopped matching would fail rather than pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB = join(PAPIC, '..', '..', '..', '..', '..');
const ACTIONS = stripComments(readFileSync(join(PAPIC, 'actions.ts'), 'utf8'));
const MANAGER = stripComments(readFileSync(join(PAPIC, 'couple-challenges-manager.tsx'), 'utf8'));
const MEMORIES = stripComments(readFileSync(join(WEB, 'lib', 'event-memories.server.ts'), 'utf8'));

function body(src: string, fn: string): string {
  const at = src.indexOf(`export async function ${fn}(`);
  assert.ok(at > -1, `${fn} is gone`);
  const next = src.indexOf('\nexport ', at + 10);
  return src.slice(at, next > -1 ? next : undefined);
}

const removes = (src: string) =>
  /\.update\(\{ is_active: false, removed_at: removedAt, moment_key: null \}\)/.test(src) && !/\.delete\(\)/.test(src);

test('✕ is a soft remove — it never deletes the row its photos hang on', () => {
  const remove = body(ACTIONS, 'deleteCoupleChallengeAction');
  assert.ok(removes(remove), 'the ✕ deletes the challenge again, or no longer marks it removed');
  assert.match(remove, /\.is\('removed_at', null\)/, 'the ✕ re-stamps a challenge already removed');
  // SABOTAGE — the old hard delete is caught.
  assert.equal(removes(remove.replace('.update({ is_active: false, removed_at: removedAt, moment_key: null })', '.delete()')), false);
});

test('the switch never re-lights a removed challenge', () => {
  const sw = body(ACTIONS, 'setCoupleChallengeActiveAction');
  const scoped = (src: string) => /\.update\(\{ is_active: active === 'true' \}\)[\s\S]{0,200}\.is\('removed_at', null\)/.test(src);
  assert.ok(scoped(sw), 'the switch can turn a removed challenge back on');
  assert.equal(scoped(sw.replace(".is('removed_at', null)", '')), false, 'sabotage: the scope check can fail');
});

test('the host’s list and the picker skip removed rows; Memories keeps one only on its photos', () => {
  assert.equal((MANAGER.match(/\.is\('removed_at', null\)/g) ?? []).length, 2, 'the list or the taken-set reads removed challenges');
  assert.match(MEMORIES, /\(m\) => !m\.removed_at \|\| tagged\.has\(m\.mission_id\)/, 'Memories lists a removed challenge with no photo, or drops one that has photos');
  assert.match(MEMORIES, /select\('mission_id, prompt, source, vendor_id, board_slot, removed_at'\)/, 'Memories cannot tell a removed challenge');
});

test('🎚 the card is TEN SLOTS: each row its name (a press that changes it) · its switch — no ✕, no "Add a challenge"', () => {
  // Owner 2026-10-27: "there will be 10 challenges the can make. choose a challenge or turn that challenge off. turning 1
  // off will become 9 of 10 challenges. it stays there, but just off."
  const at = MANAGER.indexOf('data-papic-challenges-running=""');
  const list = MANAGER.slice(at, MANAGER.indexOf('</ul>', at));
  assert.ok(at > 0, 'premise: the in-card list');
  assert.match(list, /\{slots\.map\(\(m, i\) => \(\s*<ChallengeCardRow\b/, 'the card does not draw the ten slots');
  assert.match(MANAGER, /Array\.from\(\{ length: ACTIVE_CHALLENGE_CAP - listed\.length \}, \(\) => null\)/, 'the list is not padded to ten');
  assert.match(MANAGER, /\.slice\(0, ACTIVE_CHALLENGE_CAP\)/, 'more than ten rows can be drawn');
  assert.match(MANAGER, /of \{formatCount\(ACTIVE_CHALLENGE_CAP\)\} challenges on/, 'the header does not say "N of 10 challenges on"');
  const inCard = MANAGER.slice(MANAGER.indexOf('if (inCard) {'), MANAGER.indexOf('if (!standalone) {'));
  assert.doesNotMatch(inCard, /<ChallengeAddSheet\b|deleteCoupleChallengeAction/, 'an "Add a challenge" button or a ✕ is back in the card');
  const row = stripComments(readFileSync(join(PAPIC, '_components', 'challenge-card-row.tsx'), 'utf8'));
  assert.match(row, /<ChallengeAddSheet\b[^>]*slot=\{\{ mission: m \}\}/, 'the row name does not open the change sheet');
  assert.match(row, /role="switch" aria-checked=\{m\.is_active\}/, 'the switch does not show on / off');
  assert.doesNotMatch(row, /deleteCoupleChallengeAction|data-papic-challenge-remove/, 'a ✕ is back on the row');
  const sheet = stripComments(readFileSync(join(PAPIC, '_components', 'challenge-add-sheet.tsx'), 'utf8'));
  assert.equal((sheet.match(/name="replace_mission_id"/g) ?? []).length, 1, 'the sheet does not tell the server which slot it changes');
  assert.match(sheet, /className="flex min-h-11 min-w-0 flex-1 items-center text-left"/, 'the row press is smaller than 44 px');
  // SABOTAGE — a ✕ put back on the row is caught.
  assert.match(row + '<PapicStayForm door="deleteCoupleChallengeAction"', /deleteCoupleChallengeAction/);
});

test('🎚 changing a slot: the new one goes in FIRST, then the old one is retired (never deleted), in the same place', () => {
  for (const fn of ['createCoupleChallengeAction', 'addLibraryChallengeAction']) {
    const b = body(ACTIONS, fn);
    const ins = b.indexOf(".from('papic_missions').insert(");
    const retire = b.indexOf('await retireReplaced(supabase, eventId, replacing.id)');
    assert.ok(ins > 0 && retire > ins, `${fn}: the old challenge is retired before its replacement is in`);
    assert.match(b, /created_at: replacing\.createdAt/, `${fn}: the replacement does not take the slot's place`);
    assert.doesNotMatch(b, /\.delete\(\)/, `${fn} deletes`);
  }
  const retire = ACTIONS.slice(ACTIONS.indexOf('async function retireReplaced('), ACTIONS.indexOf('export async function createCoupleChallengeAction('));
  assert.match(retire, /\.update\(\{ is_active: false, removed_at: new Date\(\)\.toISOString\(\), moment_key: null \}\)/, 'a replaced challenge is not retired softly');
  // SABOTAGE — a hard delete in its place is caught.
  assert.doesNotMatch(retire.replace('.update({ is_active: false, removed_at: new Date().toISOString(), moment_key: null })', '.delete()'), /\.update\(\{ is_active: false/);
});
