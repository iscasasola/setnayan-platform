/**
 * 🕘 THE PICKER'S "RECENTLY USED" — HELD (owner 2026-10-17: *"Just have the Moodboard and Recently Used 5 colors"*).
 *
 *   1 · it never shows more than five, newest first, each colour once (any spelling of it);
 *   2 · it never repeats one of the Mood Board's five — whatever the spelling, whatever was picked;
 *   3 · it belongs to ONE person on ONE event: another account or another event reads nothing;
 *   4 · storage that throws, refuses a write, or holds junk gives an empty row — never an error;
 *   5 · the sheet's own wiring: the row comes from these helpers, through `pickerShelves`.
 *
 * 🛡 Sabotaged once each, each red alone (2026-10-17): `RECENT_SHOWN` 5 → 6 → 1; the board filter in
 * `recentColoursToShow` removed → 2; `recentColourKey` without the event id → 3; `readRecentColours` without
 * its try → 4; the sheet reading `recent` straight from storage, past `pickerShelves` → 5.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  RECENT_SHOWN,
  parseRecentColours,
  readRecentColours,
  recentColourKey,
  recentColoursToShow,
  rememberRecentColour,
  withRecentColour,
  type RecentStorage,
} from './colour-picker-recent';
import { pickerShelves } from './mood-board-studio';

const FIVE = ['#5C0700', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];

function memory(): RecentStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

/** Pick each colour in turn, the way the sheet does. */
function pickAll(storage: RecentStorage, key: string, hexes: readonly string[]): string[] {
  let last: string[] = [];
  for (const h of hexes) last = rememberRecentColour(storage, key, h);
  return last;
}

test('1 · never more than five, newest first, each colour once', () => {
  assert.equal(RECENT_SHOWN, 5, 'the owner asked for five');
  const s = memory();
  const key = recentColourKey('user-a', 'event-1');
  const picked = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777', '#222222', 'abcdef'];
  pickAll(s, key, picked);
  const shown = recentColoursToShow(readRecentColours(s, key), []);
  assert.equal(shown.length, 5, `shows ${shown.length}, not five`);
  assert.deepEqual(shown, ['#ABCDEF', '#222222', '#777777', '#666666', '#555555'], 'not newest first, or a repeat kept its old place');
  /* One colour, many spellings — one entry. */
  const spelled = ['#a1b2c3', 'A1B2C3', '#A1B2C3', ' #a1b2c3 '].reduce<string[]>((l, h) => withRecentColour(l, h), []);
  assert.deepEqual(spelled, ['#A1B2C3']);
  /* Whatever is stored, the shelf is capped at five. */
  for (let n = 0; n <= 20; n++) {
    const list = Array.from({ length: n }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`);
    assert.ok(recentColoursToShow(list, []).length <= 5, `${n} stored → more than five shown`);
  }
  /* Not a colour → nothing is remembered. */
  assert.deepEqual(withRecentColour(['#111111'], 'not a colour'), ['#111111']);
});

test('2 · never one of the Mood Board’s five, in any spelling — and five are still shown when there are enough', () => {
  const s = memory();
  const key = recentColourKey('user-a', 'event-1');
  const picked = ['#101010', FIVE[0]!.toLowerCase(), '#202020', FIVE[2]!, '#303030', '#404040', FIVE[4]!.slice(1), '#505050', '#606060'];
  pickAll(s, key, picked);
  const shown = recentColoursToShow(readRecentColours(s, key), FIVE);
  const board = new Set(FIVE);
  for (const c of shown) assert.ok(!board.has(c), `${c} is a Mood Board colour`);
  assert.deepEqual(shown, ['#606060', '#505050', '#404040', '#303030', '#202020'], 'five are not kept after the board’s own are left out');
  /* The sheet's own rows: the same answer through `pickerShelves`, which the sheet draws. */
  const rows = pickerShelves(FIVE, { recent: readRecentColours(s, key) });
  assert.deepEqual(rows.recent.map((r) => r.hex), shown);
  assert.ok(rows.recent.every((r) => !rows.board.some((b) => b.hex === r.hex)), 'a dot is in both rows');
});

test('3 · one person, one event — another account or another event reads nothing', () => {
  const s = memory();
  pickAll(s, recentColourKey('user-a', 'event-1'), ['#123456']);
  assert.deepEqual(readRecentColours(s, recentColourKey('user-a', 'event-1')), ['#123456']);
  assert.deepEqual(readRecentColours(s, recentColourKey('user-b', 'event-1')), [], 'another account sees these');
  assert.deepEqual(readRecentColours(s, recentColourKey('user-a', 'event-2')), [], 'another event sees these');
  assert.notEqual(recentColourKey('a', 'b'), recentColourKey('b', 'a'));
  /* No scope (no signed-in event) → nothing read, nothing written. */
  assert.deepEqual(readRecentColours(s, null), []);
  const before = s.data.size;
  rememberRecentColour(s, null, '#654321');
  assert.equal(s.data.size, before, 'a pick outside an event was written');
});

test('4 · storage that throws, refuses or holds junk → an empty row, never an error', () => {
  const key = recentColourKey('user-a', 'event-1');
  const throws: RecentStorage = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.deepEqual(readRecentColours(throws, key), []);
  assert.deepEqual(rememberRecentColour(throws, key, '#123456'), []);
  assert.deepEqual(readRecentColours(null, key), []);
  const full = memory();
  full.data.set(key, JSON.stringify(['#111111']));
  full.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  assert.deepEqual(rememberRecentColour(full, key, '#222222'), ['#111111'], 'a refused write is reported as kept');
  for (const junk of ['{', '"#123456"', '{"a":1}', '[1,null,{},"nope"]', 'null', '']) {
    assert.deepEqual(parseRecentColours(junk), [], `junk ${JSON.stringify(junk)} read as colours`);
  }
  assert.deepEqual(parseRecentColours('["#abcdef", 3, "#ABCDEF", "#123456"]'), ['#ABCDEF', '#123456']);
});

test('5 · the sheet draws the row from these helpers, through pickerShelves', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/studio/mood-board/_components/colour-picker-sheet.tsx'), 'utf8'));
  assert.match(src, /const key = scope \? recentColourKey\(scope\.userId, scope\.eventId\) : null;/, 'the row is not keyed by the person and the event');
  assert.match(src, /const \[recent\] = useState\(\(\) => readRecentColours\(browserStorage\(\), key\)\);/, 'the row is not read through the wrapped reader');
  assert.match(src, /\{suggest\.recent\.map\(dot\)\}/, 'the row is not drawn from pickerShelves');
  assert.doesNotMatch(src, /localStorage/, 'the sheet reaches storage past the wrapped helpers');
});
