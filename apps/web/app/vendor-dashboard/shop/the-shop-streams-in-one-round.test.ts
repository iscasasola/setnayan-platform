/**
 * ⚡ THE SHOP'S STREAMED PARTS READ IN ONE ROUND, AND START WITH THE COVER (owner 18 Nov: every page under 0.7 s).
 *
 * What it caught (supplier walk, 24 Nov, live 7247a56, signed in): `/vendor-dashboard/shop` sent its first byte at
 * 0.5–0.85 s but its stream ended 1.5–2.4 s in. The HTML was 618 KB, but only 79 KB on the wire, so size was not the
 * cost. Two parts of the page read in single file, and both began only after the cover's whole batch was back:
 *   · the service list (`VendorServicesManager`): about twelve trips one after another, the first a fresh
 *     `supabase.auth.getUser()` the request had already answered;
 *   · the Analytics carousel (`OneAnalyticsSection`): the role, then the plan, then Batch A, then the partnership
 *     count, then Batch B, each waiting for the last.
 *
 * What is held (each part was broken on purpose and went red, then restored):
 *   1 · The Shop starts both parts' reads inside its own read block (no `await`), once the shop is known.
 *   2 · The service list asks the session through the cached `getCurrentUser`, never the auth server again, and
 *       awaits its data ONCE (`readServicesManager`, a per-request `cache()`).
 *   3 · The carousel's reads are one per-request `cache()` (`readOneAnalytics`); the plan read starts beside the role
 *       read; Batch B and the partnership count start before Batch A is awaited.
 *   4 · The Toolkit facts never wait for the layout read to START (`readStoreToolFacts` takes its promise).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('page.tsx');
const MANAGER = read('../services/_components/services-manager.tsx');
const SECTION = read('../performance/_components/one-analytics-section.tsx');

test('1 · the Shop starts the service list and the carousel with its own batch', () => {
  const start = PAGE.indexOf('const ownRead =');
  const wait = PAGE.indexOf('await Promise.all([\n    ownRead,');
  assert.ok(start > 0 && wait > start, 'the Shop read block moved');
  const block = PAGE.slice(PAGE.indexOf("if (!profile) return 'no-vendor';"), wait);
  assert.match(block, /\n {2}preloadServicesManager\(supabase, profile\);/, 'the service list waits for the cover again');
  assert.match(block, /\n {2}preloadOneAnalytics\(supabase, user\.id, profile\);/, 'the carousel waits for the cover again');
});

test('2 · the service list asks no second sign-in and awaits its data once', () => {
  assert.doesNotMatch(MANAGER, /supabase\.auth\.getUser\(\)/, 'the list asks the auth server again');
  assert.match(MANAGER, /const user = await getCurrentUser\(\);/);
  assert.match(MANAGER, /const readServicesManager = cache\(async \(supabase: SupabaseClient, profile: VendorProfileRow\) =>/);
  assert.match(MANAGER, /\} = await readServicesManager\(supabase, profile\);/);
  const body = MANAGER.slice(MANAGER.indexOf('export async function VendorServicesManager('), MANAGER.indexOf('return (\n    <div className="space-y-6">'));
  const awaits = (body.match(/\bawait\b/g) ?? []).length;
  // getCurrentUser · createClient · fetchOwnVendorProfile (all request-cached) · the one data read · the ?add= refinements.
  assert.ok(awaits <= 5, `the service list awaits ${awaits} times — a read is back in single file`);
});

test('3 · the carousel reads through one cache, with Batch B and the plan started early', () => {
  assert.match(SECTION, /const readOneAnalytics = cache\(async \(supabase: SupabaseClient, userId: string, profile: VendorProfileRow\)/);
  assert.match(SECTION, /const draw = await readOneAnalytics\(supabase, userId, profile\);/);
  const tierAt = SECTION.indexOf('const tierRead = resolveVendorTier(');
  const roleAt = SECTION.indexOf('const role = await resolveVendorRole(');
  assert.ok(tierAt > 0 && tierAt < roleAt, 'the plan read waits for the role read again');
  const batchA = SECTION.indexOf('] = await Promise.all([\n    safeRead(\n      supabase\n        .from(\'vendor_activity_stats\')');
  assert.ok(batchA > 0, 'Batch A moved');
  for (const started of ['const batchBRead = Promise.all([', 'const partnershipRead = Promise.resolve(', 'const storeGraphsRead = readStoreGraphs(', 'const newGraphsRead = readNewGraphs(']) {
    const at = SECTION.indexOf(started);
    assert.ok(at > 0 && at < batchA, `${started} no longer starts before Batch A is awaited`);
  }
});

test('4 · the Toolkit facts start beside the layout read', () => {
  assert.match(PAGE, /const toolFactsRead = readStoreToolFacts\(supabase, storeAdmin, vendorId, \(profile\.services \?\? \[\]\) as string\[\], layoutRead\);/);
  const lib = stripComments(readFileSync(join(HERE, '../../../lib/supplier-store.server.ts'), 'utf8'));
  assert.match(lib, /layoutOrRead: StoreLayout \| null \| PromiseLike<StoreLayout \| null>,/);
});
