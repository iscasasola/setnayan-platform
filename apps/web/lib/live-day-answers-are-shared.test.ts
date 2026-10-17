/**
 * live-day-answers-are-shared.test.ts — ON THE DAY, A PHONE'S POLL COSTS THE DATABASE NOTHING NEW (2026-10-18).
 *
 * Owner, 2026-10-18: "make sure app will not collapse when a lot of users are … connecting to the event". Every open
 * guest phone asks the server the same questions on a timer while the event is live. Measured in the lab before this
 * change (one guest, page left open): the hub cost the database 34–50 requests a MINUTE, the event page 29 — and every
 * one of those was multiplied by the number of guests at the venue. The answers were the same for all of them.
 *
 *   1 · `rememberedLiveRead` — 200 phones asking one event's answer inside the window are ONE database read; a refusal
 *       is never remembered; an answer marked `notRemembered` reaches this caller only; a broken cache is a direct read.
 *   2 · the photo wall's feed (`/[slug]/live-wall`) answers through it, per EVENT, and remembers ONLY an open wall —
 *       a 404 makes the block stop polling for good, so remembering one guest's failed read as "closed" would switch
 *       the wall off on every phone at the venue.
 *
 * Every assertion below has been seen red by a sabotage (see the PR body).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { herdDelay, jittered } from './live-day-timing';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
async function cacheModule() {
  return import('./live-day-cache');
}

type FakeCache = { entries: Map<string, unknown>; failGet: boolean };
function installDataCache(): FakeCache {
  const fake: FakeCache = { entries: new Map(), failGet: false };
  (globalThis as { __incrementalCache?: unknown }).__incrementalCache = {
    isOnDemandRevalidate: false,
    async generateSimpleCacheKey(key: string) {
      return key;
    },
    async get(key: string) {
      if (fake.failGet) throw new Error('the data cache is down');
      const value = fake.entries.get(key);
      return value ? { value, isStale: false } : null;
    },
    async set(key: string, value: unknown) {
      fake.entries.set(key, value);
    },
  };
  return fake;
}
function removeDataCache(): void {
  delete (globalThis as { __incrementalCache?: unknown }).__incrementalCache;
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── 1 · the shared answer ────────────────────────────────────────────────────

test('1 · two hundred phones asking one event inside the window are ONE database read', async () => {
  const { rememberedLiveRead } = await cacheModule();
  installDataCache();
  try {
    let reads = 0;
    const load = async () => {
      reads += 1;
      return { tiles: ['t1'], count: 1 };
    };
    for (let phone = 0; phone < 200; phone++) {
      assert.deepEqual(await rememberedLiveRead('test-wall-v1:maria', 'maria', load), { tiles: ['t1'], count: 1 });
    }
    assert.equal(reads, 1, `${reads} database reads for 200 phones — the answer is being read per phone again`);
    // Another event is its own answer.
    await rememberedLiveRead('test-wall-v1:jose', 'jose', load);
    assert.equal(reads, 2, 'two events shared one answer');
  } finally {
    removeDataCache();
  }
});

test('1 · a refused read is never remembered — the next phone asks again', async () => {
  const { rememberedLiveRead } = await cacheModule();
  installDataCache();
  try {
    let reads = 0;
    await assert.rejects(
      rememberedLiveRead('test-refused-v1', 'e', async () => {
        reads += 1;
        throw new Error('PGRST003');
      }),
      /PGRST003/,
    );
    const next = await rememberedLiveRead('test-refused-v1', 'e', async () => {
      reads += 1;
      return 'answered';
    });
    assert.equal(next, 'answered', 'the refusal was handed to the next phone');
    assert.equal(reads, 2);
  } finally {
    removeDataCache();
  }
});

test('1 · `notRemembered` answers THIS phone and stores nothing for the others', async () => {
  const { rememberedLiveRead, notRemembered } = await cacheModule();
  installDataCache();
  try {
    let reads = 0;
    const closed = await rememberedLiveRead('test-blip-v1', 'e', async () => {
      reads += 1;
      return notRemembered({ status: 404 });
    });
    assert.deepEqual(closed, { status: 404 }, 'the caller did not get its own honest answer');
    const open = await rememberedLiveRead('test-blip-v1', 'e', async () => {
      reads += 1;
      return { status: 200 };
    });
    assert.deepEqual(open, { status: 200 }, 'one phone’s "closed" was handed to the next phone');
    assert.equal(reads, 2);
  } finally {
    removeDataCache();
  }
});

test('1 · when the data cache cannot run, the read is asked directly (never an outage)', async () => {
  const { rememberedLiveRead, notRemembered } = await cacheModule();
  removeDataCache();
  let reads = 0;
  const load = async () => {
    reads += 1;
    return 'row';
  };
  assert.equal(await rememberedLiveRead('test-nocache-v1', 'e', load), 'row');
  assert.equal(
    await rememberedLiveRead('test-nocache-v1', 'e', async () => notRemembered('only-mine')),
    'only-mine',
    'outside Next a notRemembered answer must still reach its caller',
  );
  const fake = installDataCache();
  try {
    fake.failGet = true;
    assert.equal(await rememberedLiveRead('test-broken-v1', 'e', load), 'row', 'a broken cache became a failure');
  } finally {
    removeDataCache();
  }
  assert.ok(reads >= 2);
});

test('1 · the spacing arithmetic — ± 20 % around the base, and a herd spread over [0, max)', () => {
  assert.equal(jittered(25_000, 0.2, () => 0), 20_000);
  assert.equal(jittered(25_000, 0.2, () => 1), 30_000);
  assert.equal(jittered(25_000, 0.2, () => 0.5), 25_000);
  assert.equal(herdDelay(3_000, () => 0), 0);
  assert.ok(herdDelay(3_000, () => 0.9999) < 3_000);
});

// ── 2 · the photo wall's feed ────────────────────────────────────────────────

test('2 · the wall feed answers through the per-event cache, keyed by the event', () => {
  const route = read('app/[slug]/live-wall/route.ts');
  assert.match(
    route,
    /rememberedLiveRead\(`live-wall-v\d+:\$\{key\}`, key, \(\) => wallAnswer\(key\)\)/,
    'the wall feed is read per phone again — it must answer through rememberedLiveRead, keyed by the event',
  );
  // The answer must not depend on the asker: the snapshot is read with no viewer, and no cookie is touched.
  assert.match(route, /getWallSnapshot\(event\.event_id, null,/);
  assert.doesNotMatch(route, /cookies\(|readGuestSession\(|createClient\(\)/, 'a per-viewer read inside a shared answer');
});

test('2 · only an OPEN wall is remembered or cached at the edge — a closed answer stops every phone for good', () => {
  const route = read('app/[slug]/live-wall/route.ts');
  const body = route.slice(route.indexOf('async function wallAnswer'), route.indexOf('export async function GET'));
  // Every 404/503 path in the answer is notRemembered.
  const closings = body.match(/return [^;]*(NOT_FOUND|status: 503)[^;]*;/g) ?? [];
  assert.ok(closings.length >= 4, `expected the four closing paths, saw ${closings.length}`);
  for (const c of closings) {
    assert.match(c, /notRemembered/, `a closing answer is remembered for every phone: ${c}`);
  }
  // A failed event read is an OUTAGE (the block retries), never a refusal (the block stops for good).
  assert.match(body, /if \(error\) return notRemembered<WallAnswer>\(\{ status: 503/);
  // The edge only ever holds an open, fully measured wall.
  assert.match(route, /answer\.status === 200 && answer\.body\.challengeMeasured !== false \? EDGE_CACHE : 'no-store'/);
  assert.match(route, /s-maxage=\d+/);
});

test('2 · the wall block spaces its polls (± 20 %) and still stops on a refusal', () => {
  const block = read('app/[slug]/_components/live-wall-block.tsx');
  assert.match(block, /jittered\(POLL_MS\)/, 'the wall polls in step again — every phone at the venue at once');
  assert.match(block, /document\.visibilityState !== 'visible'\) return;/, 'a hidden phone must poll nothing');
  assert.doesNotMatch(block, /setInterval\(\(\) => void poll\(\), POLL_MS\)/);
});

// ── 4 · the watch link's poll ────────────────────────────────────────────────

test('4 · the watch poll answers through the per-event cache, with ONE event read', () => {
  const route = read('app/api/live/[slug]/watch/route.ts');
  assert.match(route, /rememberedLiveRead\(`live-watch-v\d+:\$\{key\}`, key, \(\) => watchAnswer\(key\)\)/);
  const answer = route.slice(route.indexOf('async function watchAnswer'), route.indexOf('export async function GET'));
  // The slug read carries both links — no second events read on the ordinary path.
  assert.match(answer, /\.select\('event_id, panood_watch_url, panood_watch_url_facebook'\)/);
  const ordinary = answer.slice(0, answer.indexOf('} else if (eventError)'));
  assert.equal((ordinary.match(/\.from\('events'\)/g) ?? []).length, 1, 'the ordinary path reads the event row more than once');
  // The broadcast row is asked only when no link decides it.
  assert.match(answer, /const latestBroadcastStatus = watchLive \? null : await getLatestPanoodBroadcastStatus\(eventId\);/);
});

test('4 · an unreadable status or a missing event is never shared — and never cached at the edge', () => {
  const route = read('app/api/live/[slug]/watch/route.ts');
  assert.match(route, /return state === 'unknown' \? notRemembered\(answer\) : answer;/, "'unknown' was remembered for every phone");
  assert.match(route, /return notRemembered<WatchAnswer>\(\{ status: 404/, 'a missing event was remembered');
  assert.match(route, /answer\.body\.state !== 'unknown'/);
  assert.match(route, /'Cache-Control': definite \? EDGE_CACHE : 'no-store'/);
  assert.match(route, /EDGE_CACHE = 'public, max-age=0, s-maxage=\d+, stale-while-revalidate=\d+'/);
  assert.doesNotMatch(route, /'public, max-age=15'/, 'the browser-only cache is back — it never reached the CDN');
});

test('4 · a hidden phone does not poll the watch link', () => {
  const embed = read('app/[slug]/_components/watch-live-embed.tsx');
  assert.match(embed, /setInterval\(async \(\) => \{\s*if \(document\.visibilityState !== 'visible'\) return;/);
});

// ── 3 · the run-of-show and the announcement: no herd on a change ───────────

const block = (id: string, start: string, state: 'upcoming' | 'live' | 'done') => ({
  block_id: id,
  label: id,
  start_at: start,
  end_at: null,
  location: null,
  run_state: state,
  actual_start_at: null,
  block_type: '',
  is_public: true,
});
const row = (over: Record<string, unknown>) => ({
  block_id: 'b2',
  label: 'Dinner',
  start_at: '2026-10-18T19:00:00+08:00',
  end_at: null,
  location: 'Hall',
  run_state: 'live',
  actual_start_at: '2026-10-18T19:02:00+08:00',
  block_type: 'dinner',
  is_public: true,
  audience: null,
  visibility: 'couple',
  ...over,
});

test('3 · an advance is applied from its payload — the guest’s phone reads nothing', async () => {
  const { applyGuestBlockChange } = await import('./run-of-show-live');
  const blocks = [block('b1', '2026-10-18T17:00:00+08:00', 'live'), { ...block('b2', '2026-10-18T19:00:00+08:00', 'upcoming'), label: 'Dinner' }];
  const next = applyGuestBlockChange(blocks, { eventType: 'UPDATE', new: row({}) });
  assert.ok(next, 'a complete payload was sent back for a re-read');
  assert.equal(next!.find((b) => b.block_id === 'b2')!.run_state, 'live');
  assert.equal(next!.find((b) => b.block_id === 'b2')!.actual_start_at, '2026-10-18T19:02:00+08:00');
  assert.deepEqual(next!.map((b) => b.block_id), ['b1', 'b2'], 'the advance moved the line');
  // DELETE takes the line off; INSERT puts it in time order.
  assert.deepEqual(applyGuestBlockChange(next!, { eventType: 'DELETE', old: { block_id: 'b1' } })!.map((b) => b.block_id), ['b2']);
  const inserted = applyGuestBlockChange(next!, { eventType: 'INSERT', new: row({ block_id: 'b0', start_at: '2026-10-18T15:00:00+08:00', run_state: 'done' }) });
  assert.deepEqual(inserted!.map((b) => b.block_id), ['b0', 'b1', 'b2']);
});

test('3 · the guests’ fence holds on a payload — a hidden line never appears, and unknown is never "show"', async () => {
  const { applyGuestBlockChange } = await import('./run-of-show-live');
  const { rowGuestsMaySee } = await import('./schedule');
  const blocks = [block('b2', '2026-10-18T19:00:00+08:00', 'upcoming')];
  // Each failing condition takes the line OFF the guests' list.
  for (const bad of [{ is_public: false }, { audience: ['entourage'] }, { visibility: 'coordinator_only' }]) {
    assert.equal(rowGuestsMaySee(row(bad)), 'no');
    assert.deepEqual(applyGuestBlockChange(blocks, { eventType: 'UPDATE', new: row(bad) }), [], `a ${JSON.stringify(bad)} line stayed on the guests' phones`);
    assert.deepEqual(applyGuestBlockChange([], { eventType: 'INSERT', new: row(bad) }), [], `a ${JSON.stringify(bad)} line reached the guests' phones`);
  }
  // A payload missing a fence column cannot be judged: it is re-read through the fence, never shown.
  for (const missing of ['is_public', 'audience', 'visibility']) {
    const r: Record<string, unknown> = row({});
    delete r[missing];
    assert.equal(rowGuestsMaySee(r), 'unknown');
    assert.equal(applyGuestBlockChange(blocks, { eventType: 'UPDATE', new: r }), null, `a payload without ${missing} was shown to guests`);
  }
  assert.equal(applyGuestBlockChange(blocks, { eventType: 'UPDATE', new: { block_id: 'b2' } }), null);
  assert.equal(applyGuestBlockChange(blocks, { eventType: 'DELETE', old: {} }), null);
});

test('3 · the guests’ header applies the change; only hosts re-read on every change', () => {
  const header = read('app/_components/run-of-show-header.tsx');
  assert.match(header, /const next = applyGuestBlockChange\(blocksRef\.current, change\);\s*if \(next\) setBlocks\(next\);\s*else reread\(\);/);
  // The subscription hands the payload over; the bare re-read on every change is gone.
  assert.match(header, /\(change\) => \{\s*onChange\(change as BlockChange\);\s*\}/);
  assert.doesNotMatch(header, /'postgres_changes',[\s\S]{0,400}?\(\) => \{\s*void refetch\(\);/, 'every change re-reads again — a herd per advance');
  // A guest's re-read (and the one after a reconnect) waits a random moment.
  assert.match(header, /herdDelay\(GUEST_REREAD_SPREAD_MS\)/);
  assert.match(header, /if \(subscribedOnce\.current\) reread\(\);/);
});

test('3 · the announcement: one read per event, the writer forgets it BEFORE the ping, phones spread their asks', () => {
  const action = read('app/[slug]/announcement-actions.ts');
  assert.match(action, /rememberedLiveRead\(`announcement-v\d+:\$\{eventId\}`, eventId,/);
  assert.match(action, /latest === BROADCASTS_UNREADABLE \? notRemembered\(latest\) : latest/, 'a refused read became every guest’s answer');
  // The per-guest gate stays per request, outside the shared answer.
  assert.ok(action.indexOf('readGuestSession()') < action.indexOf('rememberedLiveRead('), 'the cookie check must come first');
  const writer = read('app/dashboard/[eventId]/_actions/day-of-broadcast.ts');
  const forget = writer.indexOf('revalidateTag(liveDayTag(eventId))');
  const ping = writer.indexOf('.channel(`announce:${eventId}`)');
  assert.ok(forget > 0 && ping > 0 && forget < ping, 'the remembered announcement must be forgotten BEFORE the ping — or phones read the old words');
  const card = read('app/[slug]/_components/day-of-announcement.tsx');
  assert.match(card, /herdDelay\(PING_SPREAD_MS\)/, 'every phone asks the instant the ping lands');
  assert.match(card, /const pull = async \(\) => \{\s*if \(document\.visibilityState !== 'visible'\) return;/, 'a pocketed phone asks every 45 s again');
});
