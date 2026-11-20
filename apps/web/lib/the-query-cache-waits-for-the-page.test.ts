/**
 * 🔒 THE QUERY CACHE'S INDEXEDDB COPY WAITS FOR THE PAGE (speed pass 2026-11-18).
 *
 * The root providers used to wrap every page in `PersistQueryClientProvider`, so TanStack Query, its persister and
 * idb-keyval sat in every page's first load and the IndexedDB restore ran during boot — for a cache nothing reads
 * through React. The persistence now starts after the page has settled (`app/_components/query-persistence.tsx`), from
 * a module loaded only then (`lib/query-persistence.ts`).
 *
 * Fails if: providers.tsx imports the persistence libraries statically again · the mount stops waiting for the page
 * or stops importing the module on demand · the persisted key, max age or buster drift (a changed key silently throws
 * away every device's saved event-day bundle).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const ROOT = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));

test('providers.tsx loads no query-persistence library in the first load', () => {
  const src = read('app/providers.tsx');
  for (const lib of ['@tanstack/react-query-persist-client', '@tanstack/query-sync-storage-persister', 'idb-keyval', '@/lib/query-persistence']) {
    assert.ok(!src.includes(`'${lib}'`), `providers.tsx imports ${lib} statically`);
  }
  assert.ok(!/PersistQueryClientProvider/.test(src), 'providers.tsx wraps the page in PersistQueryClientProvider again');
  assert.match(src, /<QueryPersistence\s*\/>/, 'providers.tsx no longer mounts <QueryPersistence />');
});

test('the mount waits for the page to settle and imports the persistence on demand', () => {
  const src = read('app/_components/query-persistence.tsx');
  assert.match(src, /whenPageSettles\(/, 'QueryPersistence no longer waits for whenPageSettles');
  assert.match(src, /import\('@\/lib\/query-persistence'\)/, 'QueryPersistence no longer imports lib/query-persistence on demand');
  assert.ok(!/^import[^;]*'@\/lib\/query-persistence'/m.test(src), 'QueryPersistence imports lib/query-persistence statically');
});

test('the persisted copy keeps its key, max age and buster', () => {
  const src = read('lib/query-persistence.ts');
  assert.match(src, /PERSIST_KEY = 'setnayan-query-cache'/);
  assert.match(src, /MAX_AGE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(src, /buster: process\.env\.NEXT_PUBLIC_CACHE_BUSTER \?\? 'v1'/);
  assert.match(src, /persistQueryClient\(\{[\s\S]*queryClient: getQueryClient\(\)/, 'restore no longer targets the app\'s one QueryClient');
  // The restore must read only after IndexedDB has answered.
  assert.ok(src.indexOf('await primed') > -1 && src.indexOf('await primed') < src.indexOf('persistQueryClient({'), 'restore runs before the IndexedDB read answered');
});
