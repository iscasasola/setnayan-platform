/**
 * the-papic-page-opens-fast.test.ts — the couple's Studio › Papic page does not
 * make a phone wait for reads that could have run together.
 *
 * Measured in the lab (2026-10-22, stand-in Supabase answering every request
 * after a fixed delay, so one "trip" = one delay; numbers in the PR body): the
 * page's own loader asked its questions ONE AFTER ANOTHER — a second auth
 * round trip of its own, the event row, the Drive grant, the Drive config, the
 * camera rates, the tier config, the One tiers, the entitlement client, the
 * catalogue batch, the three self-heals, the uploads seat, the guest count,
 * the snapshot, the guest cameras, the extra cameras, the claim-link seats,
 * the standings — though almost none of them needs another's answer.
 *
 * The rule, in three parts:
 *   (1) the auth gate is the SHARED ask (`getCurrentUser`, cache()d per render
 *       and already made by the dashboard layout), never a second
 *       `supabase.auth.getUser()` of the page's own;
 *   (2) the independent reads are STARTED together, right after that gate, and
 *       none of them is awaited on its own line any more;
 *   (3) what must stay in order STAYS in order — this is what keeps the change
 *       a pure speed-up: the event row's `notFound()` comes before any
 *       self-heal WRITE; the three self-heals run together and are awaited
 *       together; every read that must SEE them (the uploads seat, the extra
 *       cameras, the claim-link seats, the standings) starts only after them,
 *       and the three that count seats start only after the guest sync.
 *   (4) two of the page's own child sections ask their two independent reads
 *       together (the gallery's run of show, the connected Drive panel).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const page = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

/** The loader: from the page function to its JSX. */
function loader(): string {
  const start = page.indexOf('export default async function PapicAddonPage(');
  assert.ok(start > -1, 'the page function was renamed — re-anchor this guard');
  const end = page.indexOf('\n  return (', start);
  assert.ok(end > start, 'the loader lost its end anchor (`return (`)');
  return page.slice(start, end);
}

/** The body of one of the page's own async section components. */
function section(name: string): string {
  const start = page.indexOf(`async function ${name}(`);
  assert.ok(start > -1, `${name} is gone from the page — re-anchor this guard`);
  const end = page.indexOf('\n  return (', start);
  assert.ok(end > start, `${name} lost its end anchor (\`return (\`)`);
  return page.slice(start, end);
}

const at = (body: string, needle: string): number => {
  const i = body.indexOf(needle);
  assert.ok(i > -1, `\`${needle}\` is gone from the loader — re-anchor this guard`);
  return i;
};

test('(1) the gate is the shared auth ask, not a second round trip of the page’s own', () => {
  const body = loader();
  assert.match(body, /const user = await getCurrentUser\(\);\s*if \(!user\) redirect\('\/login'\);/);
  assert.doesNotMatch(body, /auth\.getUser\(\)/, 'the page asks the auth server again — the layout already did, once');
});

test('(2) the independent reads are started together, right after the gate', () => {
  const body = loader();
  const gate = at(body, "if (!user) redirect('/login');");
  const firstAwaitAfterGate = body.indexOf('await ', gate + 1);
  const firstStarted = at(body, 'startRead(');
  assert.ok(firstStarted > gate, 'the reads start before the gate');
  // The block of started reads ends at the first thing the loader waits for after the gate
  // (the store-shell signal is a header read and costs no trip; the event row is next).
  const block = body.slice(gate, at(body, 'await eventRead'));
  assert.ok(firstAwaitAfterGate > -1);
  for (const read of [
    ".from('events')",
    ".from('oauth_grants')",
    'getDriveOAuthConfig()',
    'fetchCameraRates(supabase)',
    'fetchPapicTierConfig(supabase)',
    'fetchPapicOneTiers(supabase)',
    'eventEntitlementClient(eventId)',
    ".from('platform_package_catalog')",
    "ownsSkuRead('PAPIC_UNLOCK')",
    "ownsSkuRead('PAPIC_UNLOCK_LTD')",
    'fetchPlatformSettings(supabase)',
    ".eq('service_code', 'HIGH_RES_ARCHIVE')",
    "ownsSkuRead('HIGH_RES_ARCHIVE')",
    ".eq('service_code', 'CAMERA_BRIDGE')",
    'countLimitedGuests(supabase, eventId)',
    'fetchActiveLimitedSnapshot(supabase, eventId)',
    ".not('guest_id', 'is', null)",
  ]) {
    assert.ok(block.includes(read), `${read} is no longer started with the others, before the event row is awaited`);
  }
  // Nothing in the block is waited for — every one of them is a started read. (The store-shell
  // signal is the one await allowed here: it reads request headers, never the database.)
  const waited = block
    .slice(block.indexOf('startRead('))
    .replace('const appleIap = (await getIapGate()).iap;', '');
  assert.doesNotMatch(waited, /await /, 'a read in the started block is awaited on its own');
});

test('(2) …and nothing in the loader awaits a read on its own line again', () => {
  const body = loader();
  for (const serial of [
    /await supabase\s*\.from\(/,
    /await unlockAdmin\s*\.from\(/,
    /await createAdminClient\(\)\s*\.from\(/,
    /await (getDriveOAuthConfig|fetchCameraRates|fetchPapicTierConfig|fetchPapicOneTiers|fetchPlatformSettings|countLimitedGuests|fetchActiveLimitedSnapshot|readPapicStandings|eventEntitlementClient)\(/,
    /eventSkuActive\(await /,
    /await (provisionFreeCamerasAdmin|provisionUploadsCameraAdmin)\(/,
  ]) {
    assert.doesNotMatch(body, serial, `a read is awaited on its own line again: ${serial}`);
  }
});

test('(3) the order that keeps it a pure speed-up: event check → heals together → reads that see them', () => {
  const body = loader();
  const notFound = at(body, 'if (!event) notFound();');
  const healsStart = at(body, 'const freeCamerasHeal = provisionFreeCamerasAdmin(unlockAdmin, eventId');
  const healsAwait = at(body, 'await Promise.all([freeCamerasHeal, freePoolHeal, uploadsCameraHeal]);');
  assert.ok(notFound < healsStart, 'a self-heal WRITE starts before the event row is confirmed');
  assert.ok(at(body, 'const freePoolHeal = (async () => {') > healsStart);
  assert.ok(at(body, 'const uploadsCameraHeal = provisionUploadsCameraAdmin(unlockAdmin, eventId') < healsAwait);
  // Every started read that must see the heals starts after them.
  for (const after of [
    'const uploadsSeatRead = startRead(',
    'const extraCameraCountRead = startRead(',
    'const claimSeatRowsRead = startRead(',
    'const standingsRead = startRead(readPapicStandings(',
  ]) {
    assert.ok(at(body, after) > healsAwait, `${after} starts before the self-heals it must see`);
  }
  // The three seat counts start only after the guest sync, which can add, revoke and re-tier seats.
  const sync = at(body, 'await syncGuestCameras(');
  for (const after of ['const extraCameraCountRead = startRead(', 'const claimSeatRowsRead = startRead(', 'const standingsRead = startRead(']) {
    assert.ok(at(body, after) > sync, `${after} starts before the guest sync it must see`);
  }
  // A thrown guest-list read still surfaces AFTER the heals ran, as it did when it was asked there.
  assert.ok(at(body, 'const limitedGuestCount = await limitedGuestCountRead;') > healsAwait);
  assert.ok(at(body, 'const limitedSnapshot = await limitedSnapshotRead;') > healsAwait);
  // The SKU questions wait on the ONE entitlement client, not on a fresh ask each.
  assert.match(body, /const ownsSkuRead = \(sku: string\) =>\s*startRead\(entitlementClientRead\.then\(\(ent\) => eventSkuActive\(ent, eventId, sku\)\)\);/);
});

test('(4) the gallery’s run of show and the Drive panel’s two reads travel together', () => {
  const gallery = section('GalleryPreviewCard');
  const started = at(gallery, 'const scheduleBlocksRead = startRead(fetchScheduleBlocks(supabase, eventId));');
  assert.ok(started < at(gallery, 'await Promise.all(['), 'the run of show waits for the photos before it is asked');
  assert.doesNotMatch(gallery, /await fetchScheduleBlocks\(/);
  // …and is still awaited INSIDE the try, so a refused schedule still falls back to the flat grid.
  const tryAt = at(gallery, 'try {');
  assert.ok(at(gallery, 'const blocks = await scheduleBlocksRead;') > tryAt);

  const drive = section('DriveConnectedPanel');
  const second = at(drive, 'const strandedFullRead = startRead(');
  assert.ok(at(drive, 'const overflowGrantRead = startRead(') < second);
  assert.ok(second < at(drive, 'await overflowGrantRead'), 'the stranded-files count waits for the 2nd Drive before it is asked');
  assert.doesNotMatch(drive, /await overflowSupabase\s*\.from\(/);
});
