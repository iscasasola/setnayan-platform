/**
 * the-guest-list-opens-from-the-phone.test.ts — 📋 THE REPEAT-OPEN BUDGET (owner 2026-10-16: *"wouldnt it be
 * better for someone to just have a excel file for their guests that loads fast instead of always waiting
 * for that 2.5 sec load everytime?"*).
 *
 * Measured on the replay (production build, 375 px, 4× CPU, Fast 4G): the Guests tab tapped from Home drew an
 * INERT picture at ~0.1 s and the usable list only when the server answered. Now the loading screen draws
 * the host's last copy with the REAL screen, so the list is usable before the server answers. What a unit
 * test can hold of that, and does:
 *
 *   1. the loading screen is the live copy (`GuestsLastCopy` → `GuestsScreen`), not the inert html snapshot;
 *   2. it needs NOTHING from the network — no fetch, no server action, and its only `import()` is the store
 *      every event page already shares (a new `import()` target would grow the shared bundle);
 *   3. it is small: a 200-guest copy stays under COPY_BUDGET_CHARS (~0.36 KB a guest, long names, a group
 *      and a table each) — the store's own
 *      ceiling is far above it, and reading it back is one `JSON.parse`;
 *   4. its first draw is the list's own first draw — at most ROW_WINDOW rows, the rest at idle;
 *   5. it round-trips: saved, read back and drawn, the copy shows the same names and counts.
 *
 * Sabotage (2026-10-16, each turned this file red, then reverted): loading.tsx back to the html
 * `LastSeenFallback` → test 1 red · a second `import()` target in guest-list-copy.ts → test 2 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { guestRow, renderGuestsScreen } from './_components/render-guests-screen';
import { ROW_WINDOW } from './_components/guests-screen';
import { guestListCopyOf, guestListFromCopy, toGuestListRow } from '@/lib/guest-list-rows';
import { MAX_ENTRY_CHARS, readLastSeenData, saveLastSeenData, type LastSeenStorage } from '@/lib/last-seen/store';
import type { GuestRow } from '@/lib/guests';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

/** The most a 200-guest copy may weigh, in characters. */
const COPY_BUDGET_CHARS = 200 * 360;

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

const ROLES = ['bride', 'groom', 'groomsman', 'bridesmaid', 'principal_sponsor_ninong', 'guest'] as const;
const twoHundred: GuestRow[] = Array.from({ length: 200 }, (_, i) =>
  guestRow({
    first_name: `María Concepción ${i}`,
    last_name: 'Dela Peña-Buanhog',
    middle_name: 'Reyes',
    name_prefix: 'Mrs.',
    role: i < 2 ? ROLES[i] : ROLES[2 + (i % 4)],
    side: i % 2 ? 'groom' : 'bride',
    custom_tags: ['vip'],
    mobile: '+639171234567',
    email: 'maria@example.com',
    notes: 'Private — the couple only',
    guest_note: 'So happy for you both!',
    qr_token: 'secret',
  } as never),
);
const list = twoHundred.map(toGuestListRow);
const copy = guestListCopyOf({
  guests: list,
  hasSides: true,
  groupsByGuest: Object.fromEntries(list.map((g) => [g.guest_id, ['Cousins']])),
  tableByGuest: Object.fromEntries(list.map((g, i) => [g.guest_id, `Table ${1 + (i % 20)}`])),
  faceByGuest: {},
  requests: 2,
  rootLabel: 'Ana & Ben',
  roleNames: {},
});

test('1 · the loading screen is the live list from the phone, not a picture of it', () => {
  const loading = read('loading.tsx');
  assert.match(loading, /<GuestsLastCopy>/);
  assert.doesNotMatch(loading, /LastSeenFallback/, 'the inert html snapshot is not the Guest list’s loading screen');
  const shell = read('_components/guests-last-copy.tsx');
  assert.match(shell, /<GuestsScreen[\s\S]*?copy=\{\{ phase: refreshPhase\(\{ online, waitedMs: waited \}\), savedAt \}\}/);
  assert.match(shell, /useKeptGuestList\(true\)/);
});

test('2 · opening from the copy asks the network for nothing, and adds no import() target', () => {
  for (const f of ['_components/guests-last-copy.tsx', '_components/guest-list-copy.ts']) {
    const src = read(f);
    assert.doesNotMatch(src, /\bfetch\(/, `${f} fetches nothing`);
    assert.doesNotMatch(src, /from '\.\.\/[a-z-]*actions'|'use server'/, `${f} calls no server action`);
    const targets = [...src.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
    assert.ok(targets.every((t) => t === '@/lib/last-seen/client'), `${f} lazy-loads only the shared store: ${targets.join(', ')}`);
  }
});

test('3 · a 200-guest copy is small, and holds only what a row shows', () => {
  const json = JSON.stringify(copy);
  assert.ok(json.length <= COPY_BUDGET_CHARS, `200 guests kept in ${json.length} chars (budget ${COPY_BUDGET_CHARS})`);
  assert.ok(json.length < MAX_ENTRY_CHARS / 10, 'far inside the store’s own ceiling');
  for (const never of ['+639171234567', 'maria@example.com', 'Private — the couple only', 'secret', 'vip']) {
    assert.equal(json.includes(never), false, `the phone never keeps "${never}"`);
  }
  assert.ok(json.includes('So happy for you both!'), 'the guest’s own note IS on the row, so it is kept');
});

test('4 · the copy’s first draw is the list’s own first draw — at most ROW_WINDOW rows', async () => {
  const back = guestListFromCopy(JSON.parse(JSON.stringify(copy)), Date.now());
  assert.ok(back);
  const html = await renderGuestsScreen({ guests: back!.rows as never, copy: { phase: 'updating', savedAt: Date.now() } });
  const rows = (html.match(/data-guest-row=""/g) ?? []).length;
  assert.ok(rows > 0 && rows <= ROW_WINDOW, `${rows} rows drawn first (window ${ROW_WINDOW})`);
  assert.match(html, /List<b[^>]*>.*?200/s, '"List 200" — the copy’s own count');
});

test('5 · saved, read back and drawn, the copy shows the same people', () => {
  const storage = memoryStorage();
  const url = '/dashboard/e1/guests';
  assert.equal(saveLastSeenData(storage, { userId: 'ana', eventId: 'e1', page: 'guests', url, data: copy }), true);
  const hit = readLastSeenData(storage, { userId: 'ana', eventId: 'e1', page: 'guests', url });
  assert.ok(hit);
  const back = guestListFromCopy(hit!.data, hit!.savedAt);
  assert.ok(back);
  assert.equal(back!.rows.length, 200);
  assert.equal(back!.rows[7].first_name, 'María Concepción 7', 'ñ and accents survive');
  assert.deepEqual(back!.rows[7].custom_tags, [], 'a field the phone did not keep comes back empty, never undefined');
  assert.equal(back!.tableByGuest[back!.rows[7].guest_id], 'Table 8');
});
