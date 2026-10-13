/**
 * global-settings-cache.test.ts — THE PLATFORM'S SETTINGS ARE REMEMBERED, A
 * REFUSAL NEVER IS, AND EVERY WRITER FORGETS (2026-10-13, guest-load fix).
 *
 *   1 · a remembered read sends no request — the second page of a visit asks
 *       the database nothing about the bundle list, the promo windows, …;
 *   2 · a REFUSED read is not remembered: the next page asks again;
 *   3 · when the data cache itself cannot run, the read is asked directly — a
 *       broken cache must never become a caller's fallback while the database
 *       answers (every privacy control OFF, the bundle const);
 *   4 · every app file that WRITES one of the remembered tables clears its tag
 *       (`revalidateTag(GLOBAL_SETTINGS_TAGS.…)`), so an admin edit is seen on
 *       the next page and not a minute later — and the bundle list, which only
 *       a migration writes, stays that way.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { GLOBAL_SETTINGS_TAGS } from './global-settings-tags';
import { stripComments } from './strip-comments';

// Next's server runtime puts `AsyncLocalStorage` on globalThis before any of its
// modules load; plain node does not. So it is set here, and the module under
// test (which loads Next's) is imported only after (`rememberedGlobalRead`).
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
async function rememberedGlobalRead<T>(...args: Parameters<typeof import('./global-settings-cache').rememberedGlobalRead<T>>): Promise<T> {
  const mod = await import('./global-settings-cache');
  return mod.rememberedGlobalRead<T>(...args);
}

type FakeCache = { entries: Map<string, unknown>; failGet: boolean };

/** Next's data cache as `unstable_cache` sees it outside a request. */
function installDataCache(): FakeCache {
  const fake: FakeCache = { entries: new Map(), failGet: false };
  const g = globalThis as { __incrementalCache?: unknown };
  g.__incrementalCache = {
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

const TAG = GLOBAL_SETTINGS_TAGS.bundleComponents;

test('1 · a remembered read sends no request the second time', async () => {
  installDataCache();
  try {
    let reads = 0;
    const load = async () => {
      reads += 1;
      return [{ bundle_sku_code: 'GUIDED_PACK', component_service_code: 'SETNAYAN_AI' }];
    };
    const first = await rememberedGlobalRead('test-remembered-v1', TAG, load);
    const second = await rememberedGlobalRead('test-remembered-v1', TAG, load);
    assert.deepEqual(second, first);
    assert.equal(reads, 1, 'the second page asked the database again');
    // Another key is another read.
    await rememberedGlobalRead('test-remembered-other-v1', TAG, load);
    assert.equal(reads, 2, 'two different reads shared one entry');
  } finally {
    removeDataCache();
  }
});

test('2 · a refused read is never remembered — the next page asks again', async () => {
  installDataCache();
  try {
    let reads = 0;
    const refused = async (): Promise<string[]> => {
      reads += 1;
      throw new Error('did not answer in 0 ms');
    };
    await assert.rejects(rememberedGlobalRead('test-refused-v1', TAG, refused), /did not answer/);
    const answered = await rememberedGlobalRead('test-refused-v1', TAG, async () => {
      reads += 1;
      return ['ok'];
    });
    assert.deepEqual(answered, ['ok'], 'the refusal was remembered and handed to the next page');
    assert.equal(reads, 2);
  } finally {
    removeDataCache();
  }
});

test('3 · when the data cache cannot run, the read is asked directly — never the caller’s fallback', async () => {
  // No data cache at all (plain node, a script).
  removeDataCache();
  let reads = 0;
  const load = async () => {
    reads += 1;
    return ['row'];
  };
  assert.deepEqual(await rememberedGlobalRead('test-nocache-v1', TAG, load), ['row']);
  assert.deepEqual(await rememberedGlobalRead('test-nocache-v1', TAG, load), ['row']);
  assert.equal(reads, 2, 'outside Next every call reads, exactly as before');

  // A data cache that breaks.
  const fake = installDataCache();
  try {
    fake.failGet = true;
    assert.deepEqual(await rememberedGlobalRead('test-broken-v1', TAG, load), ['row'], 'a broken cache turned into a failure');
  } finally {
    removeDataCache();
  }
});

// ── 4 · every writer forgets ────────────────────────────────────────────────
const WEB = join(__dirname, '..');
const TABLE_TAG: Record<string, keyof typeof GLOBAL_SETTINGS_TAGS> = {
  bundle_components: 'bundleComponents',
  promo_free_windows: 'promoFreeWindows',
  data_privacy_controls: 'dataPrivacyControls',
  reveal_studio_config: 'revealStudioConfig',
  event_type_profiles: 'eventTypeProfiles',
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const FILES = [...sourceFiles(join(WEB, 'app')), ...sourceFiles(join(WEB, 'lib'))].map((path) => ({
  path: relative(WEB, path),
  code: stripComments(readFileSync(path, 'utf8')),
}));

function writersOf(table: string): Array<{ path: string; code: string }> {
  const write = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)\\s*\\.(insert|update|upsert|delete)\\(`);
  return FILES.filter((f) => write.test(f.code));
}

test('4 · the scan sees the files (not a stub that finds nothing)', () => {
  assert.ok(FILES.length > 500, `only ${FILES.length} source files were read`);
});

for (const [table, key] of Object.entries(TABLE_TAG)) {
  test(`4 · every write to ${table} clears GLOBAL_SETTINGS_TAGS.${key}`, () => {
    const writers = writersOf(table);
    if (table === 'bundle_components') {
      // Only a migration writes it; a remembered copy is at most a minute old.
      assert.deepEqual(
        writers.map((w) => w.path),
        [],
        'the app now writes bundle_components — that writer must call revalidateTag(GLOBAL_SETTINGS_TAGS.bundleComponents); then delete this case',
      );
      return;
    }
    assert.ok(writers.length > 0, `no app file writes ${table} any more — is the table still edited from the admin?`);
    const clears = new RegExp(`revalidateTag\\(\\s*GLOBAL_SETTINGS_TAGS\\.${key}\\s*\\)`);
    for (const writer of writers) {
      assert.ok(
        clears.test(writer.code),
        `${writer.path} writes ${table} but never calls revalidateTag(GLOBAL_SETTINGS_TAGS.${key}) — pages would show the old rows for up to a minute`,
      );
    }
  });
}
