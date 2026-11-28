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
  isEvidenceUpload,
  uploadIsLedgered,
} from './supplier-storage';
import { downgradeFit, storageWords, type DowngradeFacts } from './downgrade-limits';
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
test('the owner’s numbers (2026-11-23 SUPPLIER SIZES FIXED): Free 50 MB · Verified 1 GB · Plus 50 GB · Pro 256 GB · Ultra 1 TB', () => {
  assert.equal(STORAGE_GB, GB, 'a storage GB is the decimal GB the supplier reads');
  assert.equal(TIER_CAPS.free.storageBytes, 50 * MB, 'owner 23 Nov: "free should only be 50 clients compressed photos"');
  assert.equal(TIER_CAPS.verified.storageBytes, 1 * GB, 'owner 23 Nov: Verified 1 GB');
  assert.equal(TIER_CAPS.solo.storageBytes, 50 * GB, 'owner 23 Nov: Plus 50 GB');
  assert.equal(TIER_CAPS.pro.storageBytes, 256 * GB, 'owner 23 Nov: "Pro is 256Gb"');
  assert.equal(TIER_CAPS.enterprise.storageBytes, 1000 * GB);
});

test('storageAllowanceBytes reads TIER_CAPS for every plan — and an unknown plan reads as Free', () => {
  for (const t of VENDOR_TIERS) assert.equal(storageAllowanceBytes(t), TIER_CAPS[t].storageBytes, t);
  assert.equal(storageAllowanceBytes(null), 50 * MB, 'an unknown plan reads as Free');
  assert.equal(storageAllowanceBytes('nonsense'), 50 * MB);
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
  assert.equal(line('free'), '50 MB');
  assert.equal(line('verified'), '1 GB');
  assert.equal(line('solo'), '50 GB');
  assert.equal(line('pro'), '256 GB');
  assert.equal(line('enterprise'), '1 TB');
});

// ── 2 · the refusal ────────────────────────────────────────────────────────
test('storageFits: up to the allowance fits, one byte past does not — on every plan', () => {
  assert.equal(storageFits('solo', 49 * GB, GB), true, 'exactly 50 GB fits');
  assert.equal(storageFits('solo', 49 * GB, GB + 1), false);
  assert.equal(storageFits('pro', 255.9 * GB, 0.2 * GB), false);
  assert.equal(storageFits('enterprise', 999 * GB, GB), true);
  assert.equal(storageFits('free', 25 * MB, 25 * MB), true, 'exactly 50 MB fits');
  assert.equal(storageFits('free', 25 * MB, 25 * MB + 1), false);
  assert.equal(storageFits('verified', 1 * GB, 1), false);
});

test('the refusal names the plan, what is left, the way to make room and the next plan up — and touches nothing', () => {
  const m = storageFullMessage('solo', 49.9 * GB, 200_000_000);
  assert.match(m, /This file is 200 MB, and your Plus plan has 100 MB of its 50 GB left\./);
  assert.match(m, /Remove files from an event to make room or move to Pro: every business tool, no limit on services, people or branches, and 256 GB\./);
  assert.match(m, /Nothing you stored was changed\./);
  const full = storageFullMessage('pro', 256 * GB, 1_000_000);
  assert.match(full, /Your Pro plan’s 256 GB of storage is full\./);
  assert.match(full, /move to Ultra: every business tool, no limit on services, people or branches, and 1 TB/);
  // Ultra has no plan above it, and there are no packs: no "move to", never an invented offer.
  const ultra = storageFullMessage('enterprise', 1000 * GB, 1_000_000);
  assert.match(ultra, /Your Ultra plan’s 1 TB of storage is full\. Remove files from an event to make room\./);
  assert.doesNotMatch(ultra, /move to/);
  // A full FREE shop is offered Get verified, not a paid plan (DECISION_LOG "SUPPLIER SIZES FIXED (FINAL)": "Full Free →
  // Get verified"). Its next PAID size is still Plus — Verified is earned by verifying, never "moved to".
  const free = storageFullMessage('free', Number(TIER_CAPS.free.storageBytes), 1_000_000);
  assert.match(free, /Remove files from an event to make room or get verified, free: on the marketplace with the basics, /);
  assert.ok(free.includes(storageWords(Number(TIER_CAPS.verified.storageBytes))), 'the Get verified offer does not say its size');
  assert.doesNotMatch(free, /move to Plus/);
  assert.match(storageFullMessage('verified', Number(TIER_CAPS.verified.storageBytes), 1_000_000), /or move to Plus: every business tool, /);
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

/**
 * A stub admin client: one `vendor_profiles` row and one `vendor_storage_breakdown` answer. `used` is the shop's photos
 * and video; `docs` its other files. One number per plan — no chat & documents room (owner 23 Nov, "Yes, drop it").
 */
function stub(opts: { tier?: string | null; tierError?: boolean; used?: unknown; docs?: number; usedError?: boolean; usedThrows?: boolean }) {
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
      if (opts.usedError) return Promise.resolve({ data: null, error: { message: 'permission denied' } });
      return Promise.resolve({
        data: [
          { photos_video_bytes: opts.used, files_bytes: opts.docs ?? 0, records_bytes: 0, evidence_bytes: 0, records_measured_at: null },
        ],
        error: null,
      });
    },
  } as unknown as Parameters<typeof server.readStoredBytes>[0];
}

const MEDIA = { media: true, evidence: false };
const DOC = { media: false, evidence: false };
const EVIDENCE = { media: false, evidence: true };

/** A plan's size, read from TIER_CAPS — never a typed number, so a re-cut ladder does not break these tests. */
const cap = (t: 'free' | 'verified' | 'solo' | 'pro'): number => Number(TIER_CAPS[t].storageBytes);

test('checkSupplierStorage: photos and video fit the WHOLE plan — one number, no room', async () => {
  const plus = cap('solo');
  const r = await server.checkSupplierStorage(stub({ tier: 'solo', used: plus - 100 * MB }), 'shop', 200 * MB, MEDIA);
  assert.equal(r.kind, 'full');
  assert.match(r.kind === 'full' ? r.message : '', /This file is 200 MB, and your Plus plan has 100 MB left\. Your messages, documents, contracts and receipts still go through\. Remove files to make room or move to Pro/);
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'solo', used: plus - 100 * MB }), 'shop', 100 * MB, MEDIA)).kind, 'fits', 'exactly the plan must fit');
  // Documents count against the same number: a photo waits when papers filled the plan.
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'solo', used: 0, docs: plus }), 'shop', 1, MEDIA)).kind, 'full');
  // A shop already over (grandfathered) keeps everything — and is refused only the next photo.
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'pro', used: cap('pro') + GB }), 'shop', 1)).kind, 'full');
  // Free · Verified: counted, refused past their plan; a blind read fails closed.
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'free', used: cap('free') }), 'shop', 1)).kind, 'full');
  const verified = cap('verified');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'verified', used: verified / 4 }), 'shop', verified - verified / 4)).kind, 'fits', 'Verified: the whole plan');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'verified', used: verified / 4 }), 'shop', verified - verified / 4 + 1)).kind, 'full');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'free', usedError: true }), 'shop', 1)).kind, 'unavailable');
});

test('a DOCUMENT always goes in — full plan or blind read; only photos and video wait (owner 23 Nov, "Yes, drop it")', async () => {
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'solo', used: cap('solo') }), 'shop', 20 * MB, DOC)).kind, 'fits', 'a PDF on a full plan waited');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'free', used: cap('free') * 2, docs: cap('free') }), 'shop', 20 * MB, DOC)).kind, 'fits', 'a PDF on an over plan waited');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'solo', usedError: true }), 'shop', 20 * MB, DOC)).kind, 'fits', 'a blind read stopped a PDF');
  const photo = await server.checkSupplierStorage(stub({ tier: 'solo', used: cap('solo') }), 'shop', 20 * MB, MEDIA);
  assert.equal(photo.kind, 'full');
  // Nothing in the words speaks of a room any more.
  assert.doesNotMatch(photo.kind === 'full' ? photo.message : '', /room for chat|kept for chat|chat and documents is full/);
});

test('EVIDENCE is counted but NEVER refused — not when full, not when the read is blind (owner 22 Nov, spec § ★ K)', async () => {
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'free', used: cap('free') * 2, docs: cap('free') }), 'shop', 20 * MB, EVIDENCE)).kind, 'fits');
  assert.equal((await server.checkSupplierStorage(stub({ tierError: true }), 'shop', 20 * MB, EVIDENCE)).kind, 'fits');
  assert.equal((await server.checkSupplierStorage(stub({ tier: 'solo', usedError: true }), 'shop', 20 * MB, EVIDENCE)).kind, 'fits');
  // The evidence buckets: verification papers and contracts.
  assert.equal(isEvidenceUpload('vendorVerification'), true);
  assert.equal(isEvidenceUpload('vendorContracts'), true);
  assert.equal(isEvidenceUpload('media'), false);
  assert.equal(isEvidenceUpload('threadFiles'), false);
});

test('/api/upload asks BEFORE it signs the PUT, for EVERY shop upload and a file the shop sends in chat, and refuses with the way up', () => {
  const src = read('app/api/upload/route.ts');
  const ask = src.indexOf('checkSupplierStorage(createAdminClient(), supplierStorageShopId, sizeBytes, shopUploadKind)');
  const sign = src.indexOf('presignUploadUrl({');
  assert.ok(ask > 0, 'the upload route does not ask about storage');
  assert.ok(ask < sign, 'storage is checked after the PUT is signed — the bytes would already move');
  // Every vendor root — not only supplier-files (owner 23 Nov: the meter counts everything).
  assert.match(src, /if \(tenancy\.kind === 'vendor'\) \{\s*supplierStorageShopId = tenancy\.id;/);
  assert.match(src, /tenancy\.kind === 'thread'[\s\S]{0,600}current_vendor_profile_ids[\s\S]{0,200}supplierStorageShopId = threadShop/);
  assert.match(src, /shopUploadKind = \{ media: isMediaContentType\(baseContentType\), evidence: isEvidenceUpload\(bucketKey\) \}/);
  assert.match(src, /code: STORAGE_FULL_CODE, upgradeHref: STORAGE_UPGRADE_HREF/);
  assert.equal(STORAGE_UPGRADE_HREF, '/vendor-dashboard/subscription');
  // The size of an upload no table records goes to the ledger, after the PUT is signed.
  const rec = src.indexOf('recordShopUpload(createAdminClient()');
  assert.ok(rec > sign, 'the ledger is written before the upload is signed (or not at all)');
  assert.match(src, /supplierStorageShopId && uploadIsLedgered\(pathPrefix\)/);
  assert.equal(uploadIsLedgered('vendors/x/logo'), true);
  assert.equal(uploadIsLedgered('vendor-payment-qr/x'), true);
  assert.equal(uploadIsLedgered('vendor-originals/x'), true);
  assert.equal(uploadIsLedgered('supplier-files/x/e'), false, 'event files are sized on their stored copy — ledgering them would count twice');
  assert.equal(uploadIsLedgered('chat/t/u'), false, 'chat files are sized on the message');
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
  assert.equal(storageRowLine('solo', { status: 'ok', bytes: 1_240_000_000 }), '1.2 GB of 50 GB used');
  assert.equal(storageRowLine('pro', { status: 'ok', bytes: 0 }), '0 MB of 256 GB used');
  assert.equal(storageRowLine('pro', { status: 'ok', bytes: 800_000_000 }), '800 MB of 256 GB used');
  assert.equal(storageRowLine('verified', { status: 'ok', bytes: 1 * GB }), '1 GB of 1 GB used · full');
  assert.equal(storageRowLine('free', { status: 'ok', bytes: 1.5 * GB }), '1.5 GB of 50 MB used · over — new files wait for room');
  assert.equal(storageRowLine('enterprise', { status: 'unread' }), STORAGE_UNREAD);
  assert.equal(storageRowLine('free', { status: 'unread' }), STORAGE_UNREAD, 'every plan draws the row now');
  assert.doesNotMatch(STORAGE_UNREAD, /\b0\b/);
});

test('the Plans page draws the METER from the one breakdown read — the limits sheet reads the same, once', () => {
  const screen = read('app/vendor-dashboard/subscription/_components/plan-screen.tsx');
  assert.match(screen, /downgradeFacts\?\.storage \?\? \(await readStorageBreakdown\(createAdminClient\(\), profile\.vendor_profile_id\)\)/);
  assert.match(screen, /storage=\{storageRead\}/);
  const rows = read('app/vendor-dashboard/subscription/_components/plan-rows.tsx');
  assert.match(rows, /<StorageMeter tier=\{tier\} read=\{storage\} \/>/);
  assert.doesNotMatch(rows, /data="plan-storage"/, 'the old Storage row is the meter now (drawing: "it became the top block")');
  const facts = read('lib/downgrade-limits.server.ts');
  assert.match(facts, /readStorageBreakdown\(admin, vendorProfileId\)/);
  assert.match(facts, /storedBytes: stored\.status === 'ok' \? storageTotal\(stored\.breakdown\) : null/);
});

test('the limits sheet: Pro → Plus over 50 GB waits for room; an unread store says so, never “fits”', () => {
  const facts: DowngradeFacts = {
    founder: false,
    cards: [],
    includedBranches: 0,
    seats: null,
    extraSeats: 0,
    storedBytes: 57 * GB,
    badge: null,
  };
  const over = downgradeFit(facts, 'pro', 'solo', { paywallOn: true, storageAllowanceBytes: storageAllowanceBytes('solo'), now: new Date('2026-11-13') });
  const row = over.rows.find((r) => r.key === 'storage');
  assert.equal(row?.state, 'blocks');
  assert.match(row?.line ?? '', /You store 57 GB · Plus holds 50 GB\. Remove 7 GB first\./);
  const blind = downgradeFit({ ...facts, storedBytes: null }, 'pro', 'solo', { paywallOn: true, storageAllowanceBytes: storageAllowanceBytes('solo'), now: new Date('2026-11-13') });
  assert.equal(blind.rows.find((r) => r.key === 'storage')?.state, 'unread');
});

// 📋 Owner 2026-11-22: "supplier plans is not just Memory Space. but features for their account as well" — a plan is never
// shown as its size alone (build-sessions/SUPPLIER-PLANS-EXPLAINED-2026-11-22.md).
test('a plan reads its account features WITH its size — never the size alone', () => {
  assert.equal(planSummaryWords('free'), 'run your own clients, 1 live service, just you, main shop only, and 50 MB');
  assert.equal(planSummaryWords('verified'), 'on the marketplace with the basics, 3 live services, just you, main shop only, and 1 GB');
  assert.equal(planSummaryWords('solo'), `every business tool, ${TIER_CAPS.solo.serviceCardsTotal} live services, you and ${TIER_CAPS.solo.agentAccounts} more, main shop only, and 50 GB`);
  assert.equal(planSummaryWords('pro'), 'every business tool, no limit on services, people or branches, and 256 GB');
  assert.equal(planSummaryWords('enterprise'), 'every business tool, no limit on services, people or branches, and 1 TB');
  for (const p of VENDOR_TIERS) assert.doesNotMatch(planSummaryWords(p), /Infinity|—|NaN/, p);
  assert.deepEqual(VENDOR_TIERS.map(planRole), ['Free', 'Verified', 'The starter business', 'The growing business', 'The big studio']);
  // Every surface that shows a paid plan reads the one line — none prints its size alone.
  const read = (f: string) => stripComments(readFileSync(join(process.cwd(), f), 'utf8'));
  assert.match(read('app/for-suppliers/_components/supplier-front-data.ts'), /planSummaryWords\(t\)/, 'the /for-suppliers plan card');
  assert.match(read('app/_components/home/vendor-benefits.ts'), /planSummaryWords\('solo'\)[\s\S]*planSummaryWords\('pro'\)[\s\S]*planSummaryWords\('enterprise'\)/, 'the Plans page taglines');
  assert.match(read('lib/supplier-storage.ts'), /move to \$\{planWord\(next\)\}: \$\{planSummaryWords\(next\)\}/, 'the storage-full way up');
});
