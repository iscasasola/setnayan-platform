/**
 * supplier-storage.test.ts — THE PLAN HOLDS STORAGE (owner 2026-11-13, specs DECISION_LOG ce2d0a8 "plan storage":
 * Plus 5 GB · Pro 10 GB · Ultra 20 GB (owner 2026-11-18, ruling 24; was 15); Free and Free · Verified keep what they had — no allowance).
 *
 *   1 · the per-plan numbers, read from TIER_CAPS — and `storageAllowanceBytes` asks TIER_CAPS, not a typed number;
 *   2 · the refusal: a file past the allowance is refused with the plan's number and the way up, before any bytes move
 *       (`/api/upload`), and the database's refusal reaches the supplier as the same sentence (the files action);
 *   3 · the failed read: a usage read that fails is SAID ("Couldn't read…") and refuses uploads — never "0 MB used".
 *
 * Behaviour against a stubbed client; the wiring by source (comments stripped, so a comment cannot satisfy it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STORAGE_GB, TIER_CAPS, VENDOR_TIERS } from './vendor-tier-caps';
import {
  STORAGE_CHECK_FAILED,
  STORAGE_UNREAD,
  STORAGE_UPGRADE_HREF,
  isStorageRefusal,
  nextStoragePlan,
  storageAllowanceBytes,
  storageFits,
  storageFullMessage,
  planSummaryWords,
  planRole,
  storageRowLine,
} from './supplier-storage';
import { downgradeFit, type DowngradeFacts } from './downgrade-limits';
import { planGivesLines } from './vendor-plan-rows';
import { stripComments } from './strip-comments';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
const server = require('./supplier-storage.server') as typeof import('./supplier-storage.server');

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const GB = 1_000_000_000;
const MB = 1_000_000;

// ── 1 · the numbers ────────────────────────────────────────────────────────
test('the owner’s numbers (2026-11-23 SUPPLIER SIZES FIXED): Free 100 MB · Verified 1 GB · Plus 10 GB · Pro 256 GB · Ultra 1 TB', () => {
  assert.equal(STORAGE_GB, GB, 'a storage GB is the decimal GB the supplier reads');
  assert.equal(TIER_CAPS.free.storageBytes, 100 * MB, 'owner 23 Nov: "100MB"');
  assert.equal(TIER_CAPS.verified.storageBytes, 1 * GB, 'owner 23 Nov: "1GB"');
  assert.equal(TIER_CAPS.solo.storageBytes, 10 * GB, 'owner 23 Nov: "10 GB"');
  assert.equal(TIER_CAPS.pro.storageBytes, 256 * GB, 'owner 23 Nov: "Pro is 256Gb"');
  assert.equal(TIER_CAPS.enterprise.storageBytes, 1000 * GB);
});

test('storageAllowanceBytes reads TIER_CAPS for every plan — and an unknown plan reads as Free', () => {
  for (const t of VENDOR_TIERS) assert.equal(storageAllowanceBytes(t), TIER_CAPS[t].storageBytes, t);
  assert.equal(storageAllowanceBytes(null), 100 * MB, 'an unknown plan reads as Free');
  assert.equal(storageAllowanceBytes('nonsense'), 100 * MB);
  // The old stub returned null for every plan; the server module now re-exports the rule rather than typing a number.
  const src = read('lib/downgrade-limits.server.ts');
  assert.match(src, /export \{ storageAllowanceBytes \} from '@\/lib\/supplier-storage'/);
  assert.doesNotMatch(src, /storageAllowanceBytes\([^)]*\)[^{]*\{\s*return null/);
});

test('the paid storage packs stay off: nothing here offers or prices them', () => {
  for (const f of ['lib/supplier-storage.ts', 'lib/supplier-storage.server.ts']) {
    assert.doesNotMatch(read(f), /vendor_storage_\d+gb|₱|pricePhp/, `${f} offers a pack`);
  }
});

test('“What <plan> gives you” names each plan’s storage from the table', () => {
  const line = (t: string) => planGivesLines(t, true).find((l) => l.key === 'storage')?.line;
  assert.equal(line('free'), '100 MB');
  assert.equal(line('verified'), '1 GB');
  assert.equal(line('solo'), '10 GB');
  assert.equal(line('pro'), '256 GB');
  assert.equal(line('enterprise'), '1 TB');
});

// ── 2 · the refusal ────────────────────────────────────────────────────────
test('storageFits: up to the allowance fits, one byte past does not — on every plan', () => {
  assert.equal(storageFits('solo', 9 * GB, GB), true, 'exactly 10 GB fits');
  assert.equal(storageFits('solo', 9 * GB, GB + 1), false);
  assert.equal(storageFits('pro', 255.9 * GB, 0.2 * GB), false);
  assert.equal(storageFits('enterprise', 999 * GB, GB), true);
  assert.equal(storageFits('free', 50 * MB, 50 * MB), true, 'exactly 100 MB fits');
  assert.equal(storageFits('free', 50 * MB, 50 * MB + 1), false);
  assert.equal(storageFits('verified', 1 * GB, 1), false);
});

test('the refusal names the plan, what is left, the way to make room and the next plan up — and touches nothing', () => {
  const m = storageFullMessage('solo', 9.9 * GB, 200_000_000);
  assert.match(m, /This file is 200 MB, and your Plus plan has 100 MB of its 10 GB left\./);
  assert.match(m, /Remove files from an event to make room or move to Pro: every tool, no limit on services, people or branches, and 256 GB\./);
  assert.match(m, /Nothing you stored was changed\./);
  const full = storageFullMessage('pro', 256 * GB, 1_000_000);
  assert.match(full, /Your Pro plan’s 256 GB of storage is full\./);
  assert.match(full, /move to Ultra: every tool, no limit on services, people or branches, and 1 TB/);
  // Ultra has no plan above it, and there are no packs: no "move to", never an invented offer.
  const ultra = storageFullMessage('enterprise', 1000 * GB, 1_000_000);
  assert.match(ultra, /Your Ultra plan’s 1 TB of storage is full\. Remove files from an event to make room\./);
  assert.doesNotMatch(ultra, /move to/);
  // Free and Verified point at the first PAID size — Verified is earned by verifying, never "moved to".
  assert.match(storageFullMessage('free', 100 * MB, 1_000_000), /Your Free plan’s 100 MB of storage is full\. Remove files from an event to make room or move to Plus: every tool, 15 live services, you and 2 more, main shop only, and 10 GB\./);
  assert.equal(nextStoragePlan('free'), 'solo');
  assert.equal(nextStoragePlan('verified'), 'solo');
  assert.equal(nextStoragePlan('solo'), 'pro');
  assert.equal(nextStoragePlan('pro'), 'enterprise');
  assert.equal(nextStoragePlan('enterprise'), null);
});

test('the database’s refusal is recognised by its code word', () => {
  assert.equal(isStorageRefusal('storage_allowance: this file does not fit the 256 MB your plan holds'), true);
  assert.equal(isStorageRefusal('a photo is filed only under a service in this event’s quote'), false);
  assert.equal(isStorageRefusal(null), false);
});

/** A stub admin client: one `vendor_profiles` row and one `vendor_storage_used_bytes` answer. */
function stub(opts: { tier?: string | null; tierError?: boolean; used?: unknown; usedError?: boolean; usedThrows?: boolean }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve(
              opts.tierError ? { data: null, error: { message: 'refused' } } : { data: { tier_state: opts.tier ?? null }, error: null },
            ),
        }),
      }),
    }),
    rpc: () => {
      if (opts.usedThrows) return Promise.reject(new Error('network'));
      return Promise.resolve(opts.usedError ? { data: null, error: { message: 'permission denied' } } : { data: opts.used, error: null });
    },
  } as unknown as Parameters<typeof server.readStoredBytes>[0];
}

test('checkSupplierStorage: a Plus shop at 9.9 GB is refused a 200 MB file, with the sentence the supplier reads', async () => {
  const r = await server.checkSupplierStorage(stub({ tier: 'solo', used: 9.9 * GB }), 'shop', 200_000_000);
  assert.equal(r.kind, 'full');
  assert.equal(r.kind === 'full' && r.message, storageFullMessage('solo', 9.9 * GB, 200_000_000));
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'solo', used: 9.9 * GB }), 'shop', 50_000_000)).kind, 'fits');
  // A shop already over (grandfathered) keeps everything — and is refused only the next file.
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'pro', used: 300 * GB }), 'shop', 1)).kind, 'full');
  // Free · Verified have an allowance now too: counted, refused past it, and a blind read fails closed.
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'free', used: 0.9 * GB }), 'shop', 200_000_000)).kind, 'full');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'verified', used: 0.5 * GB }), 'shop', 0.5 * GB)).kind, 'fits');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'free', usedError: true }), 'shop', 1)).kind, 'unavailable');
});

test('/api/upload asks BEFORE it signs the PUT, for the shop’s own stored files, and refuses with the way up', () => {
  const src = read('app/api/upload/route.ts');
  const ask = src.indexOf('checkSupplierStorage(createAdminClient(), supplierStorageShopId, sizeBytes)');
  const sign = src.indexOf('presignUploadUrl({');
  assert.ok(ask > 0, 'the upload route does not ask about storage');
  assert.ok(ask < sign, 'storage is checked after the PUT is signed — the bytes would already move');
  assert.match(src, /tenancy\.kind === 'vendor' && bucketKey === 'threadFiles' && pathPrefix\.split\('\/'\)\[0\] === 'supplier-files'/);
  assert.match(src, /code: STORAGE_FULL_CODE, upgradeHref: STORAGE_UPGRADE_HREF/);
  assert.equal(STORAGE_UPGRADE_HREF, '/vendor-dashboard/subscription');
});

test('the files action turns the database’s refusal into the same sentence and the Plan link; the board shows it', () => {
  const act = read('app/_actions/event-files-actions.ts');
  assert.equal((act.match(/isStorageRefusal\(error\.message\)/g) ?? []).length, 2, 'upload and chat-file paths both map the refusal');
  assert.equal((act.match(/href: STORAGE_UPGRADE_HREF/g) ?? []).length, 2);
  const board = read('app/vendor-dashboard/clients/[eventId]/_components/event-files-board.tsx');
  assert.match(board, /pre\.upgradeHref/);
  assert.match(board, /said\.href \?/);
  assert.match(board, /See plans/);
});

// ── 3 · the failed read ────────────────────────────────────────────────────
test('a usage read that fails is UNREAD — never 0', async () => {
  assert.deepEqual(await server.readStoredBytes(stub({ usedError: true }), 'shop'), { status: 'unread' });
  assert.deepEqual(await server.readStoredBytes(stub({ usedThrows: true }), 'shop'), { status: 'unread' });
  assert.deepEqual(await server.readStoredBytes(stub({ used: null }), 'shop'), { status: 'unread' }, 'a null answer is not 0');
  assert.deepEqual(await server.readStoredBytes(stub({ used: 'abc' }), 'shop'), { status: 'unread' });
  assert.deepEqual(await server.readStoredBytes(stub({ used: -1 }), 'shop'), { status: 'unread' });
  assert.deepEqual(await server.readStoredBytes(stub({ used: 0 }), 'shop'), { status: 'ok', bytes: 0 }, 'a real 0 is 0');
  assert.deepEqual(await server.readStoredBytes(stub({ used: '1240000000' }), 'shop'), { status: 'ok', bytes: 1_240_000_000 }, 'bigint arrives as a string');
});

test('a failed read refuses the upload (fail closed) — a cap that waves files through when blind is no cap', async () => {
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'solo', usedError: true }), 'shop', 1)).kind, 'unavailable');
  assert.equal((await server.checkSupplierStorage(stub({ tierError: true }), 'shop', 1)).kind, 'unavailable');
  assert.match(STORAGE_CHECK_FAILED, /couldn’t check your storage/);
  assert.match(read('app/api/upload/route.ts'), /room\.kind === 'unavailable'[\s\S]{0,80}STORAGE_CHECK_FAILED[\s\S]{0,40}status: 503/);
});

test('the Plan’s Storage row: “X of Y used”, full, over — and a failed read says so instead of 0', () => {
  assert.equal(storageRowLine('solo', { status: 'ok', bytes: 1_240_000_000 }), '1.2 GB of 10 GB used');
  assert.equal(storageRowLine('pro', { status: 'ok', bytes: 0 }), '0 MB of 256 GB used');
  assert.equal(storageRowLine('pro', { status: 'ok', bytes: 800_000_000 }), '800 MB of 256 GB used');
  assert.equal(storageRowLine('verified', { status: 'ok', bytes: 1 * GB }), '1 GB of 1 GB used · full');
  assert.equal(storageRowLine('free', { status: 'ok', bytes: 1.5 * GB }), '1.5 GB of 100 MB used · over — new files wait for room');
  assert.equal(storageRowLine('enterprise', { status: 'unread' }), STORAGE_UNREAD);
  assert.equal(storageRowLine('free', { status: 'unread' }), STORAGE_UNREAD, 'every plan draws the row now');
  assert.doesNotMatch(STORAGE_UNREAD, /\b0\b/);
});

test('the Plan screen draws the row from the honest read, and the limits sheet reads the same bytes', () => {
  const screen = read('app/vendor-dashboard/subscription/_components/plan-screen.tsx');
  assert.match(screen, /downgradeFacts\.storedBytes === null\s*\?\s*\{ status: 'unread' \}/);
  assert.match(screen, /storageLine=\{storageLine\}/);
  const rows = read('app/vendor-dashboard/subscription/_components/plan-rows.tsx');
  assert.match(rows, /data="plan-storage"[^>]*title="Storage" line=\{storageLine\}/);
  const facts = read('lib/downgrade-limits.server.ts');
  assert.match(facts, /readStoredBytes\(admin, vendorProfileId\)/);
  assert.match(facts, /storedBytes: stored\.status === 'ok' \? stored\.bytes : null/);
});

test('the limits sheet: Pro → Plus over 10 GB waits for room; an unread store says so, never “fits”', () => {
  const facts: DowngradeFacts = {
    founder: false,
    cards: [],
    includedBranches: 0,
    seats: null,
    extraSeats: 0,
    storedBytes: 17 * GB,
    badge: null,
  };
  const over = downgradeFit(facts, 'pro', 'solo', { paywallOn: true, storageAllowanceBytes: storageAllowanceBytes('solo'), now: new Date('2026-11-13') });
  const row = over.rows.find((r) => r.key === 'storage');
  assert.equal(row?.state, 'blocks');
  assert.match(row?.line ?? '', /You store 17 GB · Plus holds 10 GB\. Remove 7 GB first\./);
  const blind = downgradeFit({ ...facts, storedBytes: null }, 'pro', 'solo', { paywallOn: true, storageAllowanceBytes: storageAllowanceBytes('solo'), now: new Date('2026-11-13') });
  assert.equal(blind.rows.find((r) => r.key === 'storage')?.state, 'unread');
});

// 📋 Owner 2026-11-22: "supplier plans is not just Memory Space. but features for their account as well" — a plan is never
// shown as its size alone (build-sessions/SUPPLIER-PLANS-EXPLAINED-2026-11-22.md).
test('a plan reads its account features WITH its size — never the size alone', () => {
  assert.equal(planSummaryWords('free'), 'run your own clients, 1 live service, just you, main shop only, and 100 MB');
  assert.equal(planSummaryWords('verified'), 'on the marketplace with the basics, 3 live services, just you, main shop only, and 1 GB');
  assert.equal(planSummaryWords('solo'), `every tool, ${TIER_CAPS.solo.serviceCardsTotal} live services, you and ${TIER_CAPS.solo.agentAccounts} more, main shop only, and 10 GB`);
  assert.equal(planSummaryWords('pro'), 'every tool, no limit on services, people or branches, and 256 GB');
  assert.equal(planSummaryWords('enterprise'), 'every tool, no limit on services, people or branches, and 1 TB');
  for (const p of VENDOR_TIERS) assert.doesNotMatch(planSummaryWords(p), /Infinity|—|NaN/, p);
  assert.deepEqual(VENDOR_TIERS.map(planRole), ['Free', 'Verified', 'The starter business', 'The growing business', 'The big studio']);
  // Every surface that shows a paid plan reads the one line — none prints its size alone.
  const read = (f: string) => stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
  assert.match(read('app/for-suppliers/_components/supplier-front-data.ts'), /planSummaryWords\(t\)/, 'the /for-suppliers plan card');
  assert.match(read('app/_components/home/vendor-benefits.ts'), /planSummaryWords\('solo'\)[\s\S]*planSummaryWords\('pro'\)[\s\S]*planSummaryWords\('enterprise'\)/, 'the Plans page taglines');
  assert.match(read('lib/supplier-storage.ts'), /move to \$\{planWord\(next\)\}: \$\{planSummaryWords\(next\)\}/, 'the storage-full way up');
});
