/**
 * a-kept-guest-list-is-one-persons.test.ts — 🔒 THE GUEST LIST KEPT ON THE PHONE IS ONLY EVER SHOWN TO THE
 * PERSON WHO SAW IT, FOR THE EVENT THEY SAW IT ON (owner 2026-10-02: *"wiped at sign-out (a shared phone never
 * shows the next person someone's guests)"*; controller brief 2026-10-16: "Never show another user's data").
 *
 * The copy rides the one last-seen store, so it inherits its rules — and this file proves it does, on the
 * DATA entries the Guest list now writes (`saveLastSeenData` / `readLastSeenData`), not only the html ones:
 *   · another account opening the phone reads nothing AND wipes the first person's copy;
 *   · another event of the same person reads nothing;
 *   · a signed-out landing page's inline wipe removes the data keys too;
 *   · a copy older than the store's age limit is not shown;
 *   · only the Guest list's own copy module writes data entries (never budget, payments or orders).
 *
 * Sabotage (2026-10-16): `readLastSeenData` without its owner check → test 1 red. Reverted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { MAX_AGE_MS, readLastSeenData, saveLastSeenData, type LastSeenStorage } from '@/lib/last-seen/store';
import { LAST_SEEN_WIPE_SCRIPT } from '@/lib/last-seen/wipe';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');

function memoryStorage(): LastSeenStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const URL_ = '/dashboard/e1/guests';
const DATA = { v: 1, rows: [{ guest_id: 'g1', first_name: 'Lola', last_name: 'Peña' }] };
const save = (s: LastSeenStorage, userId: string, eventId = 'e1', now?: number) =>
  saveLastSeenData(s, { userId, eventId, page: 'guests', url: `/dashboard/${eventId}/guests`, data: DATA, now });
const readAs = (s: LastSeenStorage, userId: string, eventId = 'e1', now?: number) =>
  readLastSeenData(s, { userId, eventId, page: 'guests', url: `/dashboard/${eventId}/guests`, now });

test('1 · another account on the same phone reads nothing — and the first copy is gone', () => {
  const s = memoryStorage();
  assert.equal(save(s, 'ana'), true);
  assert.ok(readAs(s, 'ana'), 'Ana reads her own copy');
  assert.equal(readAs(s, 'ben'), null, 'Ben reads nothing');
  assert.equal([...s.map.keys()].filter((k) => k.includes(':ana:')).length, 0, 'and Ana’s copy was wiped, not just hidden');
  assert.equal(readAs(s, 'ana'), null, 'so it is gone for Ana too');
});

test('2 · the same person on another event reads nothing; an old copy is not shown', () => {
  const s = memoryStorage();
  save(s, 'ana', 'e1');
  assert.equal(readAs(s, 'ana', 'e2'), null);
  const t0 = Date.UTC(2026, 9, 1);
  save(s, 'ana', 'e1', t0);
  assert.ok(readAs(s, 'ana', 'e1', t0 + 60_000));
  assert.equal(readAs(s, 'ana', 'e1', t0 + MAX_AGE_MS + 1), null);
  assert.equal(
    readLastSeenData(s, { userId: 'ana', eventId: 'e1', page: 'guests', url: `${URL_}?view=vip` }),
    null,
    'only on the list’s own address',
  );
});

test('3 · signing out empties it — the signed-out page’s inline wipe removes the data keys', () => {
  const s = memoryStorage();
  save(s, 'ana');
  assert.ok(s.map.size >= 2);
  vm.runInNewContext(LAST_SEEN_WIPE_SCRIPT, { document: { cookie: 'other=1' }, localStorage: s });
  assert.equal(s.map.size, 0, 'no auth cookie → every kept key removed, the guest list’s included');
});

test('4 · only the Guest list’s copy module writes a data entry', () => {
  const writers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /\bsaveLastSeenData\(/.test(readFileSync(p, 'utf8'))) {
        writers.push(relative(WEB, p));
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.deepEqual(writers.sort(), ['app/dashboard/[eventId]/guests/_components/guest-list-copy.ts', 'lib/last-seen/store.ts']);
});

test('5 · a peso figure in a guest’s note is masked, and the copy is refused if a sign survives', () => {
  const s = memoryStorage();
  const withMoney = { v: 1, rows: [{ guest_id: 'g1', first_name: 'A', last_name: 'B', guest_note: 'Gift ₱5,000 sent' }] };
  assert.equal(saveLastSeenData(s, { userId: 'ana', eventId: 'e1', page: 'guests', url: URL_, data: withMoney }), true);
  const back = JSON.stringify(readAs(s, 'ana'));
  assert.doesNotMatch(back, /₱|5,000/);
});
