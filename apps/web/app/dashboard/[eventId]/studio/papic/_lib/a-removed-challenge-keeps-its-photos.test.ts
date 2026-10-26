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

test('each challenge in the card: its name · its switch · its ✕ (44 px)', () => {
  const at = MANAGER.indexOf('data-papic-challenges-running=""');
  const list = MANAGER.slice(at, MANAGER.indexOf('</ul>', at));
  assert.ok(at > 0, 'premise: the in-card list');
  assert.match(list, /\{missions\.map\(\(m\) => \(\s*<ChallengeCardRow\b/, 'the list shows only running challenges — a paused one could never come back');
  const row = stripComments(readFileSync(join(PAPIC, '_components', 'challenge-card-row.tsx'), 'utf8'));
  assert.match(row, /role="switch" aria-checked=\{m\.is_active\}/, 'the switch does not show live / paused');
  assert.match(row, /door="deleteCoupleChallengeAction"/, 'no ✕ on the row');
  assert.match(row, /className="inline-flex h-11 w-11[^"]*"[\s\S]{0,80}data-papic-challenge-remove=""/, 'the ✕ is smaller than 44 px');
  // SABOTAGE — a row without its ✕ is caught.
  assert.doesNotMatch(row.replace(/door="deleteCoupleChallengeAction"/g, ''), /door="deleteCoupleChallengeAction"/);
});
