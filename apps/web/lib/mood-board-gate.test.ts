/**
 * 🖼 WHO MAY CHANGE THE MOOD BOARD — the gate, and every action that writes the board asking it.
 *
 * Owner 2026-10-30: *"Only the host and whoever supplier they give access to and not all"* · *"The rest can view but
 * not edit"*. WHO the two SQL questions admit (`can_change_mood_board_photos`, `colour_access_caller_is_couple`) is a
 * property of the database, proved in tests/db/the-mood-board-is-changed-by-whoever-the-hosts-allow.db.test.ts. This
 * file proves (1) what an action DOES with each answer, and (2) that every exported server action that writes a board
 * photo asks the photo gate, and every one that writes the palette/theme/suggestion asks the hosts' gate — the set of
 * writers DERIVED from the source (any `.from('event_inspiration_assets')` followed by an insert/update), so a new
 * writer that forgets cannot hide by not being listed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MOOD_BOARD_CHECK_FAILED,
  MOOD_BOARD_HOSTS_ONLY_REFUSAL,
  MOOD_BOARD_PHOTOS_REFUSAL,
  moodBoardHostsOnlyRefusalWith,
  moodBoardPhotosRefusalWith,
  type MoodBoardRpcClient,
} from './mood-board-gate';
import { stripComments } from './strip-comments';

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';

function client(answer: { data: unknown; error: unknown }, seen: string[] = []): MoodBoardRpcClient {
  return {
    rpc: (fn, args) => {
      seen.push(`${fn}:${args.p_event_id}`);
      return Promise.resolve(answer);
    },
  };
}

test('the photo gate asks can_change_mood_board_photos and says what it answered', async () => {
  const seen: string[] = [];
  assert.equal(await moodBoardPhotosRefusalWith(client({ data: true, error: null }, seen), EVENT), null);
  assert.deepEqual(seen, [`can_change_mood_board_photos:${EVENT}`]);
  assert.equal(await moodBoardPhotosRefusalWith(client({ data: false, error: null }), EVENT), MOOD_BOARD_PHOTOS_REFUSAL);
  // Anything but a literal TRUE is a no — a null from a missing row never reads as "allowed".
  assert.equal(await moodBoardPhotosRefusalWith(client({ data: null, error: null }), EVENT), MOOD_BOARD_PHOTOS_REFUSAL);
  // A check that failed never lets a write through.
  assert.equal(await moodBoardPhotosRefusalWith(client({ data: true, error: { message: '503' } }), EVENT), MOOD_BOARD_CHECK_FAILED);
});

test('the hosts’ gate asks colour_access_caller_is_couple', async () => {
  const seen: string[] = [];
  assert.equal(await moodBoardHostsOnlyRefusalWith(client({ data: true, error: null }, seen), EVENT), null);
  assert.deepEqual(seen, [`colour_access_caller_is_couple:${EVENT}`]);
  assert.equal(await moodBoardHostsOnlyRefusalWith(client({ data: false, error: null }), EVENT), MOOD_BOARD_HOSTS_ONLY_REFUSAL);
  assert.equal(await moodBoardHostsOnlyRefusalWith(client({ data: null, error: 'x' }), EVENT), MOOD_BOARD_CHECK_FAILED);
});

test('a value that is not an event id is left to the action’s own validation — no question asked', async () => {
  const seen: string[] = [];
  for (const v of [null, undefined, '', 'not-an-id', 42]) {
    assert.equal(await moodBoardPhotosRefusalWith(client({ data: false, error: null }, seen), v), null);
  }
  assert.deepEqual(seen, []);
});

test('the refusals are sentences a person can act on', () => {
  for (const s of [MOOD_BOARD_PHOTOS_REFUSAL, MOOD_BOARD_HOSTS_ONLY_REFUSAL]) {
    assert.match(s, /^[A-Z][^]*\.$/);
    assert.doesNotMatch(s, /\b(RLS|policy|moderator|null|rpc)\b/i);
  }
  assert.match(MOOD_BOARD_PHOTOS_REFUSAL, /hosts can give you Mood Board access/);
});

// ── Every writer asks ────────────────────────────────────────────────────────

const DASH = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'dashboard', '[eventId]');
const FILES = [
  'studio/mood-board/actions.ts',
  'studio/mood-board/suggestion-actions.ts',
  'wizard-actions.ts',
] as const;

/** Each exported function's own text, comments stripped (a gate named in a comment is not a call). */
function exportedFunctions(rel: string): Map<string, string> {
  const src = stripComments(readFileSync(join(DASH, rel), 'utf8'));
  const out = new Map<string, string>();
  const re = /export async function (\w+)\s*\(/g;
  const starts: { name: string; at: number }[] = [];
  for (let m = re.exec(src); m; m = re.exec(src)) starts.push({ name: m[1]!, at: m.index });
  starts.forEach((s, i) => out.set(s.name, src.slice(s.at, starts[i + 1]?.at ?? src.length)));
  return out;
}

// A board-photo write is a direct `.from('event_inspiration_assets').insert/update(` — or a call to
// `swapMoodboardCells` (lib/moodboard-swap.ts), where the drag-reorder's writes moved on 2026-10-30 (#7092) so its
// db test runs the same code; that helper writes the same table through a `TABLE` constant this regex cannot see.
const WRITES_A_PHOTO = /\.from\(\s*'event_inspiration_assets'\s*\)\s*\.(?:insert|update)\(|\bswapMoodboardCells\(/;
const PHOTO_GATE = /\b(?:moodBoardPhotosRefusal|refuseUnlessMoodBoardPhotos|moodBoardPhotoChangeRefusal|refuseUnlessMoodBoardPhotoChange)\(/;
/** 🖼⏱ The door that also opens the owners' 24-hour Undo — every DIRECT photo writer must use it (20271299051148). */
const CHANGE_DOOR = /\b(?:moodBoardPhotoChangeRefusal|refuseUnlessMoodBoardPhotoChange)\(/;
const HOST_GATE = /\b(?:refuseUnlessMoodBoardHost|moodBoardHostRefusal)\(/;

/** Writers that also change the event row (palette, theme) — the hosts' alone. */
const HOSTS_ONLY = new Set([
  'studio/mood-board/actions.ts#saveRolePalette',
  'studio/mood-board/actions.ts#saveMoodboardTheme',
  'studio/mood-board/actions.ts#applyThemeIntent',
  'studio/mood-board/actions.ts#applyMoodboardTemplate',
]);

/**
 * 🤝 A supplier's suggestion — Keep · No thanks · the Keep toast's Undo — is answered by whoever may change the photos
 * (owner 2026-10-30: *"Coordinators can also approve the changes made by suppliers?"* → *"Yes"*). Their RPCs ask
 * `can_change_mood_board_photos` themselves; the action asks first so a refusal is said.
 */
const SUGGESTION_ANSWERS = [
  'studio/mood-board/suggestion-actions.ts#keepInspirationSuggestion',
  'studio/mood-board/suggestion-actions.ts#declineInspirationSuggestion',
  'studio/mood-board/suggestion-actions.ts#undoMoodBoardChange',
] as const;

test('🔒 every action that writes a board photo asks the photo gate (or is the hosts’ alone)', () => {
  const photoWriters: string[] = [];
  for (const rel of FILES) {
    for (const [name, body] of exportedFunctions(rel)) {
      const key = `${rel}#${name}`;
      if (!WRITES_A_PHOTO.test(body)) continue;
      photoWriters.push(key);
      if (HOSTS_ONLY.has(key)) continue;
      assert.match(body, PHOTO_GATE, `${key} writes a Mood Board photo without asking can_change_mood_board_photos`);
      // 🖼⏱ …and through the door that opens the owners' Undo, so one press is one change, one notice per owner.
      assert.match(body, CHANGE_DOOR, `${key} writes a Mood Board photo without opening the change the owners may Undo`);
    }
  }
  // Floor: the sweep must keep SEEING the writers it was written for, or it passes by looking at nothing.
  for (const k of [
    'studio/mood-board/actions.ts#reorderMoodboardSlot',
    'studio/mood-board/actions.ts#applyGalleryPick',
    'wizard-actions.ts#uploadMoodboardSlot',
    'wizard-actions.ts#removeMoodboardSlot',
  ]) {
    assert.ok(photoWriters.includes(k), `${k} is no longer seen writing a board photo — the sweep went blind`);
  }
});

test('🤝 a supplier’s suggestion is answered by whoever may change the photos — not the hosts alone', () => {
  for (const key of SUGGESTION_ANSWERS) {
    const [rel, name] = key.split('#') as [string, string];
    const body = exportedFunctions(rel).get(name);
    assert.ok(body, `${key} no longer exists — update SUGGESTION_ANSWERS`);
    assert.match(body, PHOTO_GATE, `${key} does not ask the photo gate`);
    assert.doesNotMatch(body, HOST_GATE, `${key} is the hosts’ alone again — a coordinator with Mood Board Edit could not approve`);
  }
});

test('🔒 the palette, theme and template ask the hosts’ gate', () => {
  for (const key of HOSTS_ONLY) {
    const [rel, name] = key.split('#') as [string, string];
    const body = exportedFunctions(rel).get(name);
    assert.ok(body, `${key} no longer exists — update HOSTS_ONLY`);
    assert.match(body, HOST_GATE, `${key} does not ask the hosts’ gate — a person given Mood Board Edit would be silently refused`);
  }
});
