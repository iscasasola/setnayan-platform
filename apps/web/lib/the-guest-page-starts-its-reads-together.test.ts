/**
 * the-guest-page-starts-its-reads-together.test.ts — ⏩ A READ THAT NEEDS
 * NOTHING FROM ITS NEIGHBOUR DOES NOT WAIT FOR IT, AND THE BODY'S TIME HAS NAMES.
 *
 * Production, 2026-10-08 (one guest page, a real event): 2.2 s to render; its
 * own timing line said `total_ms` ≈ 1,150 with phases summing to ≈ 270. The
 * body was two dozen `await`s in single file, most of them independent, and
 * three quarters of its time belonged to no named phase.
 *
 * Measured on the harness with a 30 ms database round trip (signed-in view,
 * 35 requests before AND after — no read added, none removed):
 *     body total  861–937 ms  →  596–629 ms
 *
 * This holds:
 *   1. `startAhead` — the same promise back, a rejection neither lost nor loud;
 *   2. what is started ahead on the guest page is awaited by the same call, with
 *      the same arguments, further down — and is one of a short allowlist (never
 *      a write, never a read only some viewers get);
 *   3. `ServerTimer.mark` names a stretch, and whatever is left over is SAID
 *      (`unnamed`) instead of being found by subtraction.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { startAhead } from './start-ahead';
import { ServerTimer } from './server-timing';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ═══ 1 · startAhead ═════════════════════════════════════════════════════ */

test('startAhead hands back the SAME promise — the await further down receives exactly what it always did', async () => {
  const p = Promise.resolve({ rows: 3 });
  assert.equal(startAhead(p), p);
  assert.deepEqual(await startAhead(p), { rows: 3 });
});

test('a read that fails before anything awaits it is neither LOUD (no unhandled rejection) nor LOST (the await still throws it)', async () => {
  // 🔎 This runner FAILS a test on an unhandled rejection (measured while writing this: a bare
  // `Promise.reject` left alone for 20 ms failed the test with `failureType: 'unhandledRejection'`) —
  // so reaching the end of this test is itself the proof that `startAhead` kept the rejection quiet.
  const loud: unknown[] = [];
  const onLoud = (e: unknown) => loud.push(e);
  process.on('unhandledRejection', onLoud);
  try {
    const refused = new Error('events read refused');
    const ahead = startAhead(Promise.reject(refused));
    // Other work happens; nothing has awaited `ahead` yet.
    await sleep(20);
    assert.deepEqual(loud, [], 'a read started ahead raised an unhandled rejection');
    // The line that always awaited it still gets the failure — the same error, not a value.
    await assert.rejects(async () => {
      await ahead;
    }, (e) => e === refused);
  } finally {
    process.off('unhandledRejection', onLoud);
  }
});

test('three reads of 40 ms each: in single file ≈ 120 ms, started together ≈ 40 ms — the same three answers', async () => {
  let asked = 0;
  const readOf = (v: string) => {
    asked += 1;
    return sleep(40).then(() => v);
  };
  let t = performance.now();
  const a1 = await readOf('a');
  const b1 = await readOf('b');
  const c1 = await readOf('c');
  const inFile = performance.now() - t;

  t = performance.now();
  const bAhead = startAhead(readOf('b'));
  const cAhead = startAhead(readOf('c'));
  const a2 = await readOf('a');
  const b2 = await bAhead;
  const c2 = await cAhead;
  const together = performance.now() - t;

  assert.deepEqual([a2, b2, c2], [a1, b1, c1]);
  assert.equal(asked, 6, 'starting ahead must not add a read: three and three');
  assert.ok(inFile >= 110, `single file took ${Math.round(inFile)} ms`);
  assert.ok(together < 90, `started together took ${Math.round(together)} ms — they still waited for each other`);
});

/* ═══ 2 · THE GUEST PAGE ═════════════════════════════════════════════════ */

const PAGE = read('app/[slug]/page.tsx');
const LOADERS = read('app/[slug]/_lib/loaders.ts');
const aheadCalls = (src: string) => [...src.matchAll(/startAhead\(\s*([A-Za-z]+)\(/g)].map((m) => m[1]);
const count = (src: string, needle: string) => src.split(needle).length - 1;

test('only these reads are started ahead — each one every path below awaits, none of them a write', () => {
  assert.deepEqual(aheadCalls(PAGE).sort(), ['getCurrentUser', 'loadDoorwayFacts', 'loadEntourage', 'loadWidgets', 'readGuestSession', 'resolveVendorCapability'].sort());
  assert.deepEqual(aheadCalls(LOADERS).sort(), ['eventPapicGuestActive', 'eventStdOpeningsActive', 'loadVenueBookings', 'websiteProActiveFor'].sort());
  // The guest's own facts (their row, their seat, their ticks) are read only past the session checks — never ahead.
  assert.doesNotMatch(PAGE, /startAhead\(\s*(loadGuestContext|findGuestSeatForUser|readSeatHolder|loadSupplierDesk|loadChaptersOnThisDay)\(/);
});

test('a `cache()`d read started ahead is awaited by the SAME call with the SAME arguments — so it is still one read', () => {
  for (const call of [
    'loadWidgets(admin, event.event_id)',
    'loadDoorwayFacts(admin, event.event_id, event.event_type ?? null)',
  ]) {
    assert.equal(count(PAGE, `startAhead(${call})`), 1, `${call} is not started ahead`);
    assert.ok(count(PAGE, call) >= 2, `${call}: the awaited call's arguments differ from the one started ahead — two reads`);
    assert.ok(PAGE.indexOf(`startAhead(${call})`) < PAGE.lastIndexOf(call), `${call} is started after it is awaited`);
  }
  // The entourage's two calls share their arguments by name (the host canvas's drafted style and march are objects).
  assert.equal(count(PAGE, 'startAhead(loadEntourage(admin, event.event_id, draftedNameStyle, draftedMarch))'), 1);
  assert.match(PAGE, /entourage: await loadEntourage\(\s*admin,\s*event\.event_id,\s*draftedNameStyle,\s*draftedMarch,\s*\)/);
  assert.equal(count(PAGE, 'hostDraft?.march?.flat()'), 1, 'the drafted march is flattened twice — two arrays, two reads on the host canvas');
  // The session and the account are asked again where they always were.
  assert.ok(PAGE.indexOf('startAhead(readGuestSession())') < PAGE.indexOf('const session = await readGuestSession();'));
  assert.ok(PAGE.indexOf('startAhead(getCurrentUser())') < PAGE.indexOf('const viewerAccount = await getCurrentUser();'));
});

test('a read that is NOT `cache()`d keeps its promise: started once, awaited once', () => {
  assert.equal(count(PAGE, 'resolveVendorCapability('), 1, 'the supplier check runs twice');
  assert.match(PAGE, /const vendorCapability = await vendorCapabilityAhead;/);
  const MEDIA = LOADERS.slice(LOADERS.indexOf('export const loadMedia = cache('), LOADERS.indexOf('export const loadLiveLayer = cache('));
  const LIVE = LOADERS.slice(LOADERS.indexOf('export const loadLiveLayer = cache('), LOADERS.indexOf('export const loadDoorwayFacts = cache('));
  assert.ok(MEDIA.length > 2000 && LIVE.length > 2000, 'the loaders moved — re-anchor this test');
  for (const [src, name, call] of [
    [MEDIA, 'proWatermarkHiddenAhead', 'websiteProActiveFor(event.event_id)'],
    [MEDIA, 'venueBookingsAhead', 'loadVenueBookings(admin, event.event_id, draftedVenueChoices ?? undefined)'],
    [MEDIA, 'ownsStdRevealAhead', 'eventStdOpeningsActive(admin, event.event_id)'],
    [LIVE, 'hostCameraOpenAhead', 'eventPapicGuestActive(admin, event.event_id)'],
  ] as const) {
    assert.equal(count(src, `const ${name} = startAhead(${call});`), 1, `${name} is not started ahead`);
    assert.equal(count(src, `await ${name};`), 1, `${name} is never awaited — its failure would be swallowed`);
    assert.equal(count(src, call), 1, `${call} is also asked a second time in the same loader`);
  }
});

/* ═══ 3 · THE BODY'S TIME HAS NAMES ══════════════════════════════════════ */

function flushed(run: (t: ServerTimer) => Promise<void>): Promise<{ total_ms: number; phases: Array<{ label: string; ms: number }> }> {
  const info = console.info;
  let line = '';
  console.info = (s: unknown) => {
    line = String(s);
  };
  const t = new ServerTimer('test/route');
  return run(t)
    .then(() => t.flush())
    .then(() => JSON.parse(line.replace('[server-timing] ', '')))
    .finally(() => {
      console.info = info;
    });
}

test('`mark` names everything since the last named stretch, and what is left over is SAID — the phases add up to the total', async () => {
  const out = await flushed(async (t) => {
    await t.track('media', () => sleep(30));
    await sleep(40); // a run of awaits nobody wrapped
    t.mark('gates');
    await sleep(25);
    t.mark('live-layer');
    await sleep(35); // …and a stretch nobody named at all
  });
  const ms = Object.fromEntries(out.phases.map((p) => [p.label, p.ms]));
  assert.deepEqual(out.phases.map((p) => p.label), ['media', 'gates', 'live-layer', 'unnamed']);
  assert.ok(ms.gates! >= 35 && ms.gates! < 80, `gates ${ms.gates}`);
  assert.ok(ms['live-layer']! >= 20 && ms['live-layer']! < 60, `live-layer ${ms['live-layer']}`);
  assert.ok(ms.unnamed! >= 30, `the unnamed stretch was not reported: ${JSON.stringify(out)}`);
  const sum = out.phases.reduce((n, p) => n + p.ms, 0);
  assert.ok(Math.abs(sum - out.total_ms) <= 4, `phases ${sum} ms vs total ${out.total_ms} ms — time is missing`);
});

test('a render with nothing unnamed logs no `unnamed` phase', async () => {
  const out = await flushed(async (t) => {
    await t.track('only', () => sleep(15));
  });
  assert.deepEqual(out.phases.map((p) => p.label), ['only']);
});

test('the guest body marks its long untimed stretches', () => {
  for (const label of ['guest-session', 'gates', 'live-layer', 'capabilities', 'supplier-desk+seat', 'chapters+entourage+identity']) {
    assert.equal(count(PAGE, `timer.mark('${label}');`), 1, `the body no longer names "${label}"`);
  }
});
