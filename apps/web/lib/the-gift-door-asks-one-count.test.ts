/**
 * ⚡ THE WELCOME GIFT DOOR'S WISH LINE COSTS ONE COUNT — AND NOTHING WHEN THERE
 * IS NO E-GIFTS (owner rule 2026-10-08: "the least amount of request for the
 * tasks to be done"; controller-2026-10-08/COMMON.md rules 1 · 2 · 6 · 8;
 * SPEED-PLAN § 7, the wish list's change 3).
 *
 * ── WHAT IT COST BEFORE (read from the code) ───────────────────────────────
 * `loadDoorwayFacts` runs on EVERY guest page view. For the door's one line
 * ("Wish list · 4 things they'd love") it called the gift page's whole read —
 * every wish AND every gift's sum: two requests, one after the egift read — for
 * every event with a way to give switched on, wish list or not.
 *
 * ── WHAT THIS HOLDS ────────────────────────────────────────────────────────
 *   1 · BEHAVIOUR, on the real function over a counting client: the door's fact
 *       is ONE request — a count, head only, of this event's wishes with no Got
 *       it mark — and no row leaves the database;
 *   2 · asked at most ONCE per render, whichever service-role client asks (the
 *       loader is reached from the page, the room footer and the guest context,
 *       each with a client of its own) — and never remembered across renders;
 *   3 · EVENT-LEVEL: the function takes the event id and nothing about the
 *       reader, so it can be cached with the event's public bundle;
 *   4 · a count that could not be read is `null` — the door mentions no list;
 *   5 · the loader: the door no longer stands on the gift page's read, and the
 *       count is skipped entirely when no way to give is on (the fact the
 *       loader already holds — it folds in the gift route and "Accept gifts?").
 *
 * NOT SEEN: PostgREST itself. That `count: 'exact', head: true` answers with a
 * count and no rows is its documented behaviour; the client here is a stand-in.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08, builder EH):
 *   • the count asked without `askedOnce`                            → 2 red;
 *   • the count without its `got_at is null` filter                  → 1 red;
 *   • rows selected instead of a head count                          → 1 red;
 *   • a `guestId` parameter added to the function                    → 3 red;
 *   • a refused count answered as 0                                  → 4 red;
 *   • the loader back on `readGuestWishList`                         → 5 red;
 *   • the loader asking even with no way to give                     → 5 red.
 *
 * Run from apps/web:  npx tsx --test lib/the-gift-door-asks-one-count.test.ts
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { markServiceRoleClient, withRenderScopeForTest } from './request-once';
import { stripComments } from './strip-comments';

/* ── `server-only` shim (same as a-fee-lock-failure-keeps-its-reason.test.ts) ── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_gift_door_count__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

let L: typeof import('./wish-list.server');
before(async () => {
  L = await import('./wish-list.server');
});

const WEB = path.join(__dirname, '..');
const flat = (rel: string) => stripComments(readFileSync(path.join(WEB, rel), 'utf8')).replace(/\s+/g, ' ');

type Sent = { table: string; select: string; options: unknown; filters: string[] };

/** A service-role stand-in that records every request it is sent and answers a count. */
function counting(answer: { count: number | null; error: { message: string } | null } = { count: 4, error: null }) {
  const sent: Sent[] = [];
  const client = markServiceRoleClient({
    from(table: string) {
      return {
        select(select: string, options?: unknown) {
          const req: Sent = { table, select, options: options ?? null, filters: [] };
          const q = {
            eq(col: string, v: unknown) {
              req.filters.push(`${col}=${String(v)}`);
              return q;
            },
            is(col: string, v: unknown) {
              req.filters.push(`${col} is ${String(v)}`);
              return q;
            },
            then<A>(ok: (v: { data: null; count: number | null; error: { message: string } | null }) => A) {
              sent.push(req);
              return Promise.resolve({ data: null, ...answer }).then(ok);
            },
          };
          return q;
        },
      };
    },
  });
  return { client: client as unknown as SupabaseClient, sent };
}

const EVENT = '11111111-1111-4111-8111-111111111111';

test('1 · the door’s fact is ONE request: a head count of this event’s open wishes', async () => {
  const c = counting({ count: 4, error: null });
  assert.equal(await L.readOpenWishCount(c.client, EVENT), 4);
  assert.deepEqual(c.sent, [
    {
      table: 'event_wish_items',
      select: 'wish_item_id',
      /* A count, and NO rows: nothing a guest page has no use for leaves the database. */
      options: { count: 'exact', head: true },
      /* This event's, and still open — the same "open" the list itself draws (`got_at` is null). */
      filters: [`event_id=${EVENT}`, 'got_at is null'],
    },
  ]);
  /* The list's own rule for "open", so the door and the page can never count differently. */
  const guest = flat('lib/wish-list-guest.ts');
  assert.match(guest, /got: w\.got_at != null,/);
  assert.match(guest, /export function openWishCount\(wishes: readonly Pick<GuestWish, 'got'>\[\]\): number \{ return wishes\.filter\(\(w\) => !w\.got\)\.length; \}/);
});

test('2 · asked at most once per render, whichever service-role client asks — and never across renders', async () => {
  const a = counting();
  const b = counting();
  const c = counting();
  await withRenderScopeForTest(async () => {
    /* The page, the room footer and the guest context each hold a client of their own. */
    const answers = await Promise.all([L.readOpenWishCount(a.client, EVENT), L.readOpenWishCount(b.client, EVENT), L.readOpenWishCount(c.client, EVENT)]);
    assert.deepEqual(answers, [4, 4, 4]);
    assert.equal(a.sent.length + b.sent.length + c.sent.length, 1, 'one render asked the same count more than once');
    /* Another event is another question. */
    await L.readOpenWishCount(a.client, '22222222-2222-4222-8222-222222222222');
    assert.equal(a.sent.length + b.sent.length + c.sent.length, 2);
  });
  /* The next render starts from nothing — a wish added meanwhile is counted. */
  await withRenderScopeForTest(async () => {
    await L.readOpenWishCount(a.client, EVENT);
  });
  assert.equal(a.sent.length + b.sent.length + c.sent.length, 3, 'an answer outlived its render');
});

test('3 · event-level: the event id and nothing about the reader', () => {
  assert.equal(L.readOpenWishCount.length, 2, 'the door’s count takes more than a client and an event id');
  const s = flat('lib/wish-list.server.ts');
  const fn = s.slice(s.indexOf('export function readOpenWishCount('), s.indexOf('export async function readGuestWishList('));
  assert.match(fn, /^export function readOpenWishCount\(admin: SupabaseClient, eventId: string\): Promise<number \| null> \{ return askedOnce\(admin, 'open-wish-count', \[eventId\], async \(\) => \{/);
  assert.doesNotMatch(fn, /guest|cookie|session|viewer|user|token|headers\(/i, 'the door’s count knows who is reading — it could never be cached for everyone');
  assert.equal([...fn.matchAll(/\.from\(/g)].length, 1);
});

test('4 · a count that could not be read is null — never "0 things"', async () => {
  const refused = counting({ count: null, error: { message: 'timeout' } });
  const silenced = console.error;
  console.error = () => {};
  try {
    assert.equal(await L.readOpenWishCount(refused.client, EVENT), null);
  } finally {
    console.error = silenced;
  }
  /* A real zero is a zero. */
  assert.equal(await L.readOpenWishCount(counting({ count: 0, error: null }).client, EVENT), 0);
  assert.equal(await L.readOpenWishCount(counting({ count: null, error: null }).client, EVENT), null);
});

test('5 · the loader: one count, and none at all when no way to give is on', () => {
  const loaders = flat('app/[slug]/_lib/loaders.ts');
  const fn = loaders.slice(loaders.indexOf('export const loadDoorwayFacts = cache('), loaders.indexOf('export const loadGuestContext'));
  assert.ok(fn.length > 400, 'loadDoorwayFacts was not found');
  /* Skipped entirely by a fact this loader already holds — never asked "to find out". */
  assert.match(fn, /const openWishes = enabledEgiftCount > 0 \? await readOpenWishCount\(admin, eventId\) : null;/);
  assert.match(fn, /openWishCount: openWishes \?\? 0,/);
  assert.equal([...fn.matchAll(/readOpenWishCount\(/g)].length, 1);
  /* …and that fact is zero when the gift route is dark, the host said No, or no way is switched on. */
  assert.match(fn, /pabuyaRouteEnabled \? fetchEgiftMethods\(admin, eventId, \{ enabledOnly: true \}\)\.then\(\(m\) => m\.length\) : Promise\.resolve\(0\),/);
  assert.match(flat('lib/egift.ts'), /if \(giftsSwitch && !giftsSwitch\.error && giftsSwitch\.data && !giftsAreOn\(\(giftsSwitch\.data as \{ gifts_on\?: unknown \}\)\.gifts_on\)\) \{ return \{ methods: \[\], read: true \}; \}/);
  /* The door no longer stands on the gift page's whole read, and takes no reader. */
  assert.doesNotMatch(loaders, /readGuestWishList|GIFT_SUM_FIELDS|event_gift_records/, 'a guest page view reads the gift records for the door');
  assert.match(fn, /async \( admin: AdminClient, eventId: string, eventType: string \| null, \): Promise</, 'the doorway loader was handed a reader');
  /* The gift PAGE itself still reads its list — there it is the content, and it is read once. */
  const page = flat('app/[slug]/pabuya/page.tsx');
  assert.equal([...page.matchAll(/readGuestWishList\(/g)].length, 1);
});
