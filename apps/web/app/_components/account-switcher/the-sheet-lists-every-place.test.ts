/**
 * Guard: THE AVATAR SHEET LISTS EVERY PLACE THIS LOGIN CAN BE, AND ITS COUNTS ARE THE BELL'S, TOLD HONESTLY.
 *
 * Direction 2 "Profile header" (owner 2026-10-22: "Direction 2"; reference: Facebook's account switcher). Three
 * properties, each of which shipped wrong at least once in the shape it replaces:
 *
 *   1. ONE ROW PER SHOP. The rail drew `vendorProfiles[0]` — a helper in two shops saw one, and the supplier pages
 *      could only ever open the first. The sheet maps every reachable shop — every shop the login OWNS and every
 *      shop it helps in (owner 2026-10-22) — and the shop-id switch (lib/active-shop.ts) opens the one they pressed.
 *      That every server read follows the same switch is held by lib/the-active-shop-is-resolved-once.test.ts.
 *   2. "• N new" IS THE BELL'S OWN SET, SPLIT BY PLACE — the row counts add up to the bell, a shop count is drawn only
 *      when it can be attributed to one shop, and a refused or partial read draws NOTHING (never 0).
 *   3. THE SWITCH CHECKS BEFORE IT WRITES — the route admits only this login's reachable shops.
 *
 * Run: `node --import tsx --test app/_components/account-switcher/the-sheet-lists-every-place.test.ts` from apps/web.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { newLabel, readSheetUnreadUrls, splitSheetUnread, SHEET_UNREAD_CEILING } from '@/lib/avatar-sheet-counts';
import { pickActiveShop, reachableShops } from '@/lib/active-shop';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SHEET = 'app/_components/account-switcher/account-switcher.tsx';
const DATA = 'app/_components/account-switcher/get-switcher-data.ts';
const ROUTE = 'app/vendor-dashboard/switch-shop/route.ts';
const RESOLVER = 'lib/vendor-profile.ts';
const SIGN_OUT = 'app/auth/sign-out/route.ts';

/* ─── 1 · the counts ─────────────────────────────────────────────────────── */

const URLS = [
  '/admin/payments',
  '/admin',
  '/administrator-guide', // not HQ's: a prefix match on "/admin" would steal it
  '/vendor-dashboard/messages/T1',
  '/vendor-dashboard',
  '/dashboard/E1/guests',
  null,
  '',
  '/v/setnaprod',
];

test('the row counts are the bell\'s set split by place — they add up to it', () => {
  for (let n = 0; n <= URLS.length; n++) {
    const set = URLS.slice(0, n);
    const one = splitSheetUnread(set, 1);
    assert.equal(one.events + (one.shop ?? 0) + one.admin, set.length, `a split of ${n} lost or invented a count`);
  }
  const all = splitSheetUnread(URLS, 1);
  assert.deepEqual(all, { events: 5, shop: 2, admin: 2 });
});

test('a shop count is drawn only when ONE shop is listed — and it never leaks into Your events', () => {
  for (const rows of [0, 2, 3]) {
    const s = splitSheetUnread(URLS, rows);
    assert.equal(s.shop, null, `${rows} shop rows drew a shop count it cannot attribute`);
    assert.equal(s.events, 5, `${rows} shop rows moved the shop's notifications into Your events`);
  }
});

test('a failed, thrown or partial read answers null (draws nothing), a whole read answers the set', async () => {
  const fake = (result: unknown, throws = false) =>
    ({
      from: () => {
        const q = {
          select: () => q,
          eq: () => q,
          is: () => q,
          range: async () => {
            if (throws) throw new Error('offline');
            return result;
          },
        };
        return q;
      },
    }) as never;

  assert.equal(await readSheetUnreadUrls(fake({ data: null, error: { message: 'denied' }, count: null }), 'u'), null);
  assert.equal(await readSheetUnreadUrls(fake(null, true), 'u'), null);
  assert.equal(
    await readSheetUnreadUrls(fake({ data: [{ related_url: '/admin' }], error: null, count: 3 }), 'u'),
    null,
    'a read that returned 1 of 3 rows was split as if it were all of them',
  );
  assert.equal(await readSheetUnreadUrls(fake({ data: [], error: null, count: null }), 'u'), null);
  assert.deepEqual(
    await readSheetUnreadUrls(fake({ data: [{ related_url: '/admin' }, { related_url: null }], error: null, count: 2 }), 'u'),
    ['/admin', null],
  );
  assert.ok(SHEET_UNREAD_CEILING >= 100);
});

test('"N new" is drawn for a real positive count only — never "0 new", never for unknown', () => {
  for (const n of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(newLabel(n as number | null | undefined), null, `newLabel(${String(n)}) drew something`);
  }
  assert.equal(newLabel(3), '3 new');
});

test('every count on the sheet goes through the one drawer, and the drawer refuses what newLabel refuses', () => {
  const sheet = code(SHEET);
  assert.match(sheet, /const label = newLabel\(n\);\s*if \(!label\) return null;/, 'NewCount draws without newLabel');
  const raw = [...sheet.matchAll(/unread\?\.(events|shop|admin)/g)];
  assert.ok(raw.length >= 3, `expected the three row counts, found ${raw.length}`);
  for (const m of raw) {
    const before = sheet.slice(Math.max(0, (m.index ?? 0) - 20), m.index);
    assert.match(before, /<NewCount n=\{$/, `a row reads unread?.${m[1]} outside <NewCount> — it can draw a 0`);
  }
});

/* ─── 2 · one row per shop ───────────────────────────────────────────────── */

test('the sheet draws one row per listed shop, and the list is every reachable shop — not the first', () => {
  const sheet = code(SHEET);
  assert.match(sheet, /\{shops\.map\(\(shop\) => \{/, 'the sheet no longer maps the shop list');
  assert.doesNotMatch(sheet, /vendorName/, 'the sheet is back to drawing one shop by name');
  const data = code(DATA);
  assert.match(data, /const listed = reachableShops\(roles\.vendorProfiles\)/);
  assert.match(data, /shops: listed\.map\(/);
});

test('every shop is offered — the ones this login owns and the ones it helps in', () => {
  const own = { id: 'A', owned: true };
  const seatB = { id: 'B', owned: false };
  const seatC = { id: 'C', owned: false };
  assert.deepEqual(reachableShops([own, seatB]), [own, seatB], 'an owner was not offered the shop they help in');
  assert.deepEqual(reachableShops([seatB, seatC]), [seatB, seatC]);
  assert.deepEqual(reachableShops([]), []);
});

test('the resolver opens the chosen shop only when it is theirs', () => {
  assert.deepEqual(pickActiveShop(['A'], ['B', 'C'], 'C'), { vendorProfileId: 'C', owned: false });
  assert.deepEqual(pickActiveShop([], ['B', 'C'], 'Z'), { vendorProfileId: 'B', owned: false }, 'a foreign id was opened');
  assert.deepEqual(pickActiveShop([], ['B', 'C'], null), { vendorProfileId: 'B', owned: false });
  assert.equal(pickActiveShop([], [], 'B'), null, 'an id with no seat behind it was opened');
});

test('fetchOwnVendorProfile has ONE path — the active-shop resolver, owner and helper alike', () => {
  const src = code(RESOLVER);
  assert.doesNotMatch(src, /selectVendorProfileBy\(supabase, 'user_id', userId\)/, 'the owner path is back, and it cannot follow a switch');
  assert.match(src, /const active = await resolveActiveShop\(supabase, userId\);/);
});

/* ─── 3 · the switch checks before it writes ─────────────────────────────── */

test('the shop switch writes the cookie only for a shop this login can reach, read fresh', () => {
  const src = code(ROUTE);
  assert.match(src, /export async function POST\(/, 'the switch is not POST-only');
  assert.doesNotMatch(src, /export async function GET\(/, 'a GET can flip which shop a person stands in');
  const check = src.indexOf('reachableShops(roles.vendorProfiles).some(');
  const refuse = src.indexOf('if (!allowed) return response;');
  const write = src.indexOf('response.cookies.set(ACTIVE_SHOP_COOKIE');
  assert.ok(check > 0 && refuse > check && write > refuse, 'the cookie is written before the shop is checked');
  assert.match(src.slice(write, write + 200), /httpOnly: true/, 'the chosen shop is readable by page script');
});

test('signing out forgets the chosen shop', () => {
  assert.match(code(SIGN_OUT), /HOST_PREVIEW_PASS_COOKIE_NAME, ACTIVE_SHOP_COOKIE\]/);
});
