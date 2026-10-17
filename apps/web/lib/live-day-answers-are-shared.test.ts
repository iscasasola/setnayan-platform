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
