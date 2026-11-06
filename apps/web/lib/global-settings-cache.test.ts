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
 *   4 · every FUNCTION that WRITES one of the remembered tables clears its tag
 *       (`revalidateTag(GLOBAL_SETTINGS_TAGS.…)`, or `clearGlobalSettings` from a
 *       lib write core), so an admin edit is seen on the next page and not five
 *       minutes later — and the bundle list, which only a migration writes,
 *       stays that way. (Function-level since 2026-10-20: a file where one action
 *       clears and its sibling does not used to pass.)
 *   5 · every remembered read names a tag, and the tables it reads map to THAT
 *       tag — a read filed under the wrong tag is never cleared by its writers;
 *       and every tag has a table whose writers §4 holds.
 *   6 · the platform_settings writes allowed to skip the clear (a job's own
 *       `*_last_run_at` stamps) touch no column a remembered read selects.
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

/**
 * Every remembered table and the tag its writers must clear. A tag in
 * GLOBAL_SETTINGS_TAGS that names no table here fails test 5 — so a new
 * remembered read cannot ship without its writers being held to it.
 */
const TABLE_TAG: Record<string, keyof typeof GLOBAL_SETTINGS_TAGS> = {
  bundle_components: 'bundleComponents',
  promo_free_windows: 'promoFreeWindows',
  data_privacy_controls: 'dataPrivacyControls',
  reveal_studio_config: 'revealStudioConfig',
  event_type_profiles: 'eventTypeProfiles',
  event_type_vocab: 'eventTypeVocab',
  platform_settings: 'platformSettings',
};

/**
 * Columns of `platform_settings` that only a background job's own bookkeeping
 * writes, and that NO remembered read selects (test 6 holds that second half).
 * A function whose every write to the table names only these may skip the clear
 * — the stamps run inside `after()` on a page render, where Next refuses a
 * revalidate, and clearing every remembered setting on each sweep would buy
 * nothing a reader could see.
 */
const BOOKKEEPING_ONLY: Record<string, readonly string[]> = {
  platform_settings: [
    'admin_digest_last_sent_at',
    'booking_fee_minting_live',
    'creator_offer_sweep_last_run_at',
    'fraud_cluster_sweep_last_run_at',
    'vendor_credit_warning_sweep_last_run_at',
  ],
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

/**
 * A file cut at its top-level declarations — one piece per function (or const)
 * that starts at column 0. The clear must sit in the SAME function as the write:
 * a file where one action clears and its sibling does not is exactly the miss a
 * file-level match cannot see.
 */
function topLevelPieces(code: string): Array<{ name: string; body: string }> {
  const starts = [...code.matchAll(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*(\w+)|const\s+(\w+)\s*[=:])/gm)];
  return starts.map((m, i) => ({
    name: (m[1] ?? m[2] ?? '?') as string,
    body: code.slice(m.index ?? 0, i + 1 < starts.length ? (starts[i + 1]!.index ?? code.length) : code.length),
  }));
}

/** The argument text of the call whose `(` is at `open` (balanced; strings respected). */
function callArgs(code: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') {
      depth--;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return code.slice(open + 1);
}

type Write = { op: string; columns: string[] | null };

/** Every write to `table` in `code`, with the columns an inline object names (null when it cannot be read). */
function writesTo(table: string, code: string): Write[] {
  const re = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)\\s*\\.(insert|update|upsert|delete)\\(`, 'g');
  const out: Write[] = [];
  for (const m of code.matchAll(re)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    const args = callArgs(code, open).trim();
    let columns: string[] | null = null;
    if (args.startsWith('{') && !/\.\.\.|\[/.test(args.slice(0, args.indexOf('}') + 1))) {
      columns = [...args.matchAll(/(?:^|[{,]\s*)(\w+)\s*:/g)].map((c) => c[1] as string);
    }
    out.push({ op: m[1] as string, columns });
  }
  return out;
}

const clearsTag = (key: string) => new RegExp(`(?:revalidateTag|clearGlobalSettings)\\(\\s*GLOBAL_SETTINGS_TAGS\\.${key}\\s*\\)`);

test('4 · the scan sees the files (not a stub that finds nothing)', () => {
  assert.ok(FILES.length > 500, `only ${FILES.length} source files were read`);
});

test('4 · the write scanner reads columns, and refuses to guess past a spread', () => {
  const sample = `admin.from('platform_settings').update({ a_col: 1, b_col: x })\nadmin.from('platform_settings').update(payload)\nadmin.from('platform_settings').update({ ...p, c: 1 })`;
  assert.deepEqual(writesTo('platform_settings', sample), [
    { op: 'update', columns: ['a_col', 'b_col'] },
    { op: 'update', columns: null },
    { op: 'update', columns: null },
  ]);
});

for (const [table, key] of Object.entries(TABLE_TAG)) {
  test(`4 · every function that writes ${table} clears GLOBAL_SETTINGS_TAGS.${key}`, () => {
    const bookkeeping = new Set(BOOKKEEPING_ONLY[table] ?? []);
    const writers: string[] = [];
    const misses: string[] = [];
    for (const file of FILES) {
      if (writesTo(table, file.code).length === 0) continue;
      writers.push(file.path);
      const pieces = topLevelPieces(file.code);
      // A same-file helper that clears (`revalidateBoth()`) counts as the clear when the writer calls it.
      const clearingHelpers = pieces.filter((p) => clearsTag(key).test(p.body)).map((p) => p.name);
      const callsAClear = (body: string) =>
        clearsTag(key).test(body) || clearingHelpers.some((name) => new RegExp(`\\b${name}\\(`).test(body));
      for (const piece of pieces) {
        const writes = writesTo(table, piece.body);
        if (writes.length === 0) continue;
        const onlyBookkeeping = writes.every(
          (w) => w.op === 'update' && w.columns !== null && w.columns.length > 0 && w.columns.every((c) => bookkeeping.has(c)),
        );
        if (onlyBookkeeping) continue;
        if (!callsAClear(piece.body)) misses.push(`${file.path} · ${piece.name}`);
      }
    }
    if (table === 'bundle_components') {
      // Only a migration writes it; a remembered copy is at most GLOBAL_SETTINGS_SECONDS old.
      assert.deepEqual(
        writers,
        [],
        'the app now writes bundle_components — that writer must call revalidateTag(GLOBAL_SETTINGS_TAGS.bundleComponents); then delete this case',
      );
      return;
    }
    assert.ok(writers.length > 0, `no app file writes ${table} any more — is the table still edited from the admin?`);
    assert.deepEqual(
      misses,
      [],
      `these functions write ${table} but never call revalidateTag(GLOBAL_SETTINGS_TAGS.${key}) (or clearGlobalSettings) — ` +
        'pages would show the old rows for up to GLOBAL_SETTINGS_SECONDS',
    );
  });
}

// ── 5 · every remembered read is tagged with the table it reads ─────────────

test('5 · every tag names a table whose writers are held above', () => {
  assert.deepEqual(
    Object.keys(GLOBAL_SETTINGS_TAGS).sort(),
    [...new Set(Object.values(TABLE_TAG))].sort(),
    'a tag in GLOBAL_SETTINGS_TAGS has no table in TABLE_TAG (or the reverse) — its writers are not being checked',
  );
});

const tablesIn = (code: string) => [...code.matchAll(/\.from\(\s*['"`](\w+)['"`]\s*\)/g)].map((t) => t[1] as string);

const READS = FILES.flatMap((file) => {
  const pieces = topLevelPieces(file.code);
  return [...file.code.matchAll(/\brememberedGlobalRead(?:<[^>]*>)?\(/g)].map((m) => {
    let args = callArgs(file.code, (m.index ?? 0) + m[0].length - 1);
    // A read that delegates to a same-file function (`() => readProfileRow(eventType)`) is
    // held to the tables THAT function reads.
    for (const piece of pieces) {
      if (new RegExp(`\\b${piece.name}\\(`).test(args) && tablesIn(piece.body).length > 0) args += `\n${piece.body}`;
    }
    return {
      where: file.path,
      tag: /GLOBAL_SETTINGS_TAGS\.(\w+)/.exec(args)?.[1] ?? null,
      tables: [...new Set(tablesIn(args))],
      args,
    };
  });
}).filter((r) => r.where !== 'lib/global-settings-cache.ts');

test('5 · the scan finds the remembered reads (not a stub that finds nothing)', () => {
  assert.ok(READS.length >= 11, `only ${READS.length} remembered reads were found`);
});

for (const read of READS) {
  test(`5 · ${read.where} remembers ${read.tables.join(', ') || '(a delegated read)'} under its own table's tag`, () => {
    assert.ok(read.tag, `${read.where} calls rememberedGlobalRead without naming a GLOBAL_SETTINGS_TAGS tag`);
    for (const table of read.tables) {
      assert.equal(
        TABLE_TAG[table],
        read.tag,
        `${read.where} remembers ${table} under GLOBAL_SETTINGS_TAGS.${read.tag} — its writers clear ` +
          `${TABLE_TAG[table] ? `GLOBAL_SETTINGS_TAGS.${TABLE_TAG[table]}` : 'no tag at all'}, so an edit would not reach it`,
      );
    }
  });
}

test('6 · no remembered platform_settings read selects a column only a job’s bookkeeping writes', () => {
  const settingsReads = READS.filter((r) => r.tag === 'platformSettings');
  assert.ok(settingsReads.length >= 4, `only ${settingsReads.length} remembered platform_settings reads were found`);
  // `fetchPlatformSettings` delegates to the live read; hold that read's SELECTs too.
  const live = FILES.find((f) => f.path === 'lib/platform-settings.ts')!.code;
  const selects = [...settingsReads.map((r) => r.args), live].join('\n');
  for (const column of BOOKKEEPING_ONLY.platform_settings ?? []) {
    assert.doesNotMatch(
      selects,
      new RegExp(`\\b${column}\\b`),
      `a remembered platform_settings read selects ${column}, which its writer does not clear — remove it from BOOKKEEPING_ONLY and clear the tag there`,
    );
  }
});

// ── 7 · the settings row: remembered when whole, never when degraded ────────

/** A client whose `platform_settings` probes answer per SELECT; counts every request. */
function settingsClient(refuse: (select: string) => boolean) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      assert.equal(table, 'platform_settings');
      return {
        select(select: string) {
          const chain = {
            eq: () => chain,
            maybeSingle: async () => {
              calls.push(select);
              if (refuse(select)) return { data: null, error: { message: 'did not answer', code: '57014' } };
              if (select === 'receiving_accounts') return { data: { receiving_accounts: [] }, error: null };
              return { data: { id: 1, business_name: 'Setnayan', gcash_enabled: false, booking_fee_rate_pct: 5 }, error: null };
            },
          };
          return chain;
        },
      };
    },
  };
  return { client: client as never, calls };
}

test('7 · a whole settings read is remembered — the next page sends nothing', async () => {
  installDataCache();
  const original = console.error;
  console.error = () => {};
  try {
    const { fetchPlatformSettings } = await import('./platform-settings');
    const { client, calls } = settingsClient(() => false);
    const first = await fetchPlatformSettings(client);
    assert.equal(first.gcash_enabled, false, 'the kill switch was not read');
    const asked = calls.length;
    assert.ok(asked >= 3, `the three probes were not asked (${asked})`);
    await fetchPlatformSettings(client);
    assert.equal(calls.length, asked, 'the second page asked platform_settings again');
  } finally {
    console.error = original;
    removeDataCache();
  }
});

test('7 · a DEGRADED settings read is never remembered — a refused soft probe or accounts list asks again', async () => {
  for (const part of ['gcash_enabled', 'receiving_accounts', 'business_name']) {
    installDataCache();
    const original = console.error;
    console.error = () => {};
    try {
      const { fetchPlatformSettings } = await import('./platform-settings');
      const { client, calls } = settingsClient((select) => select.includes(part));
      const first = await fetchPlatformSettings(client);
      if (part === 'gcash_enabled') assert.equal(first.gcash_enabled, true, 'a refused soft probe must leave the rail OPEN, as before');
      const asked = calls.length;
      await fetchPlatformSettings(client);
      assert.ok(calls.length > asked, `a read whose ${part} probe was refused was remembered and handed to the next page`);
    } finally {
      console.error = original;
      removeDataCache();
    }
  }
});
