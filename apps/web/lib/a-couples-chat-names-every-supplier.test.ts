/**
 * A COUPLE'S CHAT NAMES EVERY SUPPLIER — never the bare word "Supplier" as a name.
 *
 * Owner, live, 2026-10-28 (couple's Chats › Suppliers): one thread read "Supplier", avatar "S", and its thread head
 * said "Supplier" too — "the 1 supplier is not named on chat. Why did she not show properly". The pages read the shop
 * through a `vendor_profiles` embed under the couple's RLS, which refuses every shop that is not public + verified;
 * the NULL then printed the literal 'Supplier'. A refused read that renders as a plausible name — the repo's
 * reads-are-honest disease (`app/vendor-dashboard/reads-are-honest.test.ts`, `lib/guests-read-is-honest.test.ts`).
 *
 * The cause and the fix are proven per SHOP STATE in `tests/db/a-couple-sees-every-suppliers-chat-name.db.test.ts`.
 * This file holds the two render paths to it:
 *   1 · `threadSupplierName` never yields the bare word, whatever the row — including the revealed-but-empty name the
 *       resolver itself turns into 'Supplier', and a missing row.
 *   2 · the list builder's own fallback is the honest line, not the word.
 *   3 · the couple's Chats list and thread page take their name from `readCoupleThreadSupplierNames` and nowhere
 *       else — no `'Supplier'` literal, no `vendor_profiles` read behind the thread head.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  SUPPLIER_NAME_UNREADABLE,
  nameForThread,
  threadSupplierName,
  type CoupleThreadSupplierRow,
} from './chat-supplier-names';
import { buildCoupleConversationRows } from './conversation-list';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));

const isBareWord = (name: string) => /^\s*(supplier|vendor)\s*$/i.test(name);

const base: CoupleThreadSupplierRow = {
  thread_id: 't1',
  vendor_profile_id: 'v1',
  name_revealed: false,
  business_name: null,
  logo_url: null,
  screen_name: null,
  primary_service: null,
  location_city: null,
};

test('threadSupplierName never prints the bare word, for any row shape', () => {
  const cases: Array<[string, CoupleThreadSupplierRow | null]> = [
    ['missing row', null],
    ['all empty, pre-reveal', base],
    ['revealed with an EMPTY business name', { ...base, name_revealed: true, business_name: '' }],
    ['revealed with a blank business name', { ...base, name_revealed: true, business_name: '   ' }],
    ['revealed with a NULL business name', { ...base, name_revealed: true }],
    ['pre-reveal with a screen name', { ...base, screen_name: 'Manila Band #1001' }],
    ['pre-reveal with service + city', { ...base, primary_service: 'florist', location_city: 'Cebu' }],
    ['revealed', { ...base, name_revealed: true, business_name: 'Saysay Host and Band' }],
  ];
  for (const [what, row] of cases) {
    const label = threadSupplierName(row);
    assert.ok(label.name.trim().length > 0, `${what}: empty name`);
    assert.ok(!isBareWord(label.name), `${what}: printed "${label.name}"`);
  }
  assert.equal(threadSupplierName(null).name, SUPPLIER_NAME_UNREADABLE);
  assert.equal(threadSupplierName(null).readable, false);
  assert.equal(nameForThread({ byThread: new Map(), byShop: new Map(), failed: true }, 'x').name, SUPPLIER_NAME_UNREADABLE);
});

test('pre-reveal never shows the business name or the logo, even if a row carried them', () => {
  const leaky = { ...base, business_name: 'Real Name Co', logo_url: 'logos/x.webp', screen_name: 'Cebu Florist #2' };
  const label = threadSupplierName(leaky);
  assert.equal(label.name, 'Cebu Florist #2');
  assert.equal(label.logoUrl, null);
  assert.equal(label.revealed, false);
});

test('the couple list builder falls back to the honest line, not the word', async () => {
  const supabase = {
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'not', 'is', 'order', 'limit']) q[m] = () => q;
      (q as { then: unknown }).then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
      return q;
    },
  } as never;
  const rows = await buildCoupleConversationRows({
    supabase,
    eventId: 'e1',
    threads: [{ thread_id: 't1', vendor_profile_id: 'v-unknown', inquiry_status: 'accepted', updated_at: new Date().toISOString() }],
    displayNames: new Map(),
    labels: new Map(),
    lastMessages: new Map(),
    unreadThreadIds: new Set(),
    formatTime: () => 'now',
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.displayName, SUPPLIER_NAME_UNREADABLE);
  assert.equal(rows[0]!.initials, '?', 'an unread name is a question mark, not the initials of the sentence');
});

const COUPLE_PAGES = [
  'app/dashboard/[eventId]/messages/page.tsx',
  'app/dashboard/[eventId]/messages/[threadId]/page.tsx',
] as const;

test('the couple’s Chats list and thread page take every supplier name from the one honest reader', () => {
  for (const rel of COUPLE_PAGES) {
    const src = read(rel);
    assert.ok(src.length > 2000, `${rel}: read ${src.length} chars — the guard would be asserting against a blank`);
    const literals = src.match(/['"`]Supplier['"`]/g) ?? [];
    assert.equal(literals.length, 0, `${rel}: prints the literal 'Supplier' (${literals.length}×) — a refused read looks like a name`);
    const readers = src.match(/readCoupleThreadSupplierNames\(/g) ?? [];
    assert.equal(readers.length, 1, `${rel}: expected ONE readCoupleThreadSupplierNames call, found ${readers.length}`);
    // The name must not come back from the RLS-refused embed or a resolver run on it.
    assert.equal((src.match(/resolveVendorDisplayName\(/g) ?? []).length, 0, `${rel}: resolves a name outside the reader`);
    assert.equal((src.match(/\bt\.vendor\b/g) ?? []).length, 0, `${rel}: reads the thread's vendor_profiles embed`);
  }
  // The thread head reads no vendor_profiles row at all — that read is what RLS refused.
  const thread = read(COUPLE_PAGES[1]);
  assert.equal((thread.match(/from\(\s*['"]vendor_profiles['"]\s*\)/g) ?? []).length, 0, 'thread page reads vendor_profiles');
});
